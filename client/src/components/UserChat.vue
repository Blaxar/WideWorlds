<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, onUnmounted, reactive} from 'vue';

const props = defineProps({
  promptPlaceholder: {
    type: String,
    default: 'Type here to chat',
  },
  maxMessageAmount: {
    type: Number,
    default: 6,
  },
  worldChat: {
    type: Promise,
    required: true,
  },
});

const messages = reactive([]);

onMounted(() => {
  props.worldChat.then((chat) => {
    chat.onMessage((data) => {
      messages.push(JSON.parse(data));
    });
  });
});

onUnmounted(() => {
  props.worldChat.then((chat) => {
    chat.close();
  });
});

const onSubmit = (event) => {
  const inputField = event.target.getElementsByTagName('input')[0];
  const value = inputField.value;
  props.worldChat.then((chat) => {
    if (value) chat.send(value);
  });
  inputField.value = null;
};

</script>

<template>

<div class="bottom-bar window">
<div class="window-body">
<pre id="chat-box">
<span v-for="(entry, id) in messages.slice(-props.maxMessageAmount)"
:key="id">{{entry.name}}: {{entry.msg}}</span>
</pre>
</div>
<form @submit.prevent="onSubmit">
<input type="text" :placeholder="promptPlaceholder" id="chat-prompt" />
</form>
</div>

</template>

<style scoped>

</style>
