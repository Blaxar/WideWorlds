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
   * @param {any} entry - Entry held by the wrapper.
   * @param {string} path - Path the entry resides in.
   */
  constructor(userConfig, entry, path) {
    this.userConfig = userConfig;
    this.entry = entry;
    this.path = path;
  }

  /**
   * Get configuration node from current node
   * @param {string} key - Name of the node.
   * @return {UserConfigNode} Configuration node.
   */
  at(key) {
    if (this.entry[key] === undefined) {
      throw new Error(
          `No configuration entry named '${key}' in ${this.path}`,
      );
    }

    return new UserConfigNode(this.userConfig,
        this.entry[key], `${this.path}.${key}`);
  }

  /**
   * Return the value of the entry
   * @return {any} Value of this entry.
   */
  value() {
    if (typeof this.entry === 'object') {
      throw new Error(
          `${this.path} is not a leaf node`,
      );
    }

    return this.entry;
  }

  /**
   * Set configuration leaf node (value) on current node
   * @param {string} key - Name of the node.
   * @param {any} value - Value to set.
   */
  set(key, value) {
    if (this.entry[key] === undefined ||
        typeof this.entry[key] === 'object' ) {
      throw new Error(
          `No configuration entry named '${key}' in ${this.path}`,
      );
    }

    this.entry[key] = value;
    this.userConfig.save();
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
    if (this.config[key] === undefined) {
      throw new Error(
          `No configuration entry named '${key}' in root config`,
      );
    }

    return new UserConfigNode(this, this.config[key],
        key);
  }
}

export default UserConfig;
export {defaultConfig};
