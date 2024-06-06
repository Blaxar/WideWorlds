/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import RWXLoader, {
  RWXMaterialManager, pictureTag, signTag, defaultAlphaTest,
} from 'three-rwx-loader';
import {Mesh, Group, BufferGeometry, BufferAttribute, MeshBasicMaterial,
  SRGBColorSpace, TextureLoader, Color, CanvasTexture, BoxHelper,
  LineBasicMaterial, RepeatWrapping} from 'three';
import * as fflate from 'fflate';
import {AWActionParser} from 'aw-action-parser';
import formatSignLines, {makeSignHTML, makeSignCanvas} from './sign-utils.js';

const unknownObjectName = '_unknown_';
const unknownObjectAxisAlignment = 'zorienty';
const maxCanvasWidth = 512;
const maxCanvasHeight = 512;

const boundingBoxName = 'rwx-bounding-box';

const defaultBoundingBoxColor = 0xffff00; // yellow
const scaledBoundingBoxColor = 0xff7f00; // orange

const scaledBoundingBoxMaterial =
    new LineBasicMaterial({color: scaledBoundingBoxColor, toneMapped: false});
const defaultBoxHelper = new BoxHelper(new Group(), defaultBoundingBoxColor);

/* Assume .rwx file extension if none is provided */
const normalizePropName = (name) =>
  name.match(/.+\.([a-zA-Z0-9]+)$/) ? name : name + '.rwx';
const isUrl = (str) => /https?:\/\//.test(str);

/**
 * Set bounding box on the input prop
 * @param {Object3D} rwx - Prop to set the bounding box on.
 */
function setBoundingBox(rwx) {
  // Add bounding box
  const boxHelper = defaultBoxHelper.clone();
  boxHelper.geometry = boxHelper.geometry.clone();
  boxHelper.setFromObject(rwx);
  boxHelper.name = boundingBoxName;
  boxHelper.visible = false;
  boxHelper.matrixAutoUpdate = false;
  rwx.add(boxHelper);
  boxHelper.updateMatrix();
  boxHelper.geometry.computeBoundingBox();
  boxHelper.geometry.attributes.position.needsUpdate = true;
}

/**
 * Make placeholder mesh for unknown props
 * @return {Mesh} Placeholder mesh.
 */
function makePlaceholderMesh() {
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

  return new Mesh(placeholderGeometry,
      [new MeshBasicMaterial({color: 0x000000})]);
}

/** Model registry for a given world catalogue path */
class ModelRegistry {
  /**
   * @constructor
   * @param {LoadingManager} loadingManager - three.js loading manager.
   * @param {string} path - Full path to the 3D assets folder.
   * @param {string} resourcePath - Full path to the textures folder.
   * @param {UserConfigNode} imageServiceNode - Configuration node for
   *                                            the image service.
   * @param {rasterizeHTML} rasterizeHTML - Instance of rasterizeHTML.
   * @param {UserConfigNode} htmlSignRenderingNode - Configuration node for
   *                                                 HTML sign rendering.
   */
  constructor(loadingManager, path, resourcePath, imageServiceNode = null,
      rasterizeHTML = null, htmlSignRenderingNode = null) {
    this.textureColorSpace = SRGBColorSpace;

    this.materialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, false, this.textureColorSpace,
        defaultAlphaTest, true);
    this.basicMaterialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, true, this.textureColorSpace,
        defaultAlphaTest, true);

    this.tmpMaterials = [];
    this.imageService = '';
    this.rasterizeHTML = rasterizeHTML;
    this.htmlSignRenderingNode = htmlSignRenderingNode;

    if (imageServiceNode) {
      // Ready image service URL and its update callback
      this.imageService = imageServiceNode.value();
      imageServiceNode.onUpdate((value) => {
        this.imageService = value;
      });
    }

    this.placeholder = makePlaceholderMesh();
    this.placeholder.name = unknownObjectName;
    this.placeholder.userData.rwx =
        {axisAlignment: unknownObjectAxisAlignment};

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
          setBoundingBox(rwx);
          rwx.name = name;
          resolve(rwx);
        }, null, () => {
          const rwx = this.placeholder.clone();
          setBoundingBox(rwx);
          resolve(rwx);
        });
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
    this.clearTmpMaterials();
  }

  /** Clear temporary materials */
  clearTmpMaterials() {
    for (const material of this.tmpMaterials) {
      material.map?.dispose();
      material.dispose();
    }

    this.tmpMaterials = [];
  }

  /**
   * Apply action string to the given 3D prop
   * @param {Object3D} obj3d - 3D asset to apply the action string to.
   * @param {string} actionString - Content of the action string.
   */
  applyActionString(obj3d, actionString) {
    const {actions, scenerySignature} =
      this.parseActions(actionString, obj3d.userData.prop?.description);
    this.applyActionsRecursive(obj3d, actions);
    obj3d.userData.scenerySignature = scenerySignature;
    return;
  }

  /**
   * Parse action string into an action dictionary
   * @param {string} actionString - Content of the action string.
   * @param {string} description - Content of the descritpion string.
   * @return {Object} Dictionary holding actions, scenerySignature and
   *                  sceneryTransform properties.
   */
  parseActions(actionString, description = null) {
    const create = {
      texture: null,
      color: null,
      solid: true,
      visible: true,
      picture: null,
      sign: null,
      scale: null,
      opacity: null,
      say: null,
    };

    let scenerySignature = '';

    const actionParserData = this.actionParser.parse(actionString);

    // We only care for 'create' actions for the moment.
    if (!actionParserData.create) return {actions: {}, scenerySignature};

    const createActions = actionParserData.create;

    for (const action of createActions) {
      switch (action.commandType) {
        case 'color':
          create.color = [action.color.r / 255.0,
            action.color.g / 255.0,
            action.color.b / 255.0];
          scenerySignature +=
            `${action.color.r}${action.color.g}${action.color.b}`;
          break;

        case 'texture':
          create.texture = action;
          scenerySignature += action.resource;
          scenerySignature += action.mask;
          break;

        case 'visible':
          create.visible = action.value;
          break;

        case 'solid':
          create.solid = action.value;
          break;

        case 'picture':
          create.picture = action;
          scenerySignature += action.resource;
          break;

        case 'say':
          create.say = action;
          break;

        case 'sign':
          create.sign = action;
          create.sign.text = action.text || description;
          break;

        case 'scale':
          create.scale = action;
          break;

        case 'opacity':
          create.opacity = action;
          break;

        default:
        // No action, we do nothing.
          break;
      }
    }

    return {actions: {create}, scenerySignature};
  }

  /**
   * Recursively apply parsed action commands to the given 3D prop,
   * for internal use by {@link applyActionString}
   * @param {Object3D} obj3d - 3D asset to apply the action string to.
   * @param {Object} actions - Parsed action commands.
   */
  applyActionsRecursive(obj3d, actions) {
    // Only deal with 'create' actions for the moment
    if (!actions.create) return;

    const boundingBox = obj3d.getObjectByName(boundingBoxName);
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

    const materials = [];

    let materialChanged = false;

    // This is a placeholder object, nothing to do
    if (obj3d.name === unknownObjectName) return;

    const {texture, color, solid, visible, picture, sign, scale, opacity, say} =
      actions.create;

    for (const material of obj3d.material) {
      if (!material.userData.rwx) {
        throw new Error('Material is missing RWX metadata');
      }

      const rwxMaterial = material.userData.rwx.material.clone();
      const originalSignature = material.name;

      if (texture) {
        if (texture?.resource) {
          rwxMaterial.texture = isUrl(texture.resource) ? this.imageService +
              texture.resource : texture.resource;
        }

        if (texture?.mask) {
          rwxMaterial.mask = isUrl(texture.mask) ? this.imageService +
              texture.mask : texture.mask;
        }

        materialChanged = true;
      } else if (color) {
        rwxMaterial.color = color;
        rwxMaterial.texture = null;
        rwxMaterial.mask = null;
      } else {
        // Nothing.
      }

      if (scale) {
        obj3d.scale.copy(scale.factor);
        boundingBox.scale.copy(scale.factor);
        boundingBox.material = scaledBoundingBoxMaterial;
      }

      if (opacity) rwxMaterial.opacity = opacity.value;


      obj3d.userData.rwx.solid = solid;
      obj3d.visible = visible;
      obj3d.userData.invisible = !visible;
      if (say) {
        obj3d.userData.say = say.text;
      }

      const lastMatId = materials.length;

      // Check if we need to apply a picture
      // and if said picture can be applied here to begin with...

      if (picture?.resource && obj3d.userData.taggedMaterials[pictureTag]
          ?.includes(lastMatId)) {
        const url = this.imageService + picture.resource;
        // Doing the above ensures us the new array of materials
        // will be updated, so if a picture is applied:
        // it will actually be visible

        rwxMaterial.texture = url;
        materialChanged = true;
      }
      const newSignature = rwxMaterial.getMatSignature();

      if (newSignature != originalSignature) materialChanged = true;

      if (!this.materialManager.hasThreeMaterialPack(newSignature)) {
        // Material with those properties does not exist yet, we create it
        this.materialManager.addRWXMaterial(rwxMaterial, newSignature);
      }

      materials.push(this.materialManager.getThreeMaterialPack(newSignature)
          .threeMat);

      // Check if we need to apply a sign
      // and if said sign can be applied here to begin with...
      if (sign && obj3d.userData.taggedMaterials[signTag]
          ?.includes(lastMatId)) {
        materialChanged = true;

        materials[lastMatId] = materials[lastMatId].clone();
        materials[lastMatId].color = new Color(1.0, 1.0, 1.0);
        this.tmpMaterials.push(materials[lastMatId]);
        this.writeTextToCanvas(
            materials[lastMatId],
            sign.text,
            sign.color,
            sign.bcolor,
        );
      }
    }

    if (materialChanged) obj3d.material = materials;
  }

  /**
   * Whether or not to use HTML rendering for signs
   * @return {boolean} True if HTML sign rendering should be used,
   *                   false otherwise.
  */
  useHtmlSignRendering() {
    return this.htmlSignRenderingNode ?
        this.htmlSignRenderingNode.value() : false;
  }

  /**
   * Write text content as a texture on a material, for internal
   * use by {@link applyActionsRecursive}
   * @param {Material} material - three.js material for the sign
   * @param {string} text - Text to write on the canvas
   * @param {Object} textColor - Text colour for the canvas
   * @param {Object} backgroundColor - Background colour for the canvas
  */
  writeTextToCanvas(material, text = '',
      textColor = {r: 255, g: 255, b: 255},
      backgroundColor = {r: 0, g: 0, b: 255}) {
    const ratio = material.userData?.ratio ? material.userData.ratio : 1.0;
    const canvas = document.createElement('canvas');
    const canvasWidth = ratio > 1 ? maxCanvasWidth : maxCanvasWidth * ratio;
    const canvasHeight = ratio > 1 ? maxCanvasHeight / ratio : maxCanvasHeight;

    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const {r, g, b} = backgroundColor;

    const ctx = canvas.getContext('2d');
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const {lines, fontSize, maxLineWidth} = formatSignLines(text, ctx);

    if (this.useHtmlSignRendering() && this.rasterizeHTML) {
      // HTML rasterization rendering
      const {r, g, b} = textColor;

      this.rasterizeHTML.drawHTML(
          makeSignHTML(lines, fontSize, canvasWidth, canvasHeight, r, g, b),
          canvas).then(
          (res) => {
            const texture = new CanvasTexture(canvas);
            texture.wrapS = RepeatWrapping;
            texture.wrapT = RepeatWrapping;
            material.map = texture;
            material.map.colorSpace = SRGBColorSpace;
            material.needsUpdate = true;
          },
          (e) => {
            console.log(e);
          },
      );
    } else {
      // Bare canvas rendering
      const {r, g, b} = textColor;

      makeSignCanvas(ctx, lines, fontSize, maxLineWidth, r, g, b);
      const texture = new CanvasTexture(canvas);
      texture.wrapS = RepeatWrapping;
      texture.wrapT = RepeatWrapping;
      material.map = texture;
      material.map.colorSpace = SRGBColorSpace;
      material.needsUpdate = true;
    }
  }
}

export default ModelRegistry;
export {normalizePropName, unknownObjectName, boundingBoxName,
  makePlaceholderMesh};
