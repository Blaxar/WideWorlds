<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import UserFeed, {userFeedPriority} from '../core/user-feed.js';
import {onMounted, onUnmounted, reactive} from 'vue';

const props = defineProps({
  promptPlaceholder: {
    type: String,
    default: 'Type here to chat',
  },
  maxMessageAmount: {
    type: Number,
    default: 128,
  },
  feed: {
    type: UserFeed,
    required: true,
  },
  enablePrompt: {
    type: Boolean,
    required: true,
  },
});

const messages = reactive([]);
let feedListenerId = -1;

const emit = defineEmits(['send']);

onMounted(() => {
  feedListenerId = props.feed.addListener((entry, emitter, priority) => {
    messages.push({entry, emitter, priority});
  });
});

onUnmounted(() => {
  props.feed.addListener(feedListenerId);
  feedListenerId = -1;
});

const onSubmit = (event) => {
  const inputField = event.target.getElementsByTagName('input')[0];
  const value = inputField.value;
  inputField.value = null;

  // Do not send an empty string on the chat
  if (!value.length) return;

  emit('send', value);
};


</script>

<template>

<div class="bottom-bar">
<pre id="chat-box">
<!-- eslint-disable no-tabs -->
<span class="chat-entry" :key="id"
  :class="{info: entry.priority == userFeedPriority.info,
	warning: entry.priority == userFeedPriority.warning,
	error: entry.priority == userFeedPriority.error}"
v-for="(entry, id) in messages.slice(-props.maxMessageAmount).reverse()"
><strong v-if="entry.emitter">{{entry.emitter}}: </strong>{{entry.entry}}</span>
<!-- eslint-enable no-tabs -->
</pre>
<form @submit.prevent="onSubmit" v-if="props.enablePrompt">
<input type="text" :placeholder="promptPlaceholder" id="chat-prompt"
class="text-input" />
</form>
</div>

</template>

<style scoped>

</style>
