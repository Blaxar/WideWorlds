/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import RWXLoader, {RWXMaterialManager} from 'three-rwx-loader';
import {Mesh, Group, BufferGeometry, BufferAttribute, MeshBasicMaterial,
  sRGBEncoding} from 'three';
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
   */
  constructor(loadingManager, path, resourcePath) {
    this.textureEncoding = sRGBEncoding;

    this.materialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, false, this.textureEncoding);
    this.basicMaterialManager = new RWXMaterialManager(resourcePath,
        '.jpg', '.zip', fflate, true, this.textureEncoding);

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

      obj3d.userData.rwx.solid = solid;
      obj3d.visible = visible;

      const newSignature = rwxMaterial.getMatSignature();

      if (newSignature != originalSignature) materialChanged = true;

      if (!this.materialManager.hasThreeMaterialPack(newSignature)) {
        // Material with those properties does not exist yet, we create it
        this.materialManager.addRWXMaterial(rwxMaterial, newSignature);
      }

      materials.push(this.materialManager.getThreeMaterialPack(newSignature)
          .threeMat);
    }

    if (materialChanged) obj3d.material = materials;
  }
}

export default ModelRegistry;
export {normalizePropName};
