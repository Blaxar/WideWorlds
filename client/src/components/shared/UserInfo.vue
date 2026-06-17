<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {ref, toRaw} from 'vue';


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

// Break reactivity with original object, use local version
const {name, role, email} = toRaw(props.userInfo);
const userRef = ref({name, role, email});

const onSubmit = () => {
  emit('submit', userRef.value);
};

const reset = () => {
  const {name, role, email} = toRaw(props.userInfo);
  userRef.value = {name, role, email};
};

defineExpose({reset});

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
              <option value="tourist">
                Tourist
              </option>
              <option value="citizen">
                Citizen
              </option>
              <option value="admin">
                Admin
              </option>
            </select>
          </td>
        </tr>
        <tr>
          <td>
            Email:
          </td>
          <td>
            <input
              v-model="userRef.email"
              type="text"
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
