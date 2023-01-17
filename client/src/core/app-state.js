/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const AppStates = {
  SIGNED_OUT: 'Signed Out',
  SIGNING_IN: 'Signing In',
  WORLD_UNLOADED: 'World Unloaded',
  WORLD_LOADING: 'World Loading',
  WORLD_LOADED: 'World Loaded',
};

const noOp = () => {};

/**
 * Main application state machine, used to codify how and when to
 * move to different state
 */
class AppState {
  /**
   * @constructor
   * @param {map} hooks - Hooks to bind to state transitions.
   * @param {enum} state - Initial state the machine will start with.
   */
  constructor(hooks = {}, state = AppStates.SIGNED_OUT) {
    this.state = state;

    this.transitions = {signIn: [AppStates.SIGNED_OUT, AppStates.SIGNING_IN],
      toWorldSelection: [AppStates.SIGNING_IN, AppStates.WORLD_UNLOADED],
      failedSigningIn: [AppStates.SIGNING_IN, AppStates.SIGNED_OUT],
      signOut: [AppStates.WORLD_UNLOADED, AppStates.SIGNED_OUT],
      loadWorld: [AppStates.WORLD_UNLOADED, AppStates.WORLD_LOADING],
      readyWorld: [AppStates.WORLD_LOADING, AppStates.WORLD_LOADED],
      unloadWorld: [AppStates.WORLD_LOADED, AppStates.WORLD_UNLOADED]};

    this.hooks = {[AppStates.SIGNED_OUT]: [noOp, noOp],
      [AppStates.SIGNING_IN]: [noOp, noOp],
      [AppStates.WORLD_UNLOADED]: [noOp, noOp],
      [AppStates.WORLD_LOADING]: [noOp, noOp],
      [AppStates.WORLD_LOADED]: [noOp, noOp]};

    Object.assign(this.hooks, hooks);

    // Calling the entrance hook of the initial state
    this.hooks[this.state][0](this.state);

    for (const [name, [first, second]] of Object.entries(this.transitions)) {
      this[name] = () => {
        if (!this.transitions[name] === undefined) {
          throw new Error('Transition does not exist.');
        } else if (this.state !== this.transitions[name][0]) {
          throw new Error('Transition is not permitted.');
        }

        // Leaving current state, trigger its exit hook
        this.hooks[first][1](first);

        this.state = this.transitions[name][1];

        // Entering next state, trigger its entrance hook
        this.hooks[second][0](second);

        return this.state;
      };
    }
  }
}

export default AppState;
export {AppStates};
