const AppStates = {
    SIGNED_OUT: 0,
    SIGNING_IN: 1,
    WORLD_UNLOADED: 2,
    WORLD_LOADING: 3,
    WORLD_LOADED: 4
};

const noOp = () => {};

class AppState {
    constructor(hooks = {}) {
        this.state = AppStates.SIGNED_OUT;

        this.transitions = {signIn: [AppStates.SIGNED_OUT, AppStates.SIGNING_IN],
                            toWorldSelection: [AppStates.SIGNING_IN, AppStates.WORLD_UNLOADED],
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
        this.hooks[this.state][0]();

        for(const [name, [first, second]] of Object.entries(this.transitions)) {
            this[name] = () => {
                if (!this.transitions[name] === undefined) {
                    throw('Transition does not exist.');
                } else if (this.state !== this.transitions[name][0]) {
                    throw('Transition is not permitted given the current state.');
                }

                // Leaving current state, trigger its exit hook
                this.hooks[first][1]();

                this.state = this.transitions[name][1];

                // Entering next state, trigger its entrance hook
                this.hooks[second][0]();

                return this.state;
            };
        }
    }
}

export default AppState;
export {AppStates};
