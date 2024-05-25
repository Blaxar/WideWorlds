<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

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
  },
});

const compassLength = 21;
const symbols = 'N|||||||E|||||||S|||||||W|||||||';


const atToText = (position) => {
  const {x, y, z} = position;
  const legacyCoordinates = props.userConfig.at('interface')
      .at('legacyCoordinates').value();

  const latitudeDir = z < 0 ? 'N' : 'S';
  const longitudeDir = x < 0 ? 'W' : 'E';
  const altitude = y.toFixed(1);

  const absX = Math.abs(x);
  const absZ = Math.abs(z);

  if (legacyCoordinates) {
    const latitudeVal = absZ < 5.0 ? 0 : Math.floor((absZ - 5.0) / 10.0) + 1;
    const longitudeVal = absX < 5.0 ? 0 : Math.floor((absX - 5.0) / 10.0) + 1;

    if (absX < 5.0 && absZ < 5.0) {
      return `<span class="compass-at-gz">Ground Zero</span> ` +
             `(<span class="compass-at-y">${altitude}m</span>)`;
    }
    return `<span class="compass-at-z">${latitudeVal}${latitudeDir}</span> ` +
           `<span class="compass-at-x">${longitudeVal}${longitudeDir}</span> ` +
           `(<span class="compass-at-y">${altitude}m</span>)`;
  }

  return `<span class="compass-at-x">${x.toFixed(0)}X</span> ` +
         `<span class="compass-at-z">${z.toFixed(0)}Z</span> ` +
         `<span class="compass-at-y">${y.toFixed(0)}Y</span>`;
};


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
<span v-html="atToText(props.at)"></span>
</div>
<div id="user-compass">
{{ facingToText(props.facing) }}
</div>
</template>

<style scoped>

</style>
