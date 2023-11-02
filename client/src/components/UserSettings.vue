<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, onUnmounted, ref} from 'vue';
import UserInput, {UserInputListener, qwertyBindings}
  from '../core/user-input.js';
import {renderingDistance, propsLoadingDistance}
  from '../core/user-config.js';

// TODO: find some better way to handle this... (if any)
const nonPrintableKeys = {
  8: 'Backspace',
  9: 'Tab',
  13: 'Enter',
  16: 'Shift',
  17: 'Control',
  18: 'Alt',
  19: 'Pause',
  20: 'Caps Lock',
  27: 'Escape',
  32: 'Space', // Okay, technically this one is printable, but you get the idea.
  33: 'Page Up',
  34: 'Page Down',
  35: 'End',
  36: 'Home',
  37: 'Left',
  38: 'Up',
  39: 'Right',
  40: 'Down',
  44: 'Print',
  45: 'Insert',
  46: 'Delete',
  96: 'Numpad 0',
  97: 'Numpad 1',
  98: 'Numpad 2',
  99: 'Numpad 3',
  100: 'Numpad 4',
  101: 'Numpad 5',
  102: 'Numpad 6',
  103: 'Numpad 7',
  104: 'Numpad 8',
  105: 'Numpad 9',
  106: 'Numpad *',
  107: 'Numpad +',
  109: 'Numpad -',
  110: 'Numpad .',
  111: 'Numpad /',
};

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
  useHtmlSignRenderingText: {
    type: String,
    default: 'Use HTML rendering for signs',
  },
  debugUserColliderText: {
    type: String,
    default: 'Display user collider box',
  },
  userInputs: {
    type: Array,
    default: UserInput,
  },
  listener: {
    type: Object,
    default: new UserInputListener,
  },
  userConfig: {
    type: Object,
  },
});

const formatLabel = (name) => {
  // Capitalize first letter, then put a space before each
  // remaining capital letter
  return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')
      .trim();
};

const nonPrintableKeyToName = (key) => {
  if (key === null) return null;
  return nonPrintableKeys[key] ? nonPrintableKeys[key] : null;
};

const keyToName = (key) => {
  if (key === null) return null;
  return (key >= 48 && key < 96) ? String.fromCharCode(key).toUpperCase() :
      nonPrintableKeyToName(key);
};

const onBindingKeyUp = (event) => {
  if (keyToName(event.keyCode)) {
    props.listener.bindKey(event.target.name, event.keyCode, true);
  }
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

const setUseHtmlSignRendering = (event) => {
  props.userConfig.at('graphics')
      .at('useHtmlSignRendering').set(event.target.checked);
};

const setDebugUserCollider = (event) => {
  props.userConfig.at('graphics')
      .at('debugUserCollider').set(event.target.checked);
};

const localRenderingDistance = ref(getRenderingDistance());
const localPropsLoadingDistance = ref(getPropsLoadingDistance());

onMounted(() => {
  // Each time some binding changes: we look for the corresponding input field
  // and update the value
  props.listener.addBindingListener((name, input) => {
    for (const inp of inputField.value) {
      if (inp.name === name) {
        inp.value = keyToName(input);
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
    @keyup="onBindingKeyUp" :value="keyToName(listener.getKey(name))"
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
</table>
</div>
</div>
</template>

<style scoped>

</style>
