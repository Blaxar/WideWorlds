import {loadAvatarsZip} from '../../../common/avatars-dat-parser.js';

const cmToMRatio = 0.01;
const degToRadRatio = Math.PI / 180.0;

const chunkLoadingPattern = [[-1, 1], [0, 1], [1, 1],
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
  constructor(engine3d, worldPathRegistry, httpClient, chunkSide = 2000,
      textureUpdatePeriod = 0.20) {
    this.engine3d = engine3d;
    this.worldPathRegistry = worldPathRegistry;
    this.httpClient = httpClient;
    this.chunkSide = chunkSide; // In centimeters
    this.textureUpdatePeriod = textureUpdatePeriod; // In seconds
    this.currentWorld = null;
    this.currentModelRegistry = null;
    this.chunks = new Map();
    this.props = new Map();
    this.lastTextureUpdate = 0;
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
      ...data.skyColor.north,
      ...data.skyColor.east,
      ...data.skyColor.south,
      ...data.skyColor.west,
      ...data.skyColor.top,
      ...data.skyColor.bottom,
    ].map((c) => c / 255.0));
    this.engine3d.setSkyColorSpinning(false);

    if (!data.path) throw new Error('Missing path field from world data json');

    this.currentModelRegistry = await this.worldPathRegistry.get(data.path);

    if (data.skybox) {
      const model = await this.currentModelRegistry
          .getBasic(`${data.skybox}.rwx`);
      this.engine3d.setSkyBox(model);
    }

    // TODO: customizable avatar.zip subpath and CORS disabling?
    const res = await loadAvatarsZip(`${data.path}/avatars/avatars.zip`, true);
    return res.avatars;
  }

  /** Clear current world data, reset engine3d state and chunks */
  unload() {
    this.currentWorld = null;
    this.currentModelRegistry = null;
    this.engine3d.setCameraDistance(0);
    this.engine3d.resetSkyColors();
    this.engine3d.resetSkyBox();
    this.engine3d.resetUserAvatar();
    this.engine3d.setSkyColorSpinning(true);
    this.clearChunks();
    this.lastTextureUpdate = 0;
  }

  /** Clear all chunks */
  clearChunks() {
    for (const handle of this.chunks.values()) {
      this.engine3d.removeNode(handle);
    }

    this.props.clear();
    this.chunks.clear();
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

    const cX = Math.floor(pos.x / (this.chunkSide * cmToMRatio) + 0.5);
    const cZ = Math.floor(pos.z / (this.chunkSide * cmToMRatio) + 0.5);

    for (const [x, z] of chunkLoadingPattern) {
      this.loadChunk(cX + x, cZ + z);
    }
  }

  /**
   * Load a single chunk, return right away if already loaded
   * @param {integer} x - Index of the chunk on the X axis.
   * @param {integer} z - Index of the chunk on the Z axis.
   */
  async loadChunk(x, z) {
    const chunkId = `${x}_${z}`;
    if (this.chunks.has(chunkId)) return;

    await this.reloadChunk(x, z);
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
   * Reload a single chunk no matter what
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

      modelRegistry.applyActionString(obj3d, prop.action);

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
}

export default WorldManager;
