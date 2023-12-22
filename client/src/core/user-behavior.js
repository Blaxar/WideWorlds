/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Vector3, Euler} from 'three';
import {speeds} from './user-config.js';
import {userStateToImplicit} from './animation-manager.js';

const absTiltLimit = Math.PI / 2 * 0.95; // radians
const twicePi = Math.PI * 2;
const gravity = new Vector3(0, -9.8, 0); // m/s/s
const jumpVelocity = 4.0; // m/s

const heightCorrectionThreshold = 0.01;
const interpolationDistance = 0.30;

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
    this.tmpPos = new Vector3();
    this.tmpVec3 = new Vector3();
    this.tmpEul = new Euler();

    this.elapsed = 0; // Elapsed time in seconds, for animations

    this.runByDefault = subject.configsNode ?
      subject.configsNode.at('runByDefault').value() : false;

    this.walkSpeed = subject.configsNode ?
      subject.configsNode.at('walkSpeed').value() : speeds.walk;
    this.runSpeed = subject.configsNode ?
      subject.configsNode.at('runSpeed').value() : speeds.run;
    this.colliderInterpolation = subject.physicsNode ?
      subject.physicsNode.at('colliderInterpolation').value() : true;

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

    if (subject.physicsNode) {
      subject.physicsNode.at('colliderInterpolation').onUpdate((value) => {
        this.colliderInterpolation = value;
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
    this.elapsed += delta;
    this.subject.state.idle = true;

    const isRunning = this.runByDefault && !this.run() ||
        !this.runByDefault && this.run();
    const isMovingLeftRight = this.left() && this.right();
    const isTurningBoth = this.turnLeft() && this.turnRight();
    if (isRunning) {
      this.subject.state.running = true;
      this.speed = this.runSpeed;
      this.lSpeed = speeds.lookFast;
      this.tSpeed = speeds.turnFast;
    } else {
      this.subject.state.running = false;
      this.speed = this.walkSpeed;
      this.lSpeed = speeds.look;
      this.tSpeed = speeds.turn;
    }

    if (this.subject.state.flying || this.subject.state.onGround ||
        this.strafe()) {
      this.subject.velocity.setY(0);
    } else {
      this.subject.velocity.add(gravity.clone().multiplyScalar(delta));
    }

    this.subject.velocity.setX(0);
    this.subject.velocity.setZ(0);

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

    this.direction.multiplyScalar(this.speed);

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

    if (this.moveUp() ||
        (this.jump() && this.subject.state.flying)) {
      this.subject.state.idle = false;
      this.tmpVec3.set(0, this.speed, 0);
      this.subject.velocity.setY(0);
      this.subject.velocity.add(this.tmpVec3);
      this.subject.state.flying = true;
    }

    if (this.moveDown() || this.crouch()) {
      this.subject.state.idle = false;
      this.tmpVec3.set(0, -this.speed, 0);
      this.subject.velocity.add(this.tmpVec3);
    }

    if (this.jump() && !this.subject.state.flying &&
        this.subject.state.onGround) {
      this.subject.state.idle = false;
      this.subject.velocity.setY(jumpVelocity);
    }

    if (this.forward()) {
      this.subject.state.idle = false;
      this.subject.velocity.add(this.direction);
    }

    if (this.backward()) {
      this.subject.state.idle = false;
      this.subject.velocity.sub(this.direction);
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
      this.subject.state.idle = false;
      this.tmpEul.set(0, Math.PI / 2, 0, 'YXZ');
      this.tmpVec3.applyEuler(this.tmpEul);
      this.subject.velocity.add(this.tmpVec3);
    }

    if (this.right() || (this.turnRight() && this.strafe())) {
      this.subject.state.idle = false;
      this.tmpEul.set(0, - Math.PI / 2, 0, 'YXZ');
      this.tmpVec3.applyEuler(this.tmpEul);
      this.subject.velocity.add(this.tmpVec3);
    }

    const movement = this.subject.velocity.clone()
        .multiplyScalar(delta);
    const interpolationSteps = [];

    if (this.colliderInterpolation && !this.strafe() &&
        movement.lengthSq() > interpolationDistance * interpolationDistance) {
      const nbSteps = parseInt(movement.length() / interpolationDistance);

      for (let i = 1; i <= nbSteps; i++) {
        interpolationSteps.push(
            movement.clone().multiplyScalar(i / parseFloat(nbSteps)),
        );
      }
    }

    interpolationSteps.push(movement);
    this.tmpPos.copy(this.subject.user.position);

    for (const mov of interpolationSteps) {
      this.tmpVec3.copy(this.tmpPos);
      this.tmpVec3.add(mov);

      const {x, y, z} = this.tmpVec3;

      const {topCollision, heightCorrection} =
          this.subject.collider.putColliderBox(x, y, z);

      if (topCollision && !this.strafe()) {
        // Colliding, can't move in that direction
        this.tmpVec3.copy(this.subject.user.position);
        this.subject.velocity.set(0, 0, 0);
        break;
      } else if (heightCorrection !== null && !this.strafe()) {
        if (heightCorrection > heightCorrectionThreshold) {
          this.tmpVec3.set(x, y + heightCorrection, z);
        }
        this.subject.state.flying = false;
        this.subject.state.onGround = true;
        this.subject.velocity.setY(0);
      } else {
        this.subject.state.onGround = false;
      }

      this.subject.user.position.copy(this.tmpVec3);
    }

    this.subject.collider.renderColliderBox(this.tmpVec3);
    this.subject.animation.animateImplicit(this.subject.getAvatar(),
        this.subject.getAvatarName(),
        userStateToImplicit(this.subject.state), this.elapsed);
  }
}

export default UserBehavior;
