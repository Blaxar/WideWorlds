<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {defaultMoveLength, defaultRotationAngle, smallMoveLength,
  smallRotationAngle} from '../core/props-behavior.js';

const props = defineProps({
  propsSelector: {
    type: Object,
  },
  run: {
    type: Boolean,
    default: false,
  },
  strafe: {
    type: Boolean,
    default: false,
  },
  exitKey: {
    type: Number,
    default: 27,
  },
  duplicateKey: {
    type: Number,
    default: 45,
  },
  absoluteMoveText: {
    type: String,
    default: 'Move along absolute world axes',
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

const onButtonClick = (event) => {
  const name = event.target.name;

  if (name === 'prop-delete') {
    props.propsSelector.removeAndClear();
  } else if (name === 'prop-duplicate') {
    props.propsSelector.duplicate(props.run);
    emit('defocus');
  } else if (name === 'prop-up') {
    props.propsSelector
        .moveUp(props.strafe ? smallMoveLength :
        defaultMoveLength);
    emit('defocus');
  } else if (name === 'prop-down') {
    props.propsSelector
        .moveDown(props.strafe ? smallMoveLength :
        defaultMoveLength);
    emit('defocus');
  } else if (name === 'prop-left') {
    props.propsSelector
        .moveLeft(props.strafe ? smallMoveLength :
        defaultMoveLength);
    emit('defocus');
  } else if (name === 'prop-right') {
    props.propsSelector
        .moveRight(props.strafe ? smallMoveLength :
        defaultMoveLength);
    emit('defocus');
  } else if (name === 'prop-forward') {
    props.propsSelector
        .moveForward(props.strafe ? smallMoveLength :
        defaultMoveLength);
    emit('defocus');
  } else if (name === 'prop-backward') {
    props.propsSelector
        .moveBackward(props.strafe ? smallMoveLength :
        defaultMoveLength);
    emit('defocus');
  } else if (name === 'prop-rot-x-ccw') {
    props.propsSelector.rotateXccw(props.strafe ?
        smallRotationAngle : defaultRotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-x-cw') {
    props.propsSelector.rotateXcw(props.strafe ?
        smallRotationAngle : defaultRotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-y-ccw') {
    props.propsSelector.rotateYccw(props.strafe ?
        smallRotationAngle : defaultRotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-y-cw') {
    props.propsSelector.rotateYcw(props.strafe ?
        smallRotationAngle : defaultRotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-z-ccw') {
    props.propsSelector.rotateZccw(props.strafe ?
        smallRotationAngle : defaultRotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-z-cw') {
    props.propsSelector.rotateZcw(props.strafe ?
        smallRotationAngle : defaultRotationAngle);
    emit('defocus');
  }
};

const setAbsoluteMove = (event) => {
  props.propsSelector.setUseWorldDirection(event.target.checked);
};

</script>

<template>
<div class="prop-settings surface">
<table class="prop-container">
  <tr class="button-bar"><td colspan="3">
  <button name="prop-delete" @click="onButtonClick" />
  <button name="prop-duplicate" @click="onButtonClick" />
  <button name="prop-up" @click="onButtonClick" />
  <button name="prop-down" @click="onButtonClick" />
  <button name="prop-left" @click="onButtonClick" />
  <button name="prop-right" @click="onButtonClick" />
  <button name="prop-forward" @click="onButtonClick" />
  <button name="prop-backward" @click="onButtonClick" />
  <button name="prop-rot-x-ccw" @click="onButtonClick" />
  <button name="prop-rot-x-cw" @click="onButtonClick" />
  <button name="prop-rot-y-ccw" @click="onButtonClick" />
  <button name="prop-rot-y-cw" @click="onButtonClick" />
  <button name="prop-rot-z-ccw" @click="onButtonClick" />
  <button name="prop-rot-z-cw" @click="onButtonClick" />
  </td></tr>
  <tr class="prop-name"><th scope="row">Name:</th>
  <td><input type="text"
    :defaultValue="props.propsSelector.getSinglePropName()"
  name="name" @keyup="keyupCb" class="text-input" /></td>
  <td><input type="checkbox" id="absoluteMove"
    :checked="props.propsSelector.usingWorldDirection()"
    @change="setAbsoluteMove" />
  <label for="absoluteMove">{{absoluteMoveText}}</label>
  </td></tr>
  <tr class="prop-description"><th scope="row">Description:</th>
  <td colspan="2"><textarea
    :defaultValue="props.propsSelector.getSinglePropDescription()"
    name="description" @keyup="keyupCb" class="text-input" /></td></tr>
  <tr class="prop-action"><th scope="row">Action:</th>
  <td colspan="2"><textarea
    :defaultValue="props.propsSelector.getSinglePropAction()"
  name="action" @keyup="keyupCb" class="text-input" /></td></tr>
  <tr class="prop-owner-id"><th scope="row">Owner:</th>
  <td colspan="2">#{{props.propsSelector.getSinglePropUserId()}}</td></tr>
</table>
</div>
</template>

<style scoped>

</style>
