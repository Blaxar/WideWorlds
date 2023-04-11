/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

const UserInput = [
  'forward',
  'backward',
  'left',
  'right',
  'turnLeft',
  'turnRight',
  'moveUp',
  'moveDown',
  'lookUp',
  'lookDown',
  'jump',
  'strafe',
  'run',
  'crouch',
];


const qwertyBindings = {
  forward: 87, // W
  backward: 83, // S
  left: 65, // A
  right: 68, // D
  turnLeft: 81, // Q
  turnRight: 69, // E
  moveUp: 107, // Numpad +
  moveDown: 109, // Numpad -
  lookUp: 33, // Page Up
  lookDown: 34, // Page Down
  jump: 32, // Space
  strafe: 16, // Shift
  run: 17, // Ctrl
  crouch: 67, // C
};

/** Factory for subject behaviors on user input */
class SubjectBehaviorFactory {
  /** @constructor */
  constructor() {
    this.behaviorMap = new Map();
  }

  /**
   * Register a behavior class bound to a certain subject type
   * @param {string} subjectType - Type of subject.
   * @param {class} behaviorClass - Behavior class.
   */
  register(subjectType, behaviorClass) {
    this.behaviorMap.set(subjectType, behaviorClass);
  }

  /**
   * Spawn a new subject behavior wrapper around a subject
   * @param {string} subjectType - Type of the subject.
   * @param {object} subject - Subject to wrap.
   * @return {SubjectBehavior} Behavior object wrapping the subject.
   */
  make(subjectType, subject) {
    if (!this.behaviorMap.has(subjectType)) {
      throw new
      Error(`Missing behavior associated to '{subjectType}' subject type`);
    }

    return new(this.behaviorMap.get(subjectType))(subject);
  }

  /** Clear all registered behaviors */
  clear() {
    this.behaviorMap.clear();
  }

  /**
   * Get the current amount of behaviors
   * @return {integer} Number of registered behaviors.
   */
  size() {
    return this.behaviorMap.size;
  }
}

/** To be derived, used to describe how to react given certain user inputs */
class SubjectBehavior {
  /**
   * @constructor
   * @param {object} subject - Subject to update on user input.
   */
  constructor(subject) {
    this.subject = subject;

    for (const name of UserInput) {
      this[name] = () => this[`_${name}Pressed`];
      this[`_${name}Pressed`] = false;
    }
  }

  /**
   * To be overriden, update subject based input commands
   * @param {number} delta - Elapsed number of seconds since last call.
   */
  step(delta) {} // override this in a subclass
}

/**
 * Listener for user inputs, will update registered behaviors on
 * key press/release
 */
class UserInputListener {
  /**
   * @constructor
   * @param {BehaviorFactory} behaviorFactory - Behavior factory instance.
   * @param {map} keyBindings - Key bindings to init the listener with.
   */
  constructor(behaviorFactory = new SubjectBehaviorFactory(),
      keyBindings = {}) {
    this.subjectBehaviorFactory = behaviorFactory;
    this.subjectBehavior = null;
    this.bindingListeners = [];

    // Each input key will be set to null by default, 'bind', 'clear'
    // and 'get' methods will also be ready for each one of them,
    // eg: for 'forward' there will be 'bindForward(input)',
    // 'clearForward()' and 'getForward()' methods available
    for (const name of UserInput) {
      const upperCased = name.charAt(0).toUpperCase() + name.slice(1);
      this[`${name}Key`] = keyBindings[name] ? keyBindings[name] : null;
      this[`${name}Pressed`] = false;
      this[`bind${upperCased}Key`] = (input, uniqueOverride = false) => {
        this.bindKey(name, input, uniqueOverride);
      };
      this[`clear${upperCased}Key`] = () => this.clearKey(name);
      this[`get${upperCased}Key`] = () => this.getKey(name);
    }
  }

  /**
   * Register a listener, it will be called on key-binding update
   * @param {function} listener - Listener callback function.
   * @return {integer} ID associated to this new listener.
   */
  addBindingListener(listener) {
    const id = this.bindingListeners.length;

    this.bindingListeners.push(listener);

    return id;
  }

  /**
   * Unregister a key-binding update listener
   * @param {integer} id - ID of the listener.
   * @return {boolean} True if the listener was found, false otherwise.
   */
  removeBindingListener(id) {
    if (id >= this.bindingListeners.length) {
      return false;
    }

    this.bindingListeners[id] = null;
    return true;
  }

  /** Remove all key-binding update listeners */
  clearBindingListeners() {
    this.bindingListeners.length = 0;
  }

  /**
   * Call all registered binding listeners to notify them of
   * a binding configuration update
   * @param {string} name - Name of the command.
   * @param {any} input - New input key value associated to the command.
   */
  callBindingListeners(name, input) {
    for (const listener of this.bindingListeners) {
      if (listener) listener(name, input);
    }
  }

  /**
   * Get all the commands bound to a specific key
   * @param {any} input - Input key value.
   * @return {array} Array storing the command names bound to the key.
   */
  getBindingsFromKey(input) {
    const bindings = [];

    for (const name of UserInput) {
      if (this[`${name}Key`] === input) {
        bindings.push(name);
      }
    }

    return bindings;
  }

  /**
   * Bind a key to a specific command
   * @param {string} name - Name of the command.
   * @param {any} input - Input key value associated to the command.
   * @param {boolean} unique - If true: unbind other commands using this key.
   */
  bindKey(name, input, unique = false) {
    this[`${name}Key`] = input;
    this.callBindingListeners(name, input);

    if (unique) {
      for (const binding of this.getBindingsFromKey(input)) {
        if (binding !== name) this.bindKey(binding, null, false);
      }
    }
  }

  /**
   * Clear a specific command of any key binding
   * @param {string} name - Name of the command.
   */
  clearKey(name) {
    this[`${name}Key`] = null;
  }

  /**
   * Get the key associated to a specific command
   * @param {string} name - Name of the command.
   * @return {any} Key value associated to this command (null if none).
   */
  getKey(name) {
    return this[`${name}Key`];
  }

  /**
   * Set a subject to be focused on by the input listener, it will be
   * wrapped in an approrioate SubjectBehavior-subclass (if any
   * was registered for this type) and this wrapper will be notified
   * of each key events (press/release) that the listener is aware of
   * @param {string} subjectType - Type of the subject.
   * @param {object} subject - Subject for the listener to focus on.
   */
  setSubject(subjectType, subject) {
    this.subjectBehavior =
      this.subjectBehaviorFactory.make(subjectType, subject);
  }

  /**
   * Fire a key-press event
   * @param {any} key - Input key value.
   */
  pressKey(key) {
    for (const name of UserInput) {
      if ( this[`${name}Key`] === key) {
        this[`${name}Pressed`] = true;
        break;
      }
    }
  }

  /**
   * Fire a key-release event
   * @param {any} key - Input key value.
   */
  releaseKey(key) {
    for (const name of UserInput) {
      if (this[`${name}Key`] === key) {
        this[`${name}Pressed`] = false;
        break;
      }
    }
  }

  /**
   * Update subject based on the current key states
   * @param {number} delta - Amount of seconds elapsed since last update.
   */
  step(delta) {
    if (this.subjectBehavior) {
      for (const name of UserInput) {
        if (this[`${name}Pressed`]) {
          this.subjectBehavior[`_${name}Pressed`] = true;
        } else {
          this.subjectBehavior[`_${name}Pressed`] = false;
        }
      }

      this.subjectBehavior.step(delta);
    }
  }
}

export default UserInput;
export {SubjectBehavior, SubjectBehaviorFactory, UserInputListener,
  qwertyBindings};
