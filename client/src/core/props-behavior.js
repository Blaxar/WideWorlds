/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Raycaster, Vector3, Vector2, Quaternion, Euler, Box3} from 'three';
import {boundingBoxName} from './model-registry.js';
import {pageAssetName} from '../../../common/terrain-utils.js';

const inputCooldown = 100; // In Milliseconds
const defaultMaxCastingDistance = 2000; // In meters
const defaultMoveLength = 0.5; // Half a meter
const defaultRotationAngle = Math.PI / 12.0; // One clock-hour
const smallMoveLength = 0.01; // One centimeter
const smallRotationAngle = Math.PI / 1800.0; // Tenth of a degree

/** Handle props selection */
class PropsSelector {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Main WideWorlds 3D engine.
   * @param {Engine3D} worldManager - Main world manager instance.
   * @param {function} onChange - Callback function on change of
   *                              the selection, takes the number
   *                              of selected props as argument.
   * @param {UserConfigNode} renderingDistanceNode - Configuration node
   *                                                 for the rendering
   *                                                 distance.
   */
  constructor(engine3d, worldManager, onChange = (n) => {},
      renderingDistanceNode = null) {
    this.engine3d = engine3d;
    this.worldManager = worldManager;
    this.clickRaycaster = new Raycaster();
    this.currentWorldId = null;
    this.mainDirection = new Vector3(0.0, 0.0, 1.0); // North by default
    this.propDirection = new Vector3(0.0, 0.0, 1.0); // Z by default
    this.tmpVec3 = new Vector3();
    this.tmpVecSize = new Vector3();
    this.tmpVec2 = new Vector2();
    this.nullVec2 = new Vector2();
    this.upAxis = new Vector3(0.0, 1.0, 0.0);

    this.directions = [
      new Vector2(0.0, 1.0),
      new Vector2(-1.0, 0.0),
      new Vector2(0.0, -1.0),
      new Vector2(1.0, 0.0),
    ];

    this.smartMoveLength = 0;
    this.useWorldDirection = false;
    this.props = [];

    this.avgPos = new Vector3();
    this.lastRot = new Euler();
    this.lastBox = new Box3();

    this.notifyChange = onChange;
    this.renderingDistanceNode = renderingDistanceNode;
    this.maxCastingDistance = defaultMaxCastingDistance;

    this.absPropPos = new Vector3();
    this.relPropPos = new Vector3();
    this.anchorPropPos = new Vector3();
    this.rotateCenter = new Vector3();

    // Create a node for staged objects, this will avoid
    // committing props update on the fly in the real
    // scene, thus simplifying rolling everything back
    // if/when we get interrupted
    this.stagingNode = this.engine3d.spawnNode();

    this.hasChanged = false;

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
      if (intersect.object.name == pageAssetName) {
        // Some terrain page has been selected, which is the equivalent
        // of clicking into the void as far as the props-selector
        // is concerned
        if (!add) {
          // If we're not in multiprop selection mode:
          // commit the current content to the server
          this.commitAndClear();
        }

        done = true;
        break;
      }

      if (intersect.distance < this.maxCastingDistance &&
          intersect.object.name.length > 0 &&
          intersect.object.name != boundingBoxName &&
          intersect.object.visible &&
          intersect.object.userData.prop &&
          intersect.object.parent.visible) {
        // If the object was already selected: nothing to be done
        if (!this.props.every(({stagingProp}) => {
          return intersect.object.id !== stagingProp.id;
        })) {
          done = true;
          break;
        }

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
        boundingBox = boundingBox.clone();

        const {x, y, z} = prop.userData.prop;

        // Ready the staging prop
        const stagingProp = prop.clone();
        stagingProp.position.set(x, y, z);
        stagingProp.userData['originalProp'] =
            JSON.parse(JSON.stringify(prop.userData.prop));

        this.engine3d.appendToNode(this.stagingNode, stagingProp);
        stagingProp.updateMatrix();
        prop.visible = false;

        boundingBox.position.set(x, y, z);
        boundingBox.rotation.copy(prop.rotation);
        boundingBox.updateMatrix();
        boundingBox.visible = true;
        this.engine3d.addHelperObject(boundingBox);
        this.props.push({prop, stagingProp, boundingBox});

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
    this.notifyChange(this.props.length);

    if (done) return;

    // Clicked outside of a prop: commit everything
    this.commitAndClear();
  }

  /** Clear selected props list */
  clear() {
    for (const {boundingBox} of this.props) {
      this.engine3d.removeHelperObject(boundingBox);
    }

    this.props = [];
    this.engine3d.wipeNode(this.stagingNode);
    this.hasChanged = false;
    this.updateArrows();
  }

  /**
   * Update helper arrows position and orientation, hide them
   * if no props are provided
   */
  updateArrows() {
    if (this.props.length) {
      this.avgPos.set(0, 0, 0);

      for (const {stagingProp, boundingBox} of this.props) {
        const {x, y, z} = stagingProp.userData.prop;
        this.avgPos.add(stagingProp.position.clone().set(x, y, z)
            .divideScalar(this.props.length));
        this.lastRot.copy(stagingProp.rotation);
        this.lastBox.copy(boundingBox.geometry.boundingBox);
      }

      this.lastBox.getSize(this.tmpVecSize);

      this.smartMoveLength = this.tmpVecSize.x > this.tmpVecSize.z ?
        this.tmpVecSize.x : this.tmpVecSize.z;

      this.engine3d.setHelperArrows(this.avgPos, this.lastRot);
    } else {
      this.engine3d.unsetHelperArrows();
    }
  }

  /** Commit changes to server */
  commit() {
    if (this.hasChanged) {
      const propsToCreate = [];
      const propsToUpdate = [];

      this.props.forEach(({stagingProp}) => {
        if (stagingProp.userData.prop.id === null) {
          propsToCreate.push(stagingProp);
        } else {
          propsToUpdate.push(stagingProp);
        }
      });

      this.worldManager
          .createProps(propsToCreate);

      this.worldManager
          .updateProps(propsToUpdate)
          .then((propsToBeReset) => {
            propsToBeReset.forEach((prop) => {
              prop.visible = true;
            });
          });
    } else {
      this.props.forEach(({prop}) => {
        prop.visible = true;
      });
    }
  }

  /** Commit changes to server and clear selected props list */
  commitAndClear() {
    this.commit();
    this.clear();
    this.notifyChange(this.props.length);
  }

  /**
   * Commit changes to server and copy thee selected props list
   * @param {Vector3} direction - Direction to move the props (in meters).
   */
  commitAndCopy(direction =
  this.propDirection.clone().multiplyScalar(defaultMoveLength)) {
    this.commit();
    this.move(direction);
    this.hasChanged = true;

    this.props.map(({prop, stagingProp, boundingBox}) => {
      // We signify this is a brand new object by erasing the ID
      // on the staginf prop.
      stagingProp.userData.prop.id = null;

      // Remove the reference to the original prop as well
      return {prop: null, stagingProp, boundingBox};
    });

    this.notifyChange(this.props.length);
  }

  /** Delete props from the server and clear selected props list */
  removeAndClear() {
    this.worldManager
        .removeProps(this.props.map(({stagingProp}) => stagingProp)
            .filter((p) => {
              // Props without any ID were meant to be created first
              // and do not exist on the server
              return p.userData.prop.id !== null &&
                p.userData.prop.id !== undefined;
            }))
        .then((propsToBeReset) => {
          propsToBeReset.forEach((prop) => {
            prop.visible = true;
          });
        });

    this.clear();
    this.notifyChange(this.props.length);
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

  /**
   * Determine the relative prop axis to move objects along when the 'forward'
   * command is requested
   * @param {Camera} camera - three.js camera instance.
   */
  updatePropAxis(camera) {
    camera.getWorldDirection(this.tmpVec3);

    // Flatten the vector so we get a meaningful ground direction (plane XZ)
    this.tmpVec3.setY(0);
    this.tmpVec3.normalize();

    this.tmpVec2.set(this.tmpVec3.x, this.tmpVec3.z);

    const propDirections = this.directions.map((vec2) => {
      return vec2.clone().rotateAround(this.nullVec2, -this.lastRot.y);
    });

    // Find the best-matching direction
    propDirections.sort((a, b) => {
      return this.tmpVec2.dot(b) - this.tmpVec2.dot(a);
    });

    this.propDirection.set(propDirections[0].x, 0.0, propDirections[0].y);
  }

  /**
   * Get the forward direction to be considered when moving prop selection
   * @return {Vector3D} Forward direction to be considered when moving prop
   *                    selection.
   */
  cloneDirection() {
    return this.useWorldDirection ? this.mainDirection.clone() :
        this.propDirection.clone();
  }

  /**
   * Tell if absolute world axes are being used as reference for direction
   * when moving prop selection
   * @return {boolean} Whether or not absolute world axes are being
   *                   used as reference, false means relative
   *                   prop direction will be used instead.
   */
  usingWorldDirection() {
    return this.useWorldDirection;
  }

  /**
   * Enable or disable absolute world axes as reference for direction when
   * moving prop selection
   * @param {boolean} value - Whether or not to use absolute world axes as
   *                          reference, false means relative prop
   *                          direction will be used instead.
   */
  setUseWorldDirection(value) {
    this.useWorldDirection = value;
  }

  /**
   * Move the selected props in the given absolute direction
   * @param {Vector3} direction - Direction to move the props (in meters).
   */
  move(direction) {
    this.hasChanged = true;

    this.props.forEach(({stagingProp, boundingBox}) => {
      const obj3d = stagingProp;
      this.absPropPos.set(obj3d.userData.prop.x, obj3d.userData.prop.y,
          obj3d.userData.prop.z);
      this.relPropPos.set(obj3d.position.x, obj3d.position.y,
          obj3d.position.z);
      this.anchorPropPos.copy(this.absPropPos.clone().sub(this.relPropPos));

      this.absPropPos.add(direction);

      obj3d.userData.prop.x = this.absPropPos.x;
      obj3d.userData.prop.y = this.absPropPos.y;
      obj3d.userData.prop.z = this.absPropPos.z;

      boundingBox.position.copy(this.absPropPos);
      boundingBox.updateMatrix();

      obj3d.position.copy(this.absPropPos.sub(this.anchorPropPos));
      obj3d.updateMatrix();
    });

    this.updateArrows();
  }

  /**
   * Rotate the selected props around a certain axis and given
   * a certain angle, the center position to rotate around will
   * be the center of the group, averaged using the absolute
   * position from each individual prop
   * @param {Vector3} axis - Normalized 3D axis to rotate props around.
   * @param {number} angle - Angle by which to rotate the prop around the
   *                         axis (in radians).
   */
  rotate(axis, angle) {
    this.rotateCenter.set(0.0, 0.0, 0.0);

    this.hasChanged = true;

    this.props.forEach(({stagingProp}) => {
      const {x, y, z} = stagingProp.userData.prop;
      this.rotateCenter.add(new Vector3(x, y, z));
    });

    this.rotateCenter.divideScalar(this.props.length);

    this.props.forEach(({stagingProp, boundingBox}) => {
      const obj3d = stagingProp;
      this.absPropPos.set(obj3d.userData.prop.x, obj3d.userData.prop.y,
          obj3d.userData.prop.z);
      this.relPropPos.set(obj3d.position.x, obj3d.position.y,
          obj3d.position.z);
      this.anchorPropPos.copy(this.absPropPos.clone().sub(this.relPropPos));

      this.absPropPos.sub(this.rotateCenter);
      this.absPropPos.applyAxisAngle(axis, angle);
      this.absPropPos.add(this.rotateCenter);

      obj3d.userData.prop.x = this.absPropPos.x;
      obj3d.userData.prop.y = this.absPropPos.y;
      obj3d.userData.prop.z = this.absPropPos.z;

      obj3d.rotateOnAxis(axis, angle);

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

    this.updateArrows();
  }

  /**
   * Get the name of the single selected prop
   * @return {string} Name of the prop, null if no prop or many props.
   */
  getSinglePropName() {
    return this.props.length == 1 ?
        this.props[0].stagingProp.userData.prop.name : null;
  }

  /**
   * Get the description of the single selected prop
   * @return {string} Description of the prop, null if no prop or many props.
   */
  getSinglePropDescription() {
    return this.props.length == 1 ?
        this.props[0].stagingProp.userData.prop.description : null;
  }

  /**
   * Get the action string of the single selected prop
   * @return {string} Action string of the prop, null if no prop or many props.
   */
  getSinglePropAction() {
    return this.props.length == 1 ?
        this.props[0].stagingProp.userData.prop.action : null;
  }

  /**
   * Get the user ID owning the single selected prop
   * @return {integer} User ID owning the prop, null if no prop or many props.
   */
  getSinglePropUserId() {
    return this.props.length == 1 ?
        this.props[0].stagingProp.userData.prop.userId : null;
  }

  /**
   * Set the name of the single selected prop (when applicable)
   * @param {string} name - Name to set for the prop.
   */
  setSinglePropName(name) {
    if (this.props.length == 1) {
      this.hasChanged = true;
      this.props[0].stagingProp.userData.prop.name = name;
    }
  }

  /**
   * Set the description of the single selected prop (when applicable)
   * @param {string} description - Description to set for the prop.
   */
  setSinglePropDescription(description) {
    if (this.props.length == 1) {
      this.hasChanged = true;
      this.props[0].stagingProp.userData.prop.description = description;
    }
  }

  /**
   * Set the action string of the single selected prop (when applicable)
   * @param {string} action - Action string to set for the prop.
   */
  setSinglePropAction(action) {
    if (this.props.length == 1) {
      this.hasChanged = true;
      this.props[0].stagingProp.userData.prop.action = action;
    }
  }

  /**
   * Duplicate prop selection
   * @param {boolean} smartPlacement - Whether or not to duplicate the
   *                                   prop with an offset matching its
   *                                   dimensions.
   */
  duplicate(smartPlacement = false) {
    this.commitAndCopy(this.cloneDirection()
        .multiplyScalar(smartPlacement ? this.smartMoveLength :
        defaultMoveLength));
  }

  /**
   * Move prop selection up
   * @param {boolean} scalar - Length to move by (in meters).
   */
  moveUp(scalar = defaultMoveLength) {
    const moveDirection = new Vector3(0, 1, 0);

    moveDirection
        .multiplyScalar(scalar);
    this.move(moveDirection);
  }

  /**
   * Move prop selection down
   * @param {boolean} scalar - Length to move by (in meters).
   */
  moveDown(scalar = defaultMoveLength) {
    const moveDirection = new Vector3(0, -1, 0);

    moveDirection
        .multiplyScalar(scalar);
    this.move(moveDirection);
  }

  /**
   * Move prop selection left
   * @param {boolean} scalar - Length to move by (in meters).
   */
  moveLeft(scalar = defaultMoveLength) {
    const moveDirection = this.cloneDirection()
        .applyAxisAngle(this.upAxis, Math.PI / 2)
        .multiplyScalar(scalar);
    this.move(moveDirection);
  }

  /**
   * Move prop selection right
   * @param {boolean} scalar - Length to move by (in meters).
   */
  moveRight(scalar = defaultMoveLength) {
    const moveDirection = this.cloneDirection()
        .applyAxisAngle(this.upAxis, -Math.PI / 2)
        .multiplyScalar(scalar);
    this.move(moveDirection);
  }

  /**
   * Move prop selection forward
   * @param {boolean} scalar - Length to move by (in meters).
   */
  moveForward(scalar = defaultMoveLength) {
    const moveDirection = this.cloneDirection()
        .multiplyScalar(scalar);
    this.move(moveDirection);
  }

  /**
   * Move prop selection backward
   * @param {boolean} scalar - Length to move by (in meters).
   */
  moveBackward(scalar = defaultMoveLength) {
    const moveDirection = this.cloneDirection()
        .multiplyScalar(-scalar);
    this.move(moveDirection);
  }

  /**
   * Rotate prop selection counter-clockwise on the X axis
   * @param {boolean} scalar - Angle to rotate by (in radians).
   */
  rotateXccw(scalar = defaultRotationAngle) {
    const rotationAxis = new Vector3(1.0, 0.0, 0.0);
    this.rotate(rotationAxis, scalar);
  }

  /**
   * Rotate prop selection clockwise around the X axis
   * @param {boolean} scalar - Angle to rotate by (in radians).
   */
  rotateXcw(scalar = defaultRotationAngle) {
    const rotationAxis = new Vector3(1.0, 0.0, 0.0);
    this.rotate(rotationAxis, -scalar);
  }

  /**
   * Rotate prop selection counter-clockwise around the Y axis
   * @param {boolean} scalar - Angle to rotate by (in radians).
   */
  rotateYccw(scalar = defaultRotationAngle) {
    const rotationAxis = new Vector3(0.0, 1.0, 0.0);
    this.rotate(rotationAxis, scalar);
  }

  /**
   * Rotate prop selection clockwise around the Y axis
   * @param {boolean} scalar - Angle to rotate by (in radians).
   */
  rotateYcw(scalar = defaultRotationAngle) {
    const rotationAxis = new Vector3(0.0, 1.0, 0.0);
    this.rotate(rotationAxis, -scalar);
  }

  /**
   * Rotate prop selection counter-clockwise around the Y axis
   * @param {boolean} scalar - Angle to rotate by (in radians).
   */
  rotateZccw(scalar = defaultRotationAngle) {
    const rotationAxis = new Vector3(0.0, 0.0, 1.0);
    this.rotate(rotationAxis, scalar);
  }

  /**
   * Rotate prop selection clockwise around the Y axis
   * @param {boolean} scalar - Angle to rotate by (in radians).
   */
  rotateZcw(scalar = defaultRotationAngle) {
    const rotationAxis = new Vector3(0.0, 0.0, 1.0);
    this.rotate(rotationAxis, -scalar);
  }

  /**
   * Undo changes on current prop selection
   */
  undo() {
    if (!this.hasChanged) return;

    for (const {stagingProp, boundingBox} of this.props) {
      const {x, y, z, pitch, yaw, roll,
        name, action, description} =
          stagingProp.userData.originalProp;
      Object.assign(stagingProp.userData.prop,
          {x, y, z, pitch, yaw, roll,
            name, action, description});
      stagingProp.position.set(x, y, z);
      stagingProp.rotation.set(pitch, yaw, roll, 'YZX');
      stagingProp.userData.prop.name = name;
      stagingProp.userData.prop.description = description;
      stagingProp.userData.prop.action = action;
      boundingBox.position.copy(stagingProp.position);
      boundingBox.rotation.copy(stagingProp.rotation);
      stagingProp.updateMatrix();
      boundingBox.updateMatrix();
    }

    this.updateArrows();
    this.notifyChange(this.props.length);
    this.hasChanged = false;
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
    this.moveDirection = new Vector3();
    this.rotationAxis = new Vector3();

    this.lastInput = 0;
    this.duplicating = false;
  }

  /**
   * Update props position and rotation based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    const propsSelector = this.subject;
    let now = Date.now();
    let moveLength = defaultMoveLength;
    let rotationAngle = defaultRotationAngle;

    this.moveDirection.set(0.0, 0.0, 0.0);

    if (this.exit()) {
      propsSelector.commitAndClear();
      return;
    } else if (this.delete()) {
      propsSelector.removeAndClear();
      return;
    }

    if (!this.duplicate()) {
      this.duplicating = false;
    }

    if (!this.moveUp() && !this.moveDown() &&
        !this.forward() && !this.backward() &&
        !this.left() && !this.right() &&
        !this.turnLeft() && !this.turnRight() &&
        !this.duplicate()) {
      // If no key is being pressed: disable the skipping
      // behavior below, this allows for fast sequential key
      // strokes without enduring the input cooldown
      now = 0;
    }

    if (now - this.lastInput < inputCooldown) {
      // Too soon to do anything, skip
      return;
    }

    // Only duplicate selection once per key stroke
    if (this.duplicate() && !this.duplicating) {
      propsSelector.duplicate(this.run());
      this.duplicating = true;
      return;
    }

    if (this.strafe()) {
      moveLength = smallMoveLength;
      rotationAngle = smallRotationAngle;
    }

    this.lastInput = now;

    let move = false;

    // All the input will be considered, in the final move direction
    // in case more than one axis is involved
    if (this.moveUp() && !this.moveDown()) {
      this.moveDirection.setY(moveLength);
      move = true;
    } else if (!this.moveUp() && this.moveDown()) {
      this.moveDirection.setY(- moveLength);
      move = true;
    }

    if (this.forward() && !this.backward()) {
      this.moveDirection.add(propsSelector.cloneDirection()
          .multiplyScalar(moveLength));
      move = true;
    } else if (!this.forward() && this.backward()) {
      this.moveDirection.sub(propsSelector.cloneDirection()
          .multiplyScalar(moveLength));
      move = true;
    }

    if (this.left() && !this.right()) {
      this.moveDirection.add(propsSelector.propDirection.clone()
          .applyAxisAngle(this.upAxis, Math.PI / 2)
          .multiplyScalar(moveLength));
      move = true;
    } else if (!this.left() && this.right()) {
      this.moveDirection.add(propsSelector.propDirection.clone()
          .applyAxisAngle(this.upAxis, - Math.PI / 2)
          .multiplyScalar(moveLength));
      move = true;
    }

    if (move) propsSelector.move(this.moveDirection);

    let rotate = false;

    if (this.turnLeft() && !this.turnRight()) {
      this.rotationAxis.set(0.0, 1.0, 0.0);
      rotate = true;
    } else if (!this.turnLeft() && this.turnRight()) {
      this.rotationAxis.set(0.0, 1.0, 0.0);
      rotationAngle = - rotationAngle;
      rotate = true;
    }

    if (rotate) propsSelector.rotate(this.rotationAxis, rotationAngle);
  }
}

export default PropsBehavior;
export {PropsSelector, defaultMoveLength, defaultRotationAngle,
  smallMoveLength, smallRotationAngle};
