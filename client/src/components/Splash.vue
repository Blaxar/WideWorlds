<script setup>
defineProps({
  msg: {
    type: String,
    required: true
  }
})
</script>

<template>
  <div class="splash">
    <h1>{{ msg }}</h1>
  </div>
</template>
