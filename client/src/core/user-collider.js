/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {Group, Mesh, BoxGeometry, MeshBasicMaterial, Box3, Vector3,
  Matrix4, Ray} from 'three';

const offCollideColor = 0x00ff00;
const onCollideColor = 0xff0000;
const stepHeight = 0.65; // in meters

const centralRayId = 4;
const avatarSpan = 0.6; // in meters

/** Class to handle local user collisions with the world geometry */
class UserCollider {
  /**
   * @constructor
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @param {UserConfigNode} graphicsNode - Configuration node for the
   *                                        graphics.
   */
  constructor(engine3d, graphicsNode = null) {
    this.engine3d = engine3d;
    this.nodeIDs = [];
    this.colliderBox = new Box3();
    this.colliderBox.min.set(-0.5, 0, -0.5);
    this.colliderBox.max.set(0.5, 0.5, 0.5);
    this.tmpColliderBox = this.colliderBox.clone();
    this.tmpVec3 = new Vector3();
    this.tmpMat4 = new Matrix4();

    this.tmpOrigin = new Vector3();
    this.tmpDirection = new Vector3();
    this.nullVec3 = new Vector3();

    this.rays = [];
    for (let i = 0; i < 9; i++) {
      this.rays.push(new Ray(new Vector3(), new Vector3(0, -1, 0)));
    }

    this.forwardRay = new Ray(new Vector3(), new Vector3(0, -1, 0));

    this.debugBox = new Group();
    this.topBoxMaterial = new MeshBasicMaterial({color: offCollideColor,
      wireframe: true});
    this.bottomBoxMaterial = new MeshBasicMaterial({color: offCollideColor,
      wireframe: true});
    this.topBox = new Mesh(new BoxGeometry(1, 1, 1), this.topBoxMaterial);
    this.bottomBox = new Mesh(new BoxGeometry(1, 1, 1), this.bottomBoxMaterial);
    this.colliderCenter = new Vector3(0.5, 0.5, 0.5);
    this.colliderHalfSide = 0.5;
    this.colliderHalfHeight = 0.5;
    this.topBox.position.setY(0.5);

    this.debugBox.add(this.topBox);
    this.debugBox.add(this.bottomBox);

    this.adjustRays();

    this.topBox.autoUpdateMatrix = false;
    this.debugBox.autoUpdateMatrix = false;

    this.nodeHandle = null;

    if (graphicsNode) {
      // Ready graphics node and its update callback(s)
      this.debugBox.visible =
          graphicsNode.at('debugUserCollider').value();

      graphicsNode.at('debugUserCollider').onUpdate((value) => {
        this.debugBox.visible = value;
        this.debugBox.updateMatrix();
      });
    }
  }

  /**
   * Register the debug collision box to the 3D engine
   * @return {boolean} True if the registration went well, false
   *                   false otherwise.
   */
  registerDebugBox() {
    if (this.nodeHandle !== null) return false;

    this.nodeHandle = this.engine3d.spawnNode();
    this.engine3d.appendToNode(this.nodeHandle, this.debugBox);

    return true;
  }

  /**
   * Unregister the debug collision box from the 3D engine
   * @return {boolean} True if the unregistration went well, false
   *                   false otherwise.
   */
  unregisterDebugBox() {
    if (this.nodeHandle === null) return false;

    this.engine3d.wipeNode(this.nodeHandle);
    this.engine3d.removeNode(this.nodeHandle);

    this.nodeHandle = null;

    return true;
  }

  /**
   * Ajust the shape and size of the debug collision box
   * @param {number} width - Width (in meters) of the debug box.
   * @param {number} height - Height (in meters) of the debug box.
   * @param {number} depth - Depth (in meters) of the debug box.
   * @param {Vector3} center - 3D center position of the box, in
   *                           meters.
   */
  adjustDebugBoxes(width, height, depth, center) {
    this.topBox.scale.set(width, height - stepHeight, depth);

    // Adjust the position of the top debug box to the one of the
    // collider
    this.topBox.position.copy(center);
    this.topBox.position.setY(center.y + stepHeight / 2.0);
    this.topBox.updateMatrix();

    this.bottomBox.scale.set(width, stepHeight, depth);

    // Adjust the position of the bottom debug box to the one of the
    // collider
    this.bottomBox.position.copy(center);
    this.bottomBox.position.setY(center.y - (height / 2) +
      (stepHeight / 2.0));
    this.bottomBox.updateMatrix();
  }

  /**
   * Adjust the shape of the collider and the position of the rays to
   * the provided 3D asset
   * @param {Object3D} obj3d - 3D asset to fit the collider for.
   * @param {Object3D} isAvatar - Whether or not this collider box is to
   *                              be used for avatar collision, false by
   *                              default;
   *                              True means the width and depth will
   *                              always be fixed (matching AW behavior).
   */
  adjustToObject(obj3d, isAvatar = false) {
    this.colliderBox.setFromObject(obj3d);
    const width = this.colliderBox.max.x - this.colliderBox.min.x;
    const height = this.colliderBox.max.y - this.colliderBox.min.y;
    const depth = this.colliderBox.max.z - this.colliderBox.min.z;
    const side = isAvatar ? avatarSpan : (width > depth ? width : depth);

    this.colliderHalfSide = side / 2;
    this.colliderHalfHeight = height / 2;

    this.colliderBox.max.x = this.colliderHalfSide;
    this.colliderBox.min.x = -this.colliderBox.max.x;
    this.colliderBox.max.y += this.colliderHalfHeight;
    this.colliderBox.min.y += this.colliderHalfHeight;
    this.colliderBox.max.z = this.colliderHalfSide;
    this.colliderBox.min.z = -this.colliderBox.max.z;

    this.colliderBox.getCenter(this.colliderCenter);
    this.colliderBox.min.y += stepHeight;
    this.adjustRays();
    this.adjustDebugBoxes(side, height, side, this.colliderCenter);
  }

  /**
   * Adjust the rays for the current collider box
   * @param {Vector3} direction - Movement direction.
   */
  adjustRays(direction = this.nullVec3) {
    const rX = (this.colliderBox.max.x - this.colliderBox.min.x) / 2;
    const rZ = (this.colliderBox.max.z - this.colliderBox.min.z) / 2;
    let cX = (this.colliderBox.max.x + this.colliderBox.min.x) / 2.0;
    let cZ = (this.colliderBox.max.z + this.colliderBox.min.z) / 2.0;

    let rayId = 0;
    for (const x of [this.colliderBox.min.x, cX, this.colliderBox.max.x]) {
      for (const z of [this.colliderBox.min.z, cZ, this.colliderBox.max.z]) {
        const origin = this.rays[rayId++].origin;
        origin.set(x, this.colliderBox.min.y, z);
      }
    }

    if (direction.x * direction.x > direction.z * direction.z &&
        direction.x !== 0.0) { // Avoid dividing by 0
      // Adjust X to reach the border of the collider box ("project" onto it)
      // and scale Z accordingly to maintain the direction
      cX = direction.x > 0 ? cX + rX : cX - rX;
      cZ = (rX / Math.abs(direction.x)) * direction.z + cZ;
    } else if (direction.z !== 0.0) { // Avoid dividing by 0
      // Same logic, but by adjusting Z and scaling X accordingly
      cZ = direction.z > 0 ? cZ + rZ : cZ - rZ;
      cX = (rZ / Math.abs(direction.z)) * direction.x + cX;
    } else {
      this.forwardRay.origin.copy(this.rays[centralRayId].origin);
      return;
    }

    this.forwardRay.origin.set(cX, this.colliderBox.min.y, cZ);
  }

  /**
   * Set the position of the collider box in the scene and compute
   * collision state given this ne position
   * @param {number} x - X coordinate, in meters.
   * @param {number} y - Y coordinate, in meters.
   * @param {number} z - Z coordinate, in meters.
   * @param {Vector3} direction - Movement direction.
   * @return {Object} topCollision and heightCorrection values.
   */
  putColliderBox(x, y, z, direction = null) {
    const {min, max} = this.colliderBox;

    min.x = this.colliderCenter.x + x - this.colliderHalfSide;
    min.y = this.colliderCenter.y + y - this.colliderHalfHeight + stepHeight;
    min.z = this.colliderCenter.z + z - this.colliderHalfSide;
    max.x = this.colliderCenter.x + x + this.colliderHalfSide;
    max.y = this.colliderCenter.y + y + this.colliderHalfHeight;
    max.z = this.colliderCenter.z + z + this.colliderHalfSide;

    if (max.y < min.y) min.y = max.y - 0.01;

    this.adjustRays(direction ? direction : this.nullVec3);

    const topCollision = this.collidesWithNodes(this.nodeIDs);

    if (topCollision) {
      this.topBoxMaterial.color.set(onCollideColor);
    } else {
      this.topBoxMaterial.color.set(offCollideColor);
    }

    const bottomStep = this.raycastAgainstNodes(this.nodeIDs,
        direction ? true : false);

    if (bottomStep) {
      this.bottomBoxMaterial.color.set(onCollideColor);
    } else {
      this.bottomBoxMaterial.color.set(offCollideColor);
    }

    this.topBoxMaterial.needsUpdate = true;
    this.bottomBoxMaterial.needsUpdate = true;

    return {
      topCollision,
      heightCorrection:
          bottomStep === null ? null : stepHeight - bottomStep,
    };
  }

  /**
   * Render the collider box for debugging
   * @param {Vector3} position - Position on the collider box
   */
  renderColliderBox(position) {
    this.debugBox.position.copy(position);
    this.debugBox.updateMatrix();
  }

  /**
   * Detect collision given the provided bounds tree geometry
   * @param {MeshBVH} boundsTree - Bounds tree to use for collision
   *                               detection.
   * @param {Vector3} offset - bounds tree 3D position offset.
   * @param {Matrix4} worldMat - Transformation matrix associated to the
   *                             bounds tree geometry.
   * @return {boolean} True if there is collision happening given the
   *                   provided geometry and the shape of the collider,
   *                   false otherwise.
   */
  collidesWithBoundsTree(boundsTree, offset, worldMat) {
    this.tmpColliderBox.copy(this.colliderBox);
    if (offset.lengthSq() === 0) {
      // No offset to apply
      this.tmpMat4.copy(worldMat).invert();
    } else {
      this.tmpVec3.setFromMatrixPosition(worldMat);
      this.tmpVec3.add(offset);
      this.tmpMat4.copy(worldMat).setPosition(this.tmpVec3).invert();
    }
    return boundsTree.intersectsBox(this.tmpColliderBox, this.tmpMat4);
  }

  /**
   * Raycast bottom part of the collider given the provided bounds tree
   * geometry
   * @param {MeshBVH} boundsTree - Bounds tree to use for collision
   *                               detection.
   * @param {Vector3} offset - bounds tree 3D position offset.
   * @param {Matrix4} worldMat - Transformation matrix associated to the
   *                             bounds tree geometry.
   * @param {boolean} single - Whether or not to use a single ray for
   *                           casting, false by default.
   * @return {number|null} Distance of the hit (in meters) if any, given the
   *                       provided geometry and the shape of the collider,
   *                       null otherwise.
   */
  raycastAgainstBoundsTree(boundsTree, offset, worldMat, single = false) {
    if (offset.lengthSq() === 0) {
      // No offset to apply
      this.tmpVec3.setFromMatrixPosition(worldMat);
      this.tmpMat4.copy(worldMat).invert();
    } else {
      this.tmpVec3.setFromMatrixPosition(worldMat);
      this.tmpVec3.add(offset);
      this.tmpMat4.copy(worldMat).setPosition(this.tmpVec3).invert();
    }
    let distance = stepHeight;

    const cast = (ray) => {
      this.tmpOrigin.copy(ray.origin);
      this.tmpDirection.copy(ray.direction);

      const {x, z} = this.tmpOrigin;
      const {min, max} = boundsTree.geometry.boundingBox;

      if (x < min.x + this.tmpVec3.x || x > max.x + this.tmpVec3.x ||
          z < min.z + this.tmpVec3.z || z > max.z + this.tmpVec3.z) {
        return;
      }

      ray.applyMatrix4(this.tmpMat4);
      const hit = boundsTree.raycastFirst(ray);

      ray.origin.copy(this.tmpOrigin);
      ray.direction.copy(this.tmpDirection);

      if (hit && hit.distance < distance) {
        distance = hit.distance; // Set the shortest distance of the hit
      }
    };

    if (single) {
      cast(this.forwardRay);
    } else {
      this.rays.forEach(cast);
    }

    return distance < stepHeight ? distance : null;
  }

  /**
   * Detect collision given the provided 3D engine node IDs
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   * @return {boolean} True if there is collision happening given the
   *                   provided nodes and the shape of the collider,
   *                   false otherwise.
   */
  collidesWithNodes(nodeIDs) {
    for (const nodeID of nodeIDs) {
      const boundsTree = this.engine3d.getNodeBoundsTree(nodeID);
      const offset = this.engine3d.getNodeBoundsTreeOffset(nodeID);
      const worldMat = this.engine3d.getNodeMatrixWorld(nodeID);
      if (boundsTree && worldMat && offset &&
        this.collidesWithBoundsTree(boundsTree, offset, worldMat)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Raycast bottom part of the collider given the provided 3D engine node IDs
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   * @param {boolean} single - Whether or not to use a single ray for
   *                           casting, false by default.
   * @return {number|null} Distance of the hit (in meters) if any, given
   *                       the provided nodes and the shape of the collider,
   *                       null otherwise.
   */
  raycastAgainstNodes(nodeIDs, single = false) {
    let shortestDistance = stepHeight;

    for (const nodeID of nodeIDs) {
      const boundsTree = this.engine3d.getNodeBoundsTree(nodeID);
      const offset = this.engine3d.getNodeBoundsTreeOffset(nodeID);
      const worldMat = this.engine3d.getNodeMatrixWorld(nodeID);
      if (boundsTree && worldMat && offset) {
        const distance =
            this.raycastAgainstBoundsTree(boundsTree, offset, worldMat, single);
        if (distance && distance < shortestDistance) {
          shortestDistance = distance; // The shortest distance of the hit
        }
      }
    }

    return shortestDistance < stepHeight ? shortestDistance : null;
  }

  /**
   * Update the collider state based on the provided
   * 3D engine node IDs
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   */
  update(nodeIDs) {
    this.nodeIDs = nodeIDs;
  }
}

export default UserCollider;
export {stepHeight};
