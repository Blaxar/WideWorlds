/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {qwertyBindings} from './user-input.js';

// In meters
const renderingDistance = {
  min: 20,
  max: 2000,
  default: 40,
  step: 20,
};

// In meters
const propsLoadingDistance = {
  min: 40,
  max: 2000,
  default: 60,
  step: 20,
};

const defaultConfig = {
  controls: {
    keyBindings: qwertyBindings,
    runByDefault: false,
  },
  network: {
    imageService: 'https://images.weserv.nl/?url=',
  },
  graphics: {
    renderingDistance: renderingDistance.default,
    propsLoadingDistance: propsLoadingDistance.default,
  },
  interface: {},
};

/** Wrapper around a configuration entry */
class UserConfigNode {
  /**
   * @constructor
   * @param {UserConfig} userConfig - Core user config holder.
   * @param {UserConfigNode} parent - Parent config node.
   * @param {any} defaultEntry - Default entry held by the wrapper.
   * @param {string} key - Key name of this entry.
   */
  constructor(userConfig, parent, defaultEntry, key) {
    this.userConfig = userConfig;
    this.parent = parent;
    this.defaultEntry = defaultEntry;
    this.key = key;
  }

  /**
   * Get raw configuration entry for this node
   * @return {any} Raw configuation entry of this node.
   */
  entry() {
    return this.userConfig.getEntryFromPath(this.path());
  };

  /**
   * Get absolute configuration path for this node
   * @return {string} Absolute configuration path.
   */
  path() {
    const nodes = [];
    let currentNode = this;

    while (currentNode) {
      nodes.push(currentNode.key);
      currentNode = currentNode.parent;
    };

    return `.${nodes.reverse().join('.')}`;
  };

  /**
   * Get configuration node from current node
   * @param {string} key - Name of the node.
   * @return {UserConfigNode} Configuration node.
   */
  at(key) {
    const entry = this.entry();

    // Use default config as reference for what is expected
    // in terms of keys
    if (this.defaultEntry[key] === undefined) {
      throw new Error(
          `No configuration entry named '${key}' in ${this.path()}`,
      );
    }

    if (entry[key] === undefined) {
      // No key yet on this actual entry: initialize it
      // with default values
      entry[key] = JSON.parse(JSON.stringify(this.defaultEntry[key]));
    }

    return new UserConfigNode(this.userConfig, this, this.defaultEntry[key],
        key);
  }

  /**
   * Return the value of the entry at the given key
   * @return {any} Value of this entry.
   */
  value() {
    const entry = this.entry();

    if (typeof entry === 'object') {
      throw new Error(
          `${this.path()} is not a leaf node for this key`,
      );
    }

    return entry;
  }

  /**
   * Set configuration leaf node (value) on current node
   * @param {any} value - Value to set.
   */
  set(value) {
    const path = this.path();
    const entry = this.entry();
    const parentEntry = this.parent.entry();

    // Use default config as reference for what is expected
    // in terms of keys
    if (this.parent.entry() === undefined ||
        typeof this.defaultEntry === 'object') {
      throw new Error(
          `No configuration leaf named '${this.key}' in ${path}`,
      );
    }

    if (entry === undefined || typeof entry === 'object') {
      // Mismatching type for this value: reinitialize it
      parentEntry[this.key] =
        JSON.parse(JSON.stringify(this.defaultEntry));
    }

    parentEntry[this.key] = value;
    this.userConfig.save();
    this.userConfig.fireUpdateEvent(`${path}`, value);
  }

  /**
   * Reset the value(s) for this node
   */
  reset() {
    const path = this.path();
    const parentEntry = this.parent.entry();

    // Use default config as reference for what is expected
    // in terms of keys
    if (parentEntry === undefined) {
      throw new Error(
          `No configuration entry named '${this.key}' in ${path}`,
      );
    }

    parentEntry[this.key] =
      JSON.parse(JSON.stringify(this.defaultEntry));

    this.userConfig.save();

    // Notify invoved listeners that the configuration has been updated
    for (const [p, listeners] of this.userConfig.updateListeners) {
      if (!p.startsWith(path)) continue;

      for (const listener of listeners) {
        listener(this.userConfig.getNodeFromPath(p).value());
      }
    }
  }

  /**
   * Get the default value for this leaf node
   * @return {any} Default value of this node.
   */
  defaultValue() {
    const entry = this.entry();

    if (typeof entry === 'object') {
      throw new Error(
          `${this.path()} is not a leaf node for this key`,
      );
    }

    return this.defaultEntry;
  }

  /**
   * Register a new update listeners for this node
   * @param {function} cb - Callback function to be called on each update.
   */
  onUpdate(cb) {
    const path = this.path();

    // Use default config as reference for what is expected
    // in terms of keys
    if (this.defaultEntry === undefined ||
        typeof this.defaultEntry === 'object' ) {
      throw new Error(
          `No configuration value at '${path}`,
      );
    }

    if (!this.userConfig.updateListeners.has(path)) {
      // No listener registered for this path yet
      this.userConfig.updateListeners.set(path, []);
    }

    const listeners = this.userConfig.updateListeners.get(path);
    listeners.push(cb);
  }

  /**
   * Unregister all update listeners from this node
   */
  clearListeners() {
    const path = this.path();

    // Use default config as reference for what is expected
    // in terms of keys
    if (this.defaultEntry === undefined ||
        typeof this.defaultEntry === 'object' ) {
      throw new Error(
          `No configuration value at '${path}`,
      );
    }

    if (!this.userConfig.updateListeners.has(path)) {
      // No listener registered for this path yet
      this.userConfig.updateListeners.set(path, []);
    }

    this.userConfig.updateListeners.set(path, []);
  }
}

/** Data holder for client-side user configuration */
class UserConfig {
  /**
   * @constructor
   * @param {string} configKey - Key to store the configuration at.
   * @param {function} onLoad - Callback on configuration loading.
   * @param {Storage} storage - Storage to hold the config in.
   */
  constructor(configKey = 'config', onLoad = (config) => {},
      storage = localStorage) {
    this.configKey = configKey;
    this.onLoad = onLoad;
    this.storage = storage;
    this.config = {};
    this.updateListeners = new Map();
    this.load();
    this.save();
  }

  /** Save current configuration to storage */
  save() {
    this.storage.setItem(this.configKey, JSON.stringify(this.config));
  }

  /** Load current configuration from storage */
  load() {
    const configJson = this.storage.getItem(this.configKey);

    if (configJson) {
      this.config = JSON.parse(configJson);
    } else {
      this.reset();
    }

    this.onLoad(JSON.parse(JSON.stringify(this.config)));
  }

  /** Reset current configuration to the default one */
  reset() {
    this.config = JSON.parse(JSON.stringify(defaultConfig));

    // Notify all listeners that the configuration has been updated
    for (const [path, listeners] of this.updateListeners) {
      for (const listener of listeners) {
        listener(this.getNodeFromPath(path).value());
      }
    }
  }

  /**
   * Get configuration node
   * @param {string} key - Name of the node.
   * @return {UserConfigNode} Configuration node.
   */
  at(key) {
    if (defaultConfig[key] === undefined) {
      throw new Error(
          `No configuration entry named '${key}' in root config`,
      );
    }

    if (this.config[key] === undefined) {
      // No key yet on this config: initialize it with default values
      this.config[key] = JSON.parse(JSON.stringify(defaultConfig[key]));
    }

    return new UserConfigNode(this, null, defaultConfig[key],
        key);
  }

  /**
   * Call all registered update listeners for a given configuration
   * leaf node path
   * @param {string} path - Path string of the configuration leaf node.
   * @param {any} value - Value to propagate to the listeners.
   */
  fireUpdateEvent(path, value) {
    if (!this.updateListeners.has(path)) return;

    const listeners = this.updateListeners.get(path);

    for (const listener of listeners) {
      listener(value);
    }
  }

  /**
   * Get a configuration node from its absolute path
   * @param {string} path - Configuration path of the node.
   * @return {UserConfigNode} Configuration node.
   */
  getNodeFromPath(path) {
    if (path[0] !== '.') {
      throw new Error(
          `Configuration path must start with a dot ('.')`,
      );
    }

    const tokens = path.slice(1).split('.');

    if (tokens.length < 1) {
      throw new Error('Invalid configuration path provided');
    }

    let currentNode = this;
    const nodes = tokens.slice(0, -1);
    const key = tokens.slice(-1)[0];

    for (const node of nodes) {
      currentNode = currentNode.at(node);
    }

    return currentNode.at(key);
  }

  /**
   * Get raw configuration entry from its absolute path
   * @param {string} path - Configuration path of the entry.
   * @return {any} Raw configuration entry value.
   */
  getEntryFromPath(path) {
    if (path[0] !== '.') {
      throw new Error(
          `Configuration path must start with a dot ('.')`,
      );
    }

    const tokens = path.slice(1).split('.');

    if (tokens.length < 1) {
      throw new Error('Invalid configuration path provided');
    }

    let currentNode = this.config;

    for (const token of tokens) {
      currentNode = currentNode[token];
    }

    return currentNode;
  }
}

export default UserConfig;
export {defaultConfig, renderingDistance, propsLoadingDistance};
