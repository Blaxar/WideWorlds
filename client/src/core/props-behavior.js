/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Raycaster, Vector3, Vector2, Quaternion, Euler} from 'three';
import {boundingBoxName} from './model-registry.js';

const inputCooldown = 100; // In Milliseconds
const defaultMaxCastingDistance = 2000; // In meters

/** Handle props selection */
class PropsSelector {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Main WideWorlds 3D engine.
   * @param {Engine3D} worldManager - Main world manager instance.
   * @param {UserConfigNode} renderingDistanceNode - Configuration node
   *                                                 for the rendering
   *                                                 distance.
   */
  constructor(engine3d, worldManager, renderingDistanceNode = null) {
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

    this.avgPos = new Vector3();
    this.lastRot = new Euler();

    this.renderingDistanceNode = renderingDistanceNode;
    this.maxCastingDistance = defaultMaxCastingDistance;

    if (this.renderingDistanceNode) {
      this.maxCastingDistance =
          this.renderingDistanceNode.value();

      this.renderingDistanceNode.onUpdate((value) => {
        this.maxCastingDistance = value;
      });
    }
  }

  /**
   * Select a prop for building mode
   * @param {Vector2} pointer - 2D Pointer for the raycaster.
   * @param {boolean} add - True to add the newfound prop to the existing
   *                        selection list, false (default) to clear the
   *                        list first.
   */
  select(pointer, add = false) {
    let done = false;

    this.clickRaycaster.setFromCamera(
        pointer, this.engine3d.camera,
    );

    const intersects =
        this.clickRaycaster.intersectObjects(
            this.engine3d.scene.children, true,
        );

    for (const intersect of intersects) {
      if (intersect.distance < this.maxCastingDistance &&
          intersect.object.name.length > 0 &&
          intersect.object.name != boundingBoxName &&
          intersect.object.visible) {
        // If the object was already selected: nothing to be done
        if (this.props.includes(intersect.object)) break;

        if (!add) {
          // If we're not in multiprop selection mode:
          // commit the current content to the server
          this.commitAndClear();
        }

        // We expect the object to have pre-computed bounding box geometry
        let boundingBox = intersect.object
            .getObjectByName(boundingBoxName);
        if (!boundingBox) continue;

        const prop = boundingBox.parent;
        prop.userData['originalProp'] =
            JSON.parse(JSON.stringify(prop.userData.prop));

        boundingBox = boundingBox.clone();
        const {x, y, z} = prop.userData.prop;
        boundingBox.position.set(x, y, z);
        boundingBox.visible = true;
        this.engine3d.addHelperObject(boundingBox);
        this.props.push({prop, boundingBox});

        // TODO: Remove when prop selection UI is implemented,
        //       left there in the meantime for debug purposes.
        console.log(prop);
        console.log('Avatar Pos: ' +
            [this.engine3d.user.position.x, this.engine3d.user.position.y,
              this.engine3d.user.position.z]);
        done = true;
        break;
      }
    }

    this.updateArrows();

    if (done) return;

    // Clicked outside of a prop: commit everything
    this.commitAndClear();
  }

  /** Clear selected props list */
  clear() {
    this.props = [];
  }

  /**
   * Update helper arrows position and orientation, hide them
   * if no props are provided
   */
  updateArrows() {
    if (this.props.length) {
      this.avgPos.set(0, 0, 0);

      for (const {prop} of this.props) {
        const {x, y, z} = prop.userData.prop;
        this.avgPos.add(prop.position.clone().set(x, y, z)
            .divideScalar(this.props.length));
        this.lastRot.copy(prop.rotation);
      }

      this.engine3d.setHelperArrows(this.avgPos, this.lastRot);
    } else {
      this.engine3d.unsetHelperArrows();
    }
  }

  /** Commit changes to server and clear selected props list */
  commitAndClear() {
    for (const {boundingBox} of this.props) {
      this.engine3d.removeHelperObject(boundingBox);
    }

    this.worldManager.updateProps(this.props.map(({prop}) => prop));

    this.clear();
    this.updateArrows();
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

    propsSelector.props.forEach(({prop, boundingBox}) => {
      const obj3d = prop;
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

      boundingBox.rotation.copy(obj3d.rotation);
      boundingBox.position.copy(this.absPropPos);
      boundingBox.updateMatrix();

      obj3d.position.copy(this.absPropPos.sub(this.anchorPropPos));
      obj3d.updateMatrix();
    });

    propsSelector.updateArrows();
  }
}

export default PropsBehavior;
export {PropsSelector};
