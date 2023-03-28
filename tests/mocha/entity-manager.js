/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as THREE from 'three';
import EntityManager from '../../client/src/core/entity-manager.js';
import {serializeEntityState, deserializeEntityState, entityType, updateType}
  from '../../common/ws-data-format.js';
import {epsEqual, sleep} from '../utils.js';
import * as assert from 'assert';

const makeEntityState = (id, uType, x = 0, y = 0, z = 0, yaw = 0, pitch = 0, roll = 0) => {
  // TODO: use easier position and rotation to test, make it params as well?
  const updateType = uType;
  const entityId = id;

  return {entityType: entityType.user, updateType, entityId, x, y, z, yaw, pitch, roll};
};

// Testing common utils
describe('entity-manager', () => {
  it('constructor', () => {
    const group = new THREE.Group();
    const entityManager = new EntityManager(group, 2, 0.01);

    assert.strictEqual(entityManager.group, group);
    assert.strictEqual(entityManager.localUserId, 2);
    assert.strictEqual(entityManager.avgUpdateTime, 0.01);
    assert.ok(entityManager.entityData instanceof Map);
    assert.strictEqual(entityManager.entityData.size, 1);
    assert.ok(entityManager.entityData.has('users'));

    const userData = entityManager.entityData.get('users');

    assert.strictEqual(userData.buffers.length, 2);
    assert.ok(userData.buffers[0] instanceof Map);
    assert.ok(userData.buffers[1] instanceof Map);
    assert.strictEqual(userData.id, 0);
    assert.strictEqual(entityManager.updateTimeSamples.length, 0);
  });

  it('sampleUpdateTime', () => {
    const group = new THREE.Group();
    const entityManager = new EntityManager(group, 2, 0.01);

    assert.strictEqual(entityManager.avgUpdateTime, 0.01);
    assert.strictEqual(entityManager.getAvgUpdateTimeMs(), 10);
    assert.strictEqual(entityManager.updateTimeSamples.length, 0);

    // Sample once, average update time won't be updated yet
    entityManager.sampleUpdateTime(1.0);
    assert.strictEqual(entityManager.avgUpdateTime, 0.01);
    assert.strictEqual(entityManager.getAvgUpdateTimeMs(), 10);
    assert.strictEqual(entityManager.updateTimeSamples.length, 1);

    // Sample once again: the average update time should be updated
    entityManager.sampleUpdateTime(1.5);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 0.5));
    assert.strictEqual(entityManager.getAvgUpdateTimeMs(), 500);
    assert.strictEqual(entityManager.updateTimeSamples.length, 2);

    // Sample a few more times to fill the sample queue up
    entityManager.sampleUpdateTime(2.0);
    entityManager.sampleUpdateTime(2.5);
    entityManager.sampleUpdateTime(3.0);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 0.5));
    assert.strictEqual(entityManager.getAvgUpdateTimeMs(), 500);
    assert.strictEqual(entityManager.updateTimeSamples.length, 5);

    // Sample once more: should not overflow and remove the first
    // inserted value
    entityManager.sampleUpdateTime(3.5);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 0.5));
    assert.strictEqual(entityManager.getAvgUpdateTimeMs(), 500);
    assert.strictEqual(entityManager.updateTimeSamples.length, 5);
    assert.strictEqual(entityManager.updateTimeSamples[0], 1.5);

    // Sample a few more times to completely flush the queue and
    // generate a new average
    entityManager.sampleUpdateTime(4.0);
    entityManager.sampleUpdateTime(5.0);
    entityManager.sampleUpdateTime(6.0);
    entityManager.sampleUpdateTime(7.0);
    entityManager.sampleUpdateTime(8.0);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 1.0));
    assert.strictEqual(entityManager.getAvgUpdateTimeMs(), 1000);
    assert.strictEqual(entityManager.updateTimeSamples.length, 5);
    assert.strictEqual(entityManager.updateTimeSamples[0], 4.0);
  });

  it('update and step', () => {
    const group = new THREE.Group();
    const entityManager = new EntityManager(group, 2, 0.01); // local user ID is 2

    const users = [makeEntityState(1, updateType.joining), makeEntityState(2, updateType.joining),
        makeEntityState(3, updateType.joining, 1., -1., 2., Math.PI / 2.)];

    // Test the initial setup before any update
    const userData = entityManager.entityData.get('users');
    assert.strictEqual(userData.buffers.length, 2);
    assert.ok(userData.buffers[0] instanceof Map);
    assert.ok(userData.buffers[1] instanceof Map);
    assert.strictEqual(userData.id, 0);
    assert.strictEqual(entityManager.updateTimeSamples.length, 0);
    assert.strictEqual(group.children.length, 0);

    // First update: 2 users in the list
    entityManager.update(users);

    assert.strictEqual(userData.id, 1); // the double buffer id should have been flipped
    assert.strictEqual(entityManager.updateTimeSamples.length, 1); // Time should have been sampled
    assert.ok(userData.buffers[1].size, 3); // Expecting the 2 users to be in the second buffer (Reading one)

    // Check the content of the buffers
    assert.equal(JSON.stringify(userData.buffers[1].get(1)), JSON.stringify(users[0]));
    assert.equal(JSON.stringify(userData.buffers[1].get(2)), JSON.stringify(users[1]));
    assert.equal(JSON.stringify(userData.buffers[1].get(3)), JSON.stringify(users[2]));

    // TESTING ONLY: manually sample update time to get a certain average for interpolation
    entityManager.sampleUpdateTime(0.0);
    entityManager.sampleUpdateTime(0.2);
    entityManager.sampleUpdateTime(0.4);
    entityManager.sampleUpdateTime(0.6);
    entityManager.sampleUpdateTime(0.8);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 0.2));

    // Step a first time: nothing should have been interpolated so far
    entityManager.step(0.1);

    // The 3D group should hold only 2 children: the remote users and not the local one
    assert.strictEqual(group.children.length, 2);

    let user1 = group.getObjectByName('user#1');
    let user2 = group.getObjectByName('user#2');
    let user3 = group.getObjectByName('user#3');

    assert.equal(user1.name, 'user#1'); // remote user should be in
    assert.strictEqual(user2, undefined); // local user should not be in
    assert.equal(user3.name, 'user#3'); // remote user should be in

    assert.ok(epsEqual(user1.position.x, users[0].x));
    assert.ok(epsEqual(user1.position.y, users[0].y));
    assert.ok(epsEqual(user1.position.z, users[0].z));
    assert.ok(epsEqual(user1.rotation.y, users[0].yaw));
    assert.ok(epsEqual(user1.rotation.x, users[0].pitch));
    assert.ok(epsEqual(user1.rotation.z, users[0].roll));

    assert.ok(epsEqual(user3.position.x, users[2].x));
    assert.ok(epsEqual(user3.position.y, users[2].y));
    assert.ok(epsEqual(user3.position.z, users[2].z));
    assert.ok(epsEqual(user3.rotation.y, users[2].yaw));
    assert.ok(epsEqual(user3.rotation.x, users[2].pitch));
    assert.ok(epsEqual(user3.rotation.z, users[2].roll));

    // Second update: position changed
    const users2 = [makeEntityState(1, updateType.moving, 1., -1., 2., Math.PI / 2.),
        makeEntityState(2, updateType.moving, 2., -2., 4.),
        makeEntityState(3, updateType.moving, 2., -2., 4., Math.PI / 2.)];

    entityManager.update(users2);

    // TESTING ONLY...
    entityManager.sampleUpdateTime(0.0);
    entityManager.sampleUpdateTime(0.2);
    entityManager.sampleUpdateTime(0.4);
    entityManager.sampleUpdateTime(0.6);
    entityManager.sampleUpdateTime(0.8);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 0.2));

    // Step so that each entity has progressed half way through
    entityManager.step(0.1);

    // The 3D group should hold only 2 children: the remote users and not the local one
    assert.strictEqual(group.children.length, 2);

    user1 = group.getObjectByName('user#1');
    user2 = group.getObjectByName('user#2');
    user3 = group.getObjectByName('user#3');

    assert.equal(user1.name, 'user#1'); // remote user should still be in
    assert.strictEqual(user2, undefined); // local user should still not be in
    assert.equal(user3.name, 'user#3'); // remote user should still be in

    assert.ok(epsEqual(user1.position.x, users[0].x + (users2[0].x - users[0].x) / 2.));
    assert.ok(epsEqual(user1.position.y, users[0].y + (users2[0].y - users[0].y) / 2.));
    assert.ok(epsEqual(user1.position.z, users[0].z + (users2[0].z - users[0].z) / 2.));
    assert.ok(epsEqual(user1.rotation.y, users[0].yaw + (users2[0].yaw - users[0].yaw) / 2.));
    assert.ok(epsEqual(user1.rotation.x, users[0].pitch + (users2[0].pitch - users[0].pitch) / 2.));
    assert.ok(epsEqual(user1.rotation.z, users[0].roll + (users2[0].roll - users[0].roll) / 2.));

    assert.ok(epsEqual(user3.position.x, users[2].x + (users2[2].x - users[2].x) / 2.));
    assert.ok(epsEqual(user3.position.y, users[2].y + (users2[2].y - users[2].y) / 2.));
    assert.ok(epsEqual(user3.position.z, users[2].z + (users2[2].z - users[2].z) / 2.));
    assert.ok(epsEqual(user3.rotation.y, users[2].yaw + (users2[2].yaw - users[2].yaw) / 2.));
    assert.ok(epsEqual(user3.rotation.x, users[2].pitch + (users2[2].pitch - users[2].pitch) / 2.));
    assert.ok(epsEqual(user3.rotation.z, users[2].roll + (users2[2].roll - users[2].roll) / 2.));

    // Step so that each entity has progressed one more quarter of the way through
    entityManager.step(0.05);

    // The 3D group should hold only 2 children: the remote users and not the local one
    assert.strictEqual(group.children.length, 2);

    user1 = group.getObjectByName('user#1');
    user2 = group.getObjectByName('user#2');
    user3 = group.getObjectByName('user#3');

    assert.equal(user1.name, 'user#1'); // remote user should still be in
    assert.strictEqual(user2, undefined); // local user should still not be in
    assert.equal(user3.name, 'user#3'); // remote user should still be in

    assert.ok(epsEqual(user1.position.x, users[0].x + (users2[0].x - users[0].x) * 0.75));
    assert.ok(epsEqual(user1.position.y, users[0].y + (users2[0].y - users[0].y) * 0.75));
    assert.ok(epsEqual(user1.position.z, users[0].z + (users2[0].z - users[0].z) * 0.75));
    assert.ok(epsEqual(user1.rotation.y, users[0].yaw + (users2[0].yaw - users[0].yaw) * 0.75));
    assert.ok(epsEqual(user1.rotation.x, users[0].pitch + (users2[0].pitch - users[0].pitch) * 0.75));
    assert.ok(epsEqual(user1.rotation.z, users[0].roll + (users2[0].roll - users[0].roll) * 0.75));

    assert.ok(epsEqual(user3.position.x, users[2].x + (users2[2].x - users[2].x) * 0.75));
    assert.ok(epsEqual(user3.position.y, users[2].y + (users2[2].y - users[2].y) * 0.75));
    assert.ok(epsEqual(user3.position.z, users[2].z + (users2[2].z - users[2].z) * 0.75));
    assert.ok(epsEqual(user3.rotation.y, users[2].yaw + (users2[2].yaw - users[2].yaw) * 0.75));
    assert.ok(epsEqual(user3.rotation.x, users[2].pitch + (users2[2].pitch - users[2].pitch) * 0.75));
    assert.ok(epsEqual(user3.rotation.z, users[2].roll + (users2[2].roll - users[2].roll) * 0.75));

    // Step so that each entity has progressed the remaining quarter of the way
    entityManager.step(0.05);

    assert.ok(epsEqual(user1.position.x, users2[0].x));
    assert.ok(epsEqual(user1.position.y, users2[0].y));
    assert.ok(epsEqual(user1.position.z, users2[0].z));
    assert.ok(epsEqual(user1.rotation.y, users2[0].yaw));
    assert.ok(epsEqual(user1.rotation.x, users2[0].pitch));
    assert.ok(epsEqual(user1.rotation.z, users2[0].roll));

    assert.ok(epsEqual(user3.position.x, users2[2].x));
    assert.ok(epsEqual(user3.position.y, users2[2].y));
    assert.ok(epsEqual(user3.position.z, users2[2].z));
    assert.ok(epsEqual(user3.rotation.y, users2[2].yaw));
    assert.ok(epsEqual(user3.rotation.x, users2[2].pitch));
    assert.ok(epsEqual(user3.rotation.z, users2[2].roll));

    // Second update: user left
    const users3 = [makeEntityState(2, updateType.moving, 2., -2., 4.),
        makeEntityState(3, updateType.moving, 2., -2., 4., Math.PI / 2.)];

    entityManager.update(users3);

    // TESTING ONLY...
    entityManager.sampleUpdateTime(0.0);
    entityManager.sampleUpdateTime(0.2);
    entityManager.sampleUpdateTime(0.4);
    entityManager.sampleUpdateTime(0.6);
    entityManager.sampleUpdateTime(0.8);
    assert.ok(epsEqual(entityManager.avgUpdateTime, 0.2));

    // Step, this time we don't expect any movement on the remaining entity
    entityManager.step(0.1);

    // The 3D group should hold only 1 children: the remaining remote user and not the local one
    assert.strictEqual(group.children.length, 1);

    user1 = group.getObjectByName('user#1');
    user2 = group.getObjectByName('user#2');
    user3 = group.getObjectByName('user#3');

    assert.equal(user1, undefined); // remote user should no loger be here
    assert.strictEqual(user2, undefined); // local user should still not be in
    assert.equal(user3.name, 'user#3'); // remote user should still be in

    assert.ok(epsEqual(user3.position.x, users3[1].x));
    assert.ok(epsEqual(user3.position.y, users3[1].y));
    assert.ok(epsEqual(user3.position.z, users3[1].z));
    assert.ok(epsEqual(user3.rotation.y, users3[1].yaw));
    assert.ok(epsEqual(user3.rotation.x, users3[1].pitch));
    assert.ok(epsEqual(user3.rotation.z, users3[1].roll));
  });
});
