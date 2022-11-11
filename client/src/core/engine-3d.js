import * as THREE from 'three';
import * as utils3D from './utils-3d.js';

class Engine3D {
    constructor(canvas) {
        this.stopRequested = false;
        this.renderer = new THREE.WebGLRenderer({canvas});
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.renderer.autoClear = false;
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        this.backgroundScene = new THREE.Scene();
        const fov = 45;
        const aspect = 2;
        const near = 0.1;
        const far = 100;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(0, 1.80, 0);
        this.camera.lookAt(new THREE.Vector3(0, 1.80, 1)); // Look to the north

        // Ready the Octahedron foir sky colors
        this.reversedOctahedron = utils3D.makeReversedOctahedron();
        this.skyBox = null;

        this.reversedOctahedron.material.depthTest = false;
        this.scaleSky = new THREE.Matrix4();
        this.reversedOctahedron.applyMatrix4(this.scaleSky);
        this.reversedOctahedron.renderOrder = -2;
        this.reversedOctahedron.depthTest = false;
        this.ambientLight = new THREE.AmbientLight(0xffffff, 0.6); // soft white light
        this.directionalLight = new THREE.DirectionalLight(0xffff70, 0.9); // orange-ish?
        this.directionalLight.position.set(1, 1, 1);
        this.backgroundScene.add(this.reversedOctahedron);
        this.scene.add(this.ambientLight);
        this.scene.add(this.directionalLight);
        this.nodes = new Map();
        this.lastId = 0;
    }

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

    setSkyColors(colors) {
        this.reversedOctahedron.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3));
    }

    resetSkyColors() {
        this.reversedOctahedron.geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(utils3D.defaultSkyColors), 3));
    }

    setSkyBox(model) {
        if (this.skyBox) this.backgroundScene.remove(this.skyBox);

        this.skyBox = model;
        this.skyBox.position.set(0, -1, 0);
        this.skyBox.applyMatrix4(this.scaleSky);
        this.skyBox.renderOrder = -1;
        this.skyBox.depthTest = false;
        this.backgroundScene.add(this.skyBox);
    }

    resetSkyBox(model) {
        if (this.skyBox) this.backgroundScene.remove(this.skyBox);
    }

    setAmbientLight(color) {
        this.ambientlight.color = color;
    }

    spawnNode(x = 0, y = 0, z = 0) {
        const id = this.lastId++;
        this.nodes.set(id, new THREE.Group());
        const node = this.nodes.get(id);
        node.position.set(x, y, z);
        this.scene.add(node);
        return id;
    }

    removeNode(id) {
        if (!this.nodes.has(id)) return false;

        this.scene.remove(this.nodes.get(id));
        this.nodes.delete(id);
        return true;
    }

    appendToNode(id, obj3d) {
        if (!this.nodes.has(id)) return false;

        this.nodes.get(id).add(obj3d);
        return true;
    }

    getDeltaTime() {
        return this.clock.getDelta();
    }

    render(deltaTime = this.getDeltaTime()) {
        // Do not render anything: notify the upper window context that we want to stop
        if (this.stopRequested) return false;

        if (this.resizeRendererToDisplaySize()) {
            const canvas = this.renderer.domElement;
            this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }

        // TODO: only enable spin it when the world is not loaded 
        this.reversedOctahedron.rotateY(deltaTime*0.2);
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

    start() {
        this.stopRequested = false;
    }

    stop() {
        this.stopRequested = true;
    }
}

export default Engine3D;
