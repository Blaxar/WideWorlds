/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {SubjectBehavior} from './user-input.js';
import {Raycaster} from 'three';
import {boundingBoxName} from './model-registry.js';

/** Handle props selection */
class PropsSelector {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Main WideWorlds 3D engine.
   */
  constructor(engine3d) {
    this.engine3d = engine3d;
    this.clickRaycaster = new Raycaster();

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
    if (!add) {
      this.clear();
    }

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
        // We expect the object to have pre-computed bounding box geometry
        const bb = intersects[i].object.getObjectByName(boundingBoxName);
        if (!bb) continue;

        bb.visible = true;
        this.props.push(bb.parent);

        // TODO: Remove when prop selection UI is implemented,
        //       left there in the meantime for debug purposes.
        console.log(bb.parent);
        console.log('Avatar Pos: ' +
            [this.engine3d.user.position.x, this.engine3d.user.position.y,
              this.engine3d.user.position.z]);
        break;
      }
    }
  }

  /** Clear selected props list */
  clear() {
    for (const prop of this.props) {
      prop.getObjectByName(boundingBoxName).visible = false;
    }

    this.props = [];
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
  }

  /**
   * Update props position and rotation based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {
    // TODO: implement
  }
}

export default PropsBehavior;
export {PropsSelector};
