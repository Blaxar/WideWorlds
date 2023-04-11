/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import ModelRegistry from './model-registry.js';

/**
 * Manager of model registries associated to different worlds,
 * a given registry is only instanciated when asked for the first
 * time, any following request for the same registry will return
 * the same instance, this avoids loading 3D assets twice even when
 * going back and forth between worlds.
 */
class WorldPathRegistry {
  /**
   * @constructor
   * @param {LoadingManager} loadingManager - three.js loading manager.
   * @param {UserConfigNode} imageServiceNode - Configuration node for
   *                                            the image service.
   * @param {string} modelPath - Catalogue folder holding 3D assets.
   * @param {string} resourcePath - Catalogue folder holding textures.
   */
  constructor(loadingManager, imageServiceNode, modelPath = 'rwx',
      resourcePath = 'textures') {
    this.modelRegistries = new Map();
    this.loadingManager = loadingManager;
    this.imageServiceNode = imageServiceNode;
    this.modelPath = modelPath;
    this.resourcePath = resourcePath;
  }

  /**
   * Get model registry for this world path, create it beforehand if needed
   * @param {string} path - Path to the remote asset catalogue.
   * @return {Promise} Promise of a ModelRegistry.
   */
  async get(path) {
    if (!this.modelRegistries.has(path)) {
      this.modelRegistries.set(path, new ModelRegistry(this.loadingManager,
          this.imageServiceNode, `${path}/${this.modelPath}`,
          `${path}/${this.resourcePath}`));
    }

    return await this.modelRegistries.get(path);
  }

  /** Clear all model registries */
  clear() {
    this.modelRegistries.clear();
  }
}

export default WorldPathRegistry;
