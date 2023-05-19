/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {getPageName, zeroElevationValue, isPointEnabled, getPointTexture,
  getPointRotation, pointDisabledValue, defaultPageDiameter,
  unpackElevationData, packElevationData}
  from '../../common/terrain-utils.js';
import TerrainStorage from '../../server/terrain-storage.js';
import * as assert from 'assert';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as fs from 'fs';

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

    const terrainStorage = new TerrainStorage(tmpDir);
    assert.strictEqual(terrainStorage.pageDiameter, defaultPageDiameter);

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
    const pageSize = terrainStorage.pageDiameter * terrainStorage.pageDiameter;

    const defaultPage = terrainStorage.makeDefaultPage();

    // Those pages are supposed to be pristine: they should be
    // identical to the default one
    let page1 = await terrainStorage.getPage(-2, 4);
    let page2 = await terrainStorage.getPage(1000, -100);
    assert.strictEqual(JSON.stringify(page1), JSON.stringify(defaultPage));
    assert.strictEqual(JSON.stringify(page2), JSON.stringify(defaultPage));
    assert.strictEqual(terrainStorage.pages.size, 2);
    assert.strictEqual(page1.elevationData.length, pageSize);
    assert.ok(page1.elevationData instanceof Uint16Array);
    assert.strictEqual(page1.textureData.length, pageSize);
    assert.ok(page1.textureData instanceof Uint8Array);
    assert.strictEqual(page2.elevationData.length, pageSize);
    assert.ok(page2.elevationData instanceof Uint16Array);
    assert.strictEqual(page2.textureData.length, pageSize);
    assert.ok(page2.textureData instanceof Uint8Array);

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
        assert.strictEqual(page1.elevationData.length, pageSize);
    assert.ok(page1.elevationData instanceof Uint16Array);
    assert.strictEqual(page1.textureData.length, pageSize);
    assert.ok(page1.textureData instanceof Uint8Array);
    assert.strictEqual(page2.elevationData.length, pageSize);
    assert.ok(page2.elevationData instanceof Uint16Array);
    assert.strictEqual(page2.textureData.length, pageSize);
    assert.ok(page2.textureData instanceof Uint8Array);
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

  it('getPageFilePaths', async () => {
    const tmpDir = join(tmpdir(), `setNode${Date.now()}`);
    const terrainStorage = new TerrainStorage(tmpDir);

    let paths = terrainStorage.getPageFilePaths(5, -10);

    assert.strictEqual(paths.elevationPath, null);
    assert.strictEqual(paths.texturePath, null);
    assert.ok(!fs.existsSync(paths.elevationPath));
    assert.ok(!fs.existsSync(paths.texturePath));

    await terrainStorage.savePage(5, -10);
    paths = terrainStorage.getPageFilePaths(5, -10);

    assert.strictEqual(paths.elevationPath, join(tmpDir, '5_-10.elev.png'));
    assert.strictEqual(paths.texturePath, join(tmpDir, '5_-10.tex.png'));
    assert.ok(fs.existsSync(paths.elevationPath));
    assert.ok(fs.existsSync(paths.texturePath));
  });

  it('utils', async () => {
    // Testing getPageName
    assert.strictEqual(getPageName(0, 0), '0_0');
    assert.strictEqual(getPageName(1, 2), '1_2');
    assert.strictEqual(getPageName(-10, 50000), '-10_50000');

    assert.throws(() => getPageName('test', 0), Error);
    assert.throws(() => getPageName(0, 'test'), Error);
    assert.throws(() => getPageName(0, 3.14), Error);
    assert.throws(() => getPageName(420.69, 0), Error);

    // Testing isPointEnabled
    assert.ok(isPointEnabled(123));
    assert.ok(!isPointEnabled(pointDisabledValue));

    // Testing getPointTexture
    assert.strictEqual(getPointTexture(128 + 64 + 10), 10);
    assert.strictEqual(getPointTexture(128 + 64), 0);
    assert.strictEqual(getPointTexture(128 + 7), 7);
    assert.strictEqual(getPointTexture(62), 62);

    // Testing getPointRotation
    assert.strictEqual(getPointRotation(128 + 64 + 10), 3);
    assert.strictEqual(getPointRotation(128 + 64), 3);
    assert.strictEqual(getPointRotation(128 + 7), 2);
    assert.strictEqual(getPointRotation(62), 0);
  });

  it('(un)packElevationdata', async () => {
    const tmpDir = join(tmpdir(), `packElevationdata${Date.now()}`);
    const terrainStorage = new TerrainStorage(tmpDir);
    const pageSize = defaultPageDiameter * defaultPageDiameter;

    const page = await terrainStorage.getPage(1, 2);
    const packedElevationData = packElevationData(page.elevationData);

    // Expecting Uint8Array with endian cue at the begining
    assert.strictEqual(packedElevationData.length, pageSize * 2 + 2);
    assert.strictEqual(new Uint16Array(packedElevationData.buffer)[0], 0x1144);

    const unpackedElevationData = unpackElevationData(packedElevationData);
    assert.strictEqual(unpackedElevationData.length, pageSize);
  });
});
