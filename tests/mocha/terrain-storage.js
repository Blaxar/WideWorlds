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

  it('smoke', async () => {
    // TODO: replace this one with more meaningful tests
    const terrainStorage = new TerrainStorage('test');
    assert.strictEqual(terrainStorage.tileDiameter, 128);

    terrainStorage.getTile(-2, 4);
    terrainStorage.getTile(1000, -100);
    terrainStorage.setPoint(25, -100, 230, 2, 3, false);
    terrainStorage.setPoint(-2000, 100, -20, 5, 0, true);

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
