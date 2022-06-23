<script setup>

const props = defineProps({
  login_prompt: {
    type: String,
    default: 'Log in'
  },
  username_placeholder: {
    type: String,
    default: 'your username'
  },
  password_placeholder: {
    type: String,
    default: 'your password'
  },
  button_text: {
    type: String,
    default: 'Login'
  },
  username: {
    type: String,
  },
  password: {
    type: String,
  }
});

const emit = defineEmits(['submit']);

const onSubmit = () => { emit('submit', {username: props.username, password: props.password}); }

</script>

<template>
  <div class="login">
    <h2>{{ login_prompt }}</h2>
    <form @submit.prevent="onSubmit">
    <table>
    <tr><td><label> Username: </label></td>
    <td><input type="text" :placeholder="username_placeholder" v-model="username" required></td>
    </tr>
    <tr>
    <td><label> Password: </label></td>
    <td><input type="password" :placeholder="password_placeholder" v-model="password" required></td>
    </tr>
    <tr>
    <td colspan=2><button type="submit">{{button_text}}</button></td>
    </tr>
    </table>
    </form>
  </div>
</template>

<style scoped>

</style>
