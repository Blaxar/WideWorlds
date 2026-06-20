<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, computed, ref, toRaw} from 'vue';


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
let canEditRole = false;
const userRef = ref({name, role, email});

// Handle passwords logic here, they are only included in
// the JSON payoad when their macthing fields are field
const password = ref(null);
const passwordRepeat = ref(null);
const privilegePassword = ref(null);
const privilegePasswordRepeat = ref(null);

// True when the form can be submitted (coherent field values)
const submittable = computed(() =>
  (password.value === passwordRepeat.value) &&
  (privilegePassword.value === privilegePasswordRepeat.value));

const clearPasswords = () => {
  password.value = null;
  passwordRepeat.value = null;

  privilegePassword.value = null;
  privilegePasswordRepeat.value = null;
};

const onSubmit = () => {
  userRef.value['password'] = password.value || undefined;
  userRef.value['privilegePassword'] = privilegePassword.value || undefined;

  clearPasswords();
  emit('submit', userRef.value);
};

const reset = () => {
  const {name, role, email} = toRaw(props.userInfo);
  userRef.value = {name, role, email};

  clearPasswords();

  canEditRole = (role === 'admin');
};

defineExpose({reset});

onMounted(() => {
  reset();
});

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
              :disabled="!canEditRole"
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
            Password:
          </td>
          <td>
            <input
              v-model="password"
              placeholder="****"
              type="password"
              class="text-input"
            >
          </td>
        </tr>
        <tr>
          <td />
          <td>
            <input
              v-model="passwordRepeat"
              placeholder="repeat"
              type="password"
              class="text-input"
            >
          </td>
        </tr>
        <tr>
          <td>
            Privilege Password:
          </td>
          <td>
            <input
              v-model="privilegePassword"
              placeholder="****"
              type="password"
              class="text-input"
            >
          </td>
        </tr>
        <tr>
          <td />
          <td>
            <input
              v-model="privilegePasswordRepeat"
              placeholder="repeat"
              type="password"
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
            <button
              type="submit"
              :disabled="!submittable"
            >
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
