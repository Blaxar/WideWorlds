/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Vector3, Euler} from 'three';
import {speeds} from './user-config.js';

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

    this.yAxis = new Vector3(0, 1, 0);

    this.direction = new Vector3();
    this.tmpVec3 = new Vector3();
    this.tmpEul = new Euler();

    this.runByDefault = subject.configsNode ?
      subject.configsNode.at('runByDefault').value() : false;

    this.walkSpeed = subject.configsNode ?
      subject.configsNode.at('walkSpeed').value() : speeds.walk;
    this.runSpeed = subject.configsNode ?
      subject.configsNode.at('runSpeed').value() : speeds.run;

    if (subject.configsNode) {
      subject.configsNode.at('runByDefault').onUpdate((value) => {
        this.runByDefault = value;
      });
      subject.configsNode.at('walkSpeed').onUpdate((value) => {
        this.walkSpeed = value;
      });
      subject.configsNode.at('runSpeed').onUpdate((value) => {
        this.runSpeed = value;
      });
    }
    if (this.runByDefault) {
      this.speed = this.runSpeed;
      this.lSpeed = speeds.lookFast;
      this.tSpeed = speeds.turnFast;
    } else {
      this.speed = this.walkSpeed;
      this.lSpeed = speeds.look;
      this.tSpeed = speeds.turn;
    }
  }

  // The movement code still has some bugs, such as turning right & moving right
  // Making turning faster. The same is true the other way.
  /**
   * Update user position based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    const isRunning = this.runByDefault && !this.run() ||
        !this.runByDefault && this.run();
    const isMovingLeftRight = this.left() && this.right();
    const isTurningBoth = this.turnLeft() && this.turnRight();
    if (isRunning) {
      this.speed = this.runSpeed;
      this.lSpeed = speeds.lookFast;
      this.tSpeed = speeds.turnFast;
    } else {
      this.speed = this.walkSpeed;
      this.lSpeed = speeds.look;
      this.tSpeed = speeds.turn;
    }

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

    const {x, y, z} = this.subject.user.position;

    this.subject.collider.putColliderBox(x, y, z);
  }
}

export default UserBehavior;
