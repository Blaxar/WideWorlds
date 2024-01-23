/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {getPageName, zeroElevationValue, isPointEnabled, getPointTexture,
  getPointRotation, pointDisabledValue, defaultPageDiameter,
  unpackElevationData, packElevationData}
  from '../../common/terrain-utils.js';
import WaterStorage from '../../server/water-storage.js';
import * as assert from 'assert';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import * as fs from 'fs';

// Testing Core application state machine
describe('WaterStorage', () => {
  it('constructor', async () => {
    const tmpDir = join(tmpdir(), `constructor${Date.now()}`);
    const waterStorage = new WaterStorage(tmpDir, 64);

    assert.strictEqual(waterStorage.folder, tmpDir);
    assert.strictEqual(waterStorage.pageDiameter, 64);
    assert.strictEqual(waterStorage.pages.size, 0);
  });

  it('getPagePosFromPoint', async () => {
    const tmpDir = join(tmpdir(), `getPagePosFromPoint${Date.now()}`);

    const waterStorage = new WaterStorage(tmpDir);
    assert.strictEqual(waterStorage.pageDiameter, defaultPageDiameter);

    let pagePos = waterStorage.getPagePosFromPoint(0, 0);
    assert.equal(pagePos.pageX, 0);
    assert.equal(pagePos.pageZ, 0);
    assert.equal(pagePos.offsetX, 64);
    assert.equal(pagePos.offsetZ, 64);

    pagePos = waterStorage.getPagePosFromPoint(-64, 63);
    assert.equal(pagePos.pageX, 0);
    assert.equal(pagePos.pageZ, 0);
    assert.equal(pagePos.offsetX, 0);
    assert.equal(pagePos.offsetZ, 127);

    pagePos = waterStorage.getPagePosFromPoint(11, -12);
    assert.equal(pagePos.pageX, 0);
    assert.equal(pagePos.pageZ, 0);
    assert.equal(pagePos.offsetX, 75);
    assert.equal(pagePos.offsetZ, 52);

    pagePos = waterStorage.getPagePosFromPoint(64, -65);
    assert.equal(pagePos.pageX, 1);
    assert.equal(pagePos.pageZ, -1);
    assert.equal(pagePos.offsetX, 0);
    assert.equal(pagePos.offsetZ, 127);
  });

  it('setPoint & getPage', async () => {
    const tmpDir = join(tmpdir(), `setPoint${Date.now()}`);
    const waterStorage = new WaterStorage(tmpDir);
    assert.strictEqual(waterStorage.pageDiameter, 128);
    const radius = waterStorage.pageDiameter / 2;
    const pageSize = waterStorage.pageDiameter * waterStorage.pageDiameter;

    const defaultPage = waterStorage.makeDefaultPage();

    // Those pages are supposed to be pristine: they should be
    // identical to the default one
    let page1 = await waterStorage.getPage(-2, 4);
    let page2 = await waterStorage.getPage(1000, -100);
    assert.strictEqual(JSON.stringify(page1), JSON.stringify(defaultPage));
    assert.strictEqual(JSON.stringify(page2), JSON.stringify(defaultPage));
    assert.strictEqual(waterStorage.pages.size, 2);
    assert.strictEqual(page1.length, pageSize);
    assert.ok(page1 instanceof Uint16Array);
    assert.strictEqual(page2.length, pageSize);
    assert.ok(page2 instanceof Uint16Array);

    // Modify those pages by setting some points on them
    const point1 = [-2 * waterStorage.pageDiameter - radius,
        4 * waterStorage.pageDiameter - radius];
    const point2 = [1000 * waterStorage.pageDiameter - radius,
        -100 * waterStorage.pageDiameter - radius];
    await waterStorage.setPoint(point1[0], point1[1], 230, 2, 3, false);
    await waterStorage.setPoint(point2[0], point2[1], -20, 5, 0, true);

    // Those same pages should now be different from the default one
    page1 = await waterStorage.getPage(-2, 4);
    page2 = await waterStorage.getPage(1000, -100);
    assert.notEqual(JSON.stringify(page1), JSON.stringify(defaultPage));
    assert.notEqual(JSON.stringify(page2), JSON.stringify(defaultPage));
    assert.strictEqual(JSON.stringify(waterStorage.pages.get('-2_4')),
        JSON.stringify(page1));
    assert.strictEqual(JSON.stringify(waterStorage.pages.get('1000_-100')),
        JSON.stringify(page2));
    assert.strictEqual(waterStorage.pages.size, 2);
    assert.strictEqual(page1.length, pageSize);
    assert.ok(page1 instanceof Uint16Array);
    assert.strictEqual(page2.length, pageSize);
    assert.ok(page2 instanceof Uint16Array);
  });

  it('getPageFilePath', async () => {
    const tmpDir = join(tmpdir(), `getPageFilePath${Date.now()}`);
    const waterStorage = new WaterStorage(tmpDir);

    let path = waterStorage.getPageFilePath(5, -10);

    assert.strictEqual(path, null);
    assert.ok(!fs.existsSync(path));

    await waterStorage.savePage(5, -10);
    path = waterStorage.getPageFilePath(5, -10);

    assert.strictEqual(path, join(tmpDir, '5_-10.water.png'));
    assert.ok(fs.existsSync(path));
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
  });

  it('(un)packElevationdata', async () => {
    const tmpDir = join(tmpdir(), `packElevationdata${Date.now()}`);
    const waterStorage = new WaterStorage(tmpDir);
    const pageSize = defaultPageDiameter * defaultPageDiameter;

    const page = await waterStorage.getPage(1, 2);
    const packedElevationData = packElevationData(page);

    // Expecting Uint8Array with endian cue at the begining
    assert.strictEqual(packedElevationData.length, pageSize * 2 + 2);
    assert.strictEqual(new Uint16Array(packedElevationData.buffer)[0], 0x1144);

    const unpackedElevationData = unpackElevationData(packedElevationData);
    assert.strictEqual(unpackedElevationData.length, pageSize);
  });
});
