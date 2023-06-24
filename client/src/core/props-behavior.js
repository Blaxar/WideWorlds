/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Raycaster, Vector3, Vector2, Quaternion} from 'three';
import {boundingBoxName} from './model-registry.js';

const inputCooldown = 100; // In Milliseconds

/** Handle props selection */
class PropsSelector {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Main WideWorlds 3D engine.
   * @param {Engine3D} worldManager - Main world manager instance.
   */
  constructor(engine3d, worldManager) {
    this.engine3d = engine3d;
    this.worldManager = worldManager;
    this.clickRaycaster = new Raycaster();
    this.currentWorldId = null;
    this.mainDirection = new Vector3(0.0, 0.0, 1.0); // North by default
    this.tmpVec3 = new Vector3();
    this.tmpVec2 = new Vector2();
    this.directions = [
      new Vector2(0.0, 1.0),
      new Vector2(-1.0, 0.0),
      new Vector2(0.0, -1.0),
      new Vector2(1.0, 0.0),
    ];

    this.props = [];
  }

  /**
   * Select a prop for building mode
   * @param {Vector2} pointer - 2D Pointer for the raycaster.
   * @param {boolean} add - True to add the newfound prop to the existing
   *                        selection list, false (default) to clear the
   *                        list first.
   */
  select(pointer, add = false) {
    this.clickRaycaster.setFromCamera(
        pointer, this.engine3d.camera,
    );

    const intersects =
        this.clickRaycaster.intersectObjects(
            this.engine3d.scene.children, true,
        );

    for (let i = 0; i < intersects.length; i++) {
      if (intersects[i].object.name.length > 0 &&
          intersects[i].object.name != boundingBoxName) {
        // If the object was already selected: nothing to be done
        if (this.props.includes(intersects[i].object)) break;

        if (!add) {
          // If we're not in multiprop selection mode:
          // commit the current content to the server
          this.commitAndClear();
        }

        // We expect the object to have pre-computed bounding box geometry
        const bb = intersects[i].object.getObjectByName(boundingBoxName);
        if (!bb) continue;

        const prop = bb.parent;
        prop.userData['originalProp'] =
            JSON.parse(JSON.stringify(prop.userData.prop));

        bb.visible = true;
        this.props.push(prop);

        // TODO: Remove when prop selection UI is implemented,
        //       left there in the meantime for debug purposes.
        console.log(bb.parent);
        console.log('Avatar Pos: ' +
            [this.engine3d.user.position.x, this.engine3d.user.position.y,
              this.engine3d.user.position.z]);
        return;
      }
    }

    // Clicked outside of a prop: commit everything
    this.commitAndClear();
  }

  /** Commit changes to server and clear selected props list */
  commitAndClear() {
    for (const prop of this.props) {
      prop.getObjectByName(boundingBoxName).visible = false;
    }

    this.worldManager.updateProps(this.props);

    this.props = [];
  }

  /**
   * Tell whether or not the selection list is empty
   * @return {boolean} True if no props are selected, false otherwise.
   */
  isEmpty() {
    return this.props.length === 0;
  }

  /**
   * Determine the main axis to move objects along when the 'forward'
   * command is requested
   * @param {Camera} camera - three.js camera instance.
   */
  updateMainAxis(camera) {
    camera.getWorldDirection(this.tmpVec3);

    // Flatten the vector so we get a meaningful ground direction (plane XZ)
    this.tmpVec3.setY(0);
    this.tmpVec3.normalize();

    this.tmpVec2.set(this.tmpVec3.x, this.tmpVec3.z);

    // Find the best-matching direction
    this.directions.sort((a, b) => {
      return this.tmpVec2.dot(b) - this.tmpVec2.dot(a);
    });

    this.mainDirection.set(this.directions[0].x, 0.0, this.directions[0].y);
  }
};

/** Define the behavior of the props in the 3D space based on key inputs */
class PropsBehavior extends SubjectBehavior {
  /**
   * @constructor
   * @param {PropsSelector} subject - Subject to update on user input.
   */
  constructor(subject) {
    super(subject);

    this.upAxis = new Vector3(0.0, 1.0, 0.0);
    this.quatRot = new Quaternion();
    this.absPropPos = new Vector3();
    this.relPropPos = new Vector3();
    this.anchorPropPos = new Vector3();
    this.lastInput = 0;
  }

  /**
   * Update props position and rotation based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    const propsSelector = this.subject;
    const now = Date.now();
    let moveLength = 0.5; // half a meter
    let rotateAngle = Math.PI / 12.0; // One clock-hour

    if (now - this.lastInput < inputCooldown) {
      // Too soon to do anything, skip
      return;
    }

    if (this.strafe()) {
      moveLength = 0.01; // one centimeter
      rotateAngle = Math.PI / 1800.0; // tenth of a degree
    }

    this.lastInput = now;

    propsSelector.props.forEach((obj3d) => {
      this.absPropPos.set(obj3d.userData.prop.x, obj3d.userData.prop.y,
          obj3d.userData.prop.z);
      this.relPropPos.set(obj3d.position.x, obj3d.position.y,
          obj3d.position.z);
      this.anchorPropPos.copy(this.absPropPos.clone().sub(this.relPropPos));

      if (this.moveUp() && !this.moveDown()) {
        this.absPropPos.setY(this.absPropPos.y + moveLength);
      } else if (!this.moveUp() && this.moveDown()) {
        this.absPropPos.setY(this.absPropPos.y - moveLength);
      }

      if (this.forward() && !this.backward()) {
        this.absPropPos.add(propsSelector.mainDirection.clone()
            .multiplyScalar(moveLength));
      } else if (!this.forward() && this.backward()) {
        this.absPropPos.sub(propsSelector.mainDirection.clone()
            .multiplyScalar(moveLength));
      }

      if (this.left() && !this.right()) {
        this.absPropPos.add(propsSelector.mainDirection.clone()
            .applyAxisAngle(this.upAxis, Math.PI / 2)
            .multiplyScalar(moveLength));
      } else if (!this.left() && this.right()) {
        this.absPropPos.add(propsSelector.mainDirection.clone()
            .applyAxisAngle(this.upAxis, - Math.PI / 2)
            .multiplyScalar(moveLength));
      }

      // TODO: other rotation axis
      if (this.turnLeft() && !this.turnRight()) {
        obj3d.rotateY(rotateAngle);
      } else if (!this.turnLeft() && this.turnRight()) {
        obj3d.rotateY(- rotateAngle);
      }

      obj3d.userData.prop.x = this.absPropPos.x;
      obj3d.userData.prop.y = this.absPropPos.y;
      obj3d.userData.prop.z = this.absPropPos.z;

      if (obj3d.userData.rwx.axisAlignment === 'none') {
        obj3d.userData.prop.pitch = obj3d.rotation.x;
        obj3d.userData.prop.yaw = obj3d.rotation.y;
        obj3d.userData.prop.roll = obj3d.rotation.z;
      }

      obj3d.position.copy(this.absPropPos.sub(this.anchorPropPos));

      obj3d.updateMatrix();
    });
  }
}

export default PropsBehavior;
export {PropsSelector};
