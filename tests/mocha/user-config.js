/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {LocalStorage} from "node-localstorage";
import UserConfig, {defaultConfig} from '../../client/src/core/user-config.js';
import * as assert from 'assert';
import {mkdtemp} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';

// Testing Core application state machine
describe('UserConfig', () => {
  it('constructor', async () => {
    let startConfigStr = '';

    const onLoad = (config) => {
      startConfigStr = JSON.stringify(config);
    };

    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, onLoad, storage);

    assert.strictEqual(userConfig.storage, storage);
    assert.strictEqual(userConfig.configKey, configKey);
    assert.equal(JSON.stringify(userConfig.config), JSON.stringify(defaultConfig));
    assert.equal(startConfigStr, JSON.stringify(defaultConfig));
  });

  it('at', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, (config) => {}, storage);

    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('forward').value(),
        userConfig.config.controls.keyBindings.forward);
    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('forward').path(),
        '.controls.keyBindings.forward');
    assert.throws(() => userConfig.at('IdoNotExist'), Error);
    assert.throws(() => userConfig.at('controls').at('DontKnow'), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('DontKnow'), Error);
  });

  it('set', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, (config) => {}, storage);

    let firstValue = 0;
    let secondValue = 0;

    userConfig.at('controls').at('keyBindings').at('backward').onUpdate((v) => { firstValue = v; });
    userConfig.at('controls').at('keyBindings').at('backward').onUpdate((v) => { secondValue = v; });
    assert.strictEqual(firstValue, 0);
    assert.strictEqual(secondValue, 0);
    userConfig.at('controls').at('keyBindings').at('backward').set(200);
    assert.strictEqual(firstValue, 200);
    assert.strictEqual(secondValue, 200);

    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('backward').value(), 200);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('centerward').set(200), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('backward').at('noseward').set(200), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').set(200), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('footward').onUpdate(() => {}), Error);

    // Value should have been saved to storage
    let stored = JSON.parse(storage.getItem(configKey));
    assert.strictEqual(stored.controls.keyBindings.backward, 200);

    // Try again without saving to storage
    userConfig.at('controls').at('keyBindings').at('backward').set(202, false);
    assert.strictEqual(firstValue, 202);
    assert.strictEqual(secondValue, 202);

    // New value should not have been saved to storage
    stored = JSON.parse(storage.getItem(configKey));
    assert.strictEqual(stored.controls.keyBindings.backward, 200);

    // Clearing listeners: callback functions should no longer be called
    userConfig.at('controls').at('keyBindings').at('backward').clearListeners();
    userConfig.at('controls').at('keyBindings').at('backward').set(400);
    assert.strictEqual(firstValue, 202);
    assert.strictEqual(secondValue, 202);
  });

  it('getNodeFromPath', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, (config) => {}, storage);
    let firstValue = 0;
    let secondValue = 0;

    assert.strictEqual(userConfig.getNodeFromPath('.controls.keyBindings.backward').value(), userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(userConfig.getNodeFromPath('.controls.keyBindings.backward').path(), '.controls.keyBindings.backward');

    // Nodes must exist
    assert.throws(() => userConfig.getNodeFromPath('.nothing'), Error);
    assert.throws(() => userConfig.getNodeFromPath('.controls.nowhere'), Error);
    assert.throws(() => userConfig.getNodeFromPath('.controls.keyBindings.never'), Error);

    // Path must start with a dot
    assert.throws(() => userConfig.getNodeFromPath('controls.keyBindings.backward'), Error);
  });

  it('reset', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, (config) => {}, storage);

    let firstValue = 0;
    let secondValue = 0;
    let thirdValue = 0;

    userConfig.at('controls').at('keyBindings').at('backward').onUpdate((v) => { firstValue = v; });
    userConfig.at('controls').at('keyBindings').at('backward').onUpdate((v) => { secondValue = v; });
    userConfig.at('controls').at('keyBindings').at('forward').onUpdate((v) => { thirdValue = v; });

    assert.strictEqual(firstValue, 0);
    assert.strictEqual(secondValue, 0);
    assert.strictEqual(thirdValue, 0);

    // Perform leaf node reset
    userConfig.at('controls').at('keyBindings').at('backward').reset();

    assert.strictEqual(firstValue, userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(secondValue, userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(thirdValue, 0);
    firstValue = 0;
    secondValue = 0;

    // Perform branch node reset
    userConfig.at('controls').at('keyBindings').reset();

    assert.strictEqual(firstValue, userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(secondValue, userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(thirdValue, userConfig.config.controls.keyBindings.forward);
    firstValue = 0;
    secondValue = 0;
    thirdValue = 0;

    // Perform global reset
    userConfig.reset();

    assert.strictEqual(firstValue, userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(secondValue, userConfig.config.controls.keyBindings.backward);
    assert.strictEqual(thirdValue, userConfig.config.controls.keyBindings.forward);
  });

  it('defaultValue', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, (config) => {}, storage);

    // Validate default values
    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('backward').defaultValue(),
        defaultConfig.controls.keyBindings.backward);
    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('forward').defaultValue(),
        defaultConfig.controls.keyBindings.forward);

    // Current alues should be the default ones
    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('backward').value(),
        userConfig.at('controls').at('keyBindings').at('backward').defaultValue());
    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('forward').value(),
        userConfig.at('controls').at('keyBindings').at('forward').defaultValue());

    userConfig.at('controls').at('keyBindings').at('backward').set(200);
    userConfig.at('controls').at('keyBindings').at('forward').set(200);

    // Current values should now differ from the default ones
    assert.notEqual(userConfig.at('controls').at('keyBindings').at('backward').value(),
        userConfig.at('controls').at('keyBindings').at('backward').defaultValue());
    assert.notEqual(userConfig.at('controls').at('keyBindings').at('forward').value(),
        userConfig.at('controls').at('keyBindings').at('forward').defaultValue());

    // Can only get default value from a valid leaf node
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('centerward').defaultValue(), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('backward').at('noseward').defaultValue(), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').defaultValue(), Error);
  });
});
