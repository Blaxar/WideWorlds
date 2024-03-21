/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {InstancedMesh, Matrix4, Group} from 'three';
import {flattenGroup} from 'three-rwx-loader';

const startCount = 32;
const minimumCountThreshold = 16;
const nullMatrix = new Matrix4(...(new Array(16).fill(0)));

const clearInstancedMesh = (mesh) => {
  for (let i = 0; i < mesh.count; i++) mesh.setMatrixAt(i, nullMatrix);
};

/** Background scenery handling, using optimized geometry */
class BackgroundScenery {
  /**
   * @constructor
   * @param {Group} group - Group holding the background scenery.
   * @param {function} getId - Function returning an ID value for
   *                           each object, returns the Object3D
   *                           ID value by default.
   */
  constructor(group = new Group(), getId = (obj3d) => obj3d.id) {
    this.meshes = new Map();
    this.maskMap = new Map(); // Get prop IDs from mask key
    this.reverseMaskMap = new Map(); // Get mask key from prop ID
    this.activeMasks = new Set();
    this.variantMap = new Map(); // Get variant from prop ID
    this.group = group;
    this.getId = getId;
    this.tmpMatrix = new Matrix4();
  }

  /**
   * Set a prop in the scenery, update its position if already there
   * @param {Object3D} obj3d - Instance of the prop.
   * @param {string} maskKey - Identifier for the mask.
   * @param {string} variant - String of the specific prop variant.
   */
  set(obj3d, maskKey, variant = '') {
    const id = this.getId(obj3d);
    const name = obj3d.name;
    const propRef = `${name}_${variant}`;

    if (!this.meshes.has(name)) {
      this.meshes.set(name, new Map());
    }

    if (!this.maskMap.has(maskKey)) {
      this.maskMap.set(maskKey, new Map());
    }

    const variants = this.meshes.get(name);
    let entry = 0;

    const previousVariant = this.variantMap.get(id);
    this.variantMap.set(id, variant);

    if (previousVariant !== variant) {
      // Object instance is changing variant, unset the previous entry first
      this.unset(obj3d, previousVariant);
    }

    if (variants.has(variant)) {
      // This variant was already registered, keep adding to it
      let {mesh, matrices, entryMap, freeEntries, count} =
          variants.get(variant);

      if (entryMap.has(id)) {
        const entry = entryMap.get(id);
        // Instance of this prop is already there, update its position

        obj3d.matrixWorld.toArray(matrices, entry * 16);
        if (this.activeMasks.has(maskKey)) {
          // Not meant to see this specific entry right now
          mesh.setMatrixAt(entry, nullMatrix);
        } else {
          mesh.setMatrixAt(entry, obj3d.matrixWorld);
        }

        const currentMaskKey = this.reverseMaskMap.get(id);

        // Update mask key if needed
        if (currentMaskKey !== maskKey) {
          this.maskMap.get(currentMaskKey).get(propRef)?.ids.delete(id);
          // The reverse mask map will be set at the end, no matter the
          // scenario
        }
      } else {
        // Instance of this prop is not there yet, create it
        entry = count;

        if (freeEntries.size) {
          entry = [...freeEntries][0];
          freeEntries.delete(entry);
        }

        entryMap.set(id, entry);

        if (entry === mesh.count) {
          // Time to double the size
          let tmpMatrices = mesh.instanceMatrix.array;
          mesh.removeFromParent();
          const oldMesh = mesh;

          mesh = new InstancedMesh(mesh.geometry, mesh.material,
              mesh.count * 2);
          clearInstancedMesh(mesh);

          mesh.instanceMatrix.array.set(tmpMatrices, 0);
          mesh.name = name;
          mesh.matrixAutoUpdate = false;
          oldMesh.dispose();

          tmpMatrices = new Float32Array(mesh.count * 16);
          tmpMatrices.set(matrices, 0);
          matrices = tmpMatrices;
        }

        obj3d.matrixWorld.toArray(matrices, entry * 16);

        if (this.activeMasks.has(maskKey)) {
          // Not meant to see this specific entry right now
          mesh.setMatrixAt(entry, nullMatrix);
        } else {
          mesh.setMatrixAt(entry, obj3d.matrixWorld);
        }

        if (entry === count) count++;

        // Turn the mesh visible if there are enough instances of it
        if (count >= minimumCountThreshold && mesh.parent === null) {
          this.group.add(mesh);
        }

        mesh.instanceMatrix.needsUpdate = true;
        variants.set(variant, {mesh, matrices, entryMap, freeEntries, count});
      }
    } else {
      // Make one single mesh
      const flat = obj3d.isMesh ? obj3d : flattenGroup(obj3d);

      // Flatten geometry, make it and instanced mesh.
      const mesh = new InstancedMesh(flat.geometry, flat.material, startCount);
      clearInstancedMesh(mesh);

      mesh.name = name;
      mesh.matrixAutoUpdate = false;

      // We store the original transformation matrices along with the instances
      // mesh so we can revert back the original values when unmasking.
      const matrices = new Float32Array(startCount * 16);
      obj3d.matrixWorld.toArray(matrices, 0);

      if (this.activeMasks.has(maskKey)) {
        // Not meant to see this specific entry right now
        mesh.setMatrixAt(entry, nullMatrix);
      } else {
        mesh.setMatrixAt(entry, obj3d.matrixWorld);
      }

      const entryMap = new Map();
      entryMap.set(id, entry);

      mesh.instanceMatrix.needsUpdate = true;
      variants.set(variant, {mesh, matrices, entryMap, freeEntries: new Set(),
        count: 1});
    }

    this.reverseMaskMap.set(id, maskKey);
    const maskEntries = this.maskMap.get(maskKey);

    if (maskEntries.has(propRef)) {
      const {ids} = maskEntries.get(propRef);
      // It's a set, so if the id was already there it won't be
      // duplicated
      ids.add(id);
    } else {
      maskEntries.set(propRef, {name, variant, ids: new Set([id])});
    }
  }

  /**
   * Unset a prop in the scenery, effectively removing it
   * @param {Object3D} obj3d - Instance of the prop.
   * @param {string} variant - String of the specific prop variant.
   * @return {boolean} Whether the prop was registered or not.
   */
  unset(obj3d, variant = '') {
    const id = this.getId(obj3d);
    const name = obj3d.name;

    const variants = this.meshes.get(name);
    if (!variants || !variants.has(variant)) return false;

    const {mesh, matrices, entryMap, freeEntries} = variants.get(variant);

    const entry = entryMap.get(id);
    if (entry === undefined) return false;

    freeEntries.add(entry);
    entryMap.delete(id);
    nullMatrix.toArray(matrices, entry * 16);
    mesh.setMatrixAt(entry, nullMatrix);
    mesh.instanceMatrix.needsUpdate = true;

    const maskEntries = this.maskMap.get(this.reverseMaskMap.get(id));
    if (!maskEntries) return false;

    const propRef = `${name}_${variant}`;

    if (maskEntries.has(propRef)) {
      const {ids} = maskEntries.get(propRef);
      return ids.delete(id) && this.reverseMaskMap.delete(id) &&
          this.variantMap.delete(id);
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
    this.activeMasks.add(maskKey);

    const maskEntries = this.maskMap.get(maskKey);
    if (!maskEntries) return;

    maskEntries.forEach(({name, variant, ids}) => {
      const variants = this.meshes.get(name);
      if (!variants) return;

      const v = variants.get(variant);
      if (!v) return;

      const {mesh, entryMap} = v;

      ids.forEach((id) => {
        const entry = entryMap.get(id);
        mesh.setMatrixAt(entry, nullMatrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /**
   * Unmask the objects bound to a given masking key, making
   * them visible in the scenery
   * @param {string} maskKey - Key for masking the objects.
   */
  unmask(maskKey) {
    this.activeMasks.delete(maskKey);

    const maskEntries = this.maskMap.get(maskKey);
    if (!maskEntries) return;

    maskEntries.forEach(({name, variant, ids}) => {
      const variants = this.meshes.get(name);
      if (!variants) return;

      const v = variants.get(variant);
      if (!v) return;

      const {mesh, matrices, entryMap} = v;

      ids.forEach((id) => {
        const entry = entryMap.get(id);
        this.tmpMatrix.set(...matrices.slice(entry * 16, (entry + 1) * 16));
        this.tmpMatrix.transpose();
        mesh.setMatrixAt(entry, this.tmpMatrix);
      });

      mesh.instanceMatrix.needsUpdate = true;
    });
  }

  /**
   * Clear everything
   */
  clear() {
    this.meshes.forEach((variants) => variants.forEach(({mesh}) => {
      mesh.dispose();
    }));
    this.meshes.clear();
    this.maskMap.clear();
    this.reverseMaskMap.clear();
    this.activeMasks.clear();
    this.variantMap.clear();
    this.group.clear();
  }
}

export default BackgroundScenery;
