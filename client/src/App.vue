<script setup>

import {computed, reactive, onMounted} from "vue";
import * as THREE from 'three';
import Splash from './components/Splash.vue';
import Login from './components/Login.vue';
import WorldSelection from './components/WorldSelection.vue';
import WorldView from './components/WorldView.vue';
import TopBar from './components/TopBar.vue';
import ControlBindings from './components/ControlBindings.vue';
import AppState, {AppStates} from './core/app-state.js';
import ModelRegistry from './core/model-registry.js';
import WorldPathRegistry from './core/world-path-registry.js';
import HttpClient from './core/http-client.js';
import * as utils3D from './core/utils-3d.js';
import UserInput, {SubjectBehavior, SubjectBehaviorFactory, UserInputListener} from './core/user-input.js';

// Three.js context-related settings
const clock = new THREE.Clock();
const textureEncoding = THREE.sRGBEncoding;
let renderer = null;
const scene = new THREE.Scene();
const reversedOctahedron = utils3D.makeReversedOctahedron();
reversedOctahedron.material.depthTest = false;
const scaleOctahedron = new THREE.Matrix4();
scaleOctahedron.makeScale(60.0, 60.0, 60.0);
reversedOctahedron.applyMatrix4(scaleOctahedron);
reversedOctahedron.renderOrder = -1;
scene.add(reversedOctahedron);
const fov = 45;
const aspect = 2;
const near = 0.1;
const far = 100;
const camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
camera.position.set(0, 0, 0);

// Define reactive states for Vue.js
const main = reactive({
    state: AppStates.SIGNED_OUT,
    worlds: []
});

// Ready http client for REST API usage
const httpClient = new HttpClient(import.meta.env.VITE_SERVER_URL + '/api', true);

const entranceHook = (state) => {
    console.log('Entering "' + state + '" state.');
    main.state = state;
};

const exitHook = (state) => {
    console.log('Leaving "' + state + '" state.');
};

const fetchWorldList = () => {
    httpClient.getWorlds()
    .then(json => {
        main.worlds.push(...json);
    });
};

const clearWorldList = () => {
    main.worlds.length = 0;
};

const hooks = {
    [AppStates.SIGNED_OUT]: [entranceHook, exitHook],
    [AppStates.SIGNING_IN]: [entranceHook, exitHook],
    [AppStates.WORLD_UNLOADED]: [(state) => { entranceHook(state); fetchWorldList();},
                                 (state) => { exitHook(state); clearWorldList();}],
    [AppStates.WORLD_LOADING]: [entranceHook, exitHook],
    [AppStates.WORLD_LOADED]: [entranceHook, exitHook]
};

// Initialize Wide Worlds main application object to handle core transitions (between offline and online)
const appState = new AppState(hooks);

const handleLogin = (credentials) => {

    appState.signIn();

    httpClient.login(credentials.username, credentials.password)
    .then(() => {
        appState.toWorldSelection();
    })
    .catch(error => {
        console.log(error);
        appState.failedSigningIn();
    });

};

const handleWorldSelection = (world) => {

    appState.loadWorld();

    // WIP

    appState.readyWorld();

};

const handleWorldCancel = () => {

    appState.signOut();

};

const handleLeave = () => {

    appState.unloadWorld();

};

const displayLogin = computed(() => main.state === AppStates.SIGNED_OUT);
const displayWorldSelection = computed(() => main.state === AppStates.WORLD_UNLOADED && main.worlds.length > 0);
const displayTopbar = computed(() => main.state === AppStates.WORLD_LOADED);

const resizeRendererToDisplaySize = (renderer) => {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
};

const render = () => {
    const deltaTime = Math.min(clock.getDelta());

    if (resizeRendererToDisplaySize(renderer)) {
      const canvas = renderer.domElement;
      camera.aspect = canvas.clientWidth / canvas.clientHeight;
      camera.updateProjectionMatrix();
    }

    reversedOctahedron.rotateY(deltaTime*0.2);

    renderer.render(scene, camera);
    requestAnimationFrame(render);
};

// As soon as the component is mounted: initialize Three.js 3D context and spool up rendering cycle
onMounted(() => {
    const canvas = document.querySelector('#main-3d-canvas');
    renderer = new THREE.WebGLRenderer({canvas});
    renderer.outputEncoding = THREE.sRGBEncoding;
    requestAnimationFrame(render);
});

const behaviorFactory = new SubjectBehaviorFactory();
const inputListener = new UserInputListener(behaviorFactory);

//behaviorFactory.register('dummy', DummyBehavior);

</script>

<template>
    <canvas id="main-3d-canvas"></canvas>
    <div id="overlay">
    <TopBar v-if="displayTopbar" @leave="handleLeave">
    <template v-slot:control-bindings><ControlBindings :listener="inputListener" /></template>
    </TopBar>
    <Login v-if="displayLogin" @submit="handleLogin" />
    <WorldSelection v-if="displayWorldSelection" :worlds="main.worlds" @submit="handleWorldSelection" @cancel="handleWorldCancel" />
    </div>
</template>

<style>
@import 'xp.css/dist/XP.css';
@import './assets/style.css';
</style>
