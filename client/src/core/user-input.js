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
    'crouch'
];

class SubjectBehaviorFactory {
    constructor() {
        this.behaviorMap = new Map();
    }

    register(subjectType, subjectBehaviorClass) {
        this.behaviorMap.set(subjectType, subjectBehaviorClass);
    }

    make(subjectType, subject) {
        if (!this.behaviorMap.has(subjectType)) throw(`Missing behavior associated to '{subjectType}' subject type`);
        return new(this.behaviorMap.get(subjectType))(subject);
    }

    clear() {
        this.behaviorMap.clear();
    }

    size() {
        return this.behaviorMap.size;
    }
}

/* To be derived */
class SubjectBehavior {
    constructor(subject) {
        this.subject = subject;

        for (const name of UserInput) {
            this[name] = () => this[`_${name}Pressed`];
            this[`_${name}Pressed`] = false;
        }
    }

    step(delta) {} // derive this
}

class UserInputListener {
    constructor(behaviorFactory = new SubjectBehaviorFactory()) {
        this.subjectBehaviorFactory = behaviorFactory;
        this.subjectBehavior = null;
        this.bindingListeners = [];

        // Each input key will be set to null by default, a 'bind' and 'reset' method
        // will also ne ready of each one of them, eg: for 'forward' there will be
        // 'bindForward(input)' and 'clearForward()' methods available
        for (const name of UserInput) {
            const upperCased = name.charAt(0).toUpperCase() + name.slice(1);
            this[`${name}Key`] = null;
            this[`${name}Pressed`] = false;
            this[`bind${upperCased}Key`] = (input, uniqueOverride = false) => this.bindKey(name, input, uniqueOverride);
            this[`clear${upperCased}Key`] = () => this.clearKey(name);
            this[`get${upperCased}Key`] = () => this.getKey(name);
        }
    }

    addBindingListener(listener) {
        const id = this.bindingListeners.length;

        this.bindingListeners.push(listener);

        return id;
    }

    removeBindingListener(id) {
        if (id >= this.bindingListeners.length)
            return false;

        this.bindingListeners[id] = null;
        return true;
    }

    clearBindingListeners() {
        this.bindingListeners.length = 0;
    }

    callBindingListeners(name, input) {
        for (const listener of this.bindingListeners) {
            if (listener) listener(name, input);
        }
    }

    getBindingsFromKey(input) {
        const bindings = [];

        for(const name of UserInput) {
            if(this[`${name}Key`] === input) {
                bindings.push(name);
            }
        }

        return bindings;
    }

    bindKey(name, input, uniqueOverride = false) {
        this[`${name}Key`] = input;
        this.callBindingListeners(name, input);

        if (uniqueOverride) {
            for (const binding of this.getBindingsFromKey(input)) {
                if (binding !== name) this.bindKey(binding, null, false);
            }
        }
    }

    clearKey(name) {
        this[`${name}Key`] = null;
    }

    getKey(name) {
        return this[`${name}Key`];
    }

    setSubject(subjectType, subject) {
        this.subjectBehavior = this.subjectBehaviorFactory.make(subjectType, subject);
    }

    pressKey(key) {
        for (const name of UserInput) {
            if( this[`${name}Key`] === key) {
                this[`${name}Pressed`] = true;
                break;
            }
        }
    }

    releaseKey(key) {
        for (const name of UserInput) {
            if (this[`${name}Key`] === key) {
                this[`${name}Pressed`] = false;
                break;
            }
        }
    }

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
export {SubjectBehavior, SubjectBehaviorFactory, UserInputListener};
