/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {entityType} from '../../../common/ws-data-format.js';
import {Group, Vector3, Quaternion, Euler} from 'three';

const userNodeNameRegex = /^user#([0-9]+)$/i;
const nbUpdateTimeSamples = 5;

/**
 * Core Entity class, takes entity states as input to integrate
 * and 3D scene.
 */
class EntityManager {
  /**
   * @constructor
   * @param {Group} group - three.js group object to put the entities in.
   * @param {integer} localUserId - ID of the local user.
   * @param {number} avgUpdateTime - Initial guess for the average elapsed time
   *                                 (in seconds) between each update.
   * @param {function} setEntityAvatar - Callback function to set avatars on
   *                                     entities (to be called each frame).
   * @param {function} animateEntityImp - Callback function to update implicit
   *                                      animations on entities (each frame).
   * @param {function} animateEntityExp - Callback function to update explicit
   *                                      animations on entities (each frame).
   */
  constructor(group, localUserId = null, avgUpdateTime = 0.05,
      setEntityAvatar = () => {}, animateEntityImp = () => {},
      animateEntityExp = () => {}) {
    this.group = group;
    this.setLocalUserId(localUserId);
    this.avgUpdateTime = avgUpdateTime;
    this.setEntityAvatar = setEntityAvatar;
    this.animateEntityImp = animateEntityImp;
    this.animateEntityExp = animateEntityExp;
    this.entityData = new Map();
    this.entityData.set('users', {buffers: [new Map(), new Map()], id: 0});
    this.updateTimeSamples = [];
    this.resetProgress = false;

    // Convenience 3D objects
    this.srcRot = new Quaternion();
    this.dstRot = new Quaternion();
    this.newRot = new Quaternion();
    this.tmpVec3 = new Vector3();
    this.tmpEuler = new Euler();
  }

  /**
   * Get the average time between two updates from the server
   * @return {integer} Average update time (in milliseconds).
   */
  getAvgUpdateTimeMs() {
    return parseInt(this.avgUpdateTime * 1000);
  }

  /**
   * Set the ID of the local user
   * @param {integer} id - ID of the local user.
   */
  setLocalUserId(id) {
    this.localUserId = id;
  }

  /**
   * Add a new time sample to compute the average
   * @param {number} time - Timestamp (in seconds) to sample in.
   */
  sampleUpdateTime(time = Date.now() / 1000.) {
    this.updateTimeSamples.push(time);

    // Not enough samples to compute even a single delta of time
    if (this.updateTimeSamples.length < 2) return;

    if (this.updateTimeSamples.length > nbUpdateTimeSamples) {
      this.updateTimeSamples.shift();
    }

    let avgDelta = 0;
    let previousSample = this.updateTimeSamples[0];

    for (const t of this.updateTimeSamples.slice(1)) {
      avgDelta += (t - previousSample);
      previousSample = t;
    }

    this.avgUpdateTime = avgDelta / (this.updateTimeSamples.length - 1);
  }

  /**
   * Update entities
   * @param {Array.<WorldEntity>} entities - Array of entities.
   */
  update(entities) {
    // We only care about actual users for the moment
    const userData = this.entityData.get('users');
    const bufferId = (userData.id + 1) % 2;
    const userBuffer = userData.buffers[bufferId];
    userBuffer.clear();

    for (const entity of entities) {
      entity.progress = 0.;

      if (entity.entityType === entityType.user) {
        userBuffer.set(entity.entityId, entity);
      }
    }

    // Flip RW buffers
    userData.id = bufferId;
    this.resetProgress = true;
    this.sampleUpdateTime();
  }

  /** Remove the current entities (if any) */
  clear() {
    this.group.clear();
    const buffers = this.entityData.get('users').buffers;
    buffers[0].clear();
    buffers[1].clear();
  }

  /**
   * Update single entity position and rotation in the 3D scene
   * @param {Object3D} obj3d - 3D prop representing the entity.
   * @param {WorldEntity} entity - Entity state.
   * @param {number} deltaTime - Elpased time (in seconds) since last render.
   */
  interpolateEntity(obj3d, entity, deltaTime) {
    const startProgress =
        obj3d.userData.progress ? obj3d.userData.progress : 0.;
    let progress = startProgress + deltaTime / this.avgUpdateTime;

    if (progress >= 1.) {
      progress = 1.;
      obj3d.position.set(entity.x, entity.y, entity.z);
      obj3d.rotation.set(entity.pitch, entity.yaw, entity.roll,
          'YXZ');
    } else {
      const remainingProgress =
          (progress - startProgress) / (1 - startProgress);

      this.tmpVec3.set(entity.x, entity.y, entity.z);
      obj3d.position.lerp(this.tmpVec3,
          remainingProgress);

      this.srcRot.setFromEuler(obj3d.rotation);
      this.tmpEuler.set(entity.pitch, entity.yaw, entity.roll,
          'YXZ');
      this.dstRot.setFromEuler(this.tmpEuler);
      this.newRot.slerpQuaternions(this.srcRot, this.dstRot,
          remainingProgress);

      obj3d.rotation.setFromQuaternion(this.newRot);
    }

    obj3d.userData.progress = progress;
    obj3d.updateMatrix();
  }

  /**
   * Initialize single entity position and rotation in the 3D scene
   * @param {Object3D} obj3d - 3D prop representing the entity.
   * @param {WorldEntity} entity - Entity state.
   */
  initializeEntity(obj3d, entity) {
    obj3d.position.set(entity.x, entity.y, entity.z);
    obj3d.rotation.set(entity.pitch, entity.yaw, entity.roll,
        'YXZ');

    obj3d.userData.progress = 0.;
    obj3d.userData.startTime = Date.now();
    obj3d.updateMatrix();
  }

  /**
   * Update entities into the 3D scene, only take care of users
   * for the moment
   * @param {number} deltaTime - Elapsed number of seconds since last update.
   */
  step(deltaTime) {
    const userData = this.entityData.get('users');
    const userBuffer = new Map(userData.buffers[userData.id]);
    const nodesToBeRemoved = [];

    this.group.children.forEach((node) => {
      const userMatch = node.name.match(userNodeNameRegex);

      if (userMatch && userMatch[1]) {
        if (userBuffer.has(parseInt(userMatch[1]))) {
          // Update scenario
          const user = userBuffer.get(parseInt(userMatch[1]));
          this.setEntityAvatar(node, user.dataBlock0);

          // Get the sign back and convert speed and progress to expected units
          const speed = ((user.dataBlock2 << 16) >> 16) * 0.001;
          const explicitProgress =
              ((user.dataBlock3 << 16) >> 16) / (0xffff * 1.);

          if (explicitProgress) {
            this.animateEntityExp(node, user.dataBlock1, explicitProgress);
          } else {
            this.animateEntityImp(node, user.dataBlock1, speed);
          }
          node.userData.progress =
            this.resetProgress ? 0. : node.userData.progress;
          this.interpolateEntity(node, user, deltaTime);
        } else {
          // Node for user is in the scene but not in the entity buffer:
          // it must be removed
          nodesToBeRemoved.push(node);
        }

        userBuffer.delete(parseInt(userMatch[1]));
      }
    });

    for (const node of nodesToBeRemoved) {
      this.group.remove(node);
    }

    this.resetProgress = false;

    // At this point: we're only left with new users to add to the scene
    for (const user of userBuffer.values()) {
      // We don't treat the local user as yet-another-entity: updating them
      // is not the job of the entity manager.
      // TODO: Use this opportunity to do QoS regarding latency and delta
      //       with the server state?
      if (user.entityId === this.localUserId) continue;

      const userNodeName = `user#${user.entityId}`;

      const obj3d = new Group();
      obj3d.name = userNodeName;
      obj3d.userData.progress = 0.;
      this.group.add(obj3d);
      obj3d.matrixAutoUpdate = false;
      this.initializeEntity(obj3d, userBuffer.get(user.entityId));
      this.setEntityAvatar(obj3d, user.dataBlock0);
    }
  }
}

export default EntityManager;
