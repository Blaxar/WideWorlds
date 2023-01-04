import {SubjectBehavior} from './user-input.js';
import {Vector3, Euler} from 'three';

const baseSpeed = 3.0; // m/s
const absTiltLimit = Math.PI / 2 * 0.95; // radians

/** Define the behavior of the local user in the 3D space based on key inputs */
class UserBehavior extends SubjectBehavior {
  /**
   * @constructor
   * @param {object} subject - Subject to update on user input.
   */
  constructor(subject) {
    super(subject);
    this.speed = baseSpeed; // m/s
    this.yAxis = new Vector3(0, 1, 0);

    this.direction = new Vector3();
    this.tmpVec3 = new Vector3();
    this.tmpEul = new Euler();
  }

  /**
   * Update user position based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    this.speed = this.run() ? baseSpeed * 2 : baseSpeed;

    this.subject.tilt.getWorldDirection(this.direction);
    this.tmpVec3.copy(this.direction);

    // Flatten the vector so we get a meaningful ground direction (plane XZ)
    this.direction.setY(0);
    this.direction.normalize();

    // Angles between two vectors are always positive, so we need to check
    // how high the current line of sight is to determine the tilt direction
    const tilt = this.tmpVec3.y < 0 ?
              this.direction.angleTo(this.tmpVec3) :
              - this.direction.angleTo(this.tmpVec3);

    this.direction.multiplyScalar(this.speed * delta);

    if (this.lookDown()) {
      const deltaRotX = delta * this.speed / 2;
      if (tilt + deltaRotX > absTiltLimit) {
        // Do not look above the maximum allowed tilt angle
        this.tmpEul.set(absTiltLimit, 0, 0, 'YXZ');
        this.subject.tilt.setRotationFromEuler(this.tmpEul);
      } else {
        this.subject.tilt.rotateX(deltaRotX);
      }
    }

    if (this.lookUp()) {
      const deltaRotX = - delta * this.speed / 2;
      if (tilt + deltaRotX < - absTiltLimit) {
        // Do not look below the minimum allowed tilt angle
        this.tmpEul.set(- absTiltLimit, 0, 0, 'YXZ');
        this.subject.tilt.setRotationFromEuler(this.tmpEul);
      } else {
        this.subject.tilt.rotateX(deltaRotX);
      }
    }

    if (this.turnLeft() && !this.strafe()) {
      this.subject.user.rotateOnWorldAxis(this.yAxis, delta * this.speed / 2);
    }

    if (this.turnRight() && !this.strafe()) {
      this.subject.user.rotateOnWorldAxis(this.yAxis, - delta * this.speed / 2);
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
