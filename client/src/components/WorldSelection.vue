<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, ref} from 'vue';

/* eslint-disable no-unused-vars */
const props = defineProps({
  prompt: {
    type: String,
    default: 'Select world',
  },
  selectButtonText: {
    type: String,
    default: 'Select',
  },
  cancelButtonText: {
    type: String,
    default: 'Cancel',
  },
  worlds: {
    type: Array,
    default: () => [],
  },
  defaultWorldId: {
    type: Number,
    default: null,
  },
});
/* eslint-enable no-unused-vars */

const worldId = ref(null);
const availableWorldIds = new Set();

const emit = defineEmits(['submit', 'cancel']);

const onSubmit = () => {
  if (worldId.value !== null && availableWorldIds.has(worldId.value)) {
    emit('submit', worldId.value);
  }
};

const cancel = () => {
  emit('cancel');
};

onMounted(() => {
  for (const {id} of props.worlds) {
    availableWorldIds.add(id);
  }

  worldId.value = props.defaultWorldId;
});

</script>

<template>
    <div class="world-selection window prompt">
    <div class="title-bar"><div class="title-bar-text">{{ prompt }}</div></div>
    <form @submit.prevent="onSubmit">
    <table class="window-body">
    <tr><td><label> World: </label></td>
    <td>
        <select v-model="worldId">
            <option v-for="w in worlds" :key="w.id" :value="w.id">
                {{ w.name }}
            </option>
        </select>
    </td>
    </tr>
    <tr>
    <td><button @click="cancel">{{cancelButtonText}}</button></td>
    <td><button type="submit">{{selectButtonText}}</button></td>
    </tr>
    </table>
    </form>
    </div>
</template>

<style scoped>

</style>
