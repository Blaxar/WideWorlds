import * as THREE from 'three';
import * as utils3D from './utils-3d.js';

class Engine3D {
    constructor(canvas) {
        this.stopRequested = false;
        this.renderer = new THREE.WebGLRenderer({canvas});
        this.renderer.outputEncoding = THREE.sRGBEncoding;
        this.clock = new THREE.Clock();
        this.scene = new THREE.Scene();
        const fov = 45;
        const aspect = 2;
        const near = 0.1;
        const far = 100;
        this.camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
        this.camera.position.set(0, 0, 0);
        this.camera.lookAt(new THREE.Vector3(0, 0, 1)); // Look to the north

        // Ready the Octahedron foir sky colors
        this.reversedOctahedron = utils3D.makeReversedOctahedron();
        this.skyBox = null;

        this.reversedOctahedron.material.depthTest = false;
        this.scaleSky = new THREE.Matrix4();
        this.reversedOctahedron.applyMatrix4(this.scaleSky);
        this.reversedOctahedron.renderOrder = -2;
        this.scene.add(this.reversedOctahedron);
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
        if (this.skyBox) this.scene.remove(this.skyBox);

        this.skyBox = model;
        this.skyBox.position.set(0, -1, 0);
        this.skyBox.applyMatrix4(this.scaleSky);
        this.scene.add(this.skyBox);
    }

    resetSkyBox(model) {
        if (this.skyBox) this.scene.remove(this.skyBox);
    }

    render() {
        // Do not render anything: notify the upper window context that we want to stop
        if (this.stopRequested) return false;

        const deltaTime = Math.min(this.clock.getDelta());

        if (this.resizeRendererToDisplaySize()) {
            const canvas = this.renderer.domElement;
            this.camera.aspect = canvas.clientWidth / canvas.clientHeight;
            this.camera.updateProjectionMatrix();
        }

        this.reversedOctahedron.rotateY(deltaTime*0.2);

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
