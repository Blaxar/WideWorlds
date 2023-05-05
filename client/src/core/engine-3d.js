/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as THREE from 'three';
import * as utils3D from './utils-3d.js';

const defaultUserHeight = 1.80;

/**
 * Core 3D management class, meant to abstract several three.js
 * operations regarding scene handling.
 */
class Engine3D {
  /**
   * @constructor
   * @param {HTML} canvas - HTML DOM canavas element to draw in
   */
  constructor(canvas) {
    this.stopRequested = false;
    this.renderer = new THREE.WebGLRenderer({canvas});
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.backgroundScene = new THREE.Scene();
    this.userHeight = defaultUserHeight;

    this.user = new THREE.Group();
    this.head = new THREE.Group();
    this.tilt = new THREE.Group();

    this.resetUserAvatar();
    this.userAvatar.position.set(0, this.userHeight / 2, 0);

    // Handling user subjective view here
    const fov = 50;
    const aspect = 2;
    const near = 0.1;
    const far = 100;

    this.tmpVec3 = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
    this.head.add(this.tilt);
    this.user.add(this.head);
    this.scene.add(this.user);
    this.cameraDistance = 0;
    this.clickRaycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.lastClickedObject = null;

    // Double buffered entity map, to be used each frame for rendering
    this.entities = new THREE.Group();
    this.scene.add(this.entities);

    // Ready the Octahedron for sky colors
    this.reversedOctahedron = utils3D.makeReversedOctahedron();
    this.skyBox = null;
    this.spinSkyColor = true;

    this.reversedOctahedron.material.depthTest = false;
    this.scaleSky = new THREE.Matrix4();
    this.reversedOctahedron.applyMatrix4(this.scaleSky);
    this.reversedOctahedron.renderOrder = -2;
    this.reversedOctahedron.depthTest = false;
    this.ambientLight = null;
    this.directionalLight = null;
    this.backgroundScene.add(this.reversedOctahedron);
    this.nodes = new Map();
    this.lastId = 0;
  }

  /**
   * Update 3D camera FOV to match new canvas ratio
   * @return {boolean} True if resizing was needed, false otherwise.
   */
  resizeRendererToDisplaySize() {
    const canvas = this.renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
      this.renderer.setSize(width, height, false);
    }
    return needResize;
  }

  /**
   * Change the colors of the sky
   * @param {array} colors - Color components, 18 total.
   */
  setSkyColors(colors) {
    this.reversedOctahedron.geometry.setAttribute('color',
        new THREE.BufferAttribute(new Float32Array(colors), 3));
  }

  /** Reset sky colors to their default values */
  resetSkyColors() {
    const colors = new Float32Array(utils3D.defaultSkyColors);
    this.reversedOctahedron.geometry.setAttribute('color',
        new THREE.BufferAttribute(colors, 3));
  }

  /** Clear the 3D scene of all live entities */
  clearEntities() {
    this.entities.clear();
  }

  /**
   * Change the current sky box
   * @param {Object3D} model - Asset to use as skybox.
   */
  setSkyBox(model) {
    if (this.skyBox) this.backgroundScene.remove(this.skyBox);

    this.skyBox = model;
    this.skyBox.position.set(0, -1, 0);
    this.skyBox.applyMatrix4(this.scaleSky);
    this.skyBox.renderOrder = -1;
    this.skyBox.depthTest = false;
    this.backgroundScene.add(this.skyBox);
  }

  /** Remove the current skybox (if any) */
  resetSkyBox() {
    if (this.skyBox) this.backgroundScene.remove(this.skyBox);
    this.skyBox = null;
  }

  /**
   * Set ambient light color, with a nice soft white light default
   * @param {Color} color - Color of the light
   * @param {integer} intensity - intensity of the ambient light
   */
  setAmbientLight(color = 'FFFFFF', intensity = 1) {
    this.resetAmbientLight();

    this.ambientLight = new THREE.AmbientLight(
        new THREE.Color(parseInt('0x' + color)),
        intensity);
    this.scene.add(this.ambientLight);
  }

  /** Remove the current world ambient light if any */
  resetAmbientLight() {
    if (this.ambientLight) {
      this.scene.remove(this.ambientLight);
      this.ambientLight = null;
    }
  }

  /**
   * Set directional light color, with a nice soft orange default
   * @param {Color} color - Color of the light
   * @param {integer} intensity - intensity of the directional light
   * @param {Array} position - target position for the directional Light
   */
  setDirectionalLight(color = 'FFFF70', intensity = 0.9,
      position = {x: 0, y: 0, z: 0}) {
    this.resetDirectionalLight();

    this.directionalLight = new THREE.DirectionalLight(
        new THREE.Color(parseInt('0x' + color)),
        0.6);

    this.directionalLight.position.set(position.x, position.y, position.z);
    this.scene.add(this.directionalLight);
  }

  /** Remove the current world directional light if any */
  resetDirectionalLight() {
    if (this.directionalLight) {
      this.scene.remove(this.directionalLight);
      this.directionalLight = null;
    }
  }
  /**
   * Create new node in the scene
   * @param {number} x - X coordinate of the node.
   * @param {number} y - Y coordinate of the node.
   * @param {number} z - Z coordinate of the node.
   * @return {integer} ID of the newly-spawned node.
   */
  spawnNode(x = 0, y = 0, z = 0) {
    const id = this.lastId++;
    this.nodes.set(id, new THREE.Group());
    const node = this.nodes.get(id);
    node.position.set(x, y, z);
    this.scene.add(node);
    return id;
  }

  /**
   * Remove node from the scene
   * @param {integer} id - ID of the node to remove.
   * @return {boolean} True if node exists, false otherwise.
   */
  removeNode(id) {
    if (!this.nodes.has(id)) return false;

    this.scene.remove(this.nodes.get(id));
    this.nodes.delete(id);
    return true;
  }

  /**
   * Append object to existing node in the scene
   * @param {integer} id - ID of the node to append the object to.
   * @param {Object3D} obj3d - Object to append to the node.
   * @return {boolean} True if node exists, false otherwise.
   */
  appendToNode(id, obj3d) {
    if (!this.nodes.has(id)) return false;

    this.nodes.get(id).add(obj3d);
    return true;
  }

  /**
   * Get elapsed number of seconds since last update
   * @return {number} Number of seconds.
   */
  getDeltaTime() {
    return this.clock.getDelta();
  }

  /**
   * Enable or disable sky color spinning
   * @param {boolean} spin - True to spin, false to stop
   */
  setSkyColorSpinning(spin) {
    this.spinSkyColor = spin;
    const nullVector = new THREE.Vector3();
    if (!spin) this.reversedOctahedron.setRotationFromAxisAngle(nullVector, 0);
  }

  /**
   * Set camera distance from the pivotal point along viewing axis, this
   * usually corresponds to the head of the user
   * @param {number} distance - 0 means first person view (forward-looking),
   *                            < 0 means rear view (forward-looking),
   *                            > 0 means front view (backward-looking)
   */
  setCameraDistance(distance) {
    this.cameraDistance = distance;
  }

  /**
   * Set user avatar
   * @param {Object3D} obj3d - three.js 3D asset
   * @param {integer} avatarId - Id of the avatar.
   */
  setUserAvatar(obj3d, avatarId) {
    if (this.userAvatar) this.scene.remove(this.userAvatar);

    this.user.userData.avatarId = avatarId;
    const bbox = new THREE.Box3().setFromObject(obj3d);

    this.userAvatar = obj3d;
    this.userHeight = bbox.max.y - bbox.min.y;

    this.head.position.set(0, this.userHeight, 0);
    this.scene.add(this.userAvatar);
  }

  /**
   * Set entity avatar
   * @param {Group} entity - three.js group to put the avatar in.
   * @param {Object3D} avatar - three.js 3D asset for the avatar.
   * @param {integer} avatarId - Id of the avatar.
   */
  setEntityAvatar(entity, avatar, avatarId) {
    if (entity.userData.avatarId !== avatarId) {
      // Avatar must be changed
      const bbox = new THREE.Box3().setFromObject(avatar);
      entity.userData.avatarId = avatarId;
      entity.clear();
      avatar.position.setY((bbox.max.y - bbox.min.y) / 2);
      entity.add(avatar);
    }
  }

  /**
   * Reset user avatar to default test box
   */
  resetUserAvatar() {
    const avatarGeometry = new THREE.BoxGeometry(1, this.userHeight, 1);
    const userAvatar = new THREE.Mesh(
        avatarGeometry,
        new THREE.MeshBasicMaterial({color: 0xff00ff, wireframe: true}),
    );

    this.setUserAvatar(userAvatar);
  }

  /**
   * Rendering method to be called by the upper context
   * each time we need a new frame.
   * @param {number} deltaTime - Elapsed number of seconds since last update
   * @return {boolean} false if stopping request, true otherwise
   */
  render(deltaTime = this.getDeltaTime()) {
    // Do not render anything: notify the upper window context
    // that we want to stop
    if (this.stopRequested) return false;

    if (this.resizeRendererToDisplaySize()) {
      const canvas = this.renderer.domElement;
      this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
      this.camera.updateProjectionMatrix();
    }

    if (this.spinSkyColor) {
      this.reversedOctahedron.rotateY(deltaTime*0.2);
    }

    // Adjust the avatar and camera positions based on the user position
    this.user.getWorldPosition(this.tmpVec3);
    this.tmpVec3.y += this.userHeight / 2;
    this.userAvatar.position.copy(this.tmpVec3);
    this.tilt.getWorldPosition(this.tmpVec3);
    this.camera.position.copy(this.tmpVec3);

    this.tilt.getWorldQuaternion(this.tmpQuat);
    this.camera.setRotationFromQuaternion(this.tmpQuat);

    this.user.getWorldDirection(this.tmpVec3);
    this.tmpVec3.y -= this.userHeight / 2;
    this.tmpVec3.add(this.camera.position);
    this.userAvatar.lookAt(this.tmpVec3);

    this.clickRaycaster.setFromCamera(this.pointer, this.camera);


    // Adjust the direction we're looking at base on the position of
    // the camera on the axis of view: if it's in front of the head:
    // we mean to look back;
    // Else, if it's behind or right on the head position: we mean to
    // forward
    if (this.cameraDistance <= 0) {
      this.camera.rotateY(Math.PI);
    }

    // If the camera distance is not zero: we're in third person view,
    // meaning: we intend to display the local user's own avatar, we
    // don't display it otherwise
    if (this.cameraDistance) {
      this.userAvatar.visible = true;
    } else {
      this.userAvatar.visible = false;
    }

    this.tilt.getWorldDirection(this.tmpVec3);
    this.camera.position.addScaledVector(this.tmpVec3, this.cameraDistance);

    // Update Sky colors and skybox
    this.reversedOctahedron.position.copy(this.camera.position);
    if (this.skyBox) {
      this.skyBox.position.set(this.camera.position.x,
          this.camera.position.y - 1,
          this.camera.position.z);
    }

    this.renderer.clear();
    this.renderer.render(this.backgroundScene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);

    // Notify the upper window context that we can keep rendering
    return true;
  }

  /** Start rendering */
  start() {
    this.stopRequested = false;
  }

  /** Stop rendering */
  stop() {
    this.stopRequested = true;
  }
}

export default Engine3D;
