/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {Group, Mesh, BoxGeometry, MeshBasicMaterial, Box3, Vector3,
  Matrix4} from 'three';

const offCollideColor = 0x00ff00;
const onCollideColor = 0xff0000;

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
    this.tmpVec3 = new Vector3();
    this.tmpMat4 = new Matrix4();

    this.debugBox = new Group();
    this.boxMaterial = new MeshBasicMaterial({color: offCollideColor,
      wireframe: true});
    this.topBox = new Mesh(new BoxGeometry(1, 1, 1), this.boxMaterial);
    this.colliderCenter = new Vector3(0.5, 0.5, 0.5);
    this.colliderHalfSide = 0.5;
    this.colliderHalfHeight = 0.5;
    this.topBox.position.setY(0.5);
    this.debugBox.add(this.topBox);

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
   * Register the debug collision box on the 3D engine
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
   * Unregister the debug collision box from the 3D engine
   * @param {number} width - Width (in meters) of the debug box.
   * @param {number} height - Height (in meters) of the debug box.
   * @param {number} depth - Depth (in meters) of the debug box.
   * @param {Vector3} center - 3D center position of the box, in
   *                           meters.
   */
  adjustDebugBox(width, height, depth, center) {
    this.topBox.scale.set(width, height, depth);

    // Adjust the position of the debug box to the one of the
    // collider
    this.topBox.position.copy(center);
    this.topBox.updateMatrix();
  }

  /**
   * Adjust the shape of the collider to the provided 3D asset
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
    this.adjustDebugBox(side, height, side, this.colliderCenter);
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
    min.y = this.colliderCenter.y + y - this.colliderHalfHeight;
    min.z = this.colliderCenter.z + z - this.colliderHalfSide;
    max.x = this.colliderCenter.x + x + this.colliderHalfSide;
    max.y = this.colliderCenter.y + y + this.colliderHalfHeight;
    max.z = this.colliderCenter.z + z + this.colliderHalfSide;
  }

  /**
   * Detect collision given the provided bounds tree geometry
   * @param {MeshBVH} boundsTree - Bounds tree to use for collision
   *                               detection.
   * @param {Matrix4} worldMat - Transformation matrix associated to the
   *                             bounds tree geometry.
   * @param {Vector3} offset - Optional offset to correct on the bounds
   *                           tree geometry.
   * @return {boolean} True if there is collision happening given the
   *                   provided geometry and the shape of the colider,
   *                   false otherwise.
   */
  collidesWithBoundsTree(boundsTree, worldMat, offset = new Vector3()) {
    this.tmpColliderBox.copy(this.colliderBox);
    this.tmpVec3.set(0, 0, 0);
    this.tmpColliderBox.translate(this.tmpVec3.sub(offset));
    this.tmpMat4.copy(worldMat).invert();
    return boundsTree.intersectsBox(this.tmpColliderBox, this.tmpMat4);
  }

  /**
   * Detect collision given the provided 3D engine node IDs
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   * @return {boolean} True if there is collision happening given the
   *                   provided nodes and the shape of the colider,
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
   * Update the collider state based on collision given the provided
   * 3D engine node IDs
   * @param {Engine3D} engine3d - Instance of the 3D engine.
   * @param {Array<integer>} nodeIDs - Array of IDs for nodes to be
   *                                   fetched from the 3D engine.
   */
  update(engine3d, nodeIDs) {
    if (this.collidesWithNodes(engine3d, nodeIDs)) {
      this.boxMaterial.color.set(onCollideColor);
    } else {
      this.boxMaterial.color.set(offCollideColor);
    }

    this.boxMaterial.needsUpdate = true;
  }
}

export default UserCollider;
