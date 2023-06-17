/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import RWXLoader, {
  RWXMaterialManager, pictureTag, signTag,
} from 'three-rwx-loader';
import {Mesh, Group, BufferGeometry, BufferAttribute, MeshBasicMaterial,
  SRGBColorSpace, TextureLoader, Color, CanvasTexture, BoxHelper} from 'three';
import * as fflate from 'fflate';
import {AWActionParser} from 'aw-action-parser';

const unknownObjectName = '_unknown_';
const defaultFontSize = 128;
const maxCanvasWidth = 256;
const maxCanvasHeight = 256;

const boundingBoxName = 'rwx-bounding-box';
const boundingBoxColor = 0xffff00;

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
    this.textureColorSpace = SRGBColorSpace;

    this.materialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, false, this.textureColorSpace);
    this.basicMaterialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, true, this.textureColorSpace);

    this.imageService = '';

    if (imageServiceNode) {
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
    this.pictureLoader.textureColorSpace = SRGBColorSpace;
    this.actionParser = new AWActionParser();
  }

  /**
   * Fetch an object from the registry, load it first if necessary
   * (using light-sensitive materials) and generate a bounding box
   * for it, use placeholder if not found
   * @param {string} rawName - Name of the 3D object to load.
   * @return {Promise} Promise of a three.js Object3D asset.
   */
  async get(rawName) {
    const name = normalizePropName(rawName);
    if (!this.models.has(name)) {
      this.models.set(name, new Promise((resolve) => {
        this.loader.load(name, (rwx) => {
          // Add bounding box
          const boxHelper = new BoxHelper(rwx, boundingBoxColor);
          boxHelper.name = boundingBoxName;
          boxHelper.visible = false;
          boxHelper.matrixAutoUpdate = false;
          rwx.name = name;
          rwx.add(boxHelper);
          boxHelper.updateMatrix();
          resolve(rwx);
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
    if (!actions.create) return;
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
          image.colorSpace = SRGBColorSpace;

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
        materials[lastMatId].map.colorSpace = SRGBColorSpace;
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
    const canvasWidth = ratio > 1 ? maxCanvasWidth : maxCanvasWidth * ratio;
    const canvasHeight = ratio > 1 ? maxCanvasHeight / ratio : maxCanvasHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${bcolor.r},${bcolor.g},${bcolor.b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
    ctx.textBaseline = 'middle';

    let fontSize = defaultFontSize;
    let fontFit = false;

    // Find the maximum font size that fits the text without cropping
    while (!fontFit && fontSize > 0) {
      ctx.font = fontSize + 'px Arial';
      const lines = this.breakTextIntoLines(text, ctx, canvasWidth);

      const totalHeight = lines.length * fontSize * 1.2;
      const totalWidth = Math.max(
          ...lines.map((line) => ctx.measureText(line).width),
      );

      if (totalHeight <= canvasHeight && totalWidth <= canvasWidth) {
        fontFit = true;
      } else {
        fontSize--;
      }
    }

    const lines = this.breakTextIntoLines(text, ctx, canvasWidth);

    ctx.font = fontSize + 'px Arial';
    ctx.textBaseline = 'top';

    const lineHeight = fontSize * 1.2;
    const startY = (canvasHeight - lines.length * lineHeight) / 2;

    lines.forEach((line, index) => {
      const textWidth = ctx.measureText(line).width;
      const startX = (canvasWidth - textWidth) / 2;
      const y = startY + index * lineHeight;
      ctx.fillText(line, startX, y);
    });

    return canvas;
  }

  /**
   * Breaks the text into lines to fit within the given maximum width
   * @param {string} text - The text to break into lines
   * @param {CanvasRenderingContext2D} ctx - The canvas rendering context
   * @param {integer} maxWidth - The maximum width of a line
   * @return {Array.<string>} The array of lines
  */
  breakTextIntoLines( text = '', ctx, maxWidth) {
    const lines = [];
    const paragraphs = text.split('\n');

    paragraphs.forEach((paragraph) => {
      const words = paragraph.split(' ');
      let currentLine = '';

      words.forEach((word) => {
        if (word.length === 0) {
          // Skip empty words
          return;
        }

        const metrics = ctx.measureText(`${currentLine} ${word}`);
        const lineWidth = metrics.width;

        if (lineWidth < maxWidth || currentLine.length === 0) {
          currentLine += ` ${word}`;
        } else {
          lines.push(currentLine.trim());
          currentLine = word;
        }
      });

      if (currentLine.length > 0) {
        lines.push(currentLine.trim());
      }
    });

    // Handle empty lines at the end of the text
    const emptyLineCount = [...text].reduceRight((count, char, index) => {
      if (char === '\n' && index === text.length - count - 1) {
        return count + 1;
      }
      return count;
    }, 0);

    // Add empty lines at the end
    lines.push(...Array(emptyLineCount).fill(''));

    return lines;
  }
}

export default ModelRegistry;
export {normalizePropName, unknownObjectName, boundingBoxName};
