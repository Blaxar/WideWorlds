/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import AppState, {AppStates} from '../../client/src/core/app-state.js';
import * as assert from 'assert';

// Testing Core application state machine
describe('AppState', () => {
  it('transitions', () => {
    let inSignedOut = 0;
    let inSigningIn = 0;
    let inWorldUnloaded = 0;
    let inWorldLoading = 0;
    let inWorldLoaded = 0;
    let outSignedOut = 0;
    let outSigningIn = 0;
    let outWorldUnloaded = 0;
    let outWorldLoading = 0;
    let outWorldLoaded = 0;

    const hooks = {[AppStates.SIGNED_OUT]: [() => inSignedOut++, () => outSignedOut++],
      [AppStates.SIGNING_IN]: [() => inSigningIn++, () => outSigningIn++],
      [AppStates.WORLD_UNLOADED]: [() => inWorldUnloaded++, () => outWorldUnloaded++],
      [AppStates.WORLD_LOADING]: [() => inWorldLoading++, () => outWorldLoading++],
      [AppStates.WORLD_LOADED]: [() => inWorldLoaded++, () => outWorldLoaded++]};

    const appState = new AppState(hooks);

    assert.equal(appState.state, AppStates.SIGNED_OUT);
    assert.equal(appState.signIn(), AppStates.SIGNING_IN);
    assert.equal(appState.failedSigningIn(), AppStates.SIGNED_OUT);
    assert.equal(appState.signIn(), AppStates.SIGNING_IN);
    assert.equal(appState.toWorldSelection(), AppStates.WORLD_UNLOADED);
    assert.equal(appState.loadWorld(), AppStates.WORLD_LOADING);
    assert.equal(appState.readyWorld(), AppStates.WORLD_LOADED);
    assert.equal(appState.unloadWorld(), AppStates.WORLD_UNLOADED);
    assert.equal(appState.signOut(), AppStates.SIGNED_OUT);

    assert.equal(inSignedOut, 3);
    assert.equal(inSigningIn, 2);
    assert.equal(inWorldUnloaded, 2);
    assert.equal(inWorldLoading, 1);
    assert.equal(inWorldLoaded, 1);
    assert.equal(outSignedOut, 2);
    assert.equal(outSigningIn, 2);
    assert.equal(outWorldUnloaded, 2);
    assert.equal(outWorldLoading, 1);
    assert.equal(outWorldLoaded, 1);
  });
});
