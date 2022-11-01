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

        for(const name of UserInput) {
            // If nothing is defined for this command: make a dummy implementation on the spot
            if(!this[name]) this[name] = (delta) => {};
        }
    }
}

class UserInputListener {
    constructor(behaviorFactory = new SubjectBehaviorFactory()) {
        this.subjectBehaviorFactory = behaviorFactory;
        this.subjectBehavior = null;

        // Each input key will be set to null by default, a 'bind' and 'reset' method
        // will also ne ready of each one of them, eg: for 'forward' there will be
        // 'bindForward(input)' and 'clearForward()' methods available
        for(const name of UserInput) {
            const upperCased = name.charAt(0).toUpperCase() + name.slice(1);
            this[`${name}Key`] = null;
            this[`${name}Pressed`] = false;
            this[`bind${upperCased}Key`] = (input) => this.bindKey(name, input);
            this[`clear${upperCased}Key`] = () => this.clearKey(name);
            this[`get${upperCased}Key`] = () => this.getKey(name);
        }
    }

    bindKey(name, input) {
        this[`${name}Key`] = input;
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
        for(const name of UserInput) {
            if(this[`${name}Key`] === key) {
                this[`${name}Pressed`] = true;
                break;
            }
        }
    }

    releaseKey(key) {
        for(const name of UserInput) {
            if(this[`${name}Key`] === key) {
                this[`${name}Pressed`] = false;
                break;
            }
        }
    }

    step(delta) {
        for(const name of UserInput) {
            if(this[`${name}Pressed`]) {
                if(this.subjectBehavior) this.subjectBehavior[`${name}`](delta);
            }
        }
    }
}

export default UserInput;
export {SubjectBehavior, SubjectBehaviorFactory, UserInputListener};
