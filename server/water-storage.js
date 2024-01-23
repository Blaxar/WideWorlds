/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {getPageName, zeroElevationValue, defaultPageDiameter}
  from '../common/terrain-utils.js';
import {Image} from 'image-js';
import {join} from 'node:path';
import * as fs from 'fs';

/** Takes care of server-side water level storage for each world */
class WaterStorage {
  /**
   * @constructor
   * @param {string} folder - Directory to store world water levels in.
   * @param {string} pageDiameter - Length of both page sides (X and Z) in
   *                                number of points.
   */
  constructor(folder, pageDiameter = defaultPageDiameter) {
    // Note: a 'page' in this case is the equivalent of a 'page' following
    // AW semantic, we get rid of the notion of node for simplicity
    this.folder = folder;
    this.pageDiameter = pageDiameter;
    this.pages = new Map();

    if (!fs.existsSync(this.folder)) {
      fs.mkdirSync(this.folder, {recursive: true});
    }
  }

  /**
   * Set point properties at given coordinates
   * @param {integer} x - X coordinate of the point.
   * @param {integer} z - Z coordinate of the point.
   * @param {integer} elevation - Elevation of the point.
   * @param {boolean} save - Whether or not to commit the changes to
   *                         PNG files (false by default).
   */
  async setPoint(x, z, elevation, save = false) {
    const {pageX, pageZ, offsetX, offsetZ} = this.getPagePosFromPoint(x, z);
    const page = await this.getPage(pageX, pageZ);

    page[offsetZ * this.pageDiameter * offsetX] =
      elevation - zeroElevationValue;

    this.pages.set(getPageName(pageX, pageZ), page);
    if (save) this.savePage(pageX, pageZ);
  }

  /**
   * Get page at given coordinates
   * @param {integer} pageX - X coordinate of the page.
   * @param {integer} pageZ - Z coordinate of the page.
   * @return {Object} Page at those given coordinates
   */
  async getPage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);

    if (this.pages.has(pageName)) {
      return this.pages.get(pageName);
    }

    return await this.loadPage(pageX, pageZ);
  }

  /**
   * Get the page with relative point coordinates corresponding to
   * absolute point coordinates
   * @param {integer} x - X coordinate of the point.
   * @param {integer} z - Z coordinate of the point.
   * @return {Object} Page with relative point coordinates
   */
  getPagePosFromPoint(x, z) {
    const radius = this.pageDiameter / 2;

    const pageX = Math.floor((x + radius) / this.pageDiameter);
    const pageZ = Math.floor((z + radius) / this.pageDiameter);
    let tempX = x;
    let tempZ = z;

    while (tempX < 0) tempX += this.pageDiameter;
    while (tempZ < 0) tempZ += this.pageDiameter;

    const offsetX = (tempX + radius) % this.pageDiameter;
    const offsetZ = (tempZ + radius) % this.pageDiameter;

    return {pageX, pageZ, offsetX, offsetZ};
  }

  /**
   * Load page at given coordinates from storage to cache, if
   * available
   * @param {integer} pageX - X coordinate of the page.
   * @param {integer} pageZ - Z coordinate of the page.
   * @return {Object} Page loaded from storage
   */
  async loadPage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);
    let page = this.makeDefaultPage();

    if (this.pages.has(pageName)) {
      page = this.pages.get(pageName);
    }

    const elevationPath = join(this.folder, `${pageName}.water.png`);

    await new Promise((resolve, reject) => {
      if (fs.existsSync(elevationPath)) {
        Image.load(elevationPath).then(
            (image) => image.data,
        ).then(
            (data) => {
              page.from(data.buffer);
              resolve();
            },
        ).catch((err) => {
          reject(err);
        });
      } else {
        resolve();
      };
    });

    this.pages.set(pageName, page);

    return page;
  }

  /**
   * Save page at given coordinates to storage
   * @param {integer} pageX - X coordinate of the page.
   * @param {integer} pageZ - Z coordinate of the page.
   */
  async savePage(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);
    const page = await this.getPage(pageX, pageZ);

    const elevationPath = join(this.folder, `${pageName}.water.png`);

    await new Promise(async (resolve, reject) => {
      const image = new Image(
          this.pageDiameter,
          this.pageDiameter,
          {
            width: this.pageDiameter,
            height: this.pageDiameter,
            components: 1,
            alpha: 0,
            colorModel: 'RGB',
            bitDepth: 16,
          },
      );

      image.data = page;

      image.save(elevationPath)
          .then(() => {
            resolve();
          })
          .catch((err) => {
            reject(err);
          });
    });
  }

  /**
   * Get PNG file path for a page at given coordinates, when
   * available (null otherwise)
   * @param {integer} pageX - X coordinate of the page.
   * @param {integer} pageZ - Z coordinate of the page.
   * @return {string} Water elevation file path
   */
  getPageFilePath(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);
    let elevationPath = join(this.folder, `${pageName}.water.png`);

    if (!fs.existsSync(elevationPath)) {
      elevationPath = null;
    }

    return elevationPath;
  }

  /**
   * Make a default flat page
   * @return {Object} Default flat page.
   */
  makeDefaultPage() {
    const length = this.pageDiameter * this.pageDiameter;

    return new Uint16Array(length).fill(zeroElevationValue);
  }
}

export default WaterStorage;
