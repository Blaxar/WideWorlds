/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Vector3, Euler} from 'three';

// Speeds are in metres/s
const groundSpeed = [5.0, 10.0];
// const flySpeed = [5.0, 24.0];
const lookSpeed = [2, 3.5];
const turnSpeed = [2.0, 3.0];

const absTiltLimit = Math.PI / 2 * 0.95; // radians
const twicePi = Math.PI * 2;

/** Define the behavior of the local user in the 3D space based on key inputs */
class UserBehavior extends SubjectBehavior {
  /**
   * @constructor
   * @param {object} subject - Subject to update on user input.
   */
  constructor(subject) {
    super(subject);
    this.speed = groundSpeed[0]; // m/s
    // this.fSpeed = flySpeed[0];
    this.lSpeed = lookSpeed[0];
    this.tSpeed = turnSpeed[0];

    this.yAxis = new Vector3(0, 1, 0);

    this.direction = new Vector3();
    this.tmpVec3 = new Vector3();
    this.tmpEul = new Euler();
    this.runByDefault = subject.runByDefaultNode ?
      subject.runByDefaultNode.value() : false;

    if (subject.runByDefaultNode) {
      subject.runByDefaultNode.onUpdate((value) => {
        this.runByDefault = value;
      });
    }
  }

  // The movement code still has some bugs, such as turning right & moving right
  // Making turning faster. The same is true the other way.
  /**
   * Update user position based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    const doRun = this.runByDefault && !this.run() ||
        !this.runByDefault && this.run();
    const isMovingLeftRight = this.left() && this.right();
    const isTurningBoth = this.turnLeft() && this.turnRight();

    this.speed = groundSpeed[+doRun];
    // this.fSpeed = flySpeed[+doRun];
    this.lSpeed = lookSpeed[+doRun];
    this.tSpeed = turnSpeed[+doRun];
    this.subject.tilt.getWorldDirection(this.direction);
    this.tmpVec3.copy(this.direction);

    // Flatten the vector so we get a meaningful ground direction (plane XZ)
    this.direction.setY(0);
    this.direction.normalize();

    // Angles between two 3D vectors are always positive, so we need to check
    // how high the current line of sight is to determine the tilt direction
    const tilt = this.tmpVec3.y < 0 ?
              this.direction.angleTo(this.tmpVec3) :
              - this.direction.angleTo(this.tmpVec3);

    this.direction.multiplyScalar(this.speed * delta);

    if (this.lookDown()) {
      const deltaRotX = delta * this.lSpeed;
      if (tilt + deltaRotX > absTiltLimit) {
        // Do not look above the maximum allowed tilt angle
        this.tmpEul.set(absTiltLimit, 0, 0, 'YXZ');
        this.subject.tilt.setRotationFromEuler(this.tmpEul);
      } else {
        this.subject.tilt.rotateX(deltaRotX);
      }
    }

    if (this.lookUp()) {
      const deltaRotX = - delta * this.lSpeed;
      if (tilt + deltaRotX < - absTiltLimit) {
        // Do not look below the minimum allowed tilt angle
        this.tmpEul.set(- absTiltLimit, 0, 0, 'YXZ');
        this.subject.tilt.setRotationFromEuler(this.tmpEul);
      } else {
        this.subject.tilt.rotateX(deltaRotX);
      }
    }

    if (this.turnLeft() && !this.strafe()) {
      const rot = this.subject.user.rotation;
      let rotY = (rot.y + delta * this.tSpeed) % twicePi;
      if (rotY < 0) rotY += twicePi;
      this.subject.user.rotation.set(rot.x, rotY, rot.z, 'YXZ');
    }

    if (this.turnRight() && !this.strafe()) {
      const rot = this.subject.user.rotation;
      let rotY = (rot.y - delta * this.tSpeed) % twicePi;
      if (rotY < 0) rotY += twicePi;
      this.subject.user.rotation.set(rot.x, rotY, rot.z, 'YXZ');
    }

    if (this.moveUp() || this.jump()) {
      const d = new Vector3(0, delta * this.speed, 0);
      this.subject.user.position.add(d);
    }

    if (this.moveDown() || this.crouch()) {
      const d = new Vector3(0, - delta * this.speed, 0);
      this.subject.user.position.add(d);
    }

    if (this.forward()) {
      this.subject.user.position.add(this.direction);
    }

    if (this.backward()) {
      this.subject.user.position.sub(this.direction);
    }

    this.tmpVec3.copy(this.direction);

    // Prevent unwanted movement in the north-west direction
    if (this.strafe()) {
      if (isTurningBoth) {
        return;
      }
      if (this.turnLeft() && this.right()) {
        return;
      }
      if (this.turnRight() && this.left()) {
        return;
      }
    }
    if (isMovingLeftRight) {
      return;
    }

    if (this.left() || (this.turnLeft() && this.strafe())) {
      this.tmpEul.set(0, Math.PI / 2, 0, 'YXZ');
      this.tmpVec3.applyEuler(this.tmpEul);
      this.subject.user.position.add(this.tmpVec3);
    }

    if (this.right() || (this.turnRight() && this.strafe())) {
      this.tmpEul.set(0, - Math.PI / 2, 0, 'YXZ');
      this.tmpVec3.applyEuler(this.tmpEul);
      this.subject.user.position.add(this.tmpVec3);
    }
  }
}

export default UserBehavior;
