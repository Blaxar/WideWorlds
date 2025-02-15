<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {onBeforeMount} from 'vue';

const props = defineProps({
  facing: {
    type: Number,
    default: 0.0,
  },
  at: {
    type: Object,
    default: (() => ({x: 0, y: 0, z: 0})),
  },
  userConfig: {
    type: Object,
    default: null,
  },
});

const compassLength = 21;
const symbols = 'N|||||||E|||||||S|||||||W|||||||';

let legacyCoordinates = true;

let latitudeDir = 'N';
let longitudeDir = 'W';
let altitude = '0.0';

let absX = 0;
let absZ = 0;

let latitudeVal = 0;
let longitudeVal = 0;

let gz = false;

onBeforeMount(() => {
  legacyCoordinates =
    props.userConfig.at('interface').at('legacyCoordinates').value();

  latitudeDir = props.at.z < 0 ? 'N' : 'S';
  longitudeDir = props.at.x < 0 ? 'W' : 'E';
  altitude = props.at.y.toFixed(1);

  absX = Math.abs(props.at.x);
  absZ = Math.abs(props.at.z);

  latitudeVal = absZ < 5.0 ? 0 : Math.floor((absZ - 5.0) / 10.0) + 1;
  longitudeVal = absX < 5.0 ? 0 : Math.floor((absX - 5.0) / 10.0) + 1;

  gz = absX < 5.0 && absZ < 5.0;
});

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
  <div id="user-position">
    <span v-if="legacyCoordinates">
      <span
        v-if="gz"
        class="compass-at-gz"
      >Ground Zero</span>
      <span
        v-if="!gz"
        class="compass-at-z"
      >{{ latitudeVal }}{{ latitudeDir }}</span>&nbsp;
      <span
        v-if="!gz"
        class="compass-at-x"
      >{{ longitudeVal }}{{ longitudeDir }}</span>
      (<span class="compass-at-y">{{ altitude }}m</span>)
    </span>
    <span v-else>
      <span class="compass-at-x">{{ props.at.x.toFixed(0) }}X</span>&nbsp;
      <span class="compass-at-z">{{ props.at.z.toFixed(0) }}Z</span>&nbsp;
      <span class="compass-at-y">{{ props.at.y.toFixed(0) }}Y</span>
    </span>
  </div>
  <div id="user-compass">
    {{ facingToText(props.facing) }}
  </div>
</template>

<style scoped>

</style>
