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
    default: null,
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
  <!-- eslint-disable max-len -->
  <div class="prop-settings surface">
    <table class="prop-container">
      <tbody>
        <tr class="button-bar">
          <td colspan="3">
            <button
              name="prop-undo"
              title="Undo"
              @click="onButtonClick"
            />
            <button
              name="prop-duplicate"
              title="Duplicate"
              @click="onButtonClick"
            />
            <button
              name="prop-delete"
              title="Delete"
              @click="onButtonClick"
            />
            <button
              name="prop-up"
              title="Move Up"
              @click="onButtonClick"
            />
            <button
              name="prop-down"
              title="Move Down"
              @click="onButtonClick"
            />
            <button
              name="prop-left"
              title="Move Left"
              @click="onButtonClick"
            />
            <button
              name="prop-right"
              title="Move Right"
              @click="onButtonClick"
            />
            <button
              name="prop-forward"
              title="Move Forward"
              @click="onButtonClick"
            />
            <button
              name="prop-backward"
              title="Move Backward"
              @click="onButtonClick"
            />
            <button
              name="prop-rot-x-ccw"
              title="Rotate X Counter-Clockwise"
              @click="onButtonClick"
            />
            <button
              name="prop-rot-x-cw"
              title="Rotate X Clockwise"
              @click="onButtonClick"
            />
            <button
              name="prop-rot-y-ccw"
              title="Rotate Y Clockwise"
              @click="onButtonClick"
            />
            <button
              name="prop-rot-y-cw"
              title="Rotate Y Clockwise"
              @click="onButtonClick"
            />
            <button
              name="prop-rot-z-ccw"
              title="Rotate Z Counter-Clockwise"
              @click="onButtonClick"
            />
            <button
              name="prop-rot-z-cw"
              title="Rotate Z Clockwise"
              @click="onButtonClick"
            />
            <button
              name="prop-reset"
              title="Reset rotation"
              @click="onButtonClick"
            />
            <button
              name="prop-snap"
              title="Snap to grid"
              @click="onButtonClick"
            />
          </td>
        </tr>
        <tr class="prop-name">
          <th scope="row">
            Name:
          </th>
          <td>
            <input
              type="text"
              :disabled="props.propsSelector.getSinglePropName() === null"
              :defaultValue="props.propsSelector.getSinglePropName()"
              name="name"
              class="text-input"
              @keyup="keyupCb"
              @change="changeCb"
              @textInput="changeCb"
              @input="changeCb"
            >
          </td>
          <td>
            <input
              id="absoluteMove"
              type="checkbox"
              :checked="props.propsSelector.usingWorldDirection()"
              @change="setAbsoluteMove"
            >
            <label for="absoluteMove">{{ absoluteMoveText }}</label>
          </td>
        </tr>
        <tr class="prop-description">
          <th scope="row">
            Description:
          </th>
          <td colspan="2">
            <textarea
              :disabled="props.propsSelector.getSinglePropDescription() === null"
              :defaultValue="props.propsSelector.getSinglePropDescription()"
              name="description"
              class="text-input"
              @keyup="keyupCb"
              @change="changeCb"
              @textInput="changeCb"
              @input="changeCb"
            />
          </td>
        </tr>
        <tr class="prop-action">
          <th scope="row">
            Action:
          </th>
          <td colspan="2">
            <textarea
              :disabled="props.propsSelector.getSinglePropAction() === null"
              :defaultValue="props.propsSelector.getSinglePropAction()"
              name="action"
              class="text-input"
              @keyup="keyupCb"
              @change="changeCb"
              @textInput="changeCb"
              @input="changeCb"
            />
          </td>
        </tr>
        <tr class="prop-owner-id">
          <th scope="row">
            Owner:
          </th>
          <td colspan="2">
            #{{ props.propsSelector.getSinglePropUserId() }}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <!-- eslint-enable max-len -->
</template>

<style scoped>

</style>
