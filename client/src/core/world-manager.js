/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {loadAvatarsZip} from '../../../common/avatars-dat-parser.js';
import {getPageName, defaultPageDiameter}
  from '../../../common/terrain-utils.js';
import {makePagePlane, adjustPageEdges} from './utils-3d.js';
import {Vector3, Vector2} from 'three';

const cmToMRatio = 0.01;
const degToRadRatio = Math.PI / 180.0;

const chunkLoadingPattern = [[-1, 1], [0, 1], [1, 1],
  [-1, 0], [0, 0], [1, 0],
  [-1, -1], [0, -1], [1, -1]];

const pageLoadingPattern = [[-1, 1], [0, 1], [1, 1],
  [-1, 0], [0, 0], [1, 0],
  [-1, -1], [0, -1], [1, -1]];

/** Central world-management class, handles chunk loading */
class WorldManager {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Instance of the main 3D engine.
   * @param {WorldPathRegistry} worldPathRegistry - world-path registry for
   *                                                3D assets loading.
   * @param {HttpClient} httpClient - HTTP client managing API requests to
   *                                  the server.
   * @param {integer} chunkSide - Chunk side length (in centimeters).
   * @param {number} textureUpdatePeriod - Amount of time (in seconds) to wait
   *                                       before moving animated textures to
   *                                       their next frame.
   */
  constructor(engine3d, worldPathRegistry, httpClient, chunkSide = 20 * 100,
      textureUpdatePeriod = 0.20) {
    this.engine3d = engine3d;
    this.worldPathRegistry = worldPathRegistry;
    this.httpClient = httpClient;
    this.textureUpdatePeriod = textureUpdatePeriod; // In seconds
    this.currentWorld = null;
    this.currentModelRegistry = null;
    this.currentTerrainMaterials = [];

    // Props handling
    this.chunkSide = chunkSide; // In centimeters
    this.chunks = new Map();
    this.props = new Map();

    // Terrain handling
    this.pages = new Map();
    this.pageData = new Map(); // Stores elevation and texture data
    this.terrainMaterials = new Map();

    this.lastTextureUpdate = 0;
    this.sprites = [];
    this.cameraDirection = new Vector3();
    this.xzDirection = new Vector2();
    this.terrainEnabled = false;
  }

  /**
   * Takes in a world json description, parse it and set the 3D scene
   * accordingly
   * @param {world} world - World data object.
   * @return {Promise} Promise of an object describing the content of
   *                   the parsed avatars.dat file for this world.
   */
  async load(world) {
    if (this.currentWorld) this.unload();

    this.currentWorld = world;
    const data = JSON.parse(world.data);

    // Fetch all the sky colors from the world data, normalize them
    // between 0.0 and 1.0
    this.engine3d.setSkyColors([
      ...data.skyColors.north,
      ...data.skyColors.east,
      ...data.skyColors.south,
      ...data.skyColors.west,
      ...data.skyColors.top,
      ...data.skyColors.bottom,
    ].map((c) => c / 255.0));
    this.engine3d.setSkyColorSpinning(false);

    if (data.enableFog) {
      this.engine3d.setFog(data.fogColor, data.fogMinimum, data.fogMaximum);
    } else {
      this.engine3d.resetFog();
    }
    this.engine3d.setAmbientLight(
        data.ambientColor, data.ambientLightIntensity);
    this.engine3d.setDirectionalLight(
        data.directionalColors, data.dirLightIntensity,
        {x: data.dirLightPos[0],
          y: data.dirLightPos[1],
          z: data.dirLightPos[2],
        });

    this.terrainEnabled = data.enableTerrain;

    if (!data.path) throw new Error('Missing path field from world data json');

    this.currentModelRegistry = await this.worldPathRegistry.get(data.path);
    this.currentTerrainMaterials =
        this.worldPathRegistry.getTerrainMaterials(data.path);

    if (data.skybox) {
      const model = await this.currentModelRegistry
          .getBasic(`${data.skybox}.rwx`);
      this.engine3d.setSkyBox(model);
    }

    try {
      // TODO: customizable avatars.zip subpath and CORS disabling?
      const res =
          await loadAvatarsZip(`${data.path}/avatars/avatars.zip`, true);
      return res.avatars;
    } catch (e) {
      console.error(e);
    }

    return [];
  }

  /** Clear current world data, reset engine3d state and chunks */
  unload() {
    this.currentWorld = null;
    this.currentModelRegistry = null;
    this.engine3d.setCameraDistance(0);
    this.engine3d.clearEntities();
    this.engine3d.resetSkyColors();
    this.engine3d.resetFog();
    this.engine3d.resetAmbientLight();
    this.engine3d.resetDirectionalLight();
    this.engine3d.resetSkyBox();
    this.engine3d.resetUserAvatar();
    this.engine3d.setSkyColorSpinning(true);
    this.clearChunks();
    this.clearPages();
    this.lastTextureUpdate = 0;
    this.sprites = [];
    this.cameraDirection.set(0, 0, 0);
    this.xzDirection.set(0, 0);
    this.terrainEnabled = false;
  }

  /** Clear all chunks */
  clearChunks() {
    for (const handle of this.chunks.values()) {
      this.engine3d.removeNode(handle);
    }

    this.props.clear();
    this.chunks.clear();
  }

  /** Clear all pages */
  clearPages() {
    for (const handle of this.pages.values()) {
      this.engine3d.removeNode(handle);
    }

    this.pages.clear();
  }

  /**
   * Load necessary chunks and various elements based on the provided position
   * @param {Vector3} pos - Position, surronding chunks will be loaded.
   * @param {number} delta - Elapsed number of seconds since last update.
   */
  update(pos, delta = 0) {
    if (!(this.currentWorld && this.currentModelRegistry)) return;

    if (this.lastTextureUpdate > this.textureUpdatePeriod) {
      this.currentModelRegistry.texturesNextFrame();
      this.lastTextureUpdate = 0;
    } else {
      this.lastTextureUpdate += delta;
    }

    // Compute the direction (XZ plane) the camera is facing to
    this.engine3d.camera.getWorldDirection(this.cameraDirection);
    this.xzDirection.set(this.cameraDirection.x, this.cameraDirection.z);
    const facingAngle = - this.xzDirection.angle() - Math.PI / 2;

    for (const sprite of this.sprites) {
      sprite.rotation.set(0, facingAngle, 0);
      sprite.updateMatrix();
    }

    const cX = Math.floor(pos.x / (this.chunkSide * cmToMRatio) + 0.5);
    const cZ = Math.floor(pos.z / (this.chunkSide * cmToMRatio) + 0.5);
    const pX = Math.floor(pos.x / (defaultPageDiameter * 10) + 0.5);
    const pZ = Math.floor(pos.z / (defaultPageDiameter * 10) + 0.5);

    for (const [x, z] of chunkLoadingPattern) {
      this.loadChunk(cX + x, cZ + z);
    }

    if (!this.terrainEnabled) return;

    // Unlike chunks, pages cannot be loaded independently so trivially,
    // for the simple reason there are borders to sync up, so it's easier to do
    // them one at a time to adjust the heights of points at the edges
    (async () => {
      for (const [x, z] of pageLoadingPattern) {
        await this.loadPage(pX + x, pZ + z);
      }
    })();
  }

  /**
   * Load a single prop chunk, return right away if already loaded
   * @param {integer} x - Index of the chunk on the X axis.
   * @param {integer} z - Index of the chunk on the Z axis.
   */
  async loadChunk(x, z) {
    const chunkId = `${x}_${z}`;
    if (this.chunks.has(chunkId)) return;

    await this.reloadChunk(x, z);
  }

  /**
   * Load a single terrain page, return right away if already loaded
   * @param {integer} pageX - Index of the page on the X axis.
   * @param {integer} pageZ - Index of the page on the Z axis.
   */
  async loadPage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);
    if (this.pages.has(pageName)) return;

    await this.reloadPage(pageX, pageZ);
  }

  /**
   * Get a 3D avatar asset from the current world registry
   * @param {string} name - Name of the 3D asset for the avatar.
   * @return {Promise} Promise of a three.js 3D asset.
   */
  async getAvatar(name) {
    const modelRegistry = this.currentModelRegistry;

    return await modelRegistry.getAvatar(name);
  }

  /**
   * Reload a single prop chunk no matter what
   * @param {integer} x - Index of the chunk on the X axis.
   * @param {integer} z - Index of the chunk on the Z axis.
   */
  async reloadChunk(x, z) {
    const chunkId = `${x}_${z}`;

    if (this.chunks.has(chunkId)) {
      // The chunk is already there: this is a reload scenario
      this.engine3d.removeNode(this.chunks.get(chunkId));
      this.chunks.remove(chunkId);
    }

    const chunkPos = [x * this.chunkSide * cmToMRatio, 0,
      z * this.chunkSide * cmToMRatio];
    const chunkNodeHandle = this.engine3d.spawnNode(...chunkPos);
    this.chunks.set(`${x}_${z}`, chunkNodeHandle);

    const halfChunkSide = this.chunkSide / 2;
    const chunk = await this.httpClient.getProps(this.currentWorld.id,
        x * this.chunkSide - halfChunkSide,
        (x + 1) * this.chunkSide - halfChunkSide,
        null, null, // We set no limit on the vertical (y) axis
        z * this.chunkSide - halfChunkSide,
        (z + 1) * this.chunkSide - halfChunkSide);

    const modelRegistry = this.currentModelRegistry;

    for (const prop of chunk) {
      const obj3d = await modelRegistry.get(prop.name);
      obj3d.position.set(prop.x * cmToMRatio - chunkPos[0],
          prop.y * cmToMRatio,
          prop.z * cmToMRatio - chunkPos[2]);

      obj3d.rotation.set(prop.pitch * degToRadRatio / 10,
          prop.yaw * degToRadRatio / 10,
          prop.roll * degToRadRatio / 10,
          'YZX');

      obj3d.userData.action = prop?.action;
      obj3d.userData.description = prop?.description;

      if (obj3d.userData.rwx?.axisAlignment !== 'none') {
        this.sprites.push(obj3d);
      }

      try {
        modelRegistry.applyActionString(obj3d, prop.action);
      } catch (e) {
        console.error(e);
      }

      if (!this.engine3d.appendToNode(chunkNodeHandle, obj3d)) {
        // Could not append object to node, meaning node (chunk) no
        // longer exists, we just silently cancel the whole loading.
        return;
      }

      obj3d.matrixAutoUpdate = false;
      obj3d.updateMatrix();
      this.props.set(prop.id, obj3d);
    }
  }

  /**
   * Reload a single terrain page no matter what
   * @param {integer} pageX - Index of the page on the X axis.
   * @param {integer} pageZ - Index of the page on the Z axis.
   */
  async reloadPage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);

    if (this.pages.has(pageName)) {
      // The page is already there: this is a reload scenario
      this.engine3d.removeNode(this.pages.get(pageName));
      this.pages.remove(pageName);
    }

    if (this.pageData.has(pageName)) {
      // Same here
      this.pageData.remove(pageName);
    }

    const pagePos = [pageX * defaultPageDiameter * 10, 0,
      pageZ * defaultPageDiameter * 10];
    const pageNodeHandle = this.engine3d.spawnNode(...pagePos);
    this.pages.set(pageName, pageNodeHandle);

    this.pageData.set(pageName,
        await this.httpClient.getPage(this.currentWorld.id,
            pageX, pageZ));

    const {elevationData, textureData} = this.pageData.get(pageName);

    const pagePlane = makePagePlane(elevationData, textureData,
        defaultPageDiameter * 10, defaultPageDiameter,
        this.currentTerrainMaterials, 'page');

    // Get surrounding planes, falsy if not ready yet
    const left = this.engine3d.getFromNodeByName(
        this.pages.get(getPageName(pageX - 1, pageZ)),
        'page',
    );
    const topLeft = this.engine3d.getFromNodeByName(
        this.pages.get(getPageName(pageX - 1, pageZ - 1)),
        'page',
    );
    const top = this.engine3d.getFromNodeByName(
        this.pages.get(getPageName(pageX, pageZ - 1)),
        'page',
    );
    const right = this.pageData
        .get(getPageName(pageX + 1, pageZ))?.elevationData;
    const bottomRight = this.pageData
        .get(getPageName(pageX + 1, pageZ + 1))?.elevationData;
    const bottom = this.pageData
        .get(getPageName(pageX, pageZ + 1))?.elevationData;

    // WIP: Adjust borders to match surrounding planes
    adjustPageEdges(pagePlane, elevationData, left, topLeft, top, right,
        bottomRight, bottom);

    if (!this.engine3d.appendToNode(pageNodeHandle, pagePlane)) {
      // Could not append object to node, meaning node (page) no
      // longer exists, we just silently cancel the whole loading.
      return;
    }
  }
}

export default WorldManager;
