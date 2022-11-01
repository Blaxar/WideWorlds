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

    forward(delta) {
        this.subject.z += 2.0 * delta;
    }

    backward(delta) {
        this.subject.z -= 2.0 * delta;
    }

    left(delta) {
        this.subject.x += 2.0 * delta;
    }

    right(delta) {
        this.subject.x -= 2.0 * delta;
    }

    moveUp(delta) {
        this.subject.y += 2.0 * delta;
    }

    moveDown(delta) {
        this.subject.y -= 2.0 * delta;
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

        behavior.forward(2.0);
        behavior.left(3.0);
        behavior.moveUp(4.0);

        assert.equal(subject.z, 4.0);
        assert.equal(subject.x, 6.0);
        assert.equal(subject.y, 8.0);

        behavior.backward(3.0);
        behavior.right(1.0);
        behavior.moveDown(2.0);

        assert.equal(subject.z, -2.0);
        assert.equal(subject.x, 4.0);
        assert.equal(subject.y, 4.0);
    });

    it('UserInputListener', () => {
        const subject = new DummySubject();
        const behaviorFactory = new SubjectBehaviorFactory();
        const inputListener = new UserInputListener(behaviorFactory);

        behaviorFactory.register('dummy', DummyBehavior);

        inputListener.bindForwardKey('z');
        inputListener.bindBackwardKey('s');
        inputListener.bindLeftKey('q');
        inputListener.bindRightKey('d');
        inputListener.bindMoveUpKey('+');
        inputListener.bindMoveDownKey('-');

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
    });
});
