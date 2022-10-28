<script setup>

const props = defineProps({
  id: {
    type: String,
    default: 'world-view'
  },
  canvasId: {
    type: String,
    default: 'world-view-canvas'
  },
  toolbarId: {
    type: String,
    default: 'world-view-toolbar'
  },
  logout_button_text: {
    type: String,
    default: 'Log out'
  }
});

const emit = defineEmits(['logout']);

</script>

<template>
<div :id="id">
  <div :id="toolbarId"><button @click="logout">{{logout_button_text}}</button></div>
  <canvas :id="canvasId"></canvas>
</div>
</template>

<style scoped>

</style>
