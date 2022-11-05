<script setup>

import {computed, reactive, onMounted} from "vue";
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
import Engine3D from './core/engine-3d.js';
import UserInput, {SubjectBehavior, SubjectBehaviorFactory, UserInputListener} from './core/user-input.js';
import {LoadingManager} from 'three';

// Three.js context-related settings
let engine3d = null;

// Define reactive states for Vue.js
const main = reactive({
    state: AppStates.SIGNED_OUT,
    worlds: {}
});

// Ready http client for REST API usage
const httpClient = new HttpClient(import.meta.env.VITE_SERVER_URL + '/api', true);

// Ready world path registry for object caching
const worldPathRegistry = new WorldPathRegistry(new LoadingManager());

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
            for (const world of json) {
                main.worlds[world.id] = world;
            }
    });
};

const clearWorldList = () => {
    main.worlds = {};
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

const handleWorldSelection = (id) => {
    const world = main.worlds[id];
    appState.loadWorld();

    const data = JSON.parse(world.data);

    const modelRegistry = worldPathRegistry.get(data.path);

    // Fetch all the sky colors from the world data, normalize them between 0.0 and 1.0
    engine3d.setSkyColors([
        ...data.skyColor.north,
        ...data.skyColor.east,
        ...data.skyColor.south,
        ...data.skyColor.west,
        ...data.skyColor.top,
        ...data.skyColor.bottom
    ].map((c) => c / 255.0));

    if (data.skybox) {
        worldPathRegistry.get(data.path).then((modelRegistry) => {
            return modelRegistry.get(`${data.skybox}.rwx`);
        }).then((model) => {
            engine3d.setSkyBox(model)
        });
    }

    appState.readyWorld();
};

const handleWorldCancel = () => {
    appState.signOut();
};

const handleLeave = () => {
    appState.unloadWorld();
    engine3d.resetSkyColors();
    engine3d.resetSkyBox();
};

const displayLogin = computed(() => main.state === AppStates.SIGNED_OUT);
const displayWorldSelection = computed(() => main.state === AppStates.WORLD_UNLOADED && Object.values(main.worlds).length > 0);
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
    if (engine3d.render())
        requestAnimationFrame(render);
};

// As soon as the component is mounted: initialize Three.js 3D context and spool up rendering cycle
onMounted(() => {
    const canvas = document.querySelector('#main-3d-canvas');
    engine3d = new Engine3D(canvas);
    engine3d.start();
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
    <WorldSelection v-if="displayWorldSelection" :worlds="Object.values(main.worlds)" @submit="handleWorldSelection" @cancel="handleWorldCancel" />
    </div>
</template>

<style>
@import 'xp.css/dist/XP.css';
@import './assets/style.css';
</style>
