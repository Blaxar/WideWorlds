<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {computed, reactive, onMounted} from 'vue';
import LoginForm from './components/LoginForm.vue';
import WorldSelection from './components/WorldSelection.vue';
import TopBar from './components/TopBar.vue';
import CentralOverlay from './components/CentralOverlay.vue';
import UserChat from './components/UserChat.vue';
import UserSettings from './components/UserSettings.vue';
import PropSettings from './components/PropSettings.vue';
import AnimationPicker from './components/AnimationPicker.vue';
import AppState, {AppStates} from './core/app-state.js';
import WorldPathRegistry from './core/world-path-registry.js';
import WorldManager from './core/world-manager.js';
import HttpClient from './core/http-client.js';
import EntityManager, {getUserEntityName}
  from './core/entity-manager.js';
import UserCollider from './core/user-collider.js';
import UserConfig from './core/user-config.js';
import WsClient from './core/ws-client.js';
import Engine3D from './core/engine-3d.js';
import UserFeed, {userFeedPriority} from './core/user-feed.js';
import {SubjectBehaviorFactory, UserInputListener, qwertyBindings}
  from './core/user-input.js';
import UserBehavior from './core/user-behavior.js';
import PropsBehavior, {PropsSelector} from './core/props-behavior.js';
import {entityType, updateType} from '../../common/ws-data-format.js';
import {LoadingManager, Vector2, Vector3} from 'three';
import rasterizeHTML from 'rasterizehtml';
import CommandParser from './core/command-parser.js';
import AnimationManager, {animateEntityImp, animateEntityExp}
  from './core/animation-manager.js';

// Three.js context-related settings
let commands = null;
let engine3d = null;
let userCollider = null;
let propsSelector = null;
let someInputFocused = false;
let worldManager = null;
let worldState = null;
let entityManager = null;
const tmpVec2 = new Vector2;
const animationManager = new AnimationManager();

const userState = {flying: true, onGround: false, running: false, idle: true,
  explicit: {name: '', start: 0, duration: 0}};

// Ready key bindings with default values
const storedKeyBindings = JSON.parse(JSON.stringify(qwertyBindings));
const isTextSelected = () => !!window.getSelection()?.toString();
const unselectText = () => window.getSelection()?.removeAllRanges();
const isOverlay3D = (target) => !['button-bar', 'chat-entry']
    .some((className) => target.classList.contains(className));

let defaultWorldId = null;
let worldAvatars = [];
let animations = [];
const thirdPersonCameraDistance = 8;
let cameraMode = 0; // 0 is first person view, 1 is rear view, 2 is front view
let lastAvatarUpdate = 0;

const wsClient = new WsClient(
    import.meta.env.VITE_SERVER_URL.replace(/http\:\/\//g, 'ws://') + '/api');

// Define reactive states for Vue.js
const main = reactive({
  state: AppStates.SIGNED_OUT,
  worlds: {},
  worldId: null,
  displayUserSettings: false,
  displayPropSettings: false,
  propSettingsTrigger: 0,
  animationListTrigger: 0,
  propSettings: {run: false, strafe: false},
});

const userFeed = new UserFeed();
let worldChat = null;

// Ready local storage
const userConfig = new UserConfig('config', (config) => {
  // Assign proper key bindings when they are defined
  Object.assign(storedKeyBindings, config.controls.keyBindings);
});

const worldPathRegistry = new WorldPathRegistry(new LoadingManager(), 'rwx',
    'textures', userConfig.at('network').at('imageService'), rasterizeHTML,
    userConfig.at('graphics').at('useHtmlSignRendering'));

if (localStorage.getItem('token') && localStorage.getItem('userId')) {
  // If there's an authentication token in local storage: we skip
  // past the sign-in step
  wsClient.setAuthToken(localStorage.getItem('token'));
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
  main.worlds = {};
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


const plugWorldChat = async () => {
  worldChat = await wsClient.worldChatConnect(main.worldId);
  worldChat.onMessage((entry) => {
    const data = JSON.parse(entry);
    userFeed.publish(data.msg, data.name);
    engine3d.setEntityTagByName(getUserEntityName(data.id),
        data.name);
  });
};

const unplugWorldChat = async () => {
  worldChat?.close();
  worldChat = null;
};

const hooks = {
  [AppStates.SIGNED_OUT]: [(state) => {
    entranceHook(state);
    wsClient?.clear();
    httpClient?.clear();
    localStorage.removeItem('token');
    localStorage.removeItem('userId');
  }, exitHook],
  [AppStates.SIGNING_IN]: [entranceHook, exitHook],
  [AppStates.WORLD_UNLOADED]: [(state) => {
    entranceHook(state); fetchWorldList();
  }, exitHook],
  [AppStates.WORLD_LOADING]: [entranceHook, exitHook],
  [AppStates.WORLD_LOADED]: [entranceHook, exitHook],
};

// Initialize Wide Worlds main application object to handle core
// transitions (between offline and online)
const appState = new AppState(hooks, main.state);

const resetBehavior = () => {
  inputListener.setSubject('user', {
    user: engine3d.user,
    getAvatar: (() => engine3d.userAvatar),
    getAvatarName: (() => {
      return engine3d.userAvatar.userData.avatarId === undefined ?
          '' :
          worldAvatars[engine3d.userAvatar.userData.avatarId].name;
    }),
    tilt: engine3d.tilt,
    collider: userCollider,
    velocity: new Vector3(),
    state: userState,
    animation: animationManager,
    configsNode: userConfig.at('controls'),
    physicsNode: userConfig.at('physics'),
  });
  main.displayPropSettings = false;
  someInputFocused = false;
};

const onPropsSelectionChange = (nbProps) => {
  if (nbProps) {
    main.propSettingsTrigger = (main.propSettingsTrigger + 1) % 2;
    // prop(s) selected: the selector will be the subject of every
    // input from now on
    propsSelector.updateMainAxis(engine3d.camera);
    inputListener.setSubject('props', propsSelector);
    main.displayPropSettings = true;
    engine3d.revealProps();
  } else {
    main.displayPropSettings = false;
    resetBehavior();
    engine3d.hideProps();
  }
};

const handleLogin = (credentials) => {
  appState.signIn();

  httpClient.login(credentials.username, credentials.password)
      .then(({id, token}) => {
        localStorage.setItem('token', token);
        localStorage.setItem('userId', id);
        main.userId = id;

        wsClient.setAuthToken(token);

        userFeed.publish('Logged in successfully! Please select world.',
            null, userFeedPriority.info);
        appState.toWorldSelection();
      })
      .catch((error) => {
        userFeed.publish('Could not log in, invalid username and/or password.',
            null, userFeedPriority.error);
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
  userFeed.publish(`Joining ${world.name}...`,
      null, userFeedPriority.info);

  worldManager.load(world).then(async ({avatars, path}) => {
    commands = new CommandParser(engine3d, world.data, userFeed,
        userConfig.at('controls'));
    // Mark this world as default choice for the world selection
    // screen
    defaultWorldId = id;
    localStorage.setItem('defaultWorldId', id);
    main.worldId = id;
    const motd = JSON.parse(world.data).welcome;
    if (motd) {
      userFeed.publish(`${motd}`,
          'World', userFeedPriority.info);
    }
    await unplugWorldChat();
    await plugWorldChat();
    worldAvatars = avatars;
    animationManager.setPath(path);
    updateCamera();
    worldState = wsClient.worldStateConnect(id);
    worldState.then((state) => {
      state.onMessage((data) => {
        entityManager.update(data);
      });
    });
    userCollider.registerDebugBox();
    appState.readyWorld();
  });
};

const handleLogOut = () => {
  userFeed.publish(`Logging out...`,
      null, userFeedPriority.info);
  appState.signOut();
};

const handleLeave = () => {
  const worldName = main.worlds[main.worldId].name;
  userFeed.publish(`Leaving ${worldName}...`,
      null, userFeedPriority.info);
  resetBehavior();
  propsSelector?.clear();
  worldManager.unload();
  worldState?.then((state) => {
    state.close();
  });
  worldState = null;
  appState.unloadWorld();
  main.worldId = null;
  userCollider.unregisterDebugBox();
};

const handleAvatar = (avatarId) => {
  // Remove focus from the selection menu
  document.activeElement.blur();

  // Avatar ID must be within bound
  if (avatarId >= worldAvatars.length) return;

  // Load avatar
  worldManager.getAvatar(worldAvatars[avatarId].geometry).then((obj3d) => {
    engine3d.setUserAvatar(obj3d, avatarId);
    userCollider.adjustToObject(obj3d);
    obj3d.userData.avatarId = avatarId;

    const {name, imp, exp} = worldAvatars[avatarId];
    animationManager.loadAvatarSequences(name, imp, exp);
    animations = Object.entries(exp).map(([name]) => name);
    main.animationListTrigger = (main.animationListTrigger + 1) % 2;
  });
};

const handleAnimation = (name) => {
  const avatarName = engine3d.userAvatar.userData.avatarId === undefined ?
      '' : worldAvatars[engine3d.userAvatar.userData.avatarId].name;
  userState.explicit.name = name;
  userState.explicit.start = Date.now() * 0.001;
  userState.explicit.duration =
      animationManager.probeExplicitAnimationDuration(avatarName, name);
};

const render = () => {
  const delta = engine3d.getDeltaTime();
  inputListener.step(delta);
  worldManager?.update(engine3d.camera.position, delta);
  entityManager?.setLocalUserId(main.userId);

  if (main.userId !== null && worldState && entityManager &&
      lastAvatarUpdate < Date.now() - entityManager.getAvgUpdateTimeMs() / 2) {
    let speed = 1000.0;

    if (engine3d.userAvatar.userData.lastFrame?.speed !== undefined) {
      speed = engine3d.userAvatar.userData.lastFrame.speed * 1000;
    }

    // Converting to integer then masking to get unsigned short value;
    speed = ((speed << 16) >> 16) & 0xffff;
    let explicitProgress = 0;

    const {start, duration} = userState.explicit;

    const now = Date.now() * 0.001;
    if (start && duration && now < start + duration) {
      // Explicit animation progression is expressed as
      // a ratio encoded on a 16-bit data block (unsigned),
      // where 0x0000 is 0.0 and 0xffff is 1.0
      explicitProgress = (now - start) / duration * 0xffff;
    }

    explicitProgress = explicitProgress > 0xffff ? 0xffff : explicitProgress;

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
      dataBlock0: engine3d.user.userData.avatarId, // ID of the avatar
      dataBlock1: explicitProgress ? // Animation sequence hash to play
        engine3d.userAvatar.userData.lastExplicitHash :
        engine3d.userAvatar.userData.lastImplicitHash,
      dataBlock2: speed, // Speed for implicit animations (ignored otherwise)
      dataBlock3: explicitProgress & 0xffff, // If not null, the sequence
      //                                        is to be played as an explicit
      //                                        animation
    };

    worldState.then((state) => state.send(localUserState));
    lastAvatarUpdate = Date.now();
  }

  propsSelector.updatePropAxis(engine3d.camera);

  // Only update entities if the world is loaded
  if (worldState) entityManager.step(delta);

  if (engine3d.render(delta)) {
    requestAnimationFrame(render);
  }
};

// As soon as the component is mounted: initialize Three.js 3D context and
// spool up the rendering cycle
onMounted(() => {
  const canvas = document.querySelector('#main-3d-canvas');
  engine3d = new Engine3D(canvas, userConfig.at('graphics'));
  userCollider = new UserCollider(engine3d, userConfig.at('graphics'));

  // Update user position based on controls
  // Note: we could be passing the whole engine3d object, this would work
  //       as well, but let's be rigorous there and only expose the fields
  //       we need.
  resetBehavior();

  // Ready world path registry for object caching
  worldManager = new WorldManager(engine3d, worldPathRegistry, httpClient,
      wsClient, userFeed, userCollider,
      userConfig.at('graphics').at('propsLoadingDistance'));
  propsSelector = new PropsSelector(engine3d, worldManager,
      onPropsSelectionChange, userConfig.at('graphics')
          .at('renderingDistance'));
  entityManager = new EntityManager(engine3d.entities, null,
      0.05,
      (node, avatarId) => { // Set callback for entity avatar update
        if (avatarId >= worldAvatars.length) return;
        if (node.userData.avatarId === avatarId) return;

        const {name, imp, exp} = worldAvatars[avatarId];
        animationManager.loadAvatarSequences(name, imp, exp);

        worldManager.getAvatar(worldAvatars[avatarId].geometry)
            .then((obj3d) => {
              engine3d.setEntityAvatar(node, obj3d, avatarId);
              node.userData.avatarView = null;
            });
      },
      (node, hash, speed) => {
        animateEntityImp(node, hash, speed, animationManager);
      },
      (node, hash, progress) => {
        animateEntityExp(node, hash, progress, animationManager);
      });

  engine3d.start();

  requestAnimationFrame(render);
});

const behaviorFactory = new SubjectBehaviorFactory();
const inputListener = new UserInputListener(behaviorFactory, storedKeyBindings);

behaviorFactory.register('user', UserBehavior);
behaviorFactory.register('props', PropsBehavior);

const displayLogin = computed(() => main.state === AppStates.SIGNED_OUT);
const displayWorldSelection =
      computed(() => main.state === AppStates.WORLD_UNLOADED &&
               Object.values(main.worlds).length > 0);
const displayEdgebars = computed(() => main.state === AppStates.WORLD_LOADED);

const handleSendChat = (msg) => {
  if (commands.isCommand(msg)) {
    commands.handleCommand(msg);
  } else {
    // IRC-style double slash sends the command to chat.
    if (msg.startsWith('//')) msg = msg.replace(/^\//, '');
    worldChat?.send(msg);
  }
};

const getViewCoordinates = (event, vec2) => {
  // Note: here we're assuming that the 3D rendering canvas will always
  // perfectly match the whole HTML window itself (it should anyway...)
  const x = ( event.clientX / window.innerWidth ) * 2 - 1;
  const y = - ( event.clientY / window.innerHeight ) * 2 + 1;
  vec2.set(x, y);
};

// Do not forward key events to the input listener if some html element is being
// focused
document.addEventListener('keyup', (event) => {
  if (inputListener.getRunKey() === event.code) {
    main.propSettings.run = false;
    inputListener.releaseKey(event.code);
    return;
  } else if (inputListener.getStrafeKey() === event.code) {
    main.propSettings.strafe = false;
    inputListener.releaseKey(event.code);
    return;
  }

  if (someInputFocused) return;
  inputListener.releaseKey(event.code);
}, false);

document.addEventListener('keydown', (event) => {
  if (inputListener.getRunKey() === event.code) {
    main.propSettings.run = true;
    inputListener.pressKey(event.code);
    return;
  } else if (inputListener.getStrafeKey() === event.code) {
    main.propSettings.strafe = true;
    inputListener.pressKey(event.code);
    return;
  } else if (event.code === 'Escape') {
    // Escape unselects any selected text.
    unselectText();
  } else if (event.ctrlKey && event.code === 'KeyC' && isTextSelected()) {
    // When text is selected, prevent CTRL+C from being forwarded to the
    //  inputListener, so that we can prevent actions as we copy text.
    return;
  }
  if (someInputFocused) return;
  inputListener.pressKey(event.code);
}, false);

document.addEventListener('focusin', (event) => {
  someInputFocused = true;
}, false);
document.addEventListener('focusout', (event) => {
  someInputFocused = false;
}, false);

document.addEventListener('contextmenu', (event) => {
  if (someInputFocused) return true;

  if (isOverlay3D(event.target)) {
    getViewCoordinates(event, tmpVec2);
    propsSelector.select(tmpVec2, main.propSettings.strafe);
    event.preventDefault();
  }

  return false;
}, false);

document.addEventListener('mousemove', (event) => {
  if (someInputFocused) return true;

  if (isOverlay3D(event.target)) {
    getViewCoordinates(event, tmpVec2);
    event.target.title = propsSelector.point(tmpVec2);
  }

  return false;
}, false);
</script>

<template>
  <canvas id="main-3d-canvas"></canvas>
  <div id="overlay">
    <TopBar v-if="displayEdgebars" :avatars="worldAvatars" @leave="handleLeave"
    @camera="updateCamera(true)" @avatar="handleAvatar"
    @settings="main.displayUserSettings = !main.displayUserSettings" >
    <template v-slot:animations>
      <AnimationPicker :key="main.animationListTrigger"
      :animations="animations" @animation="handleAnimation" />
    </template>
    </TopBar>
    <CentralOverlay v-if="displayEdgebars">
    <template v-slot:left v-if="main.displayUserSettings">
    <UserSettings :listener="inputListener"
    :userConfig="userConfig" />
    </template>
    <template v-slot:right v-if="main.displayPropSettings">
    <PropSettings :key="main.propSettingsTrigger" :propsSelector="propsSelector"
    :run="main.propSettings.run"
    :strafe="main.propSettings.strafe"
    :exitKey="inputListener.getExitKey()"
    :duplicateKey="inputListener.getDuplicateKey()"
    @defocus="() => { someInputFocused = false; }" />
    </template>
    </CentralOverlay>
    <LoginForm v-if="displayLogin" @submit="handleLogin" />
    <WorldSelection v-if="displayWorldSelection"
    :worlds="Object.values(main.worlds)" @submit="handleWorldSelection"
    :defaultWorldId="defaultWorldId" @cancel="handleLogOut" />
    <UserChat @send="handleSendChat" :feed="userFeed"
    :enablePrompt="main.worldId !== null" />
  </div>
</template>

<style>
@import 'xp.css/dist/XP.css';
@import './assets/style.css';
</style>
