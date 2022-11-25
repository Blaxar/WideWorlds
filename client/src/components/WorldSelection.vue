<script setup>

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
});
/* eslint-enable no-unused-vars */

/* eslint-disable prefer-const */
let worldId = null;
/* eslint-enable prefer-const */

const emit = defineEmits(['submit', 'cancel']);

const onSubmit = () => {
  emit('submit', worldId);
};
const cancel = () => {
  emit('cancel');
};

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
