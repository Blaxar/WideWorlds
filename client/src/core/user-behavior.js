import UserInput, {SubjectBehavior, SubjectBehaviorFactory, UserInputListener} from './user-input.js';
import {Vector3, Euler} from 'three';

const baseSpeed = 3.0; // m/s

// Define the behavior of the local user in the 3D space based on key inputs
class UserBehavior extends SubjectBehavior {
    constructor(subject) {
        super(subject);
        this.speed = baseSpeed; // m/s
    }

    step(delta) {
        if (this.run())
            this.speed = baseSpeed * 2;
        else
            this.speed = baseSpeed;

        if (this.turnLeft() && !this.strafe()) {
            this.subject.rotateY(delta * this.speed / 2, 0);
        }

        if (this.turnRight() && !this.strafe()) {
            this.subject.rotateY(- delta * this.speed / 2, 0);
        }

        const direction = new Vector3();
        this.subject.getWorldDirection(direction);
        direction.multiplyScalar(this.speed * delta);

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
