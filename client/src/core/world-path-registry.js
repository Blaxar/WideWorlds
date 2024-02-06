/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import ModelRegistry from './model-registry.js';
import {generateTerrainMaterials} from './terrain-utils.js';

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
   * @param {string} modelPath - Catalogue folder holding 3D assets.
   * @param {string} resourcePath - Catalogue folder holding textures.
   * @param {UserConfigNode} imageServiceNode - Configuration node for
   *                                            the image service.
   * @param {rasterizeHTML} rasterizeHTML - Instance of rasterizeHTML.
   * @param {UserConfigNode} htmlSignRenderingNode - Configuration node for
   *                                                 HTML sign rendering.
   */
  constructor(loadingManager, modelPath = 'rwx',
      resourcePath = 'textures', imageServiceNode = null,
      rasterizeHTML = null, htmlSignRenderingNode = null) {
    this.modelRegistries = new Map();
    this.terrainMaterials = new Map();
    this.loadingManager = loadingManager;
    this.modelPath = modelPath;
    this.resourcePath = resourcePath;
    this.imageServiceNode = imageServiceNode;
    this.rasterizeHTML = rasterizeHTML;
    this.htmlSignRenderingNode = htmlSignRenderingNode;
  }

  /**
   * Get model registry for this world path, create it beforehand if needed
   * @param {string} path - Path to the remote asset catalogue.
   * @return {Promise} Promise of a ModelRegistry.
   */
  async get(path) {
    if (!this.modelRegistries.has(path)) {
      this.modelRegistries.set(path, new ModelRegistry(this.loadingManager,
          `${path}/${this.modelPath}`, `${path}/${this.resourcePath}`,
          this.imageServiceNode, this.rasterizeHTML,
          this.htmlSignRenderingNode));
    }

    return await this.modelRegistries.get(path);
  }

  /**
   * Get all possible terrain tile textures
   * @param {string} path - Path to the folder holding terrain textures
   * @return {Array<Array<Material>>} Array of arrays: 4 rotation
   *                                  variations for each texture
   */
  getTerrainMaterials(path) {
    if (!this.terrainMaterials.has(path)) {
      this.terrainMaterials.set(path,
          generateTerrainMaterials(
              `${path}/${this.resourcePath}`,
          ),
      );
    }

    return this.terrainMaterials.get(path);
  }

  /** Clear all model registries */
  clear() {
    this.modelRegistries.clear();
  }
}

export default WorldPathRegistry;
