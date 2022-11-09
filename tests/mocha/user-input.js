import UserInput, {SubjectBehavior, SubjectBehaviorFactory, UserInputListener} from '../../client/src/core/user-input.js';
import * as assert from 'assert';

class DummySubject {
    constructor() {
        this.x = 0.0;
        this.y = 0.0;
        this.z = 0.0;
    }
}

class DummyBehavior extends SubjectBehavior {
    constructor(subject) {
        super(subject);
    }

    step(delta) {
        if (this.forward()) {
            this.subject.z += 2.0 * delta;
        }

        if (this.backward()) {
            this.subject.z -= 2.0 * delta;
        }

        if (this.left()) {
            this.subject.x += 2.0 * delta;
        }

        if (this.right()) {
            this.subject.x -= 2.0 * delta;
        }

        if (this.moveUp()) {
            this.subject.y += 2.0 * delta;
        }

        if (this.moveDown()) {
            this.subject.y -= 2.0 * delta;
        }
    }
}

// Testing Core application state machine
describe('UserInput', () => {
    it('SubjectBehavior constructor', () => {
        const subject = new DummySubject();
        const behavior = new SubjectBehavior(subject);
        const someDelta = 0.1;

        assert.strictEqual(behavior.subject, subject);

        for(const name of UserInput) {
            assert.equal(typeof behavior[name], 'function');
            // Should not throw
            behavior[name](someDelta);
        }
    });

    it('SubjectBehaviorFactory', () => {
        const subject = new DummySubject();
        const behaviorFactory = new SubjectBehaviorFactory();
        assert.equal(behaviorFactory.size(), 0);

        behaviorFactory.register('dummy', DummyBehavior);
        assert.equal(behaviorFactory.size(), 1);

        const behavior = behaviorFactory.make('dummy', subject);
        assert.ok(behavior instanceof DummyBehavior);
        assert.strictEqual(subject, behavior.subject);

        behaviorFactory.clear();
        assert.equal(behaviorFactory.size(), 0);
    });

    it('SubjectBehavior usage', () => {
        const subject = new DummySubject();
        const behavior = new DummyBehavior(subject);

        assert.equal(subject.x, 0.0);
        assert.equal(subject.y, 0.0);
        assert.equal(subject.z, 0.0);

        behavior._forwardPressed = true;
        behavior.step(4.0); // Moves forward
        behavior._forwardPressed = false;
        behavior.step(2.0); // Does nothing

        assert.equal(subject.z, 8.0);

        behavior._rightPressed = true;
        behavior._moveUpPressed = true;
        behavior.step(3.0); // Moves up to the right
        behavior._rightPressed = false;
        behavior.step(1.0); // Only moves up

        assert.equal(subject.x, -6.0);
        assert.equal(subject.y, 8.0);
    });

    it('UserInputListener', () => {
        const subject = new DummySubject();
        const behaviorFactory = new SubjectBehaviorFactory();
        const inputListener = new UserInputListener(behaviorFactory);

        // Keep track of binding changes caught by the listener
        const names = [];
        const inputs = [];

        behaviorFactory.register('dummy', DummyBehavior);

        assert.equal(inputListener.bindingListeners.length, 0);
        const handler = inputListener.addBindingListener((name, input) => {
            names.push(name);
            inputs.push(input);
        });
        assert.equal(inputListener.bindingListeners.length, 1);

        inputListener.bindLookUpKey('z');
        assert.equal(names.length, 1);
        assert.equal(names[0], 'lookUp');
        assert.equal(inputs.length, 1);
        assert.equal(inputs[0], 'z');
        inputListener.bindForwardKey('z', true); // This should unset the 'lookUp' key
        assert.equal(names.length, 3);
        assert.equal(names[1], 'forward');
        assert.equal(names[2], 'lookUp');
        assert.equal(inputs.length, 3);
        assert.equal(inputs[1], 'z');
        assert.strictEqual(inputs[2], null); // 'lookUp' key unset, caught by the binding listener
        inputListener.removeBindingListener(handler);
        assert.equal(inputListener.bindingListeners.length, 1);
        assert.strictEqual(inputListener.bindingListeners[0], null);
        inputListener.bindBackwardKey('s');
        inputListener.bindLeftKey('q');
        inputListener.bindRightKey('d');
        inputListener.bindMoveUpKey('+');
        inputListener.bindMoveDownKey('-');

        assert.strictEqual(inputListener.getLookUpKey(), null); // 'lookUp' key unset
        assert.equal(inputListener.getForwardKey(), 'z');
        assert.equal(inputListener.getBackwardKey(), 's');
        assert.equal(inputListener.getLeftKey(), 'q');
        assert.equal(inputListener.getRightKey(), 'd');
        assert.equal(inputListener.getMoveUpKey(), '+');
        assert.equal(inputListener.getMoveDownKey(), '-');

        inputListener.setSubject('dummy', subject);

        inputListener.pressKey('z');
        inputListener.pressKey('q');
        inputListener.step(2.0);
        inputListener.releaseKey('z');
        inputListener.releaseKey('q');

        assert.equal(subject.x, 4.0);
        assert.equal(subject.y, 0.0);
        assert.equal(subject.z, 4.0);

        inputListener.pressKey('s');
        inputListener.pressKey('-');
        inputListener.step(3.0);
        inputListener.releaseKey('s');
        inputListener.releaseKey('-');

        assert.equal(subject.x, 4.0);
        assert.equal(subject.y, -6.0);
        assert.equal(subject.z, -2.0);

        inputListener.clearForwardKey();
        inputListener.clearBackwardKey();
        inputListener.clearLeftKey();
        inputListener.clearRightKey();
        inputListener.clearMoveUpKey();
        inputListener.clearMoveDownKey();

        assert.strictEqual(inputListener.getForwardKey(), null);
        assert.strictEqual(inputListener.getBackwardKey(), null);
        assert.strictEqual(inputListener.getLeftKey(), null);
        assert.strictEqual(inputListener.getRightKey(), null);
        assert.strictEqual(inputListener.getMoveUpKey(), null);
        assert.strictEqual(inputListener.getMoveDownKey(), null);

        inputListener.clearBindingListeners();
        assert.equal(inputListener.bindingListeners.length, 0);
    });
});
