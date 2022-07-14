<script setup>

const props = defineProps({
  prompt: {
    type: String,
    default: 'Select world'
  },
  select_button_text: {
    type: String,
    default: 'Select'
  },
  cancel_button_text: {
    type: String,
    default: 'Cancel'
  },
  worlds: {
    type: Array,
    default: []
  },
  world: {
    type: Object,
    default: null
  }
});

const emit = defineEmits(['submit', 'cancel', 'fetchWorldList']);

const onSubmit = () => { emit('submit', world.id); }
const cancel = () => { emit('cancel'); }

</script>

<template>
  <div class="world_selection">
    <h2>{{ prompt }}</h2>
    <form @submit.prevent="onSubmit">
    <table>
    <tr><td><label> World: </label></td>
    <td>
      <select v-model="world">
        <option v-for="w in worlds" :key="w.id" :value="w.id">
          {{ w.name }}
        </option>
      </select>
    </td>
    </tr>
    <tr>
    <td><button @click="cancel">{{cancel_button_text}}</button></td>
    <td><button type="submit">{{select_button_text}}</button></td>
    </tr>
    </table>
    </form>
  </div>
</template>

<style scoped>

</style>
