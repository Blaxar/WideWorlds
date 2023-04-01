/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {qwertyBindings} from './user-input.js';

const defaultConfig = {
  controls: {
    keyBindings: qwertyBindings,
  },
  network: {},
  graphics: {},
  interface: {},
};

/** Wrapper around a configuration entry */
class UserConfigNode {
  /**
   * @constructor
   * @param {UserConfig} userConfig - Core user config holder.
   * @param {any} defaultEntry - Default entry held by the wrapper.
   * @param {any} entry - Entry held by the wrapper.
   * @param {string} path - Path the entry resides in.
   */
  constructor(userConfig, defaultEntry, entry, path) {
    this.userConfig = userConfig;
    this.defaultEntry = defaultEntry;
    this.entry = entry;
    this.path = path;
  }

  /**
   * Get configuration node from current node
   * @param {string} key - Name of the node.
   * @return {UserConfigNode} Configuration node.
   */
  at(key) {
    // Use default config as reference for what is expected
    // in terms of keys
    if (this.defaultEntry[key] === undefined) {
      throw new Error(
          `No configuration entry named '${key}' in ${this.path}`,
      );
    }

    if (this.entry[key] === undefined) {
      // No key yet on this actual entry: initialize it
      // with default values
      this.entry[key] = JSON.parse(JSON.stringify(this.defaultEntry[key]));
    }

    return new UserConfigNode(this.userConfig, this.defaultEntry[key],
        this.entry[key], `${this.path}.${key}`);
  }

  /**
   * Return the value of the entry at the given key
   * @param {string} key - Name of the entry.
   * @return {any} Value of this entry.
   */
  value(key) {
    if (typeof this.defaultEntry[key] === 'object') {
      throw new Error(
          `${this.path} is not a leaf node for this key`,
      );
    }

    if (typeof this.entry[key] !== typeof this.defaultEntry[key]) {
      // Mismatching type for this value: reinitialize it
      this.entry[key] = this.defaultEntry[key];
    }

    return this.entry[key];
  }

  /**
   * Set configuration leaf node (value) on current node
   * @param {string} key - Name of the node.
   * @param {any} value - Value to set.
   */
  set(key, value) {
    // Use default config as reference for what is expected
    // in terms of keys
    if (this.defaultEntry[key] === undefined ||
        typeof this.defaultEntry[key] === 'object' ) {
      throw new Error(
          `No configuration entry named '${key}' in ${this.path}`,
      );
    }

    const entryType = typeof this.entry[key];
    const defaultType = typeof this.defaultEntry[key];

    if (entryType !== defaultType) {
      throw new Error(
          `Mismatchig type for '${key}' in ${this.path}: expected ` +
          `'${defaultType}' but got ${entryType}`,
      );
    }

    if (this.entry[key] === undefined ||
        typeof this.entry[key] === 'object' ) {
      // Mismatching type for this value: reinitialize it
      this.entry[key] = JSON.parse(JSON.stringify(this.defaultEntry[key]));
    }

    this.entry[key] = value;
    this.userConfig.save();
    this.userConfig.fireUpdateEvent(`${this.path}.${key}`, value);
  }

  /**
   * Register a new update listeners for a leaf node key
   * @param {string} key - Key of the configuration entry.
   * @param {function} cb - Callback function to be called on each update.
   */
  onUpdate(key, cb = (value) => {}) {
    // Use default config as reference for what is expected
    // in terms of keys
    if (this.defaultEntry[key] === undefined ||
        typeof this.defaultEntry[key] === 'object' ) {
      throw new Error(
          `No configuration entry named '${key}' in ${this.path}`,
      );
    }

    const path = `${this.path}.${key}`;

    if (!this.userConfig.updateListeners.has(path)) {
      // No listener registered for this path yet
      this.userConfig.updateListeners.set(path, []);
    }

    const listeners = this.userConfig.updateListeners.get(path);
    listeners.push(cb);
  }
}

/** Data holder for client-side user configuration */
class UserConfig {
  /**
   * @constructor
   * @param {string} configKey - Key to store the configuration at.
   * @param {Storage} storage - Storage to hold the config in.
   */
  constructor(configKey = 'config', storage = localStorage) {
    this.configKey = configKey;
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
  }

  /** Reset current configuration to default */
  reset() {
    this.config = JSON.parse(JSON.stringify(defaultConfig));
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

    return new UserConfigNode(this, defaultConfig[key], this.config[key],
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
}

export default UserConfig;
export {defaultConfig};
