<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {computed, reactive, onMounted} from 'vue';
import LoginForm from './components/LoginForm.vue';
import WorldSelection from './components/WorldSelection.vue';
import TopBar from './components/TopBar.vue';
import UserChat from './components/UserChat.vue';
import UserSettings from './components/UserSettings.vue';
import AppState, {AppStates} from './core/app-state.js';
import WorldPathRegistry from './core/world-path-registry.js';
import WorldManager from './core/world-manager.js';
import HttpClient from './core/http-client.js';
import EntityManager from './core/entity-manager.js';
import UserConfig from './core/user-config.js';
import WsClient from './core/ws-client.js';
import Engine3D from './core/engine-3d.js';
import {SubjectBehaviorFactory, UserInputListener}
  from './core/user-input.js';
import UserBehavior from './core/user-behavior.js';
import {entityType, updateType} from '../../common/ws-data-format.js';
import {LoadingManager} from 'three';

// Three.js context-related settings
let engine3d = null;
let someInputFocused = false;
let worldManager = null;
let worldState = null;
let wsClient = null;
let entityManager = null;
const storedKeyBindings = {};
let defaultWorldId = null;
let worldAvatars = [];
const thirdPersonCameraDistance = 8;
let cameraMode = 0; // 0 is first person view, 1 is rear view, 2 is front view
let lastAvatarUpdate = 0;

// Define reactive states for Vue.js
const main = reactive({
  state: AppStates.SIGNED_OUT,
  worlds: {},
  worldId: null,
});

// Ready local storage
const userConfig = new UserConfig('config', (config) => {
  Object.assign(storedKeyBindings, config.controls.keyBindings);
});

const worldPathRegistry = new WorldPathRegistry(new LoadingManager(), 'rwx',
    'textures', userConfig.at('network').at('imageService'));

const spawnWsClient = (token) =>
  new WsClient(import.meta.env.VITE_SERVER_URL.replace(/http\:\/\//g, 'ws://') +
  '/api', token);

if (localStorage.getItem('token') && localStorage.getItem('userId')) {
  // If there's an authentication token in local storage: we skip
  // past the sign-in step
  wsClient = spawnWsClient(localStorage.getItem('token'));
  main.userId = parseInt(localStorage.getItem('userId'));
  main.state = AppStates.WORLD_UNLOADED;
}

if (localStorage.getItem('defaultWorldId')) {
  // Get the default world ID to select by default in the world
  // selection screen, if any
  defaultWorldId = parseInt(localStorage.getItem('defaultWorldId'));
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
    localStorage.removeItem('userId');
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
      .then(({id, token}) => {
        localStorage.setItem('token', token);
        localStorage.setItem('userId', id);
        main.userId = id;
        wsClient = spawnWsClient(token);
        appState.toWorldSelection();
      })
      .catch((error) => {
        console.log(error);
        appState.failedSigningIn();
      });
};

// Update camera based on desired mode
const updateCamera = (cycleMode = false) => {
  if (cycleMode) cameraMode = (cameraMode + 1) % 3;

  if (cameraMode == 0) engine3d.setCameraDistance(0);
  else if (cameraMode == 1) {
    engine3d.setCameraDistance(-thirdPersonCameraDistance);
  } else engine3d.setCameraDistance(thirdPersonCameraDistance);
};

const handleWorldSelection = (id) => {
  const world = main.worlds[id];
  appState.loadWorld();

  worldManager.load(world).then((avatars) => {
    // Mark this world as default choice for the world selection
    // screen
    defaultWorldId = id;
    localStorage.setItem('defaultWorldId', id);
    main.worldId = id;
    worldAvatars = avatars;
    updateCamera();
    worldState = wsClient.worldStateConnect(id);
    worldState.then((state) => {
      state.onMessage((data) => {
        entityManager.update(data);
      });
    });
    appState.readyWorld();
  });
};

const handleWorldCancel = () => {
  appState.signOut();
};

const handleLeave = () => {
  worldManager.unload();
  worldState.then((state) => {
    state.close();
  });
  appState.unloadWorld();
};

const handleAvatar = (avatarId) => {
  // Remove focus from the selection menu
  document.activeElement.blur();

  // Avatar ID must be within bound
  if (avatarId >= worldAvatars.length) return;

  // Load avatar
  worldManager.getAvatar(worldAvatars[avatarId].geometry).then((obj3d) => {
    engine3d.setUserAvatar(obj3d, avatarId);
  });
};

const render = () => {
  const delta = engine3d.getDeltaTime();
  inputListener.step(delta);
  worldManager?.update(engine3d.camera.position, delta);
  entityManager?.setLocalUserId(main.userId);

  if (main.userId !== null && worldState && entityManager &&
      lastAvatarUpdate < Date.now() - entityManager.getAvgUpdateTimeMs() / 2) {
    const localUserState = {
      entityType: entityType.user,
      updateType: updateType.moving,
      entityId: main.userId,
      x: engine3d.user.position.x,
      y: engine3d.user.position.y,
      z: engine3d.user.position.z,
      yaw: engine3d.user.rotation.y,
      pitch: engine3d.user.rotation.x,
      roll: engine3d.user.rotation.z,
      dataBlock0: engine3d.user.userData.avatarId,
    };

    worldState.then((state) => state.send(localUserState));
    lastAvatarUpdate = Date.now();
  }

  entityManager?.step(delta);
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

  // Update user position based on controls
  // Note: we could be passing the whole engine3d object, this would work
  //       as well, but let's be rigorous there and only expose the fields
  //       we need.
  inputListener.setSubject('user', {user: engine3d.user, tilt: engine3d.tilt,
    runByDefaultNode: userConfig.at('controls').at('runByDefault')});
  // Ready world path registry for object caching
  worldManager = new WorldManager(engine3d, worldPathRegistry, httpClient);
  entityManager = new EntityManager(engine3d.entities, null,
      0.05,
      (node, avatarId) => { // Set callback for entity avatar update
        if (avatarId >= worldAvatars.length) return;

        worldManager.getAvatar(worldAvatars[avatarId].geometry)
            .then((obj3d) => {
              engine3d.setEntityAvatar(node, obj3d, avatarId);
            });
      });

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
document.addEventListener('pointermove', (event) => {
  onPointerMove(engine3d, event);
}, false);

// Temporary debug thing that we'll remove when we properly handle mouse events.
document.addEventListener('click', (event) => {
  if (someInputFocused) return;
  const intersects =
    engine3d.clickRaycaster.intersectObjects(engine3d.scene.children, true);

  for (let i = 0; i < intersects.length; i++) {
    if ((intersects.length > 0) && (intersects[i].object.visible) &&
        (intersects[i].object.name.length > 0)) {
      engine3d.lastClickedObject = intersects[i].object;
      console.log(engine3d.lastClickedObject);
      console.log('Avatar Pos: ' +
        engine3d.user.position.x, engine3d.user.position.y,
      engine3d.user.position.z);

      return;
    }
  }
}, false);

document.addEventListener('contextmenu', (event) => {
  if (someInputFocused) return;
  event.preventDefault();
  // inputListener.onRightClick(engine3d, event);
}, false);

/**
 * Sets our Pointer object's X and Y coordinates for Raycasting
 * @param {Engine3D} engine3d - A reference to the 3D Engine
 * @param {PointerEvent} event
 */
function onPointerMove(engine3d, event) {
  engine3d.pointer.x = ( event.clientX / window.innerWidth ) * 2 - 1;
  engine3d.pointer.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

</script>

<template>
    <canvas id="main-3d-canvas"></canvas>
    <div id="overlay">
    <TopBar v-if="displayEdgebars" :avatars="worldAvatars" @leave="handleLeave"
    @camera="updateCamera(true)" @avatar="handleAvatar">
    <template v-slot:settings><UserSettings :listener="inputListener"
    :userConfig="userConfig" /></template>
    </TopBar>
    <LoginForm v-if="displayLogin" @submit="handleLogin" />
    <WorldSelection v-if="displayWorldSelection"
    :worlds="Object.values(main.worlds)" @submit="handleWorldSelection"
    :defaultWorldId="defaultWorldId" @cancel="handleWorldCancel" />
    <UserChat v-if="displayEdgebars" :worldChat="getWorldChat()" />
    </div>
</template>

<style>
@import 'xp.css/dist/XP.css';
@import './assets/style.css';
</style>
