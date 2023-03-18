<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, reactive, ref} from 'vue';

/* eslint-disable no-unused-vars */
const props = defineProps({
  leaveButtonText: {
    type: String,
    default: 'Leave',
  },
  cameraButtonText: {
    type: String,
    default: 'Change Camera',
  },
  visibilityButtonText: {
    type: String,
    default: 'Change Visibility',
  },
  controlsButtonText: {
    type: String,
    default: 'Controls',
  },
  avatars: {
    type: Array,
    default: () => [],
  },
  defaultAvatarId: {
    type: Number,
    default: 0,
  },
});
/* eslint-enable no-unused-vars */

const emit = defineEmits(['leave', 'camera', 'avatar']);

const avatarId = ref(null);

const state = reactive({
  displayControls: false,
});

const select = (event) => {
  const selected = event.target.name;

  if (selected === 'leave') emit('leave');
  else if (selected === 'camera') emit('camera');
  else if (selected === 'controls') {
    state.displayControls = !state.displayControls;
  }
};

const pickAvatar = () => {
  emit('avatar', avatarId.value);
};

onMounted(() => {
  avatarId.value = props.defaultAvatarId;
  pickAvatar();
});

</script>

<template>
    <div class="top-bar surface">
    <div class="button-bar">
    <button @click="select" name="leave">{{leaveButtonText}}</button>
    <button @click="select" name="camera">{{cameraButtonText}}</button>
    <button @click="select" name="controls">{{controlsButtonText}}</button>
    <select v-model="avatarId" @change="pickAvatar">
      <option v-for="(a, id) in avatars" :key="id" :value="id">
        {{ a.name }}
      </option>
    </select>
    </div>
    <div class="settings-panel">
    <slot name="control-bindings" v-if="state.displayControls" />
    </div>
    </div>
</template>

<style scoped>

</style>
