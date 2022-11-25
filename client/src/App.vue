<script setup>

import {computed, reactive, onMounted} from 'vue';
import LoginForm from './components/LoginForm.vue';
import WorldSelection from './components/WorldSelection.vue';
import TopBar from './components/TopBar.vue';
import UserChat from './components/UserChat.vue';
import ControlBindings from './components/ControlBindings.vue';
import AppState, {AppStates} from './core/app-state.js';
import WorldPathRegistry from './core/world-path-registry.js';
import WorldManager from './core/world-manager.js';
import HttpClient from './core/http-client.js';
import WsClient from './core/ws-client.js';
import Engine3D from './core/engine-3d.js';
import {SubjectBehaviorFactory,
  UserInputListener, qwertyBindings}
  from './core/user-input.js';
import UserBehavior from './core/user-behavior.js';
import {LoadingManager} from 'three';

// Three.js context-related settings
let engine3d = null;
let someInputFocused = false;
const worldPathRegistry = new WorldPathRegistry(new LoadingManager());
let worldManager = null;
let wsClient = null;
let storedKeyBindings = {};

// Define reactive states for Vue.js
const main = reactive({
  state: AppStates.SIGNED_OUT,
  worlds: {},
  worldId: null,
});

// Ready local storage
if (!localStorage.getItem('keyBindings')) {
  localStorage.setItem('keyBindings', JSON.stringify(qwertyBindings));
} else {
  try {
    storedKeyBindings = JSON.parse(localStorage.getItem('keyBindings'));
  } catch (e) {
    console.warn('Failed parsing key bindings from local storage: ' +
                 'falling back to default QWERTY layout');
    localStorage.setItem('keyBindings', JSON.stringify(qwertyBindings));
    storedKeyBindings = Object.assign(storedKeyBindings, qwertyBindings);
  }
}

const spawnWsClient = (token) => new WsClient(import.meta.env.VITE_SERVER_URL.replace(/http\:\/\//g, 'ws://') + '/api', token);

if (localStorage.getItem('token')) {
  // If there's an authentication token in local storage: we skip
  // past the sign-in step
  wsClient = spawnWsClient(localStorage.getItem('token'));
  main.state = AppStates.WORLD_UNLOADED;
}

// Ready http client for REST API usage
const httpClient = new HttpClient(import.meta.env.VITE_SERVER_URL + '/api',
    true, localStorage.getItem('token'));

const entranceHook = (state) => {
  console.log('Entering "' + state + '" state.');
  main.state = state;
};

const exitHook = (state) => {
  // Assume a cleared focus on state change to make up for 'focusout' event
  // not firing when components are disapearing.
  someInputFocused = false;
  console.log('Leaving "' + state + '" state.');
};

const fetchWorldList = () => {
  httpClient.getWorlds()
      .then((json) => {
        for (const world of json) {
          main.worlds[world.id] = world;
        }
      }).catch((error) => {
        if (error.message >= 401 && error.message < 404) {
          // Failed to authenticate using token: sign out completely
          appState.signOut();
        }
      });
};

const clearWorldList = () => {
  main.worlds = {};
};

const getWorldChat = () => {
  return wsClient.worldChatConnect(main.worldId); // Promise
};

const hooks = {
  [AppStates.SIGNED_OUT]: [(state) => {
    entranceHook(state);
    wsClient = null;
    httpClient.clear();
    localStorage.removeItem('token');
  }, exitHook],
  [AppStates.SIGNING_IN]: [entranceHook, exitHook],
  [AppStates.WORLD_UNLOADED]: [(state) => {
    entranceHook(state); fetchWorldList();
  },
  (state) => {
    exitHook(state); clearWorldList();
  }],
  [AppStates.WORLD_LOADING]: [entranceHook, exitHook],
  [AppStates.WORLD_LOADED]: [entranceHook, exitHook],
};

// Initialize Wide Worlds main application object to handle core
// transitions (between offline and online)
const appState = new AppState(hooks, main.state);

const handleLogin = (credentials) => {
  appState.signIn();

  httpClient.login(credentials.username, credentials.password)
      .then((token) => {
        localStorage.setItem('token', token);
        wsClient = spawnWsClient(token);
        appState.toWorldSelection();
      })
      .catch((error) => {
        console.log(error);
        appState.failedSigningIn();
      });
};

const handleWorldSelection = (id) => {
  const world = main.worlds[id];
  appState.loadWorld();

  worldManager.load(world).then(() => {
    main.worldId = id;
    appState.readyWorld();
  });
};

const handleWorldCancel = () => {
  appState.signOut();
};

const handleLeave = () => {
  worldManager.unload();
  appState.unloadWorld();
};

const handleKeyBindingUpdated = (name, input) => {
  storedKeyBindings[name] = input;
  localStorage.setItem('keyBindings', JSON.stringify(storedKeyBindings));
};

const render = () => {
  const delta = engine3d.getDeltaTime();
  inputListener.step(delta);
  worldManager?.update(engine3d.camera.position, delta);
  if (engine3d.render(delta)) {
    requestAnimationFrame(render);
  }
};

// As soon as the component is mounted: initialize Three.js 3D context and
// spool up rendering cycle
onMounted(() => {
  document.addEventListener('keydown', (event) => {
    if (event.ctrlKey && !someInputFocused) {
      event.preventDefault();
    }
  });

  const canvas = document.querySelector('#main-3d-canvas');
  engine3d = new Engine3D(canvas);
  inputListener.setSubject('user', engine3d.camera);

  // Ready world path registry for object caching
  worldManager = new WorldManager(engine3d, worldPathRegistry, httpClient);

  engine3d.start();
  requestAnimationFrame(render);
});

const behaviorFactory = new SubjectBehaviorFactory();
const inputListener = new UserInputListener(behaviorFactory, storedKeyBindings);

behaviorFactory.register('user', UserBehavior);

const displayLogin = computed(() => main.state === AppStates.SIGNED_OUT);
const displayWorldSelection =
      computed(() => main.state === AppStates.WORLD_UNLOADED &&
               Object.values(main.worlds).length > 0);
const displayEdgebars = computed(() => main.state === AppStates.WORLD_LOADED);

// Do not forward key events to the input listener if some html element is being
// focused
document.addEventListener('keyup', (event) => {
  if (someInputFocused) return;
  inputListener.releaseKey(event.keyCode);
}, false);
document.addEventListener('keydown', (event) => {
  if (someInputFocused) return;
  inputListener.pressKey(event.keyCode);
}, false);

document.addEventListener('focusin', (event) => {
  someInputFocused = true;
}, false);
document.addEventListener('focusout', (event) => {
  someInputFocused = false;
}, false);

</script>

<template>
    <canvas id="main-3d-canvas"></canvas>
    <div id="overlay">
    <TopBar v-if="displayEdgebars" @leave="handleLeave">
    <template v-slot:control-bindings><ControlBindings :listener="inputListener"
    @keyBindingUpdated="handleKeyBindingUpdated" /></template>
    </TopBar>
    <LoginForm v-if="displayLogin" @submit="handleLogin" />
    <WorldSelection v-if="displayWorldSelection"
    :worlds="Object.values(main.worlds)" @submit="handleWorldSelection"
    @cancel="handleWorldCancel" />
    <UserChat v-if="displayEdgebars" :worldChat="getWorldChat()" />
    </div>
</template>

<style>
@import 'xp.css/dist/XP.css';
@import './assets/style.css';
</style>
