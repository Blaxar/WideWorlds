<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {reactive, toRef, toRaw} from 'vue';

// eslint-disable-next-line no-unused-vars
const props = defineProps({
  userInfo: {
    type: Object,
    default: null,
  },

  buttonText: {
    type: String,
    default: 'Update',
  },
 });

const emit = defineEmits(['submit']);
 
const userRef = toRef(props, 'userInfo');

const onSubmit = () => {
  emit('submit', toRaw(userRef.value));
};

</script>

<template>
  <!-- eslint-disable max-len -->
  <form @submit.prevent="onSubmit">
    <table>
      <tbody>
        <tr>
          <td>
            Username:
          </td>
          <td>
            <input
              v-model="userRef.name"
              type="text"
              class="text-input"
            >
          </td>
        </tr>
        <tr>
          <td>
            Role:
          </td>
          <td>
            <select
              v-model="userRef.role"
            >
              <option value="tourist">Tourist</option>
              <option value="citizen">Citizen</option>
              <option value="admin"">Admin</option>
            </select>
          </td>
        </tr>
        <tr>
          <td>
            Email:
          </td>
          <td>
            <input
              type="text"
              v-model="userRef.email"
              class="text-input"
            >
          </td>
        </tr>
        <tr>
          <td>
            ID:
          </td>
          <td>
            {{ userInfo?.id }}
          </td>
        </tr>
        <tr>
          <td colspan="2">
            <button type="submit">
              {{ buttonText }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </form>
  <!-- eslint-enable max-len -->
</template>

<style scoped>

</style>
