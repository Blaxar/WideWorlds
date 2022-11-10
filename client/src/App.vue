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
import WorldManager from './core/world-manager.js';
import HttpClient from './core/http-client.js';
import Engine3D from './core/engine-3d.js';
import UserInput, {SubjectBehavior, SubjectBehaviorFactory, UserInputListener, qwertyBindings} from './core/user-input.js';
import UserBehavior from './core/user-behavior.js';
import {LoadingManager} from 'three';

// Three.js context-related settings
let engine3d = null;
let user = null;
const worldPathRegistry = new WorldPathRegistry(new LoadingManager());
let worldManager = null;
let storedKeyBindings = {};

// Define reactive states for Vue.js
const main = reactive({
    state: AppStates.SIGNED_OUT,
    worlds: {}
});

// Ready local storage
if (!localStorage.getItem('keyBindings')) {
    localStorage.setItem('keyBindings', JSON.stringify(qwertyBindings));
} else {
    try {
        storedKeyBindings = JSON.parse(localStorage.getItem('keyBindings'));
    } catch (e) {
        console.warn('Failed parsing key bindings from local storage: falling back to default QWERTY layout');
        localStorage.setItem('keyBindings', JSON.stringify(qwertyBindings));
        storedKeyBindings = Object.assign(storedKeyBindings, qwertyBindings);
    }
}

if (localStorage.getItem('token')) {
    // If there's an authentication token in local storage: skip past the sign-in step
    main.state = AppStates.WORLD_UNLOADED;
}

// Ready http client for REST API usage
const httpClient = new HttpClient(import.meta.env.VITE_SERVER_URL + '/api', true,
                                  localStorage.getItem('token'));

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
        }).catch(e => {
            if (e >= 401 && e < 404) {
                // Failed to authenticate using token: sign out completely
                appState.signOut();
            }
        });
};

const clearWorldList = () => {
    main.worlds = {};
};

const hooks = {
    [AppStates.SIGNED_OUT]: [state => {
        entranceHook(state);
        httpClient.clear();
        localStorage.removeItem('token');
    }, exitHook],
    [AppStates.SIGNING_IN]: [entranceHook, exitHook],
    [AppStates.WORLD_UNLOADED]: [state => { entranceHook(state); fetchWorldList();},
                                 state => { exitHook(state); clearWorldList(); }],
    [AppStates.WORLD_LOADING]: [entranceHook, exitHook],
    [AppStates.WORLD_LOADED]: [entranceHook, exitHook]
};

// Initialize Wide Worlds main application object to handle core transitions (between offline and online)
const appState = new AppState(hooks, main.state);

const handleLogin = (credentials) => {
    appState.signIn();

    httpClient.login(credentials.username, credentials.password)
    .then((token) => {
        localStorage.setItem('token', token);
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

    worldManager.load(world).then(() => {
        appState.readyWorld();
    });
};

const handleWorldCancel = () => {
    appState.signOut();
};

const handleLeave = () => {
    worldManager.unload().then(() => {
        appState.unloadWorld();
    });
};

const handleKeyBindingUpdated = (name, input) => {
    storedKeyBindings[name] = input;
    localStorage.setItem('keyBindings', JSON.stringify(storedKeyBindings));
};

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

const onKeyUp = (event) => {
    inputListener.releaseKey(event.keyCode);
}

const onKeyDown = (event) => {
    inputListener.pressKey(event.keyCode);
}

const render = () => {
    const delta = engine3d.getDeltaTime();
    inputListener.step(delta);
    if (engine3d.render(delta)) {
        requestAnimationFrame(render);
    }
};

// As soon as the component is mounted: initialize Three.js 3D context and spool up rendering cycle
onMounted(() => {
    const canvas = document.querySelector('#main-3d-canvas');
    engine3d = new Engine3D(canvas);
    user = inputListener.setSubject('user', engine3d.camera);

    // Ready world path registry for object caching
    worldManager = new WorldManager(engine3d, worldPathRegistry, httpClient);

    engine3d.start();
    requestAnimationFrame(render);
});

const behaviorFactory = new SubjectBehaviorFactory();
const inputListener = new UserInputListener(behaviorFactory, storedKeyBindings);

behaviorFactory.register('user', UserBehavior);

const displayLogin = computed(() => main.state === AppStates.SIGNED_OUT);
const displayWorldSelection = computed(() => main.state === AppStates.WORLD_UNLOADED && Object.values(main.worlds).length > 0);
const displayTopbar = computed(() => main.state === AppStates.WORLD_LOADED);

document.addEventListener('keyup', onKeyUp, false);
document.addEventListener('keydown', onKeyDown, false);

</script>

<template>
    <canvas id="main-3d-canvas"></canvas>
    <div id="overlay">
    <TopBar v-if="displayTopbar" @leave="handleLeave">
    <template v-slot:control-bindings><ControlBindings :listener="inputListener" @keyBindingUpdated="handleKeyBindingUpdated" /></template>
    </TopBar>
    <Login v-if="displayLogin" @submit="handleLogin" />
    <WorldSelection v-if="displayWorldSelection" :worlds="Object.values(main.worlds)" @submit="handleWorldSelection" @cancel="handleWorldCancel" />
    </div>
</template>

<style>
@import 'xp.css/dist/XP.css';
@import './assets/style.css';
</style>
