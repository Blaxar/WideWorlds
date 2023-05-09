/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

/**
  * Get tile name for given coordinates
  * @param {integer} tileX - X coordinate of the tile.
  * @param {integer} tileZ - Z coordinate of the tile.
  * @return {string} Name of the tile
  */
function getTileName(tileX, tileZ) {
  const x = parseInt(tileX);
  const z = parseInt(tileZ);

  if (isNaN(x) || isNaN(z) || x !== tileX || z !== tileZ) {
    throw new Error('Input coordinates must be valid integers');
  }

  return `${x}_${z}`;
}

/** Takes care of server-side terrain storage for each world */
class TerrainStorage {
  /**
   * @constructor
   * @param {string} world - Name of the world.
   * @param {string} tileDiameter - Length of both tile sides (X and Z) in
   *                                number of points.
   */
  constructor(world, tileDiameter = 128) {
    // Note: a 'tile' in this case is the equivalent of a 'page' following
    // AW semantic, we get ride of the notion of node for simplicity
    this.world = world;
    this.tileDiameter = tileDiameter;
    this.tiles = new Map();

    // TODO: load all available tiles from storages
  }

  /**
   * Set point properties at given coordinates
   * @param {integer} x - X coordinate of the point.
   * @param {integer} z - Z coordinate of the point.
   * @param {integer} elevation - Elevation of the point.
   * @param {integer} texture - Texture ID of the point.
   * @param {integer} rotation - Rotation of the texture for the point.
   * @param {integer} enabled - Is the point enabled or not, false
   *                            means it's a hole.
   */
  setPoint(x, z, elevation, texture = 0, rotation = 0, enabled = true) {
    const {tileX, tileZ, offsetX, offsetZ} = this.getTilePosFromPoint(x, z);
    const tile = this.getTile(tileX, tileZ);

    tile.elevation[offsetZ * this.tileDiameter * offsetX] = elevation;
    tile.texture[offsetZ * this.tileDiameter * offsetX] = texture;
    tile.rotation[offsetZ * this.tileDiameter * offsetX] = rotation;
    tile.enabled[offsetZ * this.tileDiameter * offsetX] = enabled;

    this.tiles.set(getTileName(tileX, tileZ), tile);
    this.saveTile(tileX, tileZ);
  }

  /**
   * Get tile at given coordinates
   * @param {integer} tileX - X coordinate of the tile.
   * @param {integer} tileZ - Z coordinate of the tile.
   * @return {Object} Tile at those given coordinates
   */
  getTile(tileX, tileZ) {
    let tile = this.tiles.get(getTileName(tileX, tileZ));

    if (!tile) {
      // No tile cached for those coordinates: return a default one
      tile = this.makeDefaultTile();
    }

    return tile;
  }

  /**
   * Get the tile with relative point coordinates corresponding to
   * absolute point coordinates
   * @param {integer} x - X coordinate of the point.
   * @param {integer} z - Z coordinate of the point.
   * @return {Object} Tile with relative point coordinates
   */
  getTilePosFromPoint(x, z) {
    const radius = this.tileDiameter / 2;

    const tileX = Math.floor((x + radius) / this.tileDiameter);
    const tileZ = Math.floor((z + radius) / this.tileDiameter);
    let tempX = x;
    let tempZ = z;

    while (tempX < 0) tempX += this.tileDiameter;
    while (tempZ < 0) tempZ += this.tileDiameter;

    const offsetX = (tempX + radius) % this.tileDiameter;
    const offsetZ = (tempZ + radius) % this.tileDiameter;

    return {tileX, tileZ, offsetX, offsetZ};
  }

  /**
   * Load tile at given coordinates from storage to cache
   * @param {integer} tileX - X coordinate of the tile.
   * @param {integer} tileZ - Z coordinate of the tile.
   */
  loadTile(tileX, tileZ) {
    // TODO: load tile from file system (when available)
    this.tiles.set(getTileName(tileX, tileZ), this.makeDefaultTile());
  }

  /**
   * Save tile at given coordinates to storage
   * @param {integer} tileX - X coordinate of the tile.
   * @param {integer} tileZ - Z coordinate of the tile.
   */
  saveTile(tileX, tileZ) {
    // TODO: save tile on the file system
  }

  /**
   * Make a default flat tile
   * @return {Object} Default flat tile.
   */
  makeDefaultTile() {
    const length = this.tileDiameter * this.tileDiameter;

    return {
      elevation: new Int32Array(length).fill(0),
      texture: new Uint8Array(length).fill(0),
      rotation: new Uint8Array(length).fill(0),
      enabled: new Uint8Array(length).fill(1),
    };
  }
}

export default TerrainStorage;
export {getTileName};
