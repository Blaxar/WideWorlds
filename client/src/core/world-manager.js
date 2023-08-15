/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {loadAvatarsZip} from '../../../common/avatars-dat-parser.js';
import {getPageName, defaultPageDiameter}
  from '../../../common/terrain-utils.js';
import {makePagePlane, adjustPageEdges}
  from './utils-3d.js';
import {Vector3, Vector2, Color} from 'three';

const defaultChunkLoadingPattern = [[-1, 1], [0, 1], [1, 1],
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
   * @param {HttpClient} wsClient - WS client for listening to world update
   *                                events coming from the server.
   * @param {UserConfigNode} propsLoadingNode - Configuration node for the
   *                                            props loading distance.
   * @param {integer} chunkSide - Chunk side length (in meters).
   * @param {number} textureUpdatePeriod - Amount of time (in seconds) to wait
   *                                       before moving animated textures to
   *                                       their next frame.
   */
  constructor(engine3d, worldPathRegistry, httpClient, wsClient,
      propsLoadingNode = null, chunkSide = 20, textureUpdatePeriod = 0.20) {
    this.chunkLoadingPattern = defaultChunkLoadingPattern;
    this.engine3d = engine3d;
    this.worldPathRegistry = worldPathRegistry;
    this.httpClient = httpClient;
    this.wsClient = wsClient;
    this.textureUpdatePeriod = textureUpdatePeriod; // In seconds
    this.currentWorld = null;
    this.currentModelRegistry = null;
    this.currentWorldUpdateClient = null;
    this.currentTerrainMaterials = [];

    // Props handling
    this.chunkSide = chunkSide; // In meters
    this.chunks = new Map();
    this.props = new Map();

    // Terrain handling
    this.pages = new Map();
    this.pageData = new Map(); // Stores elevation and texture data
    this.terrainMaterials = new Map();

    this.lastTextureUpdate = 0;
    this.sprites = new Map();
    this.cameraDirection = new Vector3();
    this.xzDirection = new Vector2();
    this.terrainEnabled = false;
    this.terrainElevationOffset = 0.0; // In meters
    this.previousCX = this.previousCZ = null;

    if (propsLoadingNode) {
      // Ready props loading distance and its update callback
      const propsLoadingDistance = parseInt(propsLoadingNode.value());
      this.updateChunkLoadingPattern(propsLoadingDistance);
      propsLoadingNode.onUpdate((value) => {
        this.updateChunkLoadingPattern(parseInt(value));
        this.previousCX = this.previousCZ = null;
      });
    }
  }

  /**
   * Update the chunk loading pattern
   * @param {integer} radius - Radius of chunks to load (in meters).
   */
  updateChunkLoadingPattern(radius) {
    const chunkLoadingPattern = [];
    const chunkRadius =
        Math.floor(radius / (this.chunkSide) + 0.5);

    for (let x = - chunkRadius; x < chunkRadius + 1; x++) {
      for (let z = - chunkRadius; z < chunkRadius + 1; z++) {
        // Do not add chunk coordinates to the pattern if they fall
        // out of the radius/distance
        if (x * x + z * z > chunkRadius * chunkRadius) continue;

        chunkLoadingPattern.push([x, z]);
      }
    }

    // Load closest chunks first
    chunkLoadingPattern.sort((first, second) => {
      return (first[0] * first[0] + first[1] * first[1]) -
        (second[0] * second[0] + second[1] * second[1]);
    });

    this.chunkLoadingPattern = chunkLoadingPattern;
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
      const fogColor = new Color('#' + data.fogColor);
      this.engine3d.setFog(fogColor, data.fogMinimum, data.fogMaximum);
    } else {
      this.engine3d.resetFog();
    }

    const ambientColor = new Color('#' + data.ambientColor);
    this.engine3d.setAmbientLight(
        ambientColor);

    const directionalColor = new Color('#' + data.directionalColor);
    this.engine3d.setDirectionalLight(
        directionalColor,
        // Note: AW stores the world directional light position
        //       based on flipped axis instead of the expected
        //       ones:
        //       - North to South instead of South to North
        //       - West to East instead of East to West
        //       - Up to Down instead of Down to Up
        new Vector3(
            -data.dirLightPos[0],
            -data.dirLightPos[1],
            -data.dirLightPos[2],
        ),
    );

    this.terrainEnabled = data.enableTerrain;
    this.terrainElevationOffset = data.terrainElevationOffset ?
        data.terrainElevationOffset : 0.0;

    if (!data.path) throw new Error('Missing path field from world data json');

    this.currentModelRegistry = await this.worldPathRegistry.get(data.path);
    this.currentWorldUpdateClient =
        await this.wsClient.worldUpdateConnect(world.id);

    this.currentWorldUpdateClient.onMessage(async (entries) => {
      if (entries.op === 'update') {
        for (const value of entries.data) {
          const {cX, cZ} = this.getChunkCoordinates(value.x, value.z);

          if (this.isChunkLoaded(cX, cZ)) {
            // Only update props on already-loaded chunks
            if (this.props.has(value.id)) {
              // Remove original object
              const oldObj3d = this.props.get(value.id);
              oldObj3d.removeFromParent();

              // Remove it from the sprites list (when applicable)
              this.sprites.delete(value.id);

              // Spawn a new one of the same type and update it
              const newObj3d = await this.currentModelRegistry
                  .get(oldObj3d.userData.prop.name);
              newObj3d.userData.rwx = oldObj3d.userData.rwx;

              this.updateAssetFromProp(newObj3d, value);
            }
          }
        }
      }
    });

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
    this.currentWorldUpdateClient?.close();
    this.currentWorldUpdateClient = null;
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
    this.engine3d.unsetHelperArrows();
    this.engine3d.removeAllHelperObjects();
    this.clearChunks();
    this.clearPages();
    this.lastTextureUpdate = 0;
    this.sprites.clear();
    this.cameraDirection.set(0, 0, 0);
    this.xzDirection.set(0, 0);
    this.terrainEnabled = false;
    this.terrainElevationOffset = 0.0;
    this.previousCX = this.previousCZ = null;
  }

  /**
   * Get tile-space coordinates of a chunk covering a real-space position
   * @param {number} x - Position along the X axis (in meters).
   * @param {number} z - Position along the Z axis (in meters).
   * @return {Object} Object holding {cX, cZ}, respectively tile coordinates
   *                  for the X and the Z axis
   */
  getChunkCoordinates(x, z) {
    const cX = Math.floor(x / (this.chunkSide) + 0.5);
    const cZ = Math.floor(z / (this.chunkSide) + 0.5);

    return {cX, cZ};
  }

  /**
   * Get tile-space coordinates of a page covering a real-space position
   * @param {number} x - Position along the X axis (in meters).
   * @param {number} z - Position along the Z axis (in meters).
   * @return {Object} Object holding {cX, cZ}, respectively tile coordinates
   *                  for the X and the Z axis
   */
  getPageCoordinates(x, z) {
    const pX = Math.floor(x / (defaultPageDiameter * 10) + 0.5);
    const pZ = Math.floor(z / (defaultPageDiameter * 10) + 0.5);

    return {pX, pZ};
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
    this.pageData.clear();
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

    this.sprites.forEach((sprite) => {
      sprite.rotation.set(0, facingAngle, 0);
      sprite.updateMatrix();
    });

    const {cX, cZ} = this.getChunkCoordinates(pos.x, pos.z);
    const {pX, pZ} = this.getPageCoordinates(pos.x, pos.y);

    if (this.previousCX !== cX || this.previousCZ !== cZ) {
      const lodCamera = this.engine3d.camera.clone();
      lodCamera.position.setY(0.0);
      this.engine3d.updateLODs(this.chunks, lodCamera);
    }

    this.previousCX = cX;
    this.previousCZ = cZ;

    for (const [x, z] of this.chunkLoadingPattern) {
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
   * Tell if a given chunk is already loaded
   * @param {integer} x - Index of the chunk on the X axis.
   * @param {integer} z - Index of the chunk on the Z axis.
   * @return {boolean} True if chunk is loaded, false otherwise.
   */
  isChunkLoaded(x, z) {
    const chunkId = `${x}_${z}`;
    return this.chunks.has(chunkId);
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
   * Get chunk center pos in real-space coordinates, along with
   * its corresponding 3D node in the engine (will create one if
   * none yet)
   * @param {integer} cX - Index of the chunk on the X axis.
   * @param {integer} cZ - Index of the chunk on the Z axis.
   * @return {Object} Object holding chunk position and node handler.
   */
  getChunkAnchor(cX, cZ) {
    const chunkPos = new Vector3(cX * this.chunkSide, 0,
        cZ * this.chunkSide);

    let chunkNodeHandle = this.chunks.get(`${cX}_${cZ}`);

    if (chunkNodeHandle === undefined) {
      chunkNodeHandle =
        this.engine3d.spawnNode(chunkPos.x, chunkPos.y, chunkPos.z,
            true);
      this.chunks.set(`${cX}_${cZ}`, chunkNodeHandle);
    }

    return {chunkPos, chunkNodeHandle};
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

    const chunkAnchor = this.getChunkAnchor(x, z);

    const halfChunkSide = this.chunkSide / 2;
    const chunk = await this.httpClient.getProps(this.currentWorld.id,
        x * this.chunkSide - halfChunkSide,
        (x + 1) * this.chunkSide - halfChunkSide,
        null, null, // We set no limit on the vertical (y) axis
        z * this.chunkSide - halfChunkSide,
        (z + 1) * this.chunkSide - halfChunkSide);

    const modelRegistry = this.currentModelRegistry;

    for (const prop of chunk) {
      // Cancel any pending loading if the chunk has been removed
      // or the world has been unloaded
      if (!modelRegistry || !this.isChunkLoaded(x, z)) break;

      const obj3d = await modelRegistry.get(prop.name);

      this.updateAssetFromProp(obj3d, prop, chunkAnchor);
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
    pagePlane.position.setY(this.terrainElevationOffset);

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

    adjustPageEdges(pagePlane, elevationData, left, topLeft, top, right,
        bottomRight, bottom, defaultPageDiameter);

    this.engine3d.appendToNode(pageNodeHandle, pagePlane);
  }

  /**
   * Update props on the server
   * @param {Array<Prop>} props - Staged props to update.
   * @return {Array<Prop>} - Original props to revert in case of
   *                         failure.
   */
  async updateProps(props) {
    const propsToBeReset = [];

    if (!props.length) return propsToBeReset;

    const propsData = {};

    for (const prop of props) {
      propsData[prop.userData.prop.id] = prop.userData.prop;
    }

    const results = await this.httpClient.putProps(
        this.currentWorld.id, propsData,
    );

    for (const [key, value] of Object.entries(results)) {
      const id = parseInt(key);

      if (value !== true && this.props.has(id)) {
        propsToBeReset.push(this.props.get(id));
      }
    }

    return propsToBeReset;
  }

  /**
   * Update three.js Object3D position, rotation and metadata based on
   * provided prop description object
   * @param {Object3D} obj3d - 3D asset to update.
   * @param {Prop} prop - Object describing a prop.
   * @param{Object} chunkAnchor - Object holding chunk position and node
   *                              handler.
   */
  updateAssetFromProp(obj3d, prop, chunkAnchor = null) {
    // Cancel operation if the world has been unloaded in the meantime
    if (!this.currentModelRegistry) return;

    const {cX, cZ} = this.getChunkCoordinates(prop.x, prop.z);
    const {chunkPos, chunkNodeHandle} = chunkAnchor ? chunkAnchor :
        this.getChunkAnchor(cX, cZ);

    obj3d.position.set(prop.x - chunkPos.x, prop.y,
        prop.z - chunkPos.z);
    obj3d.rotation.set(prop.pitch, prop.yaw, prop.roll, 'YZX');
    obj3d.userData.prop = prop;

    if (obj3d.userData.rwx?.axisAlignment !== 'none') {
      this.sprites.set(obj3d.userData.prop.id, obj3d);
    }

    try {
      this.currentModelRegistry.applyActionString(obj3d, prop.action);
    } catch (e) {
      console.error(e);
    }

    if (obj3d.parent) {
      obj3d.removeFromParent();
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

export default WorldManager;
