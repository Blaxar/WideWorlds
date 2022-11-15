<script setup>

const props = defineProps({
  prompt: {
    type: String,
    default: 'Log in'
  },
  usernamePlaceholder: {
    type: String,
    default: 'your username'
  },
  passwordPlaceholder: {
    type: String,
    default: 'your password'
  },
  buttonText: {
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
    <div class="login window prompt">
    <div class="title-bar"><div class="title-bar-text">{{ prompt }}</div></div>
    <form @submit.prevent="onSubmit">
    <table class="window-body">
    <tr><td><label> Username: </label></td>
    <td><input type="text" :placeholder="usernamePlaceholder" v-model="username" required /></td>
    </tr>
    <tr>
    <td><label> Password: </label></td>
    <td><input type="password" :placeholder="passwordPlaceholder" v-model="password" required /></td>
    </tr>
    <tr>
    <td colspan=2><button type="submit">{{buttonText}}</button></td>
    </tr>
    </table>
    </form>
  </div>
</template>

<style scoped>

</style>
