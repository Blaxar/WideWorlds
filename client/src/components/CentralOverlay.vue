<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

</script>

<template>
<div class="central-overlay">
  <div class="left-surface"><slot name="left" /></div>
  <div class="central-surface"><slot name="center" /></div>
  <div class="right-surface"><slot name="right" /></div>
</div>
</template>

<style scoped>

</style>
