/**
 * @author Julien 'Blaxar' Bardagi <blaxar.waldarax@gmail.com>
 */

import UserInput, {SubjectBehavior, SubjectBehaviorFactory, UserInputListener} from '../../client/src/core/user-input.js';
import {sleep} from '../utils.js';
import * as assert from 'assert';

class DummySubject {
  constructor() {
    this.x = 0.0;
    this.y = 0.0;
    this.z = 0.0;

    this.buffer = [];
    this.mouseMove = {x: 0, y: 0};
  }
}

class DummyBehavior extends SubjectBehavior {
  constructor(subject) {
    super(subject);
  }

  step(delta, mouseMove, buffer) {
    if (this.forward()) {
      this.subject.z += 20.0 * delta;
    }

    if (this.backward()) {
      this.subject.z -= 20.0 * delta;
    }

    if (this.left()) {
      this.subject.x += 20.0 * delta;
    }

    if (this.right()) {
      this.subject.x -= 20.0 * delta;
    }

    if (this.moveUp()) {
      this.subject.y += 20.0 * delta;
    }

    if (this.moveDown()) {
      this.subject.y -= 20.0 * delta;
    }

    this.subject.buffer = buffer;
    this.subject.mouseMove = mouseMove;
  }
}

// Testing Core application state machine
describe('UserInput', () => {
  it('SubjectBehavior constructor', () => {
    const subject = new DummySubject();
    const behavior = new SubjectBehavior(subject);
    const someDelta = 0.1;

    assert.strictEqual(behavior.subject, subject);

    for (const name of UserInput) {
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
    behavior.step(0.4); // Moves forward
    behavior._forwardPressed = false;
    behavior.step(0.2); // Does nothing

    assert.equal(subject.z, 8.0);

    behavior._rightPressed = true;
    behavior._moveUpPressed = true;
    behavior.step(0.3); // Moves up to the right
    behavior._rightPressed = false;
    behavior.step(0.1); // Only moves up

    assert.equal(subject.x, -6.0);
    assert.equal(subject.y, 8.0);
  });

  it('UserInputListener', async () => {
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

    // Stateful members must still be set to their default state
    assert.equal(inputListener.buffer.length, 0);
    assert.equal(inputListener.mouseMove.x, 0);
    assert.equal(inputListener.mouseMove.y, 0);

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

    inputListener.registerMouseMove(10, -10);
    inputListener.registerMouseMove(-5, 2); // At this point: {5, -8} should be stored

    // Validate listener stateful members
    assert.equal(inputListener.buffer.length, 2);
    assert.equal(inputListener.buffer[0].name, 'forward');
    assert.ok(inputListener.buffer[0].pressed);
    assert.ok(inputListener.buffer[0].delta >= 0);
    assert.equal(inputListener.buffer[1].name, 'left');
    assert.ok(inputListener.buffer[1].pressed);
    assert.ok(inputListener.buffer[1].delta >= 0);
    assert.equal(inputListener.mouseMove.x, 5);
    assert.equal(inputListener.mouseMove.y, -8);

    inputListener.step(0.2);

    // Listener stateful members must have been cleared
    assert.equal(inputListener.buffer.length, 0);
    assert.equal(inputListener.mouseMove.x, 0);
    assert.equal(inputListener.mouseMove.y, 0);

    // Validate subject stateful members, coming from
    // the listener
    assert.equal(subject.buffer.length, 2);
    assert.equal(subject.buffer[0].name, 'forward');
    assert.ok(subject.buffer[0].pressed);
    assert.ok(subject.buffer[0].delta >= 0);
    assert.equal(subject.buffer[1].name, 'left');
    assert.ok(subject.buffer[1].pressed);
    assert.ok(subject.buffer[1].delta >= 0);
    assert.equal(subject.mouseMove.x, 5);
    assert.equal(subject.mouseMove.y, -8);

    await sleep(220);

    inputListener.releaseKey('z');
    inputListener.releaseKey('q');

    assert.equal(subject.x, 4.0);
    assert.equal(subject.y, 0.0);
    assert.equal(subject.z, 4.0);

    inputListener.pressKey('s');
    inputListener.pressKey('-');

    inputListener.registerMouseMove(-4, 100);
    inputListener.registerMouseMove(0, 0);
    inputListener.registerMouseMove(1, -1); // At this point: {-3, 99} should be stored

    // Validate listener stateful members again
    assert.equal(inputListener.buffer.length, 4);
    assert.equal(inputListener.buffer[0].name, 'forward');
    assert.ok(!inputListener.buffer[0].pressed);
    assert.ok(inputListener.buffer[0].delta >= 0.2);
    assert.equal(inputListener.buffer[1].name, 'left');
    assert.ok(!inputListener.buffer[1].pressed);
    assert.ok(inputListener.buffer[1].delta >= 0.2);
    assert.equal(inputListener.buffer[2].name, 'backward');
    assert.ok(inputListener.buffer[2].pressed);
    assert.ok(inputListener.buffer[2].delta >= 0.2);
    assert.equal(inputListener.buffer[3].name, 'moveDown');
    assert.ok(inputListener.buffer[3].pressed);
    assert.ok(inputListener.buffer[3].delta >= 0.2);
    assert.equal(inputListener.mouseMove.x, -3);
    assert.equal(inputListener.mouseMove.y, 99);

    // Clock 0.3 seconds forward, commiting buffer and mouse move registers
    // to the subject and clearing them on the listener itself
    inputListener.step(0.3);

    // Listener stateful members must have been cleared again
    assert.equal(inputListener.buffer.length, 0);
    assert.equal(inputListener.mouseMove.x, 0);
    assert.equal(inputListener.mouseMove.y, 0);

    // Validate subject stateful members coming from
    // the listener again
    assert.equal(subject.buffer.length, 4);
    assert.equal(subject.buffer[0].name, 'forward');
    assert.ok(!subject.buffer[0].pressed);
    assert.ok(subject.buffer[0].delta >= 0.2);
    assert.equal(subject.buffer[1].name, 'left');
    assert.ok(!subject.buffer[1].pressed);
    assert.ok(subject.buffer[1].delta >= 0.2);
    assert.equal(subject.buffer[2].name, 'backward');
    assert.ok(subject.buffer[2].pressed);
    assert.ok(subject.buffer[2].delta >= 0.2);
    assert.equal(subject.buffer[3].name, 'moveDown');
    assert.ok(subject.buffer[3].pressed);
    assert.ok(subject.buffer[3].delta >= 0.2);
    assert.equal(subject.mouseMove.x, -3);
    assert.equal(subject.mouseMove.y, 99);

    await sleep(320);

    inputListener.releaseKey('s');
    inputListener.releaseKey('-');

    assert.equal(subject.x, 4.0);
    assert.equal(subject.y, -6.0);
    assert.equal(subject.z, -2.0);

    inputListener.registerMouseMove(0, 0); // {0, 0} should be stored (changing nothing)

    // Validate listener stateful members one last time
    assert.equal(inputListener.buffer.length, 2);
    assert.equal(inputListener.buffer[0].name, 'backward');
    assert.ok(!inputListener.buffer[0].pressed);
    assert.ok(inputListener.buffer[0].delta >= 0.3);
    assert.equal(inputListener.buffer[1].name, 'moveDown');
    assert.ok(!inputListener.buffer[1].pressed);
    assert.ok(inputListener.buffer[1].delta >= 0.3);
    assert.equal(inputListener.mouseMove.x, 0);
    assert.equal(inputListener.mouseMove.y, 0);

    inputListener.step(0.1);

    // Listener stateful members must have been cleared one last time
    assert.equal(inputListener.buffer.length, 0);
    assert.equal(inputListener.mouseMove.x, 0);
    assert.equal(inputListener.mouseMove.y, 0);

    // Validate subject stateful members coming from
    // the listener one last time
    assert.equal(subject.buffer.length, 2);
    assert.equal(subject.buffer[0].name, 'backward');
    assert.ok(!subject.buffer[0].pressed);
    assert.ok(subject.buffer[0].delta >= 0.3);
    assert.equal(subject.buffer[1].name, 'moveDown');
    assert.ok(!subject.buffer[1].pressed);
    assert.ok(subject.buffer[1].delta >= 0.3);
    assert.equal(subject.mouseMove.x, 0);
    assert.equal(subject.mouseMove.y, 0);

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
