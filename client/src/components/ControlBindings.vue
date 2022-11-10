<script setup>

import {onMounted, onUnmounted, ref} from "vue";
import UserInput, {UserInputListener} from '../core/user-input.js';

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
    111: 'Numpad /'
};

let componentKey = 0;

const props = defineProps({
    userInputs: {
        type: Array,
        default: UserInput
    },
    listener: {
        type: Object,
        default: new UserInputListener
    }
});

const formatLabel = (name) => {
    // Capitalize first letter, then put a space before each remaining capital letters
    return name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1').trim();
};

const nonPrintableKeyToName = (key) => {
    if (key === null) return null;
    return nonPrintableKeys[key] ? nonPrintableKeys[key] : null;
};

const keyToName = (key) => {
    if (key === null) return null;
    return (key >= 48 && key < 96) ? String.fromCharCode(key).toUpperCase() : nonPrintableKeyToName(key);
};

const onKeyUp = (event) => {
    if (keyToName(event.keyCode)) {
        props.listener.bindKey(event.target.name, event.keyCode, true);
    }
}

const inputField = ref(null);

const emit = defineEmits(['keyBindingUpdated']);

onMounted(() => {
    // Each time some binding changes: we look for the corresponding input field and update the value
    props.listener.addBindingListener((name, input) => {
        for (const inp of inputField.value) {
            if (inp.name === name) {
                inp.value = keyToName(input);
                break;
            }
        }

        emit('keyBindingUpdated', name, input);
    });
});

onUnmounted(() => {
    props.listener.clearBindingListeners();
});

</script>

<template>

<table :key="componentKey">
    <tr v-for="name in userInputs">
    <td>{{ formatLabel(name) }}</td>
    <td><input type="text" maxlength="0" placeholder="none" :name="name" @keyup="onKeyUp" :value="keyToName(listener.getKey(name))" ref="inputField" /></td>
    </tr>
</table>

</template>

<style scoped>

</style>
