/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import TerrainStorage, {getPageName, zeroElevationValue}
  from '../../server/terrain-storage.js';
import * as assert from 'assert';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// Testing Core application state machine
describe('TerrainStorage', () => {
  it('constructor', async () => {
    const tmpDir = join(tmpdir(), `constructor${Date.now()}`);
    const terrainStorage = new TerrainStorage(tmpDir, 64);

    assert.strictEqual(terrainStorage.folder, tmpDir);
    assert.strictEqual(terrainStorage.pageDiameter, 64);
    assert.strictEqual(terrainStorage.pages.size, 0);
  });

  it('getPagePosFromPoint', async () => {
    const tmpDir = join(tmpdir(), `getPagePosFromPoint${Date.now()}`);
    console.log(tmpDir);
    const terrainStorage = new TerrainStorage(tmpDir);
    assert.strictEqual(terrainStorage.pageDiameter, 128);

    let pagePos = terrainStorage.getPagePosFromPoint(0, 0);
    assert.equal(pagePos.pageX, 0);
    assert.equal(pagePos.pageZ, 0);
    assert.equal(pagePos.offsetX, 64);
    assert.equal(pagePos.offsetZ, 64);

    pagePos = terrainStorage.getPagePosFromPoint(-64, 63);
    assert.equal(pagePos.pageX, 0);
    assert.equal(pagePos.pageZ, 0);
    assert.equal(pagePos.offsetX, 0);
    assert.equal(pagePos.offsetZ, 127);

    pagePos = terrainStorage.getPagePosFromPoint(11, -12);
    assert.equal(pagePos.pageX, 0);
    assert.equal(pagePos.pageZ, 0);
    assert.equal(pagePos.offsetX, 75);
    assert.equal(pagePos.offsetZ, 52);

    pagePos = terrainStorage.getPagePosFromPoint(64, -65);
    assert.equal(pagePos.pageX, 1);
    assert.equal(pagePos.pageZ, -1);
    assert.equal(pagePos.offsetX, 0);
    assert.equal(pagePos.offsetZ, 127);
  });

  it('setPoint & getPage', async () => {
    const tmpDir = join(tmpdir(), `setPoint${Date.now()}`);
    const terrainStorage = new TerrainStorage(tmpDir);
    assert.strictEqual(terrainStorage.pageDiameter, 128);
    const radius = terrainStorage.pageDiameter / 2;

    const defaultPage = terrainStorage.makeDefaultPage();

    // Those pages are supposed to be pristine: they should be
    // identical to the default one
    let page1 = await terrainStorage.getPage(-2, 4);
    let page2 = await terrainStorage.getPage(1000, -100);
    assert.strictEqual(JSON.stringify(page1), JSON.stringify(defaultPage));
    assert.strictEqual(JSON.stringify(page2), JSON.stringify(defaultPage));
    assert.strictEqual(terrainStorage.pages.size, 2);

    // Modify those pages by setting some points on them
    const point1 = [-2 * terrainStorage.pageDiameter - radius,
        4 * terrainStorage.pageDiameter - radius];
    const point2 = [1000 * terrainStorage.pageDiameter - radius,
        -100 * terrainStorage.pageDiameter - radius];
    await terrainStorage.setPoint(point1[0], point1[1], 230, 2, 3, false);
    await terrainStorage.setPoint(point2[0], point2[1], -20, 5, 0, true);

    // Those same pages should now be different from the default one
    page1 = await terrainStorage.getPage(-2, 4);
    page2 = await terrainStorage.getPage(1000, -100);
    assert.notEqual(JSON.stringify(page1), JSON.stringify(defaultPage));
    assert.notEqual(JSON.stringify(page2), JSON.stringify(defaultPage));
    assert.strictEqual(JSON.stringify(terrainStorage.pages.get('-2_4')),
        JSON.stringify(page1));
    assert.strictEqual(JSON.stringify(terrainStorage.pages.get('1000_-100')),
        JSON.stringify(page2));
    assert.strictEqual(terrainStorage.pages.size, 2);
  });

  it('setNode', async () => {
    const tmpDir = join(tmpdir(), `setNode${Date.now()}`);
    const terrainStorage = new TerrainStorage(tmpDir);
    const nodeSize = 64; // 8 * 8
    const heights = new Array(nodeSize).fill(1024);
    const textures = new Array(nodeSize).fill(3);

    await terrainStorage.setNode(-5, 10, 16, 24, 8, heights, textures, true);
    const page = await terrainStorage.getPage(-5, 10);
    assert.strictEqual(page.elevationData[24 * terrainStorage.pageDiameter
        + 16], 1024);
    assert.strictEqual(page.elevationData[(24 + 7) * terrainStorage.pageDiameter
        + 16 + 7], 1024);
    assert.strictEqual(page.textureData[24 * terrainStorage.pageDiameter
        + 16], 3);
    assert.strictEqual(page.textureData[(24 + 7) * terrainStorage.pageDiameter
        + 16 + 7], 3);
  });

  it('getPageName', async () => {
    assert.strictEqual(getPageName(0, 0), '0_0');
    assert.strictEqual(getPageName(1, 2), '1_2');
    assert.strictEqual(getPageName(-10, 50000), '-10_50000');

    assert.throws(() => getPageName('test', 0), Error);
    assert.throws(() => getPageName(0, 'test'), Error);
    assert.throws(() => getPageName(0, 3.14), Error);
    assert.throws(() => getPageName(420.69, 0), Error);
  });
});
