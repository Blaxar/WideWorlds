/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {loadAvatarsZip} from '../../../common/avatars-dat-parser.js';
import {getPageName, defaultPageDiameter}
  from '../../../common/terrain-utils.js';
import {flipYawDegrees}
  from './utils-3d.js';
import {makePagePlane, adjustPageEdges, pageNodeCollisionPreSelector}
  from './terrain-utils.js';
import BackgroundScenery from './background-scenery.js';
import {makePagePlane as makeWaterPagePlane,
  adjustPageEdges as adjustWaterPageEdges, loadWaterMaterials}
  from './water-utils.js';
import {Vector3, Color, MathUtils, TextureLoader, Group} from 'three';
import {userFeedPriority} from './user-feed.js';

const chunkCacheBatchSize = 100;

const defaultChunkLoadingPattern = [[-1, 1], [0, 1], [1, 1],
  [-1, 0], [0, 0], [1, 0],
  [-1, -1], [0, -1], [1, -1]];

const pageLoadingPattern = [[-1, -1], [0, -1], [1, -1],
  [-1, 0], [0, 0], [1, 0],
  [-1, 1], [0, 1], [1, 1]];

// Ignore non-solid props when computing bounds tree for collision detection
const chunkNodeColliderFilter =
    (obj3d) => obj3d.userData.rwx?.solid === undefined ||
        obj3d.userData.rwx.solid === true;

const twoPi = 2*Math.PI;
const maxLoadingAttempts = 4;
const sceneryUpdateCooldown = 5000; // ms

/**
 * Wrapper around {@link BackgroundScenery} to process
 * updates in batches, using a double-buffer approach, thus
 * avoiding race conditions from the async processing
 * of chunks.
 */
class BackgroundSceneryUpdater {
  /**
   * @constructor
   * @param {BackgroundScenery} scenery - Background scenery.
   */
  constructor(scenery) {
    this.scenery = scenery;
    this.switch = 0; // double buffer to avoid read/write data race

    this.clear();
  }

  /**
   * Set prop into the scenery
   * @param {Object3D} obj3d - Prop to add to the scenery.
   * @param {string} maskKey - Masking key for this prop.
   */
  set(obj3d, maskKey) {
    const setWrite = this.switch;

    this.batch[setWrite].push({obj3d, maskKey});
  }

  /**
   * Unset prop from the scenery
   * @param {Object3D} obj3d - Prop to remove from the scenery.
   */
  unset(obj3d) {
    const unsetWrite = 2 + this.switch;

    this.batch[unsetWrite].push(obj3d);
  }

  /**
   * Commit pending changes to the scenery, switching
   * read and write buffers
   */
  commit() {
    const setRead = this.switch;
    const unsetRead = 2 + this.switch;
    this.switch = (this.switch + 1) % 2;

    for (const {obj3d, maskKey} of this.batch[setRead]) {
      if (obj3d.visible) {
        obj3d.updateMatrixWorld(true);
        this.scenery.set(obj3d, maskKey, obj3d.userData.scenerySignature);
      } else {
        this.scenery.unset(obj3d);
      }
    }

    for (const obj3d of this.batch[unsetRead]) {
      this.scenery.unset(obj3d, obj3d.userData.scenerySignature);
    }

    this.batch[setRead] = [];
    this.batch[unsetRead] = [];
  }

  /**
   * Clear everything
   */
  clear() {
    // First two arrays are read/write buffers for objects to be set,
    // the second two ones are also read/write buffers, but for objects
    // to be removed.
    this.batch = [[], [], [], []];
  }
}

/** Central world-management class, handles chunk loading */
class WorldManager {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Instance of the main 3D engine.
   * @param {ChunkCache} chunkCache - Instance of the chunk cache.
   * @param {WorldPathRegistry} worldPathRegistry - world-path registry for
   *                                                3D assets loading.
   * @param {HttpClient} httpClient - HTTP client managing API requests to
   *                                  the server.
   * @param {WsClient} wsClient - WS client for listening to world update
   *                              events coming from the server.
   * @param {UserFeed} userFeed - The user feed for publishing messages.
   * @param {userCollider} userCollider - Instance of the local user collider
   *                                      for collision detection.
   * @param {UserConfigNode} graphicsNode - Configuration node for the graphics.
   * @param {integer} chunkSide - Chunk side length (in meters).
   * @param {number} textureUpdatePeriod - Amount of time (in seconds) to wait
   *                                       before moving animated textures to
   *                                       their next frame.
   */
  constructor(engine3d, chunkCache, worldPathRegistry, httpClient, wsClient,
      userFeed, userCollider, graphicsNode = null, chunkSide = 20,
      textureUpdatePeriod = 0.20) {
    this.elapsed = 0;
    this.chunkLoadingPattern = defaultChunkLoadingPattern;
    this.chunkCollisionPattern = defaultChunkLoadingPattern;
    this.pageCollisionPattern = pageLoadingPattern;
    this.engine3d = engine3d;
    this.chunkCache = chunkCache;
    this.worldPathRegistry = worldPathRegistry;
    this.httpClient = httpClient;
    this.wsClient = wsClient;
    this.userCollider = userCollider;
    this.textureUpdatePeriod = textureUpdatePeriod; // In seconds
    this.currentWorld = null;
    this.currentModelRegistry = null;
    this.currentWorldUpdateClient = null;
    this.currentTerrainMaterials = [];
    this.userFeed = userFeed;
    this.tmpColor = new Color();
    this.tmpVec3 = new Vector3();

    // Lights
    this.ambientColor = new Color();

    // Props handling
    this.chunkSide = chunkSide; // In meters
    this.chunks = new Map();
    this.chunkKeys = new Map(); // Reverse of this.chunks
    this.props = new Map();

    // Terrain handling
    this.pages = new Map();
    this.pageData = new Map(); // Stores elevation and texture data
    this.terrainMaterials = new Map();

    this.lastTextureUpdate = 0;
    this.terrainEnabled = false;
    this.terrainElevationOffset = 0.0; // In meters

    // Water handling
    this.waterPages = new Map();
    this.waterPageData = new Map(); // Stores elevation data
    this.currentWaterMaterials = null;

    this.water = {
      enabled: false,
      level: 0, // In meters
      surfaceMove: 0, // In meters
      speed: 1.0,
      color: '000000',
      visbility: 20, // In meters
    };

    this.fog = {
      enabled: false,
      color: '000000',
      minimum: 0,
      maximum: 1000,
    };

    // Background scenery will not be included in the selection domain
    // when right-clicking...
    this.sceneryNodeHandle =
      this.engine3d.spawnNode(0, 0, 0, false, false, false);
    this.background = new Group();
    this.scenery = new BackgroundScenery(this.background, (obj3d) => {
      // Each prop in the scenery will be identified by its database ID
      return obj3d.userData.prop.id;
    });
    this.sceneryUpdater = new BackgroundSceneryUpdater(this.scenery);
    this.lastSceneryUpdate = Date.now();

    this.waterNodeHandle = this.engine3d.spawnNode();

    this.previousCX = this.previousCZ = null;
    this.textureLoader = new TextureLoader();

    // Internal state to keep track of idle loading progress
    this.idleChunksLoading = {radius: 0, progress: 0, start: 0, last: 0};

    // User-provided parameters
    this.idlePropsLoading = {
      distance: 0, // m
      downtime: 1000, // ms here for convenience
      cooldown: 1000, // ms here for convenience
    };

    this.backgroundScenery = {
      enabled: false,
    };

    this.buildMode = false;

    if (graphicsNode) {
      // Ready props loading distance and its update callback
      const propsLoadingNode = graphicsNode.at('propsLoadingDistance');
      const propsLoadingDistance = parseInt(propsLoadingNode.value());

      this.updateChunkLoadingPattern(propsLoadingDistance);
      propsLoadingNode.onUpdate((value) => {
        this.updateChunkLoadingPattern(parseInt(value));
        this.previousCX = this.previousCZ = null;
      });

      const idlePropsLoadingNode = graphicsNode.at('idlePropsLoading');
      // Ready idle props loading values and their callbacks
      this.idlePropsLoading.distance =
          parseInt(idlePropsLoadingNode.at('distance').value());
      this.idlePropsLoading.downtime =
          parseInt(idlePropsLoadingNode.at('downtime').value()) * 1000.0;

      const speed = parseFloat(idlePropsLoadingNode.at('speed').value());
      this.idlePropsLoading.cooldown = 1000.0 / (speed < 1 ? 1.0 : speed);

      idlePropsLoadingNode.at('distance').onUpdate((value) => {
        this.idlePropsLoading.distance = parseInt(value);
      });
      idlePropsLoadingNode.at('downtime').onUpdate((value) => {
        this.idlePropsLoading.downtime = parseInt(value) * 1000.0;
      });
      idlePropsLoadingNode.at('speed').onUpdate((value) => {
        const speed = parseFloat(value);
        this.idlePropsLoading.cooldown = 1000.0 / (speed < 1 ? 1.0 : speed);
      });

      const backgroundSceneryNode = graphicsNode.at('backgroundScenery');
      // Ready background scenery value and its callback
      const value = backgroundSceneryNode.at('enabled').value();
      if (value) {
        this.engine3d.appendToNode(this.sceneryNodeHandle, this.background);
      }

      backgroundSceneryNode.at('enabled').onUpdate((value) => {
        if (value) {
          this.engine3d.appendToNode(this.sceneryNodeHandle, this.background);
        } else {
          this.engine3d.wipeNode(this.sceneryNodeHandle);
        }
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
   * @return {Promise<Object>} Promise of an object describing the content of
   *                           the parsed avatars.dat file for this world.
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
      this.fog.enabled = true;
      this.fog.color = data.fogColor;
      this.fog.minimum = data.fogMinimum;
      this.fog.maximum = data.fogMaximum;
    } else {
      this.fog.enabled = false;
    }

    this.ambientColor.set('#' + data.ambientColor);
    this.engine3d.setAmbientLight(
        this.ambientColor);

    const directionalColor = this.tmpColor.set('#' + data.directionalColor);
    this.engine3d.setDirectionalLight(
        directionalColor,
        // Note: AW stores the world directional light position
        //       based on flipped axis instead of the expected
        //       ones:
        //       - North to South instead of South to North
        //       - West to East instead of East to West
        //       - Up to Down instead of Down to Up
        this.tmpVec3.set(
            -data.dirLightPos[0],
            -data.dirLightPos[1],
            -data.dirLightPos[2],
        ),
    );
    const entry = data?.entryPoint;
    const yaw = entry?.yaw || 0;
    if (entry !== undefined) {
      this.engine3d.user.position.set(entry.x, entry.y, entry.z);
    }
    // Face GL South (Renderware North) by default (industry standard)
    // For legacy worlds, we should modify the entry point's angle.
    this.engine3d.user.rotation.set(
        0, MathUtils.degToRad(flipYawDegrees(yaw)), 0, 'YXZ');

    this.terrainEnabled = data.enableTerrain;
    this.terrainElevationOffset = data.terrainElevationOffset ?
        data.terrainElevationOffset : 0.0;

    if (!data.path) throw new Error('Missing path field from world data json');

    if (data.water) {
      this.water = Object.assign(this.water, data.water);
      this.currentWaterMaterials = loadWaterMaterials(this.textureLoader,
          `${data.path}/textures`, data.water);
    }

    this.currentModelRegistry = await this.worldPathRegistry.get(data.path);
    this.currentWorldUpdateClient =
        await this.wsClient.worldUpdateConnect(world.id);

    this.currentWorldUpdateClient.onMessage(async (entries) => {
      const modelRegistry = this.currentModelRegistry;
      const boundTreesToUpdate = new Set();

      if (entries.op === 'create') {
        for (const prop of entries.data) {
          const {cX, cZ} = this.getChunkCoordinates(prop.x, prop.z);
          if (!modelRegistry || !this.isChunkLoaded(cX, cZ)) continue;
          const chunkAnchor = this.getChunkAnchor(cX, cZ);

          boundTreesToUpdate.add(this.chunks.get(`${cX}_${cZ}`));

          const obj3d = await modelRegistry.get(prop.name);

          this.updateAssetFromProp(obj3d, prop, chunkAnchor);
          if (this.buildMode) obj3d.visible = true;
        }
      } else if (entries.op === 'update') {
        for (const value of entries.data) {
          const {cX, cZ} = this.getChunkCoordinates(value.x, value.z);

          // Only update props on already-loaded chunks
          if (!this.isChunkLoaded(cX, cZ) || !this.props.has(value.id)) {
            continue;
          }

          boundTreesToUpdate.add(this.chunks.get(`${cX}_${cZ}`));

          // Remove original object
          const oldObj3d = this.props.get(value.id);

          // Remove it from the dynamic object list (when applicable)
          this.engine3d.unsetDynamicOnNode(oldObj3d.userData.chunkNodeHandle,
              oldObj3d);

          oldObj3d.removeFromParent();

          // Spawn a new one update it
          const newObj3d = await modelRegistry.get(value.name);

          this.updateAssetFromProp(newObj3d, value);
          if (this.buildMode) newObj3d.visible = true;
        }
      } else if (entries.op === 'delete') {
        for (const id of entries.data) {
          const obj3d = this.props.get(id);

          if (!obj3d) continue;

          boundTreesToUpdate.add(obj3d.userData.chunkNodeHandle);

          // Remove the object from the dynamic object list (when applicable)
          this.engine3d.unsetDynamicOnNode(obj3d.userData.chunkNodeHandle,
              obj3d);
          this.sceneryUpdater.unset(obj3d);
          obj3d.removeFromParent();
          this.props.delete(id);
        }
      }

      boundTreesToUpdate.forEach((chunkNodeHandle) => {
        this.engine3d.updateNodeBoundsTree(chunkNodeHandle,
            chunkNodeColliderFilter);
      });
    });

    this.currentTerrainMaterials =
        this.worldPathRegistry.getTerrainMaterials(data.path);

    if (data.skybox) {
      const model = await this.currentModelRegistry
          .getBasic(`${data.skybox}.rwx`);
      this.engine3d.setSkyBox(model);
    }

    const {cX, cZ} = this.getChunkCoordinates(this.engine3d.user.position.x,
        this.engine3d.user.position.z);
    this.loadCachedChunks(cX, cZ);

    try {
      // TODO: customizable avatars.zip subpath and CORS disabling?
      return {
        avatars: (
          await loadAvatarsZip(`${data.path}/avatars/avatars.zip`, true)
        ).avatars,
        path: data.path,
      };
    } catch (e) {
      console.error(e);
    }

    return {avatars: [], path: data.path};
  }

  /** Clear current world data, reset engine3d state and chunks */
  unload() {
    this.currentWorld = null;
    this.currentWorldUpdateClient?.close();
    this.currentWorldUpdateClient = null;
    this.currentModelRegistry.clearTmpMaterials();
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
    this.clearWater();
    this.scenery.clear();
    this.sceneryUpdater.clear();
    this.lastTextureUpdate = 0;
    this.terrainEnabled = false;
    this.terrainElevationOffset = 0.0;
    this.previousCX = this.previousCZ = null;
    this.loadingPages = false;
    this.loadingWaterPages = false;
    this.water.enabled = false;
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
    this.chunkKeys.clear();
  }

  /** Clear all terrain pages */
  clearPages() {
    for (const handle of this.pages.values()) {
      this.engine3d.removeNode(handle);
    }

    this.pages.clear();
    this.pageData.clear();
  }

  /** Clear all water pages and associated materials **/
  clearWater() {
    this.engine3d.wipeNode(this.waterNodeHandle);

    this.currentWaterMaterials.waterMaterial?.map?.dispose();
    this.currentWaterMaterials.waterMaterial?.dispose();
    this.currentWaterMaterials.bottomMaterial?.map?.dispose();
    this.currentWaterMaterials.bottomMaterial?.dispose();

    this.currentWaterMaterials = null;

    this.waterPages.clear();
    this.waterPageData.clear();
  }

  /**
   * Load necessary chunks and various elements based on the provided position
   * @param {Vector3} pos - Position, surronding chunks will be loaded.
   * @param {number} delta - Elapsed number of seconds since last update.
   */
  update(pos, delta = 0) {
    this.elapsed += delta;
    if (!(this.currentWorld && this.currentModelRegistry)) return;

    this.updateTextures(delta);
    this.updateWater(delta);

    const {cX, cZ} = this.getChunkCoordinates(pos.x, pos.z);
    const {pX, pZ} = this.getPageCoordinates(pos.x, pos.z);
    const now = Date.now();

    this.updateScenery(now);
    if (this.previousCX !== cX || this.previousCZ !== cZ) {
      this.resetIdleChunksLoading(now);
      this.updateChunks(cX, cZ);

      this.previousCX = cX;
      this.previousCZ = cZ;
    } else if (this.idlePropsLoading.distance > 0 &&
        this.idleChunksLoading.radius < this.idlePropsLoading.distance &&
        (now - this.idleChunksLoading.start) > this.idlePropsLoading.downtime &&
        (now - this.idleChunksLoading.last) > this.idlePropsLoading.cooldown) {
      // 4 conditions need to be met to go on with idle chunk loading:
      // - Be enabled via the distance being set above 0;
      // - Have the current radius to load be inferior to the maximum allowed
      //   distance (it won't ever stop on its own otherwise);
      // - Have enough time elapsed since the user went "idle" chunk-wise, this
      //   ensures that it stops when the user starts significantly moving;
      // - Have enough time elapsed since the last loaded piece, this ensures
      //   a reasonable pace to load props (not overworking the web browser).

      this.updateIdleChunksLoading(pos, now);
    }

    this.updateCollider(cX, cZ, pX, pZ);
    this.updatePages(pX, pZ);
  }

  /**
   * Update animated textures, for internal use by {@link update}
   * @param {number} delta - Elapsed number of seconds since last update.
   */
  updateTextures(delta) {
    if (this.lastTextureUpdate > this.textureUpdatePeriod) {
      this.currentModelRegistry.texturesNextFrame();
      this.lastTextureUpdate = 0;
    } else {
      this.lastTextureUpdate += delta;
    }
  }

  /**
   * Update water animation and tune underwater rendering, for internal
   * use by {@link update}
   * @param {number} delta - Elapsed number of seconds since last update.
   */
  updateWater(delta) {
    if (this.currentWaterMaterials) {
      this.currentWaterMaterials.waterMaterial.step(delta);
      this.currentWaterMaterials.bottomMaterial.step(delta);
    }

    if (this.water.enabled) {
      this.engine3d.setNodePosition(
          this.waterNodeHandle, 0,
          this.water.level +
           Math.sin(this.elapsed * this.water.speed) *
           0.5 * this.water.surfaceMove,
          0,
      );
    }

    const intersects = this.engine3d.intersectNodeFromCamera(
        this.waterNodeHandle,
        this.tmpVec3.set(0, 1, 0),
    );

    if (intersects.length) {
      this.tmpColor.set('#' + this.water.color);
      this.engine3d.setAmbientLight(this.tmpColor);
      this.engine3d.setFog(this.tmpColor, 0, this.water.visibility);
    } else {
      this.engine3d.setAmbientLight(this.ambientColor);
      if (this.fog.enabled) {
        this.tmpColor.set('#' + this.fog.color);
        this.engine3d.setFog(this.tmpColor, this.fog.minimum, this.fog.maximum);
      } else {
        this.engine3d.resetFog();
      }
    }
  }

  /**
   * Update background scenery by committing pending props changes, for internal
   * use by {@link update}
   * @param {timestamp} now - Current timestamp (in milliseconds).
   */
  updateScenery(now) {
    if (now - this.lastSceneryUpdate > sceneryUpdateCooldown) {
      this.lastSceneryUpdate = now;
      this.sceneryUpdater.commit();
    }
  }

  /**
   * Reset idle chunks loading state, for internal use by {@link update}
   * @param {timestamp} now - Current timestamp (in milliseconds).
   */
  resetIdleChunksLoading(now) {
    // Reset idle chunk loading state
    this.idleChunksLoading.start = now;
    this.idleChunksLoading.radius = 0;
    this.idleChunksLoading.progress = 0;
  }

  /**
   * Update chunks and background scenery props visbility, for internal use
   * by {@link update}
   * @param {integer} cX - Index of the chunk on the X axis.
   * @param {integer} cZ - Index of the chunk on the Z axis.
   */
  updateChunks(cX, cZ) {
    const lodCamera = this.engine3d.camera.clone();
    lodCamera.position.setY(0.0);

    for (const [x, z] of this.chunkLoadingPattern) {
      this.loadChunk(cX + x, cZ + z);
    }

    // We notify the 3D engine that we want to update the current
    // chunks around the camera
    const {visible, turnedInvisible} =
          this.engine3d.updateLODs(new Set(this.chunkLoadingPattern.map(
              ([x, z]) => {
                const chunkId = `${cX + x}_${cZ + z}`;
                return this.chunks.get(chunkId);
              },
          ).filter((nodeId) => nodeId !== undefined)),
          lodCamera);

    // Update background scenery
    visible.forEach((id) => {
      this.scenery.mask(this.chunkKeys.get(id));
    });
    turnedInvisible.forEach((id) => {
      this.scenery.unmask(this.chunkKeys.get(id));
    });
  }

  /**
   * Update idle chunks loading, for internal use by {@link update}
   * @param {Vector3} pos - Ground camera position.
   * @param {timestamp} now - Current timestamp (in millisceonds).
   */
  updateIdleChunksLoading(pos, now) {
    this.idleChunksLoading.last = now;

    let cX = 0;
    let cZ = 0;
    let i = 0;
    do {
      let {radius, progress} = this.idleChunksLoading;

      const coordinates = this.getChunkCoordinates(
          pos.x + Math.cos(progress) * radius,
          pos.z + Math.sin(progress) * radius);

      cX = coordinates.cX;
      cZ = coordinates.cZ;

      const perimeter = twoPi*radius;
      const nbSteps = parseInt(perimeter / this.chunkSide) * 2;
      const radStep = twoPi / nbSteps;

      progress += radStep;
      if (progress > twoPi) {
        // Past full circle: restart with a bigger radius
        this.idleChunksLoading.progress = 0;
        this.idleChunksLoading.radius += this.chunkSide;
      } else {
        this.idleChunksLoading.progress = progress;
      }
    } while (this.isChunkLoaded(cX, cZ) && ++i < maxLoadingAttempts);

    this.loadChunk(cX, cZ, true, true);
  }

  /**
   * Update user collider state, for internal use by {@link update}
   * @param {integer} cX - Index of the current chunk on the X axis.
   * @param {integer} cZ - Index of the current chunk on the Z axis.
   * @param {integer} pX - Index of the current terrain page on the X axis.
   * @param {integer} pZ - Index of the current terrain page on the Z axis.
   */
  updateCollider(cX, cZ, pX, pZ) {
    // Test props and terrain collision with user
    this.userCollider.update(this.chunkCollisionPattern.map(
        ([x, z]) => {
          const chunkId = `${cX + x}_${cZ + z}`;
          return this.chunks.get(chunkId);
        },
    ).concat(this.terrainEnabled ? this.pageCollisionPattern.map(
        ([x, z]) => {
          const pageId = `${pX + x}_${pZ + z}`;
          return this.pages.get(pageId);
        },
    ) : []));
  }

  /**
   * Update terrain and water pages, for internal use by {@link update}
   * @param {integer} pX - Index of the current page on the X axis.
   * @param {integer} pZ - Index of the current page on the Z axis.
   */
  updatePages(pX, pZ) {
    if (this.terrainEnabled && !this.loadingPages) {
      this.loadingPages = true;
      // Unlike chunks, pages cannot be loaded independently so trivially,
      // for the simple reason there are borders to sync up, so it's easier to
      // do them one at a time to adjust the heights of points at the edges
      (async () => {
        for (const [x, z] of pageLoadingPattern) {
          await this.loadPage(pX + x, pZ + z);
        }

        this.loadingPages = false;
      })();
    }

    if (this.water.enabled && !this.loadingWaterPages) {
      this.loadingWaterPages = true;
      // Same here...
      (async () => {
        for (const [x, z] of pageLoadingPattern) {
          await this.loadWaterPage(pX + x, pZ + z);
        }

        this.loadingWaterPages = false;
      })();
    }
  }

  /**
   * Load all the nearby available chunks from the cache when entering the
   * world, centered around a given position
   * @param {integer} cX - Index of the central chunk on the X axis.
   * @param {integer} cZ - Index of the central chunk on the Z axis.
   */
  async loadCachedChunks(cX, cZ) {
    const maxRadius = this.idlePropsLoading.distance /
        parseFloat(this.chunkSide);

    let coords = await this.chunkCache.getAvailableCoordinates(this.worldId);

    console.debug(`Found ${coords.length} chunks in local cache`);

    // Sort the coordinates to get the closest ones first
    coords = coords.sort((a, b) => {
      const sqrdADist = (a.x - cX) * (a.x - cX) + (a.z - cZ) * (a.z - cZ);
      const sqrdBDist = (b.x - cX) * (b.x - cX) + (b.z - cZ) * (b.z - cZ);

      return sqrdADist - sqrdBDist;
    });

    let i = 0;
    let promises = [];

    for (const {x, z} of coords) {
      // World not loaded, just stop
      if (this.currentWorld === null) return;

      const sqrdDist = (x - cX) * (x - cX) + (z - cZ) * (z - cZ);

      if (sqrdDist > maxRadius * maxRadius) {
        // We're past the allowed radius
        break;
      }

      promises.push(this.loadChunk(x, z, true, true));
      i++;

      // Only let a certain amount of chunk-loading promises run
      // at any given time, this ought to avoid staggering or, worse,
      // freezing the web browser
      if (promises.length >= chunkCacheBatchSize) {
        await Promise.all(promises);
        promises = [];
      }
    }

    // Load remaining amount at the end
    await Promise.all(promises);

    console.debug(`Loaded ${i} chunks from local cache`);
  }

  /**
   * Load a single prop chunk, return right away if already loaded
   * @param {integer} x - Index of the chunk on the X axis.
   * @param {integer} z - Index of the chunk on the Z axis.
   * @param {boolean} hide - Whether or not to hide chunk at creation.
   * @param {boolean} lazy - Whether or not to load the chunk from the cache.
   *                         If True: Will issue a network call only if not
   *                                  found in cache;
   *                         If false (default): Will always issue a network
   *                                             call.
   */
  async loadChunk(x, z, hide = false, lazy = false) {
    const chunkId = `${x}_${z}`;
    if (this.chunks.has(chunkId)) return;

    await this.reloadChunk(x, z, hide, lazy);
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
   * Tell if a given terrain page is already loaded
   * @param {integer} x - Index of the page on the X axis.
   * @param {integer} z - Index of the page on the Z axis.
   * @return {boolean} True if page is loaded, false otherwise.
   */
  isPageLoaded(x, z) {
    const pageName = getPageName(x, z);
    return this.pages.has(pageName);
  }

  /**
   * Load a single water page, return right away if already loaded
   * @param {integer} pageX - Index of the page on the X axis.
   * @param {integer} pageZ - Index of the page on the Z axis.
   */
  async loadWaterPage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);
    if (this.waterPages.has(pageName)) return;

    await this.reloadWaterPage(pageX, pageZ);
  }

  /**
   * Tell if a given water page is already loaded
   * @param {integer} x - Index of the page on the X axis.
   * @param {integer} z - Index of the page on the Z axis.
   * @return {boolean} True if page is loaded, false otherwise.
   */
  isPageWaterLoaded(x, z) {
    const pageName = getPageName(x, z);
    return this.waterPages.has(pageName);
  }

  /**
   * Get a 3D avatar asset from the current world registry
   * @param {string} name - Name of the 3D asset for the avatar.
   * @return {Promise<Object3D>} Promise of a three.js 3D asset.
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
   * @param {boolean} hide - Whether or not to hide chunk at creation.
   * @return {Object} Object holding chunk position and node handler.
   */
  getChunkAnchor(cX, cZ, hide = false) {
    const chunkPos = new Vector3(cX * this.chunkSide, 0,
        cZ * this.chunkSide);

    let chunkNodeHandle = this.chunks.get(`${cX}_${cZ}`);

    if (chunkNodeHandle === undefined) {
      chunkNodeHandle =
        this.engine3d.spawnNode(chunkPos.x, chunkPos.y, chunkPos.z,
            true, hide);
      this.chunks.set(`${cX}_${cZ}`, chunkNodeHandle);
      this.chunkKeys.set(chunkNodeHandle, `${cX}_${cZ}`);
    }

    return {chunkPos, chunkNodeHandle};
  }

  /**
   * Reload a single prop chunk no matter what
   * @param {integer} x - Index of the chunk on the X axis.
   * @param {integer} z - Index of the chunk on the Z axis.
   * @param {boolean} hide - Whether or not to hide chunk at creation.
   * @param {boolean} lazy - Whether or not to load the chunk from the cache.
   *                         If true: Will issue a network call only if not
   *                         found in cache;
   *                         If false (default): Will always issue a network
   *                         call.
   */
  async reloadChunk(x, z, hide = false, lazy = false) {
    const chunkId = `${x}_${z}`;

    if (this.chunks.has(chunkId)) {
      // The chunk is already there: this is a reload scenario
      const key = this.chunks.get(chunkId);
      this.engine3d.removeNode(key);
      this.chunks.remove(chunkId);
      this.chunkKeys.remove(key);
    }

    const chunkAnchor = this.getChunkAnchor(x, z, hide);

    const halfChunkSide = this.chunkSide / 2;

    const loadNetworkProps = () => {
      return this.httpClient.getProps(this.currentWorld.id,
          x * this.chunkSide - halfChunkSide,
          (x + 1) * this.chunkSide - halfChunkSide,
          null, null, // We set no limit on the vertical (y) axis
          z * this.chunkSide - halfChunkSide,
          (z + 1) * this.chunkSide - halfChunkSide);
    };

    let loadedFromNetwork = false;

    const loadCacheProps = () => {
      return this.chunkCache.get(this.currentWorld.id, x, z);
    };

    const deleteCacheProps = () => {
      return this.chunkCache.delete(this.currentWorld.id, x, z);
    };

    const chunk = await (async () => {
      if (lazy) {
        // try to fetch chunk from the cache first, fallback
        // on the network if no entry was found
        return new Promise((resolve) => {
          loadCacheProps().then((result) => {
            if (result) {
              resolve(result.props);
            } else {
              loadNetworkProps().then((res) => {
                loadedFromNetwork = true;
                resolve(res);
              });
            }
          }, (error) => {
            // Failed to access the cache, lazy-delete
            // the chunk from the cache and fall back
            // to the network request
            deleteCacheProps();
            loadNetworkProps().then((res) => {
              loadedFromNetwork = true;
              resolve(res);
            });
          });
        });
      } else {
        // Ignoring the cache here, aim straight for the newtork request
        return new Promise((resolve) => {
          loadNetworkProps().then((res) => {
            loadedFromNetwork = true;
            resolve(res);
          });
        });
      }
    })();

    if (loadedFromNetwork) {
      // Cache entry needs to be updated for this chunk
      this.chunkCache.put(this.currentWorld.id, x, z, chunk);
    }

    const modelRegistry = this.currentModelRegistry;

    for (const prop of chunk) {
      // Cancel any pending loading if the chunk has been removed
      // or the world has been unloaded
      if (!modelRegistry || !this.isChunkLoaded(x, z)) break;

      const obj3d = await modelRegistry.get(prop.name);

      this.updateAssetFromProp(obj3d, prop, chunkAnchor);
    }

    this.engine3d.updateNodeBoundsTree(chunkAnchor.chunkNodeHandle,
        chunkNodeColliderFilter);
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
        await this.httpClient.getTerrainPage(this.currentWorld.id,
            pageX, pageZ));

    const {elevationData, textureData} = this.pageData.get(pageName);

    const pagePlane = makePagePlane(elevationData, textureData,
        defaultPageDiameter * 10, defaultPageDiameter,
        this.currentTerrainMaterials);
    pagePlane.position.setY(this.terrainElevationOffset);
    pagePlane.updateMatrix();

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
    this.engine3d.updateNodeBoundsTree(pageNodeHandle,
        () => true, pageNodeCollisionPreSelector,
        pagePlane.position);
  }

  /**
   * Reload a single water page no matter what
   * @param {integer} pageX - Index of the page on the X axis.
   * @param {integer} pageZ - Index of the page on the Z axis.
   */
  async reloadWaterPage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);

    if (this.waterPages.has(pageName)) {
      // The page is already there: this is a reload scenario
      this.waterPages.get(pageName).removeFromParent();
      this.waterPages.remove(pageName);
    }

    if (this.waterPageData.has(pageName)) {
      // Same here
      this.waterPageData.remove(pageName);
    }

    this.waterPageData.set(pageName,
        await this.httpClient.getWaterPage(this.currentWorld.id,
            pageX, pageZ));

    const pagePos = [pageX * defaultPageDiameter * 10, 0,
      pageZ * defaultPageDiameter * 10];

    const elevationData = this.waterPageData.get(pageName);

    const pagePlane = makeWaterPagePlane(
        elevationData,
        defaultPageDiameter * 10,
        defaultPageDiameter,
        this.currentWaterMaterials.waterMaterial,
        this.currentWaterMaterials.bottomMaterial,
        new Vector3(pagePos[0], 0, pagePos[2]),
    );

    // Get surrounding planes, falsy if not ready yet
    const left = this.waterPages.get(getPageName(pageX - 1, pageZ));
    const topLeft = this.waterPages.get(getPageName(pageX - 1, pageZ - 1));
    const top = this.waterPages.get(getPageName(pageX, pageZ - 1));

    const right = this.waterPageData
        .get(getPageName(pageX + 1, pageZ));
    const bottomRight = this.waterPageData
        .get(getPageName(pageX + 1, pageZ + 1));
    const bottom = this.waterPageData
        .get(getPageName(pageX, pageZ + 1));

    adjustWaterPageEdges(pagePlane, elevationData, left, topLeft, top, right,
        bottomRight, bottom, defaultPageDiameter);

    this.waterPages.set(pageName, pagePlane);
    this.engine3d.appendToNode(this.waterNodeHandle, pagePlane);
    pagePlane.updateMatrix();
  }

  /**
   * Create props on the server
   * @param {Array<Object3D>} props - Staged props to update.
   * @return {Promise<Array<Object3D>>} - Props that could not be created.
   */
  async createProps(props) {
    const propsNotCreated = [];
    let unauthorizedCreate = false;

    if (!props.length) return propsNotCreated;

    const propsData = props.map((prop) => prop.userData.prop);

    const results = await this.httpClient.postProps(
        this.currentWorld.id, propsData,
    );

    for (const [key, value] of Object.entries(results)) {
      const id = parseInt(key);
      if (value === false) unauthorizedCreate = true;

      if (value !== true) {
        propsNotCreated.push(props[id]);
      }
    }
    if (unauthorizedCreate) {
      // TODO: This will never trigger, since building is enabled for everyone.
      this.userFeed.publish(
          'You may not build in this world.', 'Building Inspector',
          userFeedPriority.warning);
    }

    return propsNotCreated;
  }

  /**
   * Update props on the server
   * @param {Array<Object3D>} props - Staged props to update.
   * @return {Promise<Array<Object3D>>} - Original props to revert in case of
   *                                      failure.
   */
  async updateProps(props) {
    const propsToBeReset = [];
    let unauthorizedUpdate = false;

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
      if (value === false) unauthorizedUpdate = true;

      if (value !== true && this.props.has(id)) {
        propsToBeReset.push(this.props.get(id));
      }
    }
    if (unauthorizedUpdate) {
      this.userFeed.publish(
          'You may only change your own property.', 'Building Inspector',
          userFeedPriority.warning);
    }

    return propsToBeReset;
  }

  /**
   * Remove props on the server
   * @param {Array<Object3D>} props - Staged props to remove.
   * @return {Promise<Array<Object3D>>} - Original props to revert in case of
   *                                      failure.
   */
  async removeProps(props) {
    const propsToBeReset = [];
    let unauthorizedDelete = false;

    if (!props.length) return propsToBeReset;

    const propsData = props.map((prop) => prop.userData.prop.id);

    const results = await this.httpClient.deleteProps(
        this.currentWorld.id, propsData,
    );

    for (const [key, value] of Object.entries(results)) {
      const id = parseInt(key);
      if (value === false) unauthorizedDelete = true;

      if (value !== true && this.props.has(propsData[id])) {
        propsToBeReset.push(this.props.get(propsData[id]));
      }
    }
    if (unauthorizedDelete) {
      this.userFeed.publish(
          'You may only demolish your own property.', 'Building Inspector',
          userFeedPriority.warning);
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

    try {
      this.currentModelRegistry.applyActionString(obj3d, prop.action);

      if (obj3d.userData?.say) {
        this.userFeed.publish(
            obj3d.userData.say, null, userFeedPriority.objectSay,
        );
      }
    } catch (e) {
      console.error(e);
    }

    if (obj3d.parent) {
      this.engine3d.unsetDynamicOnNode(obj3d.userData.chunkNodeHandle,
          obj3d);
      obj3d.removeFromParent();
    }

    if (!this.engine3d.appendToNode(chunkNodeHandle, obj3d, 0,
        obj3d.userData.rwx?.axisAlignment !== 'none')) {
      // Could not append object to node, meaning node (chunk) no
      // longer exists, we just silently cancel the whole loading.
      return;
    }

    obj3d.userData.chunkNodeHandle = chunkNodeHandle;

    obj3d.matrixAutoUpdate = false;
    obj3d.updateMatrix();

    this.props.set(prop.id, obj3d);

    this.sceneryUpdater.set(obj3d,
        this.chunkKeys.get(obj3d.userData.chunkNodeHandle));
  }

  /**
   * Tell if a given position is ready for collision detection
   * @param {number} x - X-axis coordinate value (in meters).
   * @param {number} z - Z-axis coordinate value (in meters).
   * @return {boolean} True if the position is ready, false
   *                   otherwise.
   */
  isPositionCollisionReady(x, z) {
    const {cX, cZ} = this.getChunkCoordinates(x, z);
    if (!this.isChunkLoaded(cX, cZ)) return false;

    const {pX, pZ} = this.getPageCoordinates(x, z);
    if (!this.isPageLoaded(pX, pZ)) return false;

    const chunkNodeId = this.chunks.get(`${cX}_${cZ}`);
    const pageNodeId = this.chunks.get(`${pX}_${pZ}`);

    return this.engine3d.isNodeBoundsTreeReady(chunkNodeId) &&
        this.engine3d.isNodeBoundsTreeReady(pageNodeId);
  }

  /**
   * Set build mode state
   * @param {boolean} value - True if on, false otherwise.
   */
  setBuildMode(value) {
    this.buildMode = value;
  }

  /**
   * Get build mode state
   * @return {boolean} True if on, false otherwise.
   */
  isBuildMode() {
    return this.buildMode;
  }
}

export default WorldManager;
