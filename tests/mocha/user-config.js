/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import {LocalStorage} from "node-localstorage";
import UserConfig, {defaultConfig} from '../../client/src/core/user-config.js';
import * as assert from 'assert';
import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Testing Core application state machine
describe('UserConfig', () => {
  it('UserConfig constructor', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, storage);

    assert.strictEqual(userConfig.storage, storage);
    assert.strictEqual(userConfig.configKey, configKey);
    assert.equal(JSON.stringify(userConfig.config), JSON.stringify(defaultConfig));
  });

  it('UserConfig at', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, storage);

    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('forward').value(),
        userConfig.config.controls.keyBindings.forward);
    assert.throws(() => userConfig.at('IdoNotExist'), Error);
    assert.throws(() => userConfig.at('controls').at('DontKnow'), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('DontKnow'), Error);
  });

  it('UserConfig set', async () => {
    const tmpDir = await mkdtemp(join(tmpdir(), 'ww-test'));
    const storage = new LocalStorage(tmpDir);
    const configKey = `mochaTestConfig${Date.now()}`;
    const userConfig = new UserConfig(configKey, storage);

    userConfig.at('controls').at('keyBindings').set('backward', 200);
    assert.strictEqual(userConfig.at('controls').at('keyBindings').at('backward').value(), 200);
    assert.throws(() => userConfig.at('controls').at('keyBindings').set('centerward', 200), Error);
    assert.throws(() => userConfig.at('controls').at('keyBindings').at('backward').set('noseward', 200), Error);
    assert.throws(() => userConfig.at('controls').set('keyBindings', 200), Error);

    // Value should have been saved to storage
    const stored = JSON.parse(storage.getItem(configKey));
    assert.strictEqual(stored.controls.keyBindings.backward, 200);
  });
});
