<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, computed, ref, toRaw, reactive} from 'vue';


const props = defineProps({
  userInfo: {
    type: Object,
    default: null,
  },
  submitText: {
    type: String,
    default: 'Update',
  },
  resetText: {
    type: String,
    default: 'Reset',
  },
});

const emit = defineEmits(['submit']);

const defaultErrorFeedback = {
  name: '',
  role: '',
  email: '',
  password: '',
  privilegePassword: '',
};

// Break reactivity with original object, use local version
const {name, role, email} = toRaw(props.userInfo);
let canEditRole = false;
const userRef = ref({name, role, email});
const errorFeedback = reactive({...defaultErrorFeedback});

// Handle passwords logic here, they are only included in
// the JSON payoad when their matching fields are filled
const password = ref(null);
const passwordRepeat = ref(null);
const privilegePassword = ref(null);
const privilegePasswordRepeat = ref(null);

// True when the form can be submitted (coherent field values)
const submittable = computed(() =>
  (password.value === passwordRepeat.value) &&
  (privilegePassword.value === privilegePasswordRepeat.value));

const clearForm = () => {
  password.value = null;
  passwordRepeat.value = null;

  privilegePassword.value = null;
  privilegePasswordRepeat.value = null;

  Object.assign(errorFeedback, defaultErrorFeedback);
};

const reset = (errors = null) => {
  const {name, role, email} = toRaw(props.userInfo);

  clearForm();

  if (errors && Array.isArray(errors)) {
    for (const error of errors) {
      errorFeedback[error.field] = error.desc;
    }
  } else {
    userRef.value = {name, role, email};
  }

  canEditRole = (role === 'admin');
};

const submit = () => {
  userRef.value['password'] = password.value || undefined;
  userRef.value['privilegePassword'] = privilegePassword.value || undefined;

  clearForm();
  emit('submit', userRef.value);
};

defineExpose({reset});

onMounted(() => {
  reset();
});

</script>

<template>
  <!-- eslint-disable max-len -->
  <form
    @submit.prevent="submit"
    @reset.prevent="reset"
  >
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
          <td class="field-error">
            {{ errorFeedback.name }}
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
          <td class="field-error">
            {{ errorFeedback.role }}
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
          <td class="field-error">
            {{ errorFeedback.email }}
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
          <td class="field-error">
            {{ errorFeedback.password }}
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
          <td />
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
          <td class="field-error">
            {{ errorFeedback.privilegePassword }}
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
          <td />
        </tr>
        <tr>
          <td>
            ID:
          </td>
          <td>
            {{ userInfo?.id }}
          </td>
          <td />
        </tr>
        <tr>
          <td>
            <button
              type="submit"
              :disabled="!submittable"
            >
              {{ submitText }}
            </button>
          </td>
          <td>
            <button
              type="reset"
            >
              {{ resetText }}
            </button>
          </td>
          <td />
        </tr>
      </tbody>
    </table>
  </form>
  <!-- eslint-enable max-len -->
</template>

<style scoped>

</style>
