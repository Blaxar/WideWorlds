<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onMounted, ref} from 'vue';

/* eslint-disable no-unused-vars */
const props = defineProps({
  animations: {
    type: Array,
    default: () => [],
  },
});
/* eslint-enable no-unused-vars */

const emit = defineEmits(['animation']);

const animationName = ref(null);

const pickAnimation = () => {
  const name = animationName.value;
  if (name) {
    emit('animation', name);
    animationName.value = 0;
  }
};

onMounted(() => {
  animationName.value = null;
  pickAnimation();
});

</script>

<template>
<select v-model="animationName" @change="pickAnimation">
  <option v-for="name in animations" :key="name" :value="name">
    {{ name }}
  </option>
</select>
</template>
