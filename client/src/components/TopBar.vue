<script setup>

import {computed, reactive} from "vue";

const props = defineProps({
  leaveButtonText: {
    type: String,
    default: 'Leave'
  },
  cameraButtonText: {
    type: String,
    default: 'Change camera'
  },
  visibilityButtonText: {
    type: String,
    default: 'Change visibility'
  },
  controlsButtonText: {
    type: String,
    default: 'Controls'
  }
});

const emit = defineEmits(['leave']);

const state = reactive({
    selected: null
});

const displayControls = computed(() => state.selected === 'controls');
const leave = () => emit('leave');

const select = (event) => {
    state.selected = state.selected === event.target.name ? null : event.target.name;
    if (state.selected === 'leave') emit('leave');
}
</script>

<template>
    <div class="top-bar surface">
    <div class="button-bar">
    <button @click="select" name="leave">{{leaveButtonText}}</button>
    <button @click="select" name="camera">{{cameraButtonText}}</button>
    <button @click="select" name="controls">{{controlsButtonText}}</button>
    </div>
    <div class="settings-panel">
    <slot name="control-bindings" v-if="displayControls" />
    </div>
    </div>
</template>

<style scoped>

</style>
