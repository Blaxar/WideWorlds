/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import RWXLoader, {
  RWXMaterialManager, pictureTag, signTag,
} from 'three-rwx-loader';
import {Mesh, Group, BufferGeometry, BufferAttribute, MeshBasicMaterial,
  sRGBEncoding, TextureLoader, Color, CanvasTexture} from 'three';
import * as fflate from 'fflate';
import {AWActionParser} from 'aw-action-parser';

const unknownObjectName = '_unknown_';

/* Assume .rwx file extension if none is provided */
const normalizePropName = (name) =>
  name.match(/.+\.([a-zA-Z0-9]+)$/) ? name : name + '.rwx';

/** Model registry for a given world catalogue path */
class ModelRegistry {
  /**
   * @constructor
   * @param {LoadingManager} loadingManager - three.js loading manager.
   * @param {string} path - Full path to the 3D assets folder.
   * @param {string} resourcePath - Full path to the textures folder.
   * @param {UserConfigNode} imageServiceNode - Configuration node for
   *                                            the image service.
   */
  constructor(loadingManager, path, resourcePath, imageServiceNode = null) {
    this.textureEncoding = sRGBEncoding;

    this.materialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, false, this.textureEncoding);
    this.basicMaterialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, true, this.textureEncoding);

    if (this.imageService) {
      // Ready image service URL and its update callback
      this.imageService = imageServiceNode.value();
      imageServiceNode.onUpdate((value) => {
        this.imageService = value;
      });
    }

    const placeholderGeometry = new BufferGeometry();
    const positions = [
      0.0, 0.2, 0.0,
      -0.2, 0.0, 0.0,
      0.2, 0.0, 0.0,
    ];

    placeholderGeometry.setAttribute('position',
        new BufferAttribute(new Float32Array(positions), 3));
    placeholderGeometry.setIndex([0, 1, 2]);
    placeholderGeometry.addGroup(0, 3, 0);

    this.placeholder = new Mesh(placeholderGeometry,
        [new MeshBasicMaterial({color: 0x000000})]);
    this.placeholder.name = unknownObjectName;

    this.models = new Map();
    this.basicModels = new Map();
    this.avatarModels = new Map();

    this.loader = (new RWXLoader(loadingManager))
        .setRWXMaterialManager(this.materialManager)
        .setPath(path).setFlatten(true);
    this.basicLoader = (new RWXLoader(loadingManager))
        .setRWXMaterialManager(this.basicMaterialManager)
        .setPath(path).setFlatten(true);
    this.avatarLoader = (new RWXLoader(loadingManager))
        .setRWXMaterialManager(this.materialManager)
        .setPath(path).setFlatten(false);
    this.pictureLoader = new TextureLoader();
    this.pictureLoader.textureEncoding = sRGBEncoding;
    this.actionParser = new AWActionParser();
  }

  /**
   * Fetch an object from the registry, load it first if necessary and
   * use placeholder if not found, all using light-sensitive materials
   * @param {string} rawName - Name of the 3D object to load.
   * @return {Promise} Promise of a three.js Object3D asset.
   */
  async get(rawName) {
    const name = normalizePropName(rawName);
    if (!this.models.has(name)) {
      this.models.set(name, new Promise((resolve) => {
        this.loader.load(name, (rwx) => {
          rwx.name = name; resolve(rwx);
        }, null, () => resolve(this.placeholder.clone()));
      }));
    }

    return (await this.models.get(name)).clone();
  }

  /**
   * Fetch an object from the registry, load it first if necessary and
   * use placeholder if not found, all using light-agnostic materials
   * @param {string} rawName - Name of the 3D object to load.
   * @return {Promise} Promise of a three.js Object3D asset.
   */
  async getBasic(rawName) {
    const name = normalizePropName(rawName);
    if (!this.basicModels.has(name)) {
      this.basicModels.set(name, new Promise((resolve) => {
        this.basicLoader.load(name, (rwx) => {
          rwx.name = name; resolve(rwx);
        }, null, () => resolve(this.placeholder.clone()));
      }));
    }

    return (await this.basicModels.get(name)).clone();
  }

  /**
   * Fetch an avatar from the registry, load it first if necessary and
   * use placeholder if not found, all using light-sensitive materials
   * @param {string} rawName - Name of the 3D avatar to load.
   * @return {Promise} Promise of a three.js Object3D asset.
   */
  async getAvatar(rawName) {
    const name = normalizePropName(rawName);
    if (!this.avatarModels.has(name)) {
      this.avatarModels.set(name, new Promise((resolve) => {
        this.avatarLoader.load(name, (rwx) => {
          rwx.name = name; resolve(rwx);
        }, null, () => resolve(this.placeholder.clone()));
      }));
    }

    return (await this.avatarModels.get(name)).clone();
  }

  /** Update all animated texture to their next frame */
  texturesNextFrame() {
    this.materialManager.texturesNextFrame();
    this.basicMaterialManager.texturesNextFrame();
  }

  /** Clear all cached models */
  clear() {
    this.models.clear();
    this.basicModels.clear();
    this.avatarModels.clear();
  }

  /**
   * Apply action string to the given 3D prop
   * @param {Object3D} obj3d - 3D asset to apply the action string to.
   * @param {string} actionString - Content of the action string.
   */
  applyActionString(obj3d, actionString) {
    this.applyActionsRecursive(obj3d, this.actionParser.parse(actionString));
  }

  /**
   * Recursively apply parsed action commands to the given 3D prop,
   * for internal use by {@link applyActionString}
   * @param {Object3D} obj3d - 3D asset to apply the action string to.
   * @param {string} actions - Parsed action commands.
   */
  applyActionsRecursive(obj3d, actions) {
    if (obj3d instanceof Group) {
      // We are dealing with a group, this means we must
      // perform a recursive call to its children

      for (const child of actions.children) {
        this.applyActionsRecursive(child, actions);
      }

      return;
    } else if (!(obj3d instanceof Mesh)) {
      // If the object is neither a Group nor a Mesh, then it's invalid
      throw new Error('Invalid object type provided for action parsing');
    }
    // We only care for 'create' actions for the moment.
    const createActions = actions.create ? actions.create : [];
    const materials = [];

    let materialChanged = false;

    // This is a placeholder object, nothing to do
    if (obj3d.name === unknownObjectName) return;

    for (const material of obj3d.material) {
      if (!material.userData.rwx) {
        throw new Error('Material is missing RWX metadata');
      }

      const rwxMaterial = material.userData.rwx.material.clone();
      const originalSignature = material.name;

      let texture = null;
      let color = null;
      let solid = true;
      let visible = true;
      let picture = null;
      const sign = {};
      const scale = {};

      for (const action of createActions) {
        if (action.commandType === 'color') {
          color = [action.color.r / 255.0,
            action.color.g / 255.0,
            action.color.b / 255.0];
        } else if (action.commandType === 'texture') {
          texture = action.texture;
        } else if (action.commandType === 'visible') {
          visible = action.value;
        } else if (action.commandType === 'solid') {
          solid = action.value;
        } else if (action.commandType === 'picture') {
          picture = action.resource;
        } else if (action.commandType === 'sign') {
          sign.text = action.text || obj3d.userData.description;
          sign.bcolor = action.bcolor;
          sign.color = action.color;
        } else if (action.commandType === 'scale') {
          scale.factor = action.factor;
        }
      }

      if (texture) {
        rwxMaterial.texture = texture;
        rwxMaterial.mask = null;
      } else if (color) {
        rwxMaterial.color = color;
        rwxMaterial.texture = null;
        rwxMaterial.mask = null;
      }
      if (scale.factor) {
        obj3d.scale.copy(scale.factor);
      }
      obj3d.userData.rwx.solid = solid;
      obj3d.visible = visible;

      const newSignature = rwxMaterial.getMatSignature();

      if (newSignature != originalSignature) materialChanged = true;

      if (!this.materialManager.hasThreeMaterialPack(newSignature)) {
        // Material with those properties does not exist yet, we create it
        this.materialManager.addRWXMaterial(rwxMaterial, newSignature);
      }

      const lastMatId = materials.length;
      materials.push(this.materialManager.getThreeMaterialPack(newSignature)
          .threeMat);

      // Check if we need to apply a picture
      //  and if said picture can be applied here to begin with...
      if (picture && obj3d.userData.taggedMaterials[pictureTag]
          ?.includes(lastMatId)) {
        const url = this.imageService + picture;

        // Doing the above ensures us the new array of materials
        //  will be updated, so if a picture is applied:
        //   it will actually be visible
        materialChanged = true;

        this.pictureLoader.load(url, (image) => {
          image.encoding = sRGBEncoding;

          materials[lastMatId] = materials[lastMatId].clone();
          materials[lastMatId].color = new Color(1.0, 1.0, 1.0);
          materials[lastMatId].map = image;
          materials[lastMatId].transparent = true;
          materials[lastMatId].needsUpdate = true;
        });
      }

      // Check if we need to apply a sign
      //  and if said sign can be applied here to begin with...
      if (sign && obj3d.userData.taggedMaterials[signTag]
          ?.includes(lastMatId)) {
        materialChanged = true;

        materials[lastMatId] = materials[lastMatId].clone();
        materials[lastMatId].color = new Color(1.0, 1.0, 1.0);
        materials[lastMatId].map = new CanvasTexture(
            this.textCanvas(
                sign.text,
                materials[lastMatId].userData.ratio,
                sign.color,
                sign.bcolor,
            ),
        );
        materials[lastMatId].map.encoding = sRGBEncoding;
      }
    }

    if (materialChanged) obj3d.material = materials;
  }

  /**
   * Draws an HTMLCanvasElement as a CanvasTexture on top of a Sign object
   * for internal use by {@link applyActionsRecursive}
   * @param {string} text - Sign text to write on the canvas
   * @param {integer} ratio - Sign ratio, to make the text fit
   * @param {Array.<integer>} color - Text colour for the canvas
   * @param {Array.<integer>} bcolor - Background colour for the canvas
   * @return {CanvasTexture} Sign Canvas Texture
  */
  textCanvas(text = '', ratio = 1,
      color = {r: 255, g: 255, b: 255},
      bcolor = {r: 0, g: 0, b: 255}) {
    const canvas = document.createElement('canvas');
    canvas.width = ratio > 1 ? 256 : 256 * ratio;
    canvas.height = ratio > 1 ? 256 / ratio : 256;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${bcolor.r}, ${bcolor.g}, ${bcolor.b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    const fontSizes = [120, 50, 40, 30, 20, 10, 5];
    let fontIndex = 0;

    const words = text.split(/([ \n])/);
    let lines = [''];
    const maxWidth = canvas.width * 0.95;
    const maxHeight = (canvas.height * 0.95) / ratio;

    ctx.font = `${fontSizes[fontIndex]}px Arial`;

    // TODO: use a proper way to get line height from font size
    const fontSizeToHeightRatio = 1;
    let lineHeight = fontSizes[fontIndex] * fontSizeToHeightRatio;

    let curWordIndex = 0;

    let tentativeWord;
    let tentativeLine;

    while (curWordIndex < words.length) {
      const curLine = lines.length - 1;

      if (words[curWordIndex] === '\n') {
        tentativeWord = '';
      } else {
        tentativeWord = words[curWordIndex];
      }

      if (lines[curLine].length > 0) {
        tentativeLine = lines[curLine] + tentativeWord;
      } else {
        tentativeLine = tentativeWord;
      }

      if (
        words[curWordIndex] !== '\n' &&
        ctx.measureText(tentativeLine).width <= maxWidth
      ) {
        // TODO: use actualBoundingBoxLeft and actualBoundingBoxRight
        //  instead of .width
        // Adding word to end of line
        lines[curLine] = tentativeLine;
        curWordIndex += 1;
      } else if (
        ctx.measureText(tentativeWord).width <= maxWidth &&
        lineHeight * (curLine + 1) <= maxHeight
      ) {
        // Adding word as a new line
        lines.push(tentativeWord);
        curWordIndex += 1;
      } else if (fontIndex < fontSizes.length - 1) {
        // Retry all with smaller font size
        fontIndex += 1;
        ctx.font = `${fontSizes[fontIndex]}px Arial`;
        lineHeight = fontSizes[fontIndex] * fontSizeToHeightRatio;
        lines = [''];
        curWordIndex = 0;
      } else {
        // Min font size reached, add word as new line anyway
        lines.push(tentativeWord);
        curWordIndex += 1;
      }
    }

    lines.forEach((line, i) => {
      ctx.fillText(
          line,
          canvas.width / 2,
          canvas.height / 2 +
            i * lineHeight -
            ((lines.length - 1) * lineHeight) / 2,
      );
    });

    return canvas;
  }
}

export default ModelRegistry;
export {normalizePropName, unknownObjectName};
