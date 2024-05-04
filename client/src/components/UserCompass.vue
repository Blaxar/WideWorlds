<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const props = defineProps({
  facing: {
    type: Number,
    default: 0.0,
  },
});

const compassLength = 21;
const symbols = 'N|||||||E|||||||S|||||||W|||||||';

const facingToText = (angle) => {
  const slice = Math.PI * 2 / symbols.length;

  let a = (-angle) + (slice * 0.5);
  if (a < 0) a += Math.PI * 2;

  const offset = parseInt((a / slice)) % symbols.length;

  let str = '';

  for (let i = 0; i < symbols.length; i++) {
    str += symbols[(offset + i) % symbols.length];
  }

  const cut = (symbols.length - compassLength) / 2;
  const adjust = (symbols.length - compassLength) % 2;
  return str.slice(cut + adjust, -cut);
};

</script>

<template>
<div id="user-compass">
<span> {{ facingToText(props.facing) }} </span>
</div>

</template>

<style scoped>

</style>
