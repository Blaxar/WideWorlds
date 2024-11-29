<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, onUnmounted, computed, reactive} from 'vue';

/* eslint-disable no-unused-vars */
const props = defineProps({
  titleText: {
    type: String,
    default: 'Untitled',
  },
});

const state = reactive({
  display: true,
});
/* eslint-enable no-unused-vars */

const display = computed(() => state.display);

const emit = defineEmits(['minimize', 'maximize', 'close', 'hold', 'release']);

/* eslint-disable no-unused-vars */
const minimize = (event) => {
  emit('minimize');
};

const maximize = (event) => {
  emit('maximize');
};
/* eslint-enable no-unused-vars */

const close = (event) => {
  emit('close');
};

const hold = (event) => {
  const movableWindow = event.target.parentElement;
  const marginLeft = parseInt(movableWindow.style['margin-left']
      ?.replace('px', '') || '0');
  const marginTop = parseInt(movableWindow.style['margin-top']
      ?.replace('px', '') || '0');

  emit('hold', movableWindow, marginLeft - event.pageX,
      marginTop - event.pageY);
};

const release = (event) => {
  emit('release');
};

onMounted(() => {
  state.display = true;
});

onUnmounted(() => {
  // ??
});

</script>

<template>
  <div v-if="display" class="window movable-window">
  <div class="title-bar" @pointerdown="hold" @pointerup="release">
  <div class="title-bar-text">{{titleText}}</div>
    <div class="title-bar-controls">
      <!--
      <button aria-label="Minimize" @click="minimize"></button>
      <button aria-label="Maximize" @click="maximize"></button>
      -->
      <button aria-label="Close" @click="close"></button>
    </div>
  </div>
  <div class="window-body">
  <slot name="body" />
  </div>
  </div>
</template>

<style scoped>

</style>
