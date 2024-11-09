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

const emit = defineEmits(['minimize', 'maximize', 'close']);

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

onMounted(() => {
  state.display = true;
});

onUnmounted(() => {
  // ??
});

</script>

<template>
  <div v-if="display" id="movable-window" class="window">
  <div class="title-bar">
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
