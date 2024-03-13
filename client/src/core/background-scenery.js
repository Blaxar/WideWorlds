/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {InstancedMesh, Matrix4, Group} from 'three';
import {flattenGroup} from 'three-rwx-loader';

const startCount = 32;
const minimumCountThreshold = 16;
const nullMatrix = new Matrix4(...(new Array(16).fill(0)));

/** Background scenery handling, using optimized geometry */
class BackgroundScenery {
  /**
   * @constructor
   * @param {null} param - Some param.
   */
  constructor() {
    this.meshes = new Map();
    this.maskMap = new Map();
    this.reverseMaskMap = new Map();
    this.activeMasks = new Set();
    this.group = new Group();
    this.tmpMatrix = new Matrix4();
  }

  /**
   * Set a prop in the scenery, update its position if already there
   * @param {Object3D} obj3d - Instance of the prop.
   * @param {string} maskKey - Identifier for the mask.
   * @param {any} hash - Hash of the specific prop variant.
   */
  set(obj3d, maskKey, hash = 0) {
    const id = obj3d.id;
    const name = obj3d.name;

    if (!this.meshes.has(name)) {
      this.meshes.set(name, new Map());
    }

    if (!this.maskMap.has(maskKey)) {
      this.maskMap.set(maskKey, new Map());
    }

    const variants = this.meshes.get(name);
    let entry = 0;

    if (variants.has(hash)) {
      // This variant was already registered, keep adding to it
      let {mesh, matrices, entryMap, freeEntries, count} = variants.get(hash);

      if (entryMap.has(id)) {
        const entry = entryMap.get(id);
        // Instance of this prop is already there, update its position
        obj3d.matrixWorld.toArray(matrices, entry * 16);
        if (!this.activeMasks.has(maskKey)) {
          mesh.setMatrixAt(entry, obj3d.matrixWorld);
        }
      } else {
        // Instance of this prop is not there yet, create it
        entry = count;

        if (freeEntries.size) {
          entry = [...freeEntries][0];
          freeEntries.delete(entry);
        }

        entryMap.set(id, entry);

        if (count === mesh.count) {
          let tmpMatrices = mesh.instanceMatrix.array;
          mesh = new InstancedMesh(mesh.geometry, mesh.material,
              mesh.count * 2);
          mesh.instanceMatrix.array.set(tmpMatrices, 0);
          mesh.name = name;

          tmpMatrices = new Float32Array(mesh.count * 16);
          tmpMatrices.set(matrices, 0);
          matrices = tmpMatrices;
        }

        obj3d.matrixWorld.toArray(matrices, 16 * entry);
        mesh.setMatrixAt(entry, obj3d.matrixWorld);

        if (entry === count) count++;

        // Turn the mesh visible if there are enough instances of it
        if (count >= minimumCountThreshold && mesh.parent === null) {
          this.group.add(mesh);
        }

        mesh.updateMatrix();
        variants.set(hash, {mesh, matrices, entryMap, freeEntries, count});
      }
    } else {
      // Make one single mesh
      const flat = obj3d.isMesh ? obj3d : flattenGroup(obj3d);

      // Flatten geometry, make it and instanced mesh.
      const mesh = new InstancedMesh(flat.geometry, flat.material, startCount);
      mesh.name = name;

      // We store the original transformation matrices along with the instances
      // mesh so we can revert back the original values when unmasking.
      const matrices = new Float32Array(startCount * 16);
      obj3d.matrixWorld.toArray(matrices, 0);
      mesh.setMatrixAt(0, obj3d.matrixWorld);

      const entryMap = new Map();
      entryMap.set(id, entry);

      mesh.updateMatrix();
      variants.set(hash, {mesh, matrices, entryMap, freeEntries: new Set(),
        count: 1});
    }

    this.reverseMaskMap.set(id, maskKey);
    const maskEntries = this.maskMap.get(maskKey);
    const propRef = `${name}_${hash}`;

    if (maskEntries.has(propRef)) {
      const {ids} = maskEntries.get(propRef);
      // It's a set, so if the id was already there it won't be
      // duplicated
      ids.add(id);
    } else {
      maskEntries.set(propRef, {name, hash, ids: new Set([id])});
    }
  }

  /**
   * Unset a prop in the scenery, effectively removing it
   * @param {Object3D} obj3d - Instance of the prop.
   * @return {boolean} Whether the prop was registered or not.
   */
  unset(obj3d) {
    const id = obj3d.id;
    const name = obj3d.name;
    const hash = 0; // Compute hash

    const variants = this.meshes.get(name);
    if (!variants.has(hash)) return false;

    const {mesh, matrices, entryMap, freeEntries} = variants.get(hash);

    const entry = entryMap.get(id);
    if (!entry) return false;

    freeEntries.add(entry);
    nullMatrix.toArray(matrices, entry * 16);
    mesh.setMatrixAt(entry, nullMatrix);

    const maskEntries = this.maskMap.get(this.reverseMaskMap.get(id));
    if (!maskEntries) return false;

    const propRef = `${name}_${hash}`;

    if (maskEntries.has(propRef)) {
      const {ids} = maskEntries.get(propRef);
      return ids.delete(id) && this.reverseMaskMap.delete(id);
    } else {
      return false;
    }
  }

  /**
   * Mask the objects bound to a given masking key, making
   * them invisible in the scenery
   * @param {string} maskKey - Key for masking the objects.
   */
  mask(maskKey) {
    if (!this.maskMap.has(maskKey)) return;

    this.activeMasks.add(maskKey);

    const maskEntries = this.maskMap.get(maskKey);

    maskEntries.forEach(({name, hash, ids}) => {
      const variants = this.meshes.get(name);
      if (!variants) return;

      const variant = variants.get(hash);
      if (!variant) return;

      const {mesh, entryMap} = variant;

      ids.forEach((id) => {
        mesh.setMatrixAt(entryMap.get(id), nullMatrix);
        mesh.updateMatrix();
      });
    });
  }

  /**
   * Unask the objects bound to a given masking key, making
   * them visible in the scenery
   * @param {string} maskKey - Key for masking the objects.
   */
  unmask(maskKey) {
    if (!this.maskMap.has(maskKey)) return;

    this.activeMasks.delete(maskKey);

    const maskEntries = this.maskMap.get(maskKey);

    maskEntries.forEach(({name, hash, ids}) => {
      const variants = this.meshes.get(name);
      if (!variants) return;

      const variant = variants.get(hash);
      if (!variant) return;

      const {mesh, matrices, entryMap} = variant;

      ids.forEach((id) => {
        const entry = entryMap.get(id);
        this.tmpMatrix.set(...matrices.slice(entry * 16, (entry + 1) * 16));
        this.tmpMatrix.transpose();
        mesh.setMatrixAt(entryMap.get(id), this.tmpMatrix);
        mesh.updateMatrix();
      });
    });
  }

  /**
   * Clear everything
   */
  clear() {
    this.meshes.clear();
    this.maskMap.clear();
    this.reverseMaskMap.clear();
    this.activeMasks.clear();
    this.group.clear();
  }
}

export default BackgroundScenery;
