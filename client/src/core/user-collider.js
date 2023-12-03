/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {Group, Mesh, BoxGeometry, MeshBasicMaterial, Box3, Vector3,
  Matrix4, Ray} from 'three';

const offCollideColor = 0x00ff00;
const onCollideColor = 0xff0000;
const stepHeight = 0.60; // in meters

/** Class to handle local user collisions with the world geometry */
class UserCollider {
  /**
   * @constructor
   * @param {UserConfigNode} graphicsNode - Configuration node for the
   *                                        graphics.
   */
  constructor(graphicsNode = null) {
    this.side = 1.0;
    this.colliderBox = new Box3();
    this.colliderBox.min.set(-0.5, 0, -0.5);
    this.colliderBox.max.set(0.5, 0.5, 0.5);
    this.tmpColliderBox = this.colliderBox.clone();
    this.tmpMat4 = new Matrix4();

    this.tmpOrigin = new Vector3();
    this.tmpDirection = new Vector3();

    this.rays = [];
    for (let i = 0; i < 9; i++) {
      this.rays.push(new Ray(new Vector3(), new Vector3(0, -1, 0)));
    }

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
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @return {boolean} True if the registration went well, false
   *                   false otherwise.
   */
  registerDebugBox(engine3d) {
    if (this.nodeHandle !== null) return false;

    this.nodeHandle = engine3d.spawnNode();
    engine3d.appendToNode(this.nodeHandle, this.debugBox);

    return true;
  }

  /**
   * Unregister the debug collision box from the 3D engine
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @return {boolean} True if the unregistration went well, false
   *                   false otherwise.
   */
  unregisterDebugBox(engine3d) {
    if (this.nodeHandle === null) return false;

    engine3d.wipeNode(this.nodeHandle);
    engine3d.removeNode(this.nodeHandle);

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
   */
  adjustToObject(obj3d) {
    this.colliderBox.setFromObject(obj3d);
    const width = this.colliderBox.max.x - this.colliderBox.min.x;
    const height = this.colliderBox.max.y - this.colliderBox.min.y;
    const depth = this.colliderBox.max.z - this.colliderBox.min.z;
    const side = width > depth ? width : depth;

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
   */
  adjustRays() {
    const cX = (this.colliderBox.max.x + this.colliderBox.min.x) / 2.0;
    const cZ = (this.colliderBox.max.z + this.colliderBox.min.z) / 2.0;

    let rayId = 0;
    for (const x of [this.colliderBox.min.x, cX, this.colliderBox.max.x]) {
      for (const z of [this.colliderBox.min.z, cZ, this.colliderBox.max.z]) {
        const origin = this.rays[rayId++].origin;
        origin.set(x, this.colliderBox.min.y, z);
      }
    }
  }

  /**
   * Set the position of the collider box in the scene
   * @param {number} x - X coordinate, in meters.
   * @param {number} y - Y coordinate, in meters.
   * @param {number} z - Z coordinate, in meters.
   */
  putColliderBox(x, y, z) {
    this.debugBox.position.set(x, y, z);
    this.debugBox.updateMatrix();
    const {min, max} = this.colliderBox;

    min.x = this.colliderCenter.x + x - this.colliderHalfSide;
    min.y = this.colliderCenter.y + y - this.colliderHalfHeight + stepHeight;
    min.z = this.colliderCenter.z + z - this.colliderHalfSide;
    max.x = this.colliderCenter.x + x + this.colliderHalfSide;
    max.y = this.colliderCenter.y + y + this.colliderHalfHeight;
    max.z = this.colliderCenter.z + z + this.colliderHalfSide;

    if (max.y < min.y) min.y = max.y - 0.01;

    this.adjustRays();
  }

  /**
   * Detect collision given the provided bounds tree geometry
   * @param {MeshBVH} boundsTree - Bounds tree to use for collision
   *                               detection.
   * @param {Matrix4} worldMat - Transformation matrix associated to the
   *                             bounds tree geometry.
   * @return {boolean} True if there is collision happening given the
   *                   provided geometry and the shape of the collider,
   *                   false otherwise.
   */
  collidesWithBoundsTree(boundsTree, worldMat) {
    this.tmpColliderBox.copy(this.colliderBox);
    this.tmpMat4.copy(worldMat).invert();
    return boundsTree.intersectsBox(this.tmpColliderBox, this.tmpMat4);
  }

  /**
   * Raycast bottom part of the collider given the provided bounds tree
   * geometry
   * @param {MeshBVH} boundsTree - Bounds tree to use for collision
   *                               detection.
   * @param {Matrix4} worldMat - Transformation matrix associated to the
   *                             bounds tree geometry.
   * @return {number|null} Distance of the hit (in meters) if any, given the
   *                       provided geometry and the shape of the collider,
   *                       null otherwise.
   */
  raycastAgainstBoundsTree(boundsTree, worldMat) {
    this.tmpMat4.copy(worldMat).invert();
    let distance = stepHeight;

    for (const ray of this.rays) {
      this.tmpOrigin.copy(ray.origin);
      this.tmpDirection.copy(ray.direction);

      ray.applyMatrix4(this.tmpMat4);
      const hit = boundsTree.raycastFirst(ray);

      ray.origin.copy(this.tmpOrigin);
      ray.direction.copy(this.tmpDirection);

      if (hit && hit.distance < distance) {
        distance = hit.distance; // Return the shortest distance of the hit
      }
    }

    return distance < stepHeight ? distance : null;
  }

  /**
   * Detect collision given the provided 3D engine node IDs
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   * @return {boolean} True if there is collision happening given the
   *                   provided nodes and the shape of the collider,
   *                   false otherwise.
   */
  collidesWithNodes(engine3d, nodeIDs) {
    for (const nodeID of nodeIDs) {
      const boundsTree = engine3d.getNodeBoundsTree(nodeID);
      const worldMat = engine3d.getNodeMatrixWorld(nodeID);
      if (boundsTree && worldMat) {
        if (this.collidesWithBoundsTree(boundsTree, worldMat)) return true;
      }
    }

    return false;
  }

  /**
   * Raycast bottom part of the collider given the provided 3D engine node IDs
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   * @return {number|null} Distance of the hit (in meters) if any, given
   *                       the provided nodes and the shape of the collider,
   *                       null otherwise.
   */
  raycastAgainstNodes(engine3d, nodeIDs) {
    let shortestDistance = stepHeight;

    for (const nodeID of nodeIDs) {
      const boundsTree = engine3d.getNodeBoundsTree(nodeID);
      const worldMat = engine3d.getNodeMatrixWorld(nodeID);
      if (boundsTree && worldMat) {
        const distance = this.raycastAgainstBoundsTree(boundsTree, worldMat);
        if (distance && distance < shortestDistance) {
          shortestDistance = distance; // The shortest distance of the hit
        }
      }
    }

    return shortestDistance < stepHeight ? shortestDistance : null;
  }

  /**
   * Update the collider state based on collision given the provided
   * 3D engine node IDs
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   */
  update(engine3d, nodeIDs) {
    if (this.collidesWithNodes(engine3d, nodeIDs)) {
      this.topBoxMaterial.color.set(onCollideColor);
    } else {
      this.topBoxMaterial.color.set(offCollideColor);
    }

    if (this.raycastAgainstNodes(engine3d, nodeIDs)) {
      this.bottomBoxMaterial.color.set(onCollideColor);
    } else {
      this.bottomBoxMaterial.color.set(offCollideColor);
    }

    this.topBoxMaterial.needsUpdate = true;
    this.bottomBoxMaterial.needsUpdate = true;
  }
}

export default UserCollider;
export {stepHeight};
