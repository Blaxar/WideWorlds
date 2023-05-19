/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {getPageName, zeroElevationValue, defaultPageDiameter}
  from '../common/terrain-utils.js';
import {Image} from 'image-js';
import {join} from 'node:path';
import * as fs from 'fs';

/** Takes care of server-side terrain storage for each world */
class TerrainStorage {
  /**
   * @constructor
   * @param {string} folder - Directory to store world terrains in.
   * @param {string} pageDiameter - Length of both page sides (X and Z) in
   *                                number of points.
   */
  constructor(folder, pageDiameter = defaultPageDiameter) {
    // Note: a 'page' in this case is the equivalent of a 'page' following
    // AW semantic, we get ride of the notion of node for simplicity
    this.folder = folder;
    this.pageDiameter = pageDiameter;
    this.pages = new Map();

    if (!fs.existsSync(this.folder)) {
      fs.mkdirSync(this.folder, {recursive: true});
    }
    // TODO: load all available pages from storages
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
   * @param {boolean} save - Whether or not to commit the changes to
   *                         PNG files (false by default).
   */
  async setPoint(x, z, elevation, texture = 0, rotation = 0, enabled = true,
      save = false) {
    const {pageX, pageZ, offsetX, offsetZ} = this.getPagePosFromPoint(x, z);
    const page = await this.getPage(pageX, pageZ);

    // In the original AW elevation dump file format: a single point texture,
    // its rotation and its enabling are all encoded in a single byte.
    // The highest two order bits encode the rotation this makes it 4 possible
    // values (going counter-clockwise, rotating left).
    // The remaining amount of bits (6 of them) simply encode the ID of the
    // texture.
    // When a point is disabled (hole): the whole byte is set to 254

    if (texture > 0x3f || texture < 0) {
      throw new Error(
          'Invalid texture value provided, must be between 0 and 63',
      );
    }

    if (rotation > 3 || rotation < 0) {
      throw new Error(
          'Invalid rotation value provided, must be between 0 and 3',
      );
    }

    let textureEntry = 254;

    if (enabled) {
      textureEntry = (texture + (rotation << 6));
    }

    page.elevationData[offsetZ * this.pageDiameter * offsetX] =
      elevation - zeroElevationValue;
    page.textureData[offsetZ * this.pageDiameter * offsetX] = textureEntry;

    this.pages.set(getPageName(pageX, pageZ), page);
    if (save) this.savePage(pageX, pageZ);
  }

  /**
   * Set point properties on a given node within a page
   * @param {integer} pageX - X coordinate of the page.
   * @param {integer} pageZ - Z coordinate of the xpage.
   * @param {integer} offsetX - Starting X coordinate of the point.
   * @param {integer} offsetZ - starting Z coordinate of the point.
   * @param {integer} width - Width of the node to set.
   * @param {Array} elevationData - Elevation data.
   * @param {Array} textureData - Texture data.
   * @param {boolean} save - Whether or not to commit the changes to
   *                         PNG files (false by default).
   */
  async setNode(pageX, pageZ, offsetX, offsetZ, width, elevationData,
      textureData, save = false) {
    const page = await this.getPage(pageX, pageZ);

    const copyData = (srcData, dstData) => {
      for (let i = 0, z = 0; i < srcData.length; i += width) {
        let toCopy = (srcData.length - i);
        toCopy = toCopy > width ? width : toCopy;

        dstData.set(srcData.slice(i, i + toCopy),
            (offsetZ + z) * this.pageDiameter + offsetX);
        z++;
      }
    };

    copyData(elevationData, page.elevationData);
    copyData(textureData, page.textureData);

    this.pages.set(getPageName(pageX, pageZ), page);

    if (save) await this.savePage(pageX, pageZ);
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

    const elevationPath = join(this.folder, `${pageName}.elev.png`);
    const texturePath = join(this.folder, `${pageName}.tex.png`);

    await Promise.all([
      new Promise((resolve, reject) => {
        if (fs.existsSync(elevationPath)) {
          Image.load(elevationPath).then(
              (image) => image.data,
          ).then(
              (data) => {
                page.elevationData = new Uint16Array(data.buffer);
                resolve();
              },
          ).catch((err) => {
            reject(err);
          });
        } else {
          resolve();
        };
      }),
      new Promise((resolve, reject) => {
        if (fs.existsSync(texturePath)) {
          Image.load(texturePath).then(
              (image) => image.data,
          ).then(
              (data) => {
                page.textureData = new Uint8Array(data.buffer);
                resolve();
              },
          ).catch((err) => {
            reject(err);
          });
        } else {
          resolve();
        };
      }),
    ]);

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

    const elevationPath = join(this.folder, `${pageName}.elev.png`);
    const texturePath = join(this.folder, `${pageName}.tex.png`);

    await Promise.all([
      new Promise(async (resolve, reject) => {
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

        image.data = page.elevationData;

        image.save(elevationPath)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
      }),
      new Promise((resolve, reject) => {
        const image = new Image(
            this.pageDiameter,
            this.pageDiameter,
            {
              width: this.pageDiameter,
              height: this.pageDiameter,
              components: 1,
              alpha: 0,
              colorModel: 'RGB',
              bitDepth: 8,
            },
        );

        image.data = page.textureData;

        image.save(texturePath)
            .then(() => {
              resolve();
            })
            .catch((err) => {
              reject(err);
            });
      }),
    ]);
  }

  /**
   * Get PNG file paths for a page at given coordinates, when
   * available (null otherwise)
   * @param {integer} pageX - X coordinate of the page.
   * @param {integer} pageZ - Z coordinate of the page.
   * @return {Object} Elevation and terrain file paths
   */
  getPageFilePaths(pageX, pageZ) {
    const pageName = getPageName(pageX, pageZ);
    let elevationPath = join(this.folder, `${pageName}.elev.png`);
    let texturePath = join(this.folder, `${pageName}.tex.png`);

    if (!fs.existsSync(elevationPath)) {
      elevationPath = null;
    }

    if (!fs.existsSync(texturePath)) {
      texturePath = null;
    }

    return {elevationPath, texturePath};
  }

  /**
   * Make a default flat page
   * @return {Object} Default flat page.
   */
  makeDefaultPage() {
    const length = this.pageDiameter * this.pageDiameter;

    return {
      elevationData: new Uint16Array(length).fill(zeroElevationValue),
      textureData: new Uint8Array(length).fill(0),
    };
  }
}

export default TerrainStorage;
