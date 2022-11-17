<script setup>

import {onMounted, onUnmounted, ref} from "vue";

const props = defineProps({
    promptPlaceholder: {
        type: String,
        default: 'Type here to chat'
    }
});

onMounted(() => {
    // TODO
});

onUnmounted(() => {
    // TODO
});

</script>

<template>

<div class="bottom-bar window">
<div class="window-body">
    <pre>This is where chat content will be displayed,<br/>eventually...
</pre>
</div>
<input type="text" :placeholder="promptPlaceholder" id="chat-prompt">
</div>

</template>

<style scoped>

</style>
