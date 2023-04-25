<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, onUnmounted, ref} from 'vue';
import UserInput, {UserInputListener, qwertyBindings}
  from '../core/user-input.js';

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
<div class="controls-container">
<table :key="componentKey">
    <tr><th scope="col" class="controls-header">Controls</th>
    <th scope="col">Key Bindings</th></tr>
    <tr v-for="name in userInputs" :key="name">
    <td>{{ formatLabel(name) }}</td>
    <td>
        <input type="text" maxlength="0" placeholder="none" :name="name"
        @keyup="onBindingKeyUp" :value="keyToName(listener.getKey(name))"
        ref="inputField" />
    </td>
    </tr>
</table>

<table>
  <tr><td>
    <button @click="resetKeys" name="resetKeys">{{resetKeysButtonText}}</button>
    </td><td>
    <input type="checkbox" id="runByDefault"
:checked="props.userConfig.at('controls').at('runByDefault').value()"
    @change="setRunByDefault"/>
    <label for="runByDefault">{{runByDefaultText}}</label>
  </td></tr>
  <tr><td colspan="2"></td></tr>
  <tr><td>Image service URL prefix:</td>
  <td><input type="text" placeholder="none"
    @change="onImageServiceChange"
    :value="props.userConfig.at('network').at('imageService').value()"
    ref="imageService" />
    <button @click="resetImageService" name="resetImageService">
      {{resetImageServiceButtonText}}
    </button>
  </td></tr>
</table>
</div>

</template>

<style scoped>

</style>
