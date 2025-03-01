<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */


const props = defineProps({ // eslint-disable-line no-unused-vars
  prompt: {
    type: String,
    default: 'Log in',
  },
  usernamePlaceholder: {
    type: String,
    default: 'your username',
  },
  passwordPlaceholder: {
    type: String,
    default: 'your password',
  },
  buttonText: {
    type: String,
    default: 'Login',
  },
});

/* eslint-disable prefer-const */
let username = null;
let password = null;
/* eslint-enable prefer-const */

const emit = defineEmits(['submit']);

const onSubmit = () => {
  emit('submit', {username, password});
};

</script>

<template>
  <div class="login window prompt">
    <div class="title-bar">
      <div class="title-bar-text">
        {{ prompt }}
      </div>
    </div>
    <form @submit.prevent="onSubmit">
      <table class="window-body">
        <tbody>
          <tr>
            <td><label> Username: </label></td>
            <td>
              <input
                v-model="username"
                type="text"
                :placeholder="usernamePlaceholder"
                required
              >
            </td>
          </tr>
          <tr>
            <td><label> Password: </label></td>
            <td>
              <input
                v-model="password"
                type="password"
                :placeholder="passwordPlaceholder"
                required
              >
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
  </div>
</template>

<style scoped>

</style>
