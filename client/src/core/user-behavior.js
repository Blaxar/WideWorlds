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
  }

  /**
   * Update user position based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    this.speed = this.run() ? baseSpeed * 2 : baseSpeed;

    const direction = new Vector3();
    this.subject.getWorldDirection(direction);
    const originalDirection = direction.clone();

    // Flatten the vector so we get a meaningful ground direction (plane XZ)
    direction.setY(0);
    direction.normalize();

    // Angles between two vectors are always positive, so we need to check
    // how high the current line of sight is to determine the tilt direction
    const tilt = originalDirection.y > 0 ?
              direction.angleTo(originalDirection) :
              - direction.angleTo(originalDirection);

    direction.multiplyScalar(this.speed * delta);

    if (this.lookUp()) {
      const deltaRotX = delta * this.speed / 2;
      if (tilt + deltaRotX > absTiltLimit) {
        // Do not look above the maximum allowed tilt angle
        this.subject.rotateX(absTiltLimit - tilt);
      } else {
        this.subject.rotateX(deltaRotX);
      }
    }

    if (this.lookDown()) {
      const deltaRotX = - delta * this.speed / 2;
      if (tilt + deltaRotX < - absTiltLimit) {
        // Do not look below the minimum allowed tilt angle
        this.subject.rotateX(- absTiltLimit - tilt);
      } else {
        this.subject.rotateX(deltaRotX);
      }
    }

    if (this.turnLeft() && !this.strafe()) {
      this.subject.rotateOnWorldAxis(this.yAxis, delta * this.speed / 2);
    }

    if (this.turnRight() && !this.strafe()) {
      this.subject.rotateOnWorldAxis(this.yAxis, - delta * this.speed / 2);
    }

    if (this.moveUp() || this.jump()) {
      const d = new Vector3(0, delta * this.speed, 0);
      this.subject.position.add(d);
    }

    if (this.moveDown() || this.crouch()) {
      const d = new Vector3(0, - delta * this.speed, 0);
      this.subject.position.add(d);
    }

    if (this.forward()) {
      this.subject.position.add(direction);
    }

    if (this.backward()) {
      this.subject.position.sub(direction);
    }

    const d = direction.clone();

    if (this.left() || (this.turnLeft() && this.strafe())) {
      d.applyEuler(new Euler(0, Math.PI / 2, 0, 'YXZ'));
      this.subject.position.add(d);
    }

    if (this.right() || (this.turnRight() && this.strafe())) {
      d.applyEuler(new Euler(0, - Math.PI / 2, 0, 'YXZ'));
      this.subject.position.add(d);
    }
  }
}

export default UserBehavior;
