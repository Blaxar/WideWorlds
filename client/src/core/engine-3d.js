/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as THREE from 'three';
import * as utils3D from './utils-3d.js';

const defaultUserHeight = 1.80; // In meters
const defaultLightIntensity = 0.6;
const defaultRenderingDistance = 100.0; // In meters
const defaultHidingDistance = 60.0; // In meters

/**
 * Core 3D management class, meant to abstract several three.js
 * operations regarding scene handling.
 */
class Engine3D {
  /**
   * @constructor
   * @param {HTML} canvas - HTML DOM canvas element to draw in
   * @param {UserConfigNode} graphicsNode - Configuration node for the
   *                                        graphics.
   */
  constructor(canvas, graphicsNode = null) {
    this.stopRequested = false;
    this.renderer = new THREE.WebGLRenderer({canvas});
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.autoClear = false;
    this.clock = new THREE.Clock();
    this.scene = new THREE.Scene();
    this.backgroundScene = new THREE.Scene();
    this.foregroundScene = new THREE.Scene();
    this.userHeight = defaultUserHeight;

    this.user = new THREE.Group();
    this.head = new THREE.Group();
    this.tilt = new THREE.Group();

    this.renderingDistance = defaultRenderingDistance;
    this.hidingDistance = defaultHidingDistance;

    if (graphicsNode) {
      // Ready graphics node and its update callback(s)
      this.renderingDistance = graphicsNode
          .at('renderingDistance').value();
      this.hidingDistance = graphicsNode
          .at('propsLoadingDistance').value();

      graphicsNode.at('renderingDistance').onUpdate((value) => {
        this.renderingDistance = parseFloat(value);
      });

      graphicsNode.at('propsLoadingDistance').onUpdate((value) => {
        this.hidingDistance = parseFloat(value);
        this.lods = [0.0, this.hidingDistance];
      });
    }

    this.lods = [0.0, defaultHidingDistance];

    this.resetUserAvatar();
    this.userAvatar.position.set(0, this.userHeight / 2, 0);

    // Handling user subjective view here
    const fov = 50;
    const aspect = 2;
    const near = 0.1;

    this.tmpVec3 = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();

    this.cameraDirection = new THREE.Vector3();
    this.xzDirection = new THREE.Vector2();

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near,
        this.renderingDistance);

    this.head.add(this.tilt);
    this.user.add(this.head);
    this.scene.add(this.user);
    this.cameraDistance = 0;

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
    this.lodNodeIDs = new Set();
    this.lastId = 0;

    this.helperArrows = utils3D.makeHelperArrows(1);
    this.helperArrows.visible = false;
    this.helperArrows.matrixAutoUpdate = false;
    this.foregroundScene.add(this.helperArrows);

    this.helperObjects = new THREE.Group();
    this.foregroundScene.add(this.helperObjects);
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
   * Set the scene's fog
   * @param {Color} color - Color of the fog
   * @param {float} near - How close to the camera the fog starts.
   * @param {float} far - How far the fog extends.
   */
  setFog(color = new THREE.Color('FF0000'), near = 0.25, far = 40) {
    this.resetFog();

    this.scene.fog = new THREE.Fog(color,
        near, far);
  }

  /** Remove the current world fog if any */
  resetFog() {
    if (this.scene.fog) {
      this.scene.fog = null;
    }
  }

  /**
   * Set ambient light color, with a nice soft white light default
   * @param {Color} color - Color of the light
   * @param {integer} intensity - intensity of the ambient light
   */
  setAmbientLight(color = new THREE.Color('#FFFFFF'),
      intensity = defaultLightIntensity) {
    this.resetAmbientLight();

    this.ambientLight = new THREE.AmbientLight(
        color, intensity);

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
   * @param {Vector3} position - Source position for the directional light
   * @param {number} intensity - Intensity of the directional light
   */
  setDirectionalLight(color = new THREE.Color('FFFF70'),
      position = THREE.Object3D.DEFAULT_UP,
      intensity = defaultLightIntensity) {
    this.resetDirectionalLight();

    this.directionalLight = new THREE.DirectionalLight(
        color, intensity);

    this.directionalLight.position.copy(position);

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
   * @param {boolean} lod - Whether or not the node will allow for different
   *                        levels of detail, false by default.
   * @return {integer} ID of the newly-spawned node.
   */
  spawnNode(x = 0, y = 0, z = 0, lod = false) {
    const id = this.lastId++;
    this.nodes.set(id, lod ? new THREE.LOD() :
        new THREE.Group());
    const node = this.nodes.get(id);

    if (lod) {
      // Ready the LOD with different levels, ready to welcome
      // 3D objects
      node.autoUpdate = false;
      for (const distance of this.lods) {
        node.addLevel(new THREE.Group(), distance);
      }
      this.lodNodeIDs.add(id);
    }

    node.position.set(x, y, z);
    this.scene.add(node);
    node.userData['dynamic'] = new Map();
    return id;
  }

  /**
   * Remove node from the scene
   * @param {integer} id - ID of the node to remove.
   * @return {boolean} True if node exists, false otherwise.
   */
  removeNode(id) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);

    if (node.isLOD) this.lodNodeIDs.delete(id);

    this.scene.remove(node);
    this.nodes.delete(id);

    return true;
  }

  /**
   * Append object to existing node in the scene
   * @param {integer} id - ID of the node to append the object to.
   * @param {Object3D} obj3d - Object to append to the node.
   * @param {integer} level - If node is LOD: level to set the object in.
   * @param {boolean} dynamic - Whether or node to treat the object as
   *                            a dynamic one to update it on every frame
   *                            when visible
   * @return {boolean} True if node exists, false otherwise.
   */
  appendToNode(id, obj3d, level = 0, dynamic = false) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);

    if (node.isLOD) {
      // The target level needs to exist
      if (level < 0 || level >= node.levels.length) {
        return false;
      }

      node.levels[level].object.add(obj3d);
    } else if (level !== 0) {
      // Not a LOD, can't be any other level
      return false;
    } else {
      node.add(obj3d);
    }

    if (dynamic) {
      node.userData.dynamic.set(obj3d.id, obj3d);
    }

    return true;
  }

  /**
   * Tell if a given object belongs to a specific node
   * @param {integer} id - ID of the node to check.
   * @param {Object3D} obj3d - Object to check.
   * @return {boolean} True if the object belongs to the node,
   *                   false otherwise.
   */
  belongsToNode(id, obj3d) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);

    if (node.isLOD) {
      return obj3d.parent === node.levels[0].object;
    } else {
      return obj3d.parent === node.parent;
    }
  }

  /**
   * Set an object as dynamic on a specific node
   * @param {integer} id - ID of the node to check.
   * @param {Object3D} obj3d - Object to check.
   * @return {boolean} True if the object was set as dynamic on
   *                   the node, false otherwise.
   */
  setDynamicOnNode(id, obj3d) {
    if (!this.belongsToNode(id, obj3d)) return false;

    const node = this.nodes.get(id);

    node.userData.dynamic.set(obj3d.id, obj3d);

    return true;
  }

  /**
   * Unset an object as dynamic on a specific node
   * @param {integer} id - ID of the node to check.
   * @param {Object3D} obj3d - Object to check.
   * @return {boolean} True if the object was set as dynamic on
   *                   the node, false otherwise.
   */
  unsetDynamicOnNode(id, obj3d) {
    if (!this.belongsToNode(id, obj3d)) return false;

    const node = this.nodes.get(id);

    node.userData.dynamic.delete(obj3d.id);

    return true;
  }

  /**
   * Update dynamic objects
   * @param {number} deltaTime - Elapsed number of seconds since last update.
   */
  stepDynamicObjects(deltaTime) {
    // Compute the direction (XZ plane) the camera is facing to
    this.camera.getWorldDirection(this.cameraDirection);
    this.xzDirection.set(this.cameraDirection.x, this.cameraDirection.z);
    const facingAngle = - this.xzDirection.angle() - Math.PI / 2;

    this.nodes.forEach((node) => {
      const group = node.isLOD ? node.levels[0].object : node;

      if (!group.visible || !node.userData.dynamic) return;

      node.userData.dynamic.forEach((obj3d) => {
        if (obj3d.visible) {
          // Update front-facing objects (sprites)
          if (obj3d.userData.rwx?.axisAlignment !== 'none') {
            obj3d.rotation.set(0, facingAngle, 0);
            obj3d.updateMatrix();
          }
        }
      });
    });
  }

  /**
   * Get object by name from existing node in the scene
   * @param {integer} id - ID of the node to get the object from.
   * @param {string} name - Object to append to the node.
   * @param {integer} level - If node is LOD: level to set the object in.
   * @return {Object3D} If found: a 3D asset bearing this name,
   *                    falsy otherwise.
   */
  getFromNodeByName(id, name, level = 0) {
    if (!this.nodes.has(id)) return null;

    const node = this.nodes.get(id);

    if (node.isLOD) {
      // The target level needs to exist
      if (level < 0 || level >= node.levels.length) {
        return null;
      }

      return node.levels[level].getObjectByName(name);
    } else if (level !== 0) {
      // Not a LOD, can't be any other level
      return null;
    } else {
      return node.getObjectByName(name);
    }
  }

  /**
   * Remove all objects from a node
   * @param {integer} id - ID of the node to remove all objects from.
   * @return {boolean} True if the node exists, false otherwise.
   */
  wipeNode(id) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);
    node.userData.dynamic.clear();
    node.clear();

    return true;
  }

  /**
   * Update all LOD levels based on current hiding distance and
   * camera position
   * @param {Set<integer>} lodNodeIDs - ID of the LOD nodes to update, none
   +                                    LOD nodes or none existing nodes
   *                                    will be ignored.
   * @param {Camera} camera - Camera to use as a reference to update the
   *                          displayed level of each LOD node.
   */
  updateLODs(lodNodeIDs, camera = this.camera) {
    lodNodeIDs.forEach((id) => {
      const node = this.nodes.get(id);
      if (!node || !node.isLOD) return;

      node.levels[1].distance = this.hidingDistance;
      node.update(camera);
    });
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
   * Set helper arrows visible with the given position and rotation
   * @param {Vector3} pos - Position of the arrows.
   * @param {Euler} rot - Rotation of the arrows.
   */
  setHelperArrows(pos, rot) {
    this.helperArrows.position.copy(pos);
    this.helperArrows.rotation.copy(rot);
    this.helperArrows.updateMatrix();
    this.helperArrows.visible = true;
  }

  /** Turn helper arrows invisible */
  unsetHelperArrows() {
    this.helperArrows.visible = false;
  }

  /**
   * Add helper object to the foreground scene
   * @param {Object3D} obj3d - Object to add to the foreground scene.
   */
  addHelperObject(obj3d) {
    this.helperObjects.add(obj3d);
  }

  /**
   * Remove helper object from the foreground scene
   * @param {Object3D} obj3d - Object to remove from the foreground scene.
   */
  removeHelperObject(obj3d) {
    this.helperObjects.remove(obj3d);
  }

  /**
   * Remove all helper objects from the foreground scene
   */
  removeAllHelperObjects() {
    this.helperObjects.clear();
  }

  /**
   * Reveal invisible props
   */
  revealProps() {
    this.nodes.forEach((node) => {
      if (!node.isLOD || node.getCurrentLevel() > 0) return;

      const group = node.levels[0].object;

      if (!group.visible) return;

      group.children.forEach((obj3d) => {
        if (obj3d.userData.prop && obj3d.userData.invisible) {
          obj3d.visible = true;
        }
      });
    });
  }

  /**
   * Hide invisible props
   */
  hideProps() {
    this.nodes.forEach((node) => {
      if (!node.isLOD || node.getCurrentLevel() > 0) return;

      const group = node.levels[0].object;

      if (!group.visible) return;

      group.children.forEach((obj3d) => {
        if (obj3d.userData.prop && obj3d.userData.invisible) {
          obj3d.visible = false;
        }
      });
    });
  }

  /**
   * Rendering method to be called by the upper context
   * each time we need a new frame
   * @param {number} deltaTime - Elapsed number of seconds since last update.
   * @return {boolean} false if stopping request, true otherwise.
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


    // Adjust the direction we're looking at based on the position of
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
    this.camera.far = 1000; // Allow large skyboxes to be fully displayed
    this.camera.updateProjectionMatrix();
    this.renderer.render(this.backgroundScene, this.camera);
    this.camera.far = this.renderingDistance;
    this.camera.updateProjectionMatrix();
    this.renderer.clearDepth();
    this.stepDynamicObjects(deltaTime);
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.foregroundScene, this.camera);

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
