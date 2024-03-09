/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import * as THREE from 'three';
import {MathUtils} from 'three';
import * as utils3D from './utils-3d.js';
import {MeshBVH} from 'three-mesh-bvh';
import {flattenGroup} from 'three-rwx-loader';
import formatSignLines, {makeTagCanvas} from './sign-utils.js';

const defaultUserHeight = 1.80; // In meters
const defaultLightIntensity = 0.6;
const defaultRenderingDistance = 100.0; // In meters
const defaultHidingDistance = 60.0; // In meters
const lightScalingFactor = Math.PI; // Since version 155 of three.js
const entityTagName = 'entity-tag';
const tagFontSizePx = 15;
const tagHeightOffset = 0.2; // in meters
const isNumber = (value) => !isNaN(value);

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
    this.visibleLODNodeIDs = new Set();

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
    this.tmpVec3bis = new THREE.Vector3();
    this.tmpQuat = new THREE.Quaternion();
    this.tmpRaycaster = new THREE.Raycaster();

    this.cameraDirection = new THREE.Vector3();
    this.xzDirection = new THREE.Vector2();

    this.camera = new THREE.PerspectiveCamera(fov, aspect, near,
        this.renderingDistance);

    this.head.add(this.tilt);
    this.user.add(this.head);
    this.scene.add(this.user);
    this.cameraDistance = 0;

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
    this.entities.children.forEach((child) => {
      const sprite = child.getObjectByName(entityTagName);

      if (sprite) {
        sprite.material.map.dispose();
        sprite.material.dispose();
      }
    });

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
        color, intensity * lightScalingFactor);

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
        color, intensity * lightScalingFactor);

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
   * Update the bounds tree (for collision detection) on a node
   * @param {integer} id - ID of the node to generate a bounds tree for.
   * @param {function} filter - Filter function to use when flattening
   *                            group, gets fed every mesh and group
   *                            and returns true to accept them in the
   *                            final mesh.
   * @param {function} preSelector - Function in charge of selecting a
   *                                 specific asset within the node group
   *                                 as the actual geometry, this happens
   *                                 before the filtering and merging
   *                                 for bounds tree computation.
   * @param {Vector3} offset - 3D Position offset to apply to the actual
   *                           bounds tree when computing collisions.
   * @return {boolean} True if the node exists and the bounds tree was
   *                   successfully updated, false otherwise.
   */
  updateNodeBoundsTree(id, filter = () => true,
      preSelector = (obj3d) => obj3d,
      offset = new THREE.Vector3()) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);
    let obj3d = node;

    if (node.isLOD) {
      obj3d = node.levels[0].object;
    }

    // Preselect geometry
    obj3d = preSelector(obj3d);

    // Make one single mesh
    const flat = obj3d.isMesh ? obj3d.clone() : flattenGroup(obj3d, filter);

    if (!flat.geometry.getIndex().count) {
      // No face in geometry, so no bounds to compute, return right away
      node.boundsTree = null;
      return true;
    }

    // Compute bounds tree
    try {
      node.boundsTree = new MeshBVH(flat.geometry);
      node.boundsTreeOffset = offset;
    } catch (e) {
      console.error(e); // Something went wrong
      return false;
    }

    return true;
  }

  /**
   * Tell if a given node has its bounds tree ready for collision detection
   * @param {integer} id - ID of the node to look for a bounds tree on.
   * @return {boolean} True if the node exists and its bounds tree is
   *                   ready, false otherwise.
   */
  isNodeBoundsTreeReady(id) {
    if (!this.nodes.has(id)) return false;
    const node = this.nodes.get(id);

    // When the boundsTree attribute is null: it means
    // there is no geometry to collide against, which is
    // different from being undefined when the node has
    // yet to be processed in that regard.
    return node.boundsTree !== undefined;
  }

  /**
   * Get the bounds tree (for collision detection) from a node
   * @param {integer} id - ID of the node to get the bounds tree from.
   * @return {MeshBVH} The .boundsTree property of the node, undefined if
   *                   it has not been generated yet, null if the node does
   *                   not exist.
   */
  getNodeBoundsTree(id) {
    if (!this.nodes.has(id)) return null;

    return this.nodes.get(id).boundsTree;
  }

  /**
   * Get the bounds tree 3D position offset from a node
   * @param {integer} id - ID of the node to get the bounds tree from.
   * @return {Vector3} The .boundsTreeOffset property of the node, undefined if
   *                   it has not been generated yet, null if the node does
   *                   not exist.
   */
  getNodeBoundsTreeOffset(id) {
    if (!this.nodes.has(id)) return null;

    return this.nodes.get(id).boundsTreeOffset;
  }

  /**
   * Get the world transformation matrix
   * @param {integer} id - ID of the node to get the bounds tree from.
   * @return {Matrix4} Global transformation matrix of this node, null
   *                   if the node does not exist.
   */
  getNodeMatrixWorld(id) {
    if (!this.nodes.has(id)) return null;

    return this.nodes.get(id).matrixWorld;
  }

  /**
   * Create new node in the scene
   * @param {number} x - X coordinate of the node.
   * @param {number} y - Y coordinate of the node.
   * @param {number} z - Z coordinate of the node.
   * @param {boolean} lod - Whether or not the node will allow for different
   *                        levels of detail, false by default.
   * @param {boolean} hide - Whether or not to hide node at creation.
   * @return {integer} ID of the newly-spawned node.
   */
  spawnNode(x = 0, y = 0, z = 0, lod = false, hide = false) {
    const id = this.lastId++;
    this.nodes.set(id, lod ? new THREE.LOD() :
        new THREE.Group());
    const node = this.nodes.get(id);

    if (lod) {
      // Ready the LOD with different levels, ready to welcome
      // 3D objects
      node.autoUpdate = false;
      for (const distance of this.lods) {
        const g = new THREE.Group();
        g.matrixAutoUpdate = false;
        node.addLevel(g, distance);
        g.updateMatrix();
      }

      this.lodNodeIDs.add(id);
      if (!hide) this.visibleLODNodeIDs.add(id);
    }

    node.position.set(x, y, z);

    node.userData['dynamic'] = new Map();
    node.matrixAutoUpdate = false;
    node.updateMatrix();

    if (!hide) this.scene.add(node);

    return id;
  }

  /**
   * Set the position of an existing node
   * @param {integer} id - ID of the node to set the position of.
   * @param {number} x - X coordinate of the node.
   * @param {number} y - Y coordinate of the node.
   * @param {number} z - Z coordinate of the node.
   * @return {boolean} True if node exists, false otherwise.
   */
  setNodePosition(id, x, y, z) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);

    node.position.set(x, y, z);
    node.updateMatrix();

    return true;
  }

  /**
   * Remove node from the scene
   * @param {integer} id - ID of the node to remove.
   * @return {boolean} True if node exists, false otherwise.
   */
  removeNode(id) {
    if (!this.nodes.has(id)) return false;

    const node = this.nodes.get(id);

    this.lodNodeIDs.delete(id);
    this.visibleLODNodeIDs.delete(id);

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

    this.visibleLODNodeIDs.forEach((id) => {
      const node = this.nodes.get(id);
      if (!node) return;

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
   * Intersect a given node by raycasting from the camera
   * @param {integer} id - ID of the node to intersect with.
   * @param {Vector3} direction - Direction of the ray to cast.
   * @param {boolean} recursive - Check the node descendants if true.
   * @return {Array} Array of intersection candidates.
   */
  intersectNodeFromCamera(id, direction = null, recursive = true) {
    if (!this.nodes.has(id)) return [];

    const node = this.nodes.get(id);

    this.tmpRaycaster.set(this.camera.getWorldPosition(this.tmpVec3),
        direction || this.camera.getWorldDirection(this.tmpVec3bis));

    return this.tmpRaycaster.intersectObject(node, recursive);
  }

  /**
   * Update all LOD levels based on current hiding distance and
   * camera position
   * @param {Set<integer>} lodNodeIDs - ID of the LOD nodes to update,
   +                                    non-LOD nodes or none existing
   *                                    nodes will be ignored.
   * @param {Camera} camera - Camera to use as a reference to update the
   *                          displayed level of each LOD node.
   */
  updateLODs(lodNodeIDs, camera = this.camera) {
    this.visibleLODNodeIDs.forEach((id) => {
      const node = this.nodes.get(id);
      if (!node || !node.isLOD) return;

      node.levels[1].distance = this.hidingDistance;
      node.update(camera);

      if (node.getCurrentLevel() > 0) {
        // Node went invisible
        this.visibleLODNodeIDs.delete(id);
        node.removeFromParent();
      }

      // If the node was meant to turn invisible: then it will remain
      // as such, no need to check it again.
      // If the node was meant to remain visible, then keep it this way,
      // no need to check it again.
      lodNodeIDs.delete(id);
    });

    lodNodeIDs.forEach((id) => {
      const node = this.nodes.get(id);
      if (!node || !node.isLOD) return;

      node.levels[1].distance = this.hidingDistance;
      node.update(camera);

      if (node.getCurrentLevel() <= 0) {
        // Node went visible
        this.scene.add(node);
        this.visibleLODNodeIDs.add(id);
      }
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
      avatar.position.setY((bbox.max.y - bbox.min.y) / 2);

      const sprite = entity.getObjectByName(entityTagName);

      entity.clear();
      entity.add(avatar);

      if (sprite) {
        // Update the tag position (if any)
        bbox.setFromObject(entity);
        sprite.position.set(0, bbox.max.y + tagHeightOffset, 0);
        entity.add(sprite);
      }
    }
  }

  /**
   * Set entity tag using the name of the entity
   * @param {string} name - Name of the three.js group to set the tag on.
   * @param {string} tag - Tag string to set above the entity.
   */
  setEntityTagByName(name, tag = '') {
    const entity = this.entities.getObjectByName(name);
    if (!entity) return;

    let sprite = entity.getObjectByName(entityTagName);

    if (!sprite) {
      const bbox = new THREE.Box3().setFromObject(entity);
      const canvas = document.createElement('canvas');
      canvas.width = 200;
      canvas.height = 200;

      const ctx = canvas.getContext('2d');

      makeTagCanvas(ctx, [tag], tagFontSizePx,
          formatSignLines(tag, ctx).maxLineWidth, 255, 255, 255);

      const map = new THREE.CanvasTexture(canvas);
      const material = new THREE.PointsMaterial({map});
      material.alphaTest = 0.05;
      material.transparent = true;
      material.sizeAttenuation = false;
      material.size = 200;

      const geometry = new THREE.BufferGeometry();
      const vertices = new Float32Array([0.0, 0.0, 0.0]);
      geometry.setAttribute( 'position',
          new THREE.BufferAttribute(vertices, 3));

      // Using THREE.Points instead of THREE.Sprite allows size definition
      // using pixels, matching the actual 2D canvas
      sprite = new THREE.Points(geometry, material);
      sprite.name = entityTagName;
      sprite.position.set(0, bbox.max.y + tagHeightOffset, 0);
      sprite.userData.lookup = {canvas};
      entity.add(sprite);
    } else {
      // Reuse exsting canvas to write the new tag
      const canvas = sprite.userData.lookup.canvas;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      makeTagCanvas(ctx, [tag], tagFontSizePx,
          formatSignLines(tag, ctx).maxLineWidth, 255, 255, 255);
      sprite.material.map.needsUpdate = true;
      sprite.material.needsUpdate = true;
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
   * Teleports the user to the specified position and sets the yaw.
   * @param {object} position - The target position (x, y, z).
   * @param {number} [yaw] - The yaw angle in degrees (optional).
   * @return {object|false} Returns an object with the new position and yaw if
   *                        successful, or false if teleportation fails.
   */
  teleportUser(position, yaw) {
    const y = position.y ?? this.user.position.y;

    this.user.position.set(position.x, y, position.z);
    if (isNumber(yaw)) {
      const radianYaw = -MathUtils.degToRad((yaw + 180) % 360);

      this.user.rotation.set(
          0, radianYaw, 0, 'YXZ');

      return {x: position.x, y: position.y, z: position.z, yaw: yaw};
    } else {
      return {x: position.x, y: position.y, z: position.z};
    }
    return false;
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
    this.camera.far = 5000; // Allow large skyboxes to be fully displayed
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
