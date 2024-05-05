<script setup>
/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {defaultMoveLength, defaultRotationAngle, smallMoveLength,
  verySmallMoveLength, smallRotationAngle, verySmallRotationAngle}
  from '../core/props-behavior.js';

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
    type: String,
    default: 'Escape',
  },
  duplicateKey: {
    type: String,
    default: 'Insert',
  },
  absoluteMoveText: {
    type: String,
    default: 'Move along absolute world axes',
  },
});

const emit = defineEmits(['defocus']);

const keyupCb = (event) => {
  if (event.code === props.exitKey) {
    props.propsSelector.commitAndClear();
  } else if (event.code === props.duplicateKey) {
    props.propsSelector.commitAndCopy();
    emit('defocus');
  }
};

const changeCb = (event) => {
  if (event.target.name == 'name') {
    props.propsSelector.setSinglePropName(event.target.value);
  } else if (event.target.name == 'description') {
    props.propsSelector.setSinglePropDescription(event.target.value);
  } else if (event.target.name == 'action') {
    props.propsSelector.setSinglePropAction(event.target.value);
  }
};

const onButtonClick = (event) => {
  const name = event.target.name;
  const moveLength = props.strafe ? props.run ? verySmallMoveLength :
    smallMoveLength : defaultMoveLength;
  const rotationAngle = props.strafe ? props.run ?
    verySmallRotationAngle : smallRotationAngle :
    defaultRotationAngle;

  if (name === 'prop-undo') {
    props.propsSelector.undo();
    emit('defocus');
  } else if (name === 'prop-delete') {
    props.propsSelector.removeAndClear();
  } else if (name === 'prop-duplicate') {
    props.propsSelector.duplicate(props.run);
    emit('defocus');
  } else if (name === 'prop-up') {
    props.propsSelector.moveUp(moveLength);
    emit('defocus');
  } else if (name === 'prop-down') {
    props.propsSelector.moveDown(moveLength);
    emit('defocus');
  } else if (name === 'prop-left') {
    props.propsSelector.moveLeft(moveLength);
    emit('defocus');
  } else if (name === 'prop-right') {
    props.propsSelector.moveRight(moveLength);
    emit('defocus');
  } else if (name === 'prop-forward') {
    props.propsSelector.moveForward(moveLength);
    emit('defocus');
  } else if (name === 'prop-backward') {
    props.propsSelector.moveBackward(moveLength);
    emit('defocus');
  } else if (name === 'prop-rot-x-ccw') {
    props.propsSelector.rotateXccw(rotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-x-cw') {
    props.propsSelector.rotateXcw(rotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-y-ccw') {
    props.propsSelector.rotateYccw(rotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-y-cw') {
    props.propsSelector.rotateYcw(rotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-z-ccw') {
    props.propsSelector.rotateZccw(rotationAngle);
    emit('defocus');
  } else if (name === 'prop-rot-z-cw') {
    props.propsSelector.rotateZcw(rotationAngle);
    emit('defocus');
  } else if (name === 'prop-reset') {
    props.propsSelector.resetRotation();
    emit('defocus');
  } else if (name === 'prop-snap') {
    props.propsSelector.snapToGrid();
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
  <button name="prop-undo" @click="onButtonClick" title="Undo" />
  <button name="prop-duplicate" @click="onButtonClick" title="Duplicate" />
  <button name="prop-delete" @click="onButtonClick" title="Delete" />
  <button name="prop-up" @click="onButtonClick" title="Move Up" />
  <button name="prop-down" @click="onButtonClick" title="Move Down" />
  <button name="prop-left" @click="onButtonClick" title="Move Left" />
  <button name="prop-right" @click="onButtonClick" title="Move Right" />
  <button name="prop-forward" @click="onButtonClick" title="Move Forward" />
  <button name="prop-backward" @click="onButtonClick" title="Move Backward" />
  <button name="prop-rot-x-ccw" @click="onButtonClick"
    title="Rotate X Counter-Clockwise" />
  <button name="prop-rot-x-cw" @click="onButtonClick"
    title="Rotate X Clockwise" />
  <button name="prop-rot-y-ccw" @click="onButtonClick"
    title="Rotate Y Clockwise" />
  <button name="prop-rot-y-cw" @click="onButtonClick"
    title="Rotate Y Clockwise" />
  <button name="prop-rot-z-ccw" @click="onButtonClick"
    title="Rotate Z Counter-Clockwise" />
  <button name="prop-rot-z-cw" @click="onButtonClick"
    title="Rotate Z Clockwise" />
  <button name="prop-reset" @click="onButtonClick" disabled="true"
    title="Reset rotation" />
  <button name="prop-snap" @click="onButtonClick" disabled="true"
    title="Snap to grid" />
  </td></tr>
  <tr class="prop-name"><th scope="row">Name:</th>
  <td><input type="text"
    :disabled="props.propsSelector.getSinglePropName() === null"
    :defaultValue="props.propsSelector.getSinglePropName()"
    name="name" @keyup="keyupCb"
    @change="changeCb" @textInput="changeCb" @input="changeCb"
    class="text-input" /></td>
  <td><input type="checkbox" id="absoluteMove"
    :checked="props.propsSelector.usingWorldDirection()"
    @change="setAbsoluteMove" />
  <label for="absoluteMove">{{absoluteMoveText}}</label>
  </td></tr>
  <tr class="prop-description"><th scope="row">Description:</th>
  <td colspan="2"><textarea
    :disabled="props.propsSelector.getSinglePropDescription() === null"
    :defaultValue="props.propsSelector.getSinglePropDescription()"
    name="description" @keyup="keyupCb"
    @change="changeCb" @textInput="changeCb" @input="changeCb"
    class="text-input" /></td></tr>
  <tr class="prop-action"><th scope="row">Action:</th>
  <td colspan="2"><textarea
    :disabled="props.propsSelector.getSinglePropAction() === null"
    :defaultValue="props.propsSelector.getSinglePropAction()"
    name="action" @keyup="keyupCb"
    @change="changeCb" @textInput="changeCb" @input="changeCb"
    class="text-input" /></td></tr>
  <tr class="prop-owner-id"><th scope="row">Owner:</th>
  <td colspan="2">#{{props.propsSelector.getSinglePropUserId()}}</td></tr>
</table>
</div>
</template>

<style scoped>

</style>
