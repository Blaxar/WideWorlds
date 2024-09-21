<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, onUnmounted, ref} from 'vue';
import ChunkCache from '../core/chunk-cache.js';
import UserInput, {UserInputListener, qwertyBindings}
  from '../core/user-input.js';
import {renderingDistance, propsLoadingDistance, idlePropsLoading}
  from '../core/user-config.js';
import UserConfig from '../core/user-config.js';
import UserFeed, {userFeedPriority} from '../core/user-feed.js';

const componentKey = 0;

const props = defineProps({
  resetKeysButtonText: {
    type: String,
    default: 'Reset Keys',
  },
  runByDefaultText: {
    type: String,
    default: 'Run by default',
  },
  resetImageServiceButtonText: {
    type: String,
    default: 'Reset',
  },
  renderingDistanceText: {
    type: String,
    default: 'Rendering distance:',
  },
  propsLoadingDistanceText: {
    type: String,
    default: 'Props loading distance:',
  },
  idlePropsLoadingText: {
    type: String,
    default: 'Idle props loading',
  },
  idlePropsLoadingDistanceText: {
    type: String,
    default: 'Distance:',
  },
  idlePropsLoadingDowntimeText: {
    type: String,
    default: 'Downtime:',
  },
  idlePropsLoadingSpeedText: {
    type: String,
    default: 'Speed:',
  },
  backgroundSceneryText: {
    type: String,
    default: 'Display background scenery',
  },
  useHtmlSignRenderingText: {
    type: String,
    default: 'Use HTML rendering for signs',
  },
  debugUserColliderText: {
    type: String,
    default: 'Display user collider box',
  },
  colliderInterpolationText: {
    type: String,
    default: 'Enable collider interpolation',
  },
  legacyCoordinatesText: {
    type: String,
    default: 'Enable Legacy (AW) Coordinates',
  },
  clearChunkCacheText: {
    type: String,
    default: 'Clear Chunk Cache',
  },
  userInputs: {
    type: Array,
    default: UserInput,
  },
  listener: {
    type: Object,
    default: new UserInputListener,
  },
  chunkCache: {
    type: Object,
    default: new ChunkCache,
  },
  userConfig: {
    type: UserConfig,
  },
  feed: {
    type: UserFeed,
    required: true,
  },
  chunksClearedMessage: {
    type: String,
    default: 'Cleared every chunk of props from local cache',
  },
});

// Alias to shorten the path
const backgroundScenery = () =>
  props.userConfig.at('graphics').at('backgroundScenery');

const formatLabel = (name) => {
  if (typeof name !== 'string' || name === '') return '';

  // Capitalize first letter, then put a space before each
  // remaining capital letter
  return name.startsWith('Key') ? name.substring(3) :
    name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')
        .trim();
};

const onBindingKeyUp = (event) => {
  props.listener.bindKey(event.target.name, event.code, true);
};

const onImageServiceChange = (event) => {
  props.userConfig.at('network').at('imageService').set(event.target.value);
};

const inputField = ref(null);

const imageService = ref(null);

const resetKeys = () => {
  props.listener.bindAllKeys(qwertyBindings);
};

const resetImageService = () => {
  imageService.value.value = props.userConfig.at('network').at('imageService')
      .defaultValue();
  props.userConfig.at('network').at('imageService').reset();
};

const setRunByDefault = (event) => {
  props.userConfig.at('controls').at('runByDefault').set(event.target.checked);
};

const getRenderingDistance = () => {
  return props.userConfig.at('graphics').at('renderingDistance').value();
};

const setRenderingDistance = (event) => {
  const value = parseInt(event.target.value);
  localRenderingDistance.value = value;
  props.userConfig.at('graphics').at('renderingDistance').set(value, false);
};

const saveRenderingDistance = (event) => {
  const value = parseInt(event.target.value);
  localRenderingDistance.value = value;
  props.userConfig.at('graphics').at('renderingDistance').set(value);
};

const getPropsLoadingDistance = () => {
  return props.userConfig.at('graphics').at('propsLoadingDistance').value();
};

const setPropsLoadingDistance = (event) => {
  const value = parseInt(event.target.value);
  localPropsLoadingDistance.value = value;
  props.userConfig.at('graphics').at('propsLoadingDistance').set(value, false);
};

const savePropsLoadingDistance = (event) => {
  const value = parseInt(event.target.value);
  localPropsLoadingDistance.value = value;
  props.userConfig.at('graphics').at('propsLoadingDistance').set(value);
};

// Idle props loading distance: maximum radius to load chunks within

const getIdlePropsLoadingDistance = () => {
  return props.userConfig.at('graphics').at('idlePropsLoading')
      .at('distance').value();
};

const setIdlePropsLoadingDistance = (event) => {
  const value = parseInt(event.target.value);
  localIdlePropsLoadingDistance.value = value;
  props.userConfig.at('graphics').at('idlePropsLoading')
      .at('distance').set(value, false);
};

const saveIdlePropsLoadingDistance = (event) => {
  const value = parseInt(event.target.value);
  localIdlePropsLoadingDistance.value = value;
  props.userConfig.at('graphics').at('idlePropsLoading')
      .at('distance').set(value);
};

// Idle props loading downtime: how long to wait before starting
// once user stopped moving

const getIdlePropsLoadingDowntime = () => {
  return props.userConfig.at('graphics').at('idlePropsLoading')
      .at('downtime').value();
};

const setIdlePropsLoadingDowntime = (event) => {
  const value = parseInt(event.target.value);
  localIdlePropsLoadingDowntime.value = value;
  props.userConfig.at('graphics').at('idlePropsLoading')
      .at('downtime').set(value, false);
};

const saveIdlePropsLoadingDowntime = (event) => {
  const value = parseInt(event.target.value);
  localIdlePropsLoadingDowntime.value = value;
  props.userConfig.at('graphics').at('idlePropsLoading')
      .at('downtime').set(value);
};

// Idle props loading speed: how many chunks to load per second

const getIdlePropsLoadingSpeed = () => {
  return props.userConfig.at('graphics').at('idlePropsLoading')
      .at('speed').value();
};

const setIdlePropsLoadingSpeed = (event) => {
  const value = parseInt(event.target.value);
  localIdlePropsLoadingSpeed.value = value;
  props.userConfig.at('graphics').at('idlePropsLoading')
      .at('speed').set(value, false);
};

const saveIdlePropsLoadingSpeed = (event) => {
  const value = parseInt(event.target.value);
  localIdlePropsLoadingSpeed.value = value;
  props.userConfig.at('graphics').at('idlePropsLoading')
      .at('speed').set(value);
};

const setBackgroundScenery = (event) => {
  backgroundScenery().at('enabled').set(event.target.checked);
};

const setUseHtmlSignRendering = (event) => {
  props.userConfig.at('graphics')
      .at('useHtmlSignRendering').set(event.target.checked);
};

const setDebugUserCollider = (event) => {
  props.userConfig.at('graphics')
      .at('debugUserCollider').set(event.target.checked);
};

const setColliderInterpolation = (event) => {
  props.userConfig.at('physics')
      .at('colliderInterpolation').set(event.target.checked);
};

const setlegacyCoordinates = (event) => {
  props.userConfig.at('interface')
      .at('legacyCoordinates').set(event.target.checked);
};

const clearChunkCache = () => {
  props.feed.publish(props.chunksClearedMessage, 'Client',
      userFeedPriority.info);
  props.chunkCache.clear();
};

const localRenderingDistance = ref(getRenderingDistance());
const localPropsLoadingDistance = ref(getPropsLoadingDistance());
const localIdlePropsLoadingDistance = ref(getIdlePropsLoadingDistance());
const localIdlePropsLoadingDowntime = ref(getIdlePropsLoadingDowntime());
const localIdlePropsLoadingSpeed = ref(getIdlePropsLoadingSpeed());

onMounted(() => {
  // Each time some binding changes: we look for the corresponding input field
  // and update the value
  props.listener.addBindingListener((name, input) => {
    for (const inp of inputField.value) {
      if (inp.name === name) {
        inp.value = formatLabel(input);
        break;
      }
    }

    props.userConfig.at('controls').at('keyBindings').at(name)
        .set(input);
  });
});

onUnmounted(() => {
  props.listener.clearBindingListeners();
});

</script>

<template>
<div class="user-settings surface">
<div class="controls-container">
<table :key="componentKey">
  <tr><th scope="col" class="controls-header">Controls</th>
  <th scope="col">Key Bindings</th></tr>
  <tr v-for="name in userInputs" :key="name">
  <td>{{ formatLabel(name) }}</td>
  <td>
    <input type="text" maxlength="0" placeholder="none" :name="name"
    @keyup="onBindingKeyUp" :value="formatLabel(listener.getKey(name))"
    ref="inputField" class="text-input" />
  </td>
  </tr>
</table>

<table>
  <tr><td>
    <button @click="resetKeys" name="resetKeys">{{resetKeysButtonText}}</button>
    </td><td>
    <input type="checkbox" id="runByDefault"
    :checked="props.userConfig.at('controls').at('runByDefault').value()"
    @change="setRunByDefault" />
    <label for="runByDefault">{{runByDefaultText}}</label>
  </td></tr>
  <tr><td colspan="2"></td></tr>
  <tr><td>Image service URL prefix:</td>
  <td><input type="text" placeholder="none"
    @change="onImageServiceChange"
    :value="props.userConfig.at('network').at('imageService').value()"
    ref="imageService" class="text-input" />
    <button @click="resetImageService" name="resetImageService">
      {{resetImageServiceButtonText}}
    </button>
  </td></tr>
  <tr><td colspan="2">
  <label for="renderingDistance">
    {{renderingDistanceText}}: {{localRenderingDistance}}m
  </label>
  <input id="renderingDistance" type="range" :min="renderingDistance.min"
    :max="renderingDistance.max" :defaultValue="getRenderingDistance()"
    :step="renderingDistance.step" @input="setRenderingDistance"
    @change="saveRenderingDistance" />
  </td></tr>
  <tr><td colspan="2">
  <label for="propsLoadingDistance">
    {{propsLoadingDistanceText}}: {{localPropsLoadingDistance}}m
  </label>
  <input id="propsLoadingDistance" type="range" :min="propsLoadingDistance.min"
    :max="propsLoadingDistance.max" :defaultValue="getPropsLoadingDistance()"
    :step="propsLoadingDistance.step" @input="setPropsLoadingDistance"
    @change="savePropsLoadingDistance" />
  </td></tr>
  <tr><td colspan="2"> {{idlePropsLoadingText}} </td></tr>
  <tr><td colspan="2">
  <label for="idlePropsLoadingDistance">
    {{idlePropsLoadingDistanceText}}: {{localIdlePropsLoadingDistance}}m
  </label>
  <input id="idlePropsLoadingDistance" type="range"
    :min="idlePropsLoading.distance.min"
    :max="idlePropsLoading.distance.max"
    :defaultValue="getIdlePropsLoadingDistance()"
    :step="idlePropsLoading.distance.step" @input="setIdlePropsLoadingDistance"
    @change="saveIdlePropsLoadingDistance" />
  </td></tr>
  <tr><td colspan="2">
  <label for="idlePropsLoadingDowntime">
    {{idlePropsLoadingDowntimeText}}: {{localIdlePropsLoadingDowntime}}s
  </label>
  <input id="idlePropsLoadingDowntime" type="range"
    :min="idlePropsLoading.downtime.min"
    :max="idlePropsLoading.downtime.max"
    :defaultValue="getIdlePropsLoadingDowntime()"
    :step="idlePropsLoading.downtime.step" @input="setIdlePropsLoadingDowntime"
    @change="saveIdlePropsLoadingDowntime" />
  </td></tr>
  <tr><td colspan="2">
  <label for="idlePropsLoadingSpeed">
    {{idlePropsLoadingSpeedText}}: {{localIdlePropsLoadingSpeed}} chunks/second
  </label>
  <input id="idlePropsLoadingSpeed" type="range"
    :min="idlePropsLoading.speed.min"
    :max="idlePropsLoading.speed.max" :defaultValue="getIdlePropsLoadingSpeed()"
    :step="idlePropsLoading.speed.step" @input="setIdlePropsLoadingSpeed"
    @change="saveIdlePropsLoadingSpeed" />
  </td></tr>
  <tr><td colspan="2">
  <input type="checkbox" id="backgroundScenery"
    :checked="backgroundScenery().at('enabled').value()"
    @change="setBackgroundScenery" />
    <label for="backgroundScenery">
      {{backgroundSceneryText}}
    </label>
  </td></tr>
  <tr><td colspan="2">
  <input type="checkbox" id="useHtmlSignRendering"
    :checked=
    "props.userConfig.at('graphics').at('useHtmlSignRendering').value()"
    @change="setUseHtmlSignRendering" />
    <label for="useHtmlSignRendering">
      {{useHtmlSignRenderingText}}
    </label>
  </td></tr>
  <tr><td colspan="2">
  <input type="checkbox" id="debugUserCollider"
    :checked=
    "props.userConfig.at('graphics').at('debugUserCollider').value()"
    @change="setDebugUserCollider" />
    <label for="debugUserCollider">
      {{debugUserColliderText}}
    </label>
  </td></tr>
  <tr><td colspan="2">
  <input type="checkbox" id="colliderInterpolation"
    :checked=
    "props.userConfig.at('physics').at('colliderInterpolation').value()"
    @change="setColliderInterpolation" />
    <label for="colliderInterpolation">
      {{colliderInterpolationText}}
    </label>
  </td></tr>
  <tr><td colspan="2">
  <input type="checkbox" id="legacyCoordinates"
    :checked=
    "props.userConfig.at('interface').at('legacyCoordinates').value()"
    @change="setlegacyCoordinates" />
    <label for="legacyCoordinates">
      {{legacyCoordinatesText}}
    </label>
  </td></tr>
  <tr><td colspan="2">
    <button @click="clearChunkCache">
      {{clearChunkCacheText}}
    </button>
  </td></tr>
</table>
</div>
</div>
</template>

<style scoped>

</style>
