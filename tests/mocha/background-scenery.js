/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {Matrix4, Group} from 'three';
import {makePlaceholderMesh} from '../../client/src/core/model-registry.js';
import BackgroundScenery from '../../client/src/core/background-scenery.js';
import * as assert from 'assert';

// Testing background scenery utility for the client
describe('BackgroundScenery', () => {
  it('constructor', () => {
    const scenery = new BackgroundScenery();

    assert.equal(scenery.meshes.size, 0);
    assert.equal(scenery.maskMap.size, 0);
    assert.equal(scenery.reverseMaskMap.size, 0);
    assert.equal(scenery.activeMasks.size, 0);
    assert.equal(scenery.group.children.length, 0);
  });

  it('Set and clear', () => {
    const scenery = new BackgroundScenery();
    const group = new Group();
    const tmpMat = new Matrix4();

    // Ready some props
    const obj1 = makePlaceholderMesh();
    let obj2 = makePlaceholderMesh();

    obj1.name = 'some1.rwx';
    obj1.position.setY(1.0);
    group.add(obj1);
    obj1.updateMatrix();
    obj1.updateMatrixWorld(true);
    const mat1 = obj1.matrixWorld.clone();

    obj2.name = 'some2.rwx';
    group.add(obj2);
    obj2.position.setZ(-3.0);
    obj2.updateMatrix();
    obj2.updateMatrixWorld(true);
    let mat2 = obj2.matrixWorld.clone();

    // Insert one of each
    scenery.set(obj1, 1);
    scenery.set(obj2, 3);

    // New entries should exist
    assert.ok(scenery.meshes.has(obj1.name));
    assert.ok(scenery.meshes.has(obj2.name));

    // Default hash is there
    assert.ok(scenery.meshes.get(obj1.name).has(0));
    assert.ok(scenery.meshes.get(obj2.name).has(0));

    const data1 = scenery.meshes.get(obj1.name).get(0);
    let data2 = scenery.meshes.get(obj2.name).get(0);

    // Validate each entry
    assert.equal(data1.mesh.name, obj1.name);
    assert.equal(data1.mesh.material.length, obj1.material.length);
    assert.equal(data1.mesh.count, 32);
    assert.equal(data1.mesh.parent, null); // Not yet visible
    assert.equal(data1.count, 1);
    assert.equal(data1.entryMap.size, 1);
    assert.strictEqual(data1.entryMap.get(obj1.id), 0);

    data1.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(mat1));
    tmpMat.set(...data1.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat1));

    assert.equal(data2.mesh.name, obj2.name);
    assert.equal(data2.mesh.material.length, obj2.material.length);
    assert.equal(data2.mesh.count, 32);
    assert.equal(data2.mesh.parent, null); // Not yet visible
    assert.equal(data2.count, 1);
    assert.strictEqual(data2.entryMap.get(obj2.id), 0);

    data2.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(mat2));
    tmpMat.set(...data2.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));

    // Validate internal state of the scenery
    assert.ok(scenery.meshes.has(obj1.name));
    assert.ok(scenery.meshes.has(obj2.name));
    assert.ok(scenery.maskMap.has(1));
    assert.ok(scenery.maskMap.has(3));
    assert.ok(scenery.reverseMaskMap.has(obj1.id));
    assert.ok(scenery.reverseMaskMap.has(obj2.id));
    assert.equal(scenery.reverseMaskMap.get(obj1.id), 1);
    assert.equal(scenery.reverseMaskMap.get(obj2.id), 3);
    assert.ok(scenery.maskMap.get(1).has('some1.rwx_0'));
    assert.ok(scenery.maskMap.get(3).has('some2.rwx_0'));
    assert.equal(scenery.maskMap.get(1).get('some1.rwx_0').name, 'some1.rwx');
    assert.equal(scenery.maskMap.get(3).get('some2.rwx_0').name, 'some2.rwx');
    assert.equal(scenery.maskMap.get(1).get('some1.rwx_0').hash, 0);
    assert.equal(scenery.maskMap.get(3).get('some2.rwx_0').hash, 0);
    assert.ok(scenery.maskMap.get(1).get('some1.rwx_0').ids.has(obj1.id));
    assert.ok(scenery.maskMap.get(3).get('some2.rwx_0').ids.has(obj2.id));
    assert.equal(scenery.activeMasks.size, 0);

    // Update position and mask key of one of them
    data2 = scenery.meshes.get(obj2.name).get(0);
    obj2.position.setZ(-300.5);
    obj2.updateMatrix();
    obj2.updateMatrixWorld(true);
    mat2 = obj2.matrixWorld.clone();

    scenery.set(obj2, 2);

    data2.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(mat2));
    tmpMat.set(...data2.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));

    assert.ok(scenery.maskMap.has(2));
    assert.ok(scenery.reverseMaskMap.has(obj2.id));
    assert.equal(scenery.reverseMaskMap.get(obj2.id), 2);
    assert.ok(scenery.maskMap.get(2).has('some2.rwx_0'));
    assert.equal(scenery.maskMap.get(2).get('some2.rwx_0').name, 'some2.rwx');
    assert.equal(scenery.maskMap.get(2).get('some2.rwx_0').hash, 0);
    assert.ok(scenery.maskMap.get(2).get('some2.rwx_0').ids.has(obj2.id));
    assert.ok(!scenery.maskMap.get(3).get('some2.rwx_0').ids.has(obj2.id));
    assert.equal(scenery.activeMasks.size, 0);

    const ogMat2 = obj2.matrixWorld.clone();

    // Keep adding up until right before the visibility threshold
    for (let i = 1; i < 15; i++) {
      const obj2 = makePlaceholderMesh();
      obj2.name = 'some2.rwx';
      group.add(obj2);
      obj2.position.setY(-i);
      obj2.updateMatrix();
      obj2.updateMatrixWorld(true);
      scenery.set(obj2, 2);

      const mat2 = obj2.matrixWorld.clone();
      const data2 = scenery.meshes.get(obj2.name).get(0);

      assert.equal(data2.mesh.name, obj2.name);
      assert.equal(data2.mesh.material.length, obj2.material.length);
      assert.equal(data2.mesh.count, 32);
      assert.strictEqual(data2.mesh.parent, null);
      assert.equal(data2.count, i + 1);

      data2.mesh.getMatrixAt(i, tmpMat);
      assert.ok(tmpMat.equals(mat2));
      tmpMat.set(...data2.matrices.slice(i * 16, (i + 1) * 16));
      tmpMat.transpose(); // Get proper column-major
      assert.ok(tmpMat.equals(mat2));
    }

    // Reach the visibility threshold
    obj2 = makePlaceholderMesh();
    obj2.name = 'some2.rwx';
    group.add(obj2);
    obj2.position.setY(-15);
    obj2.updateMatrix();
    obj2.updateMatrixWorld(true);
    scenery.set(obj2, 2);

    mat2 = obj2.matrixWorld.clone();
    data2 = scenery.meshes.get(obj2.name).get(0);

    assert.equal(data2.mesh.name, obj2.name);
    assert.equal(data2.mesh.material.length, obj2.material.length);
    assert.equal(data2.mesh.count, 32);
    assert.strictEqual(data2.mesh.parent, scenery.group); // Must have turned visible by now
    assert.equal(data2.count, 16);

    data2.mesh.getMatrixAt(15, tmpMat);
    assert.ok(tmpMat.equals(mat2));
    tmpMat.set(...data2.matrices.slice(15 * 16, 16 * 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));

    // Keep adding up until right before the size increase threshold
    for (let i = 16; i < 32; i++) {
      const obj2 = makePlaceholderMesh();
      obj2.name = 'some2.rwx';
      group.add(obj2);
      obj2.position.setY(-i);
      obj2.updateMatrix();
      obj2.updateMatrixWorld(true);
      scenery.set(obj2, 2);

      const mat2 = obj2.matrixWorld.clone();
      const data2 = scenery.meshes.get(obj2.name).get(0);

      assert.equal(data2.mesh.name, obj2.name);
      assert.equal(data2.mesh.material.length, obj2.material.length);
      assert.equal(data2.mesh.count, 32);
      assert.strictEqual(data2.mesh.parent, scenery.group);
      assert.equal(data2.count, i + 1);

      data2.mesh.getMatrixAt(i, tmpMat);
      assert.ok(tmpMat.equals(mat2));
      tmpMat.set(...data2.matrices.slice(i * 16, (i + 1) * 16));
      tmpMat.transpose(); // Get proper column-major
      assert.ok(tmpMat.equals(mat2));
    }

    // Reach the size increase threshold
    obj2 = makePlaceholderMesh();
    obj2.name = 'some2.rwx';
    group.add(obj2);
    obj2.position.setY(-32);
    obj2.updateMatrix();
    obj2.updateMatrixWorld(true);
    scenery.set(obj2, 2);

    mat2 = obj2.matrixWorld.clone();
    data2 = scenery.meshes.get(obj2.name).get(0);

    assert.equal(data2.mesh.name, obj2.name);
    assert.equal(data2.mesh.material.length, obj2.material.length);
    assert.equal(data2.mesh.count, 64);
    assert.strictEqual(data2.mesh.parent, scenery.group);
    assert.equal(data2.count, 33);

    data2.mesh.getMatrixAt(32, tmpMat);
    assert.ok(tmpMat.equals(mat2));
    tmpMat.set(...data2.matrices.slice(32 * 16, 33 * 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));

    // Validate that previous elements were properly saved after
    // resizing the internal array
    data2.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(ogMat2));
    tmpMat.set(...data2.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(ogMat2));

    // Clear everything
    scenery.clear();

    assert.equal(scenery.meshes.size, 0);
    assert.equal(scenery.maskMap.size, 0);
    assert.equal(scenery.reverseMaskMap.size, 0);
    assert.equal(scenery.activeMasks.size, 0);
    assert.equal(scenery.group.children.length, 0);
  });

  it('Unset', () => {
    const scenery = new BackgroundScenery();
    const group = new Group();
    const tmpMat = new Matrix4();
    const zeroMat = new Matrix4(...(new Array(16).fill(0)));

    for (let i = 0; i < 44; i++) {
      const obj = makePlaceholderMesh();
      obj.name = 'some.rwx';
      group.add(obj);
      obj.position.setY(-i);
      obj.updateMatrix();
      obj.updateMatrixWorld(true);
      scenery.set(obj, 2);

      const mat = obj.matrixWorld.clone();
      const data = scenery.meshes.get(obj.name).get(0);

      assert.equal(data.mesh.name, obj.name);
      assert.equal(data.mesh.material.length, obj.material.length);
      assert.equal(data.count, i + 1);

      data.mesh.getMatrixAt(i, tmpMat);
      assert.ok(tmpMat.equals(mat));
      tmpMat.set(...data.matrices.slice(i * 16, (i + 1) * 16));
      tmpMat.transpose(); // Get proper column-major
      assert.ok(tmpMat.equals(mat));
    }

    let data = scenery.meshes.get('some.rwx').get(0);

    assert.equal(data.mesh.name, 'some.rwx');
    assert.equal(data.mesh.count, 64);
    assert.strictEqual(data.mesh.parent, scenery.group);
    assert.equal(data.count, 44);

    const someObj = group.children[3];

    assert.ok(scenery.unset(someObj));

    data = scenery.meshes.get('some.rwx').get(0);
    assert.equal(data.mesh.count, 64);
    assert.equal(data.count, 44);

    const entry = data.entryMap.get(someObj.id);

    data.mesh.getMatrixAt(entry, tmpMat);
    assert.ok(tmpMat.equals(zeroMat));
    tmpMat.set(...data.matrices.slice(entry * 16, (entry + 1) * 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(zeroMat));
    assert.ok(data.freeEntries.has(entry)); // The freed entry should be listed among the ones to pick next

    // Validate internal state of the scenery
    assert.ok(scenery.meshes.has(someObj.name));
    assert.ok(scenery.maskMap.has(2));
    assert.ok(!scenery.reverseMaskMap.has(someObj.id)); // Deleted entry
    assert.ok(scenery.maskMap.get(2).has('some.rwx_0'));
    assert.equal(scenery.maskMap.get(2).get('some.rwx_0').name, 'some.rwx');
    assert.equal(scenery.maskMap.get(2).get('some.rwx_0').hash, 0);
    assert.ok(!scenery.maskMap.get(2).get('some.rwx_0').ids.has(someObj.id)); // Deleted entry
    assert.equal(scenery.activeMasks.size, 0);

    // Adding a new prop should reuse the freed entry number
    const obj = makePlaceholderMesh();
    obj.name = 'some.rwx';
    group.add(obj);
    obj.position.setY(-100);
    obj.updateMatrix();
    obj.updateMatrixWorld(true);
    scenery.set(obj, 2);

    const mat = obj.matrixWorld.clone();
    data = scenery.meshes.get(obj.name).get(0);
    assert.equal(data.count, 44);
    assert.equal(data.entryMap.get(obj.id), entry); // Entry has been reused

    data.mesh.getMatrixAt(entry, tmpMat);
    assert.ok(tmpMat.equals(mat));
    tmpMat.set(...data.matrices.slice(entry * 16, (entry + 1) * 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat));

    assert.ok(!data.freeEntries.has(entry)); // No free entries remaining

    // Removing a non-registered entry should fail...
    assert.ok(!scenery.unset(someObj));
  });

  it('Mask/Unmask', () => {
    const scenery = new BackgroundScenery();
    const group = new Group();
    const tmpMat = new Matrix4();
    const zeroMat = new Matrix4(...(new Array(16).fill(0)));

    // Ready some props;
    const obj1 = makePlaceholderMesh();
    let obj2 = makePlaceholderMesh();

    obj1.name = 'some.rwx';
    obj1.position.setY(1.0);
    group.add(obj1);
    obj1.updateMatrix();
    obj1.updateMatrixWorld(true);
    const mat1 = obj1.matrixWorld.clone();

    obj2.name = 'some.rwx';
    group.add(obj2);
    obj2.position.setZ(-3.0);
    obj2.updateMatrix();
    obj2.updateMatrixWorld(true);
    let mat2 = obj2.matrixWorld.clone();
    let ogMat2 = obj2.matrixWorld.clone();

    // Insert one of each
    scenery.set(obj1, 1);
    scenery.set(obj2, 2);
    assert.equal(scenery.activeMasks.size, 0);

    // Mask group 2
    scenery.mask(2);

    assert.equal(scenery.activeMasks.size, 1);
    assert.ok(!scenery.activeMasks.has(1));
    assert.ok(scenery.activeMasks.has(2));

    let data = scenery.meshes.get(obj1.name).get(0);

    assert.equal(data.count, 2);
    data.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(mat1)); // Not masked
    tmpMat.set(...data.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat1));

    data.mesh.getMatrixAt(1, tmpMat);
    assert.ok(tmpMat.equals(zeroMat)); // Masked
    tmpMat.set(...data.matrices.slice(16, 32));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));

    // Mask group 1
    scenery.mask(1);

    assert.equal(scenery.activeMasks.size, 2);
    assert.ok(scenery.activeMasks.has(1));
    assert.ok(scenery.activeMasks.has(2));

    data = scenery.meshes.get(obj1.name).get(0);

    assert.equal(data.count, 2);
    data.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(zeroMat)); // Masked
    tmpMat.set(...data.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat1));

    data.mesh.getMatrixAt(1, tmpMat);
    assert.ok(tmpMat.equals(zeroMat)); // Masked
    tmpMat.set(...data.matrices.slice(16, 32));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));

    // Unmask group 2
    scenery.unmask(2);

    assert.equal(scenery.activeMasks.size, 1);
    assert.ok(scenery.activeMasks.has(1));
    assert.ok(!scenery.activeMasks.has(2));

    data = scenery.meshes.get(obj1.name).get(0);

    assert.equal(data.count, 2);
    data.mesh.getMatrixAt(0, tmpMat);
    assert.ok(tmpMat.equals(zeroMat)); // Masked
    tmpMat.set(...data.matrices.slice(0, 16));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat1));

    data.mesh.getMatrixAt(1, tmpMat);
    assert.ok(tmpMat.equals(mat2)); // Unmasked
    tmpMat.set(...data.matrices.slice(16, 32));
    tmpMat.transpose(); // Get proper column-major
    assert.ok(tmpMat.equals(mat2));
  });
});
