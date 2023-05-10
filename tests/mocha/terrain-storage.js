/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import TerrainStorage, {getTileName} from '../../server/terrain-storage.js';
import * as assert from 'assert';

// Testing Core application state machine
describe('TerrainStorage', () => {
  it('constructor', async () => {
    const terrainStorage = new TerrainStorage('utopia', 64);

    assert.strictEqual(terrainStorage.world, 'utopia');
    assert.strictEqual(terrainStorage.tileDiameter, 64);
    assert.strictEqual(terrainStorage.tiles.size, 0);
  });

  it('getTilePosFromPoint', async () => {
    const terrainStorage = new TerrainStorage('test');
    assert.strictEqual(terrainStorage.tileDiameter, 128);

    let tilePos = terrainStorage.getTilePosFromPoint(0, 0);
    assert.equal(tilePos.tileX, 0);
    assert.equal(tilePos.tileZ, 0);
    assert.equal(tilePos.offsetX, 64);
    assert.equal(tilePos.offsetZ, 64);

    tilePos = terrainStorage.getTilePosFromPoint(-64, 63);
    assert.equal(tilePos.tileX, 0);
    assert.equal(tilePos.tileZ, 0);
    assert.equal(tilePos.offsetX, 0);
    assert.equal(tilePos.offsetZ, 127);

    tilePos = terrainStorage.getTilePosFromPoint(11, -12);
    assert.equal(tilePos.tileX, 0);
    assert.equal(tilePos.tileZ, 0);
    assert.equal(tilePos.offsetX, 75);
    assert.equal(tilePos.offsetZ, 52);

    tilePos = terrainStorage.getTilePosFromPoint(64, -65);
    assert.equal(tilePos.tileX, 1);
    assert.equal(tilePos.tileZ, -1);
    assert.equal(tilePos.offsetX, 0);
    assert.equal(tilePos.offsetZ, 127);
  });

  it('setPoint & getTile', async () => {
    const terrainStorage = new TerrainStorage('test');
    assert.strictEqual(terrainStorage.tileDiameter, 128);
    const radius = terrainStorage.tileDiameter / 2;

    const defaultTile = terrainStorage.makeDefaultTile();

    // Those tiles are supposed to be pristine: they should be
    // identical to the default one
    let tile1 = terrainStorage.getTile(-2, 4);
    let tile2 = terrainStorage.getTile(1000, -100);
    assert.strictEqual(JSON.stringify(tile1), JSON.stringify(defaultTile));
    assert.strictEqual(JSON.stringify(tile2), JSON.stringify(defaultTile));
    assert.strictEqual(terrainStorage.tiles.size, 0);

    // Modify those tiles by setting some points on them
    const point1 = [-2 * terrainStorage.tileDiameter - radius,
        4 * terrainStorage.tileDiameter - radius];
    const point2 = [1000 * terrainStorage.tileDiameter - radius,
        -100 * terrainStorage.tileDiameter - radius];
    terrainStorage.setPoint(point1[0], point1[1], 230, 2, 3, false);
    terrainStorage.setPoint(point2[0], point2[1], -20, 5, 0, true);

    // Those same tiles should now be different from the default one
    tile1 = terrainStorage.getTile(-2, 4);
    tile2 = terrainStorage.getTile(1000, -100);
    assert.notEqual(JSON.stringify(tile1), JSON.stringify(defaultTile));
    assert.notEqual(JSON.stringify(tile2), JSON.stringify(defaultTile));
    assert.strictEqual(JSON.stringify(terrainStorage.tiles.get('-2_4')),
        JSON.stringify(tile1));
    assert.strictEqual(JSON.stringify(terrainStorage.tiles.get('1000_-100')),
        JSON.stringify(tile2));
    assert.strictEqual(terrainStorage.tiles.size, 2);
  });

  it('getTileName', async () => {
    assert.strictEqual(getTileName(0, 0), '0_0');
    assert.strictEqual(getTileName(1, 2), '1_2');
    assert.strictEqual(getTileName(-10, 50000), '-10_50000');

    assert.throws(() => getTileName('test', 0), Error);
    assert.throws(() => getTileName(0, 'test'), Error);
    assert.throws(() => getTileName(0, 3.14), Error);
    assert.throws(() => getTileName(420.69, 0), Error);
  });
});
