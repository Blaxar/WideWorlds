<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const props = defineProps({
  propsSelector: {
    type: Object,
  },
  exitKey: {
    type: Number,
    default: 27,
  },
  duplicateKey: {
    type: Number,
    default: 45,
  },
});

const emit = defineEmits(['defocus']);

const keyupCb = (event) => {
  if (event.keyCode === props.exitKey) {
    props.propsSelector.commitAndClear();
  } else if (event.keyCode === props.duplicateKey) {
    props.propsSelector.commitAndCopy();
    emit('defocus');
  } else if (event.target.name == 'name') {
    props.propsSelector.setSinglePropName(event.target.value);
  } else if (event.target.name == 'description') {
    props.propsSelector.setSinglePropDescription(event.target.value);
  } else if (event.target.name == 'action') {
    props.propsSelector.setSinglePropAction(event.target.value);
  }
};

</script>

<template>
<div class="prop-settings surface">
<table class="prop-container">
  <tr class="prop-name"><th scope="row">Name:</th>
  <td><input type="text" :defaultValue="props.propsSelector.getSinglePropName()"
  name="name" @keyup="keyupCb" /></td></tr>
  <tr class="prop-description"><th scope="row">Description:</th>
  <td><textarea :defaultValue="props.propsSelector.getSinglePropDescription()"
  name="description" @keyup="keyupCb" /></td></tr>
  <tr class="prop-action"><th scope="row">Action:</th>
  <td><textarea :defaultValue="props.propsSelector.getSinglePropAction()"
  name="action" @keyup="keyupCb" /></td></tr>
</table>
</div>
</template>

<style scoped>

</style>
