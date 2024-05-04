<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, ref} from 'vue';

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
  settingsButtonText: {
    type: String,
    default: 'Settings',
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

const emit = defineEmits(['leave', 'camera', 'avatar', 'settings']);

const avatarId = ref(null);

const select = (event) => {
  const selected = event.target.name;

  if (selected === 'leave') emit('leave');
  else if (selected === 'camera') emit('camera');
  else if (selected === 'settings') emit('settings');
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
    <div class="top-bar">
    <div class="surface">
    <div class="button-bar">
    <button @click="select" name="leave">{{leaveButtonText}}</button>
    <button @click="select" name="camera">{{cameraButtonText}}</button>
    <button @click="select" name="settings">{{settingsButtonText}}</button>
    <select v-model="avatarId" @change="pickAvatar">
      <option v-for="(a, id) in avatars" :key="id" :value="id">
        {{ a.name }}
      </option>
    </select>
    <slot name="animations" />
    </div>
    <div class="info-bar">
    <slot name="compass" />
    </div>
    </div>
    </div>
</template>

<style scoped>

</style>
