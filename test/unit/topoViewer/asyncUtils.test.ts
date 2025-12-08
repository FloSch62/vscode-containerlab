/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach */

import { expect } from 'chai';
import sinon from 'sinon';

// Import module under test directly (pure functions, no vscode dependency)
import { sleep, debounce } from '../../../src/topoViewer/shared/utilities/AsyncUtils';

describe('AsyncUtils - sleep basic behavior', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('resolves after specified milliseconds', async () => {
    let resolved = false;
    const sleepPromise = sleep(1000).then(() => {
      resolved = true;
    });

    expect(resolved).to.be.false;

    clock.tick(999);
    await Promise.resolve();
    expect(resolved).to.be.false;

    clock.tick(1);
    await sleepPromise;
    expect(resolved).to.be.true;
  });

  it('resolves immediately for 0ms', async () => {
    let resolved = false;
    const sleepPromise = sleep(0).then(() => {
      resolved = true;
    });

    expect(resolved).to.be.false;
    clock.tick(0);
    await sleepPromise;
    expect(resolved).to.be.true;
  });

  it('returns a Promise that resolves to void', async () => {
    const result = sleep(0);
    expect(result).to.be.instanceOf(Promise);

    clock.tick(0);
    const resolved = await result;
    expect(resolved).to.be.undefined;
  });
});

describe('AsyncUtils - sleep edge cases', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('handles small delays', async () => {
    let resolved = false;
    const sleepPromise = sleep(10).then(() => {
      resolved = true;
    });

    clock.tick(9);
    await Promise.resolve();
    expect(resolved).to.be.false;

    clock.tick(1);
    await sleepPromise;
    expect(resolved).to.be.true;
  });

  it('handles large delays', async () => {
    let resolved = false;
    const sleepPromise = sleep(60000).then(() => {
      resolved = true;
    });

    clock.tick(59999);
    await Promise.resolve();
    expect(resolved).to.be.false;

    clock.tick(1);
    await sleepPromise;
    expect(resolved).to.be.true;
  });

  it('multiple sleeps resolve independently', async () => {
    let resolved1 = false;
    let resolved2 = false;

    const sleep1 = sleep(100).then(() => {
      resolved1 = true;
    });
    const sleep2 = sleep(200).then(() => {
      resolved2 = true;
    });

    clock.tick(100);
    await sleep1;
    expect(resolved1).to.be.true;
    expect(resolved2).to.be.false;

    clock.tick(100);
    await sleep2;
    expect(resolved2).to.be.true;
  });
});

describe('AsyncUtils - debounce basic behavior', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('calls function after wait time elapses', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced();
    expect(spy.called).to.be.false;

    clock.tick(99);
    expect(spy.called).to.be.false;

    clock.tick(1);
    expect(spy.calledOnce).to.be.true;
  });

  it('delays execution when called multiple times', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced();
    clock.tick(50);

    debounced();
    clock.tick(50);
    expect(spy.called).to.be.false;

    clock.tick(50);
    expect(spy.calledOnce).to.be.true;
  });

  it('only calls function once for rapid calls', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced();
    debounced();
    debounced();
    debounced();
    debounced();

    clock.tick(100);
    expect(spy.calledOnce).to.be.true;
  });
});

describe('AsyncUtils - debounce with arguments', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('passes arguments to debounced function', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced('arg1', 'arg2');
    clock.tick(100);

    expect(spy.calledOnce).to.be.true;
    expect(spy.firstCall.args).to.deep.equal(['arg1', 'arg2']);
  });

  it('uses last arguments when called multiple times', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced('first');
    clock.tick(50);
    debounced('second');
    clock.tick(50);
    debounced('third');
    clock.tick(100);

    expect(spy.calledOnce).to.be.true;
    expect(spy.firstCall.args).to.deep.equal(['third']);
  });

  it('handles multiple arguments of different types', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced('string', 123, { key: 'value' }, [1, 2, 3]);
    clock.tick(100);

    expect(spy.calledOnce).to.be.true;
    expect(spy.firstCall.args).to.deep.equal(['string', 123, { key: 'value' }, [1, 2, 3]]);
  });
});

describe('AsyncUtils - debounce edge cases', () => {
  let clock: sinon.SinonFakeTimers;

  beforeEach(() => {
    clock = sinon.useFakeTimers();
  });

  afterEach(() => {
    clock.restore();
  });

  it('handles 0ms wait time', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 0);

    debounced();
    expect(spy.called).to.be.false;

    clock.tick(0);
    expect(spy.calledOnce).to.be.true;
  });

  it('handles large wait time', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 60000);

    debounced();
    clock.tick(59999);
    expect(spy.called).to.be.false;

    clock.tick(1);
    expect(spy.calledOnce).to.be.true;
  });

  it('can be called again after initial execution', () => {
    const spy = sinon.spy();
    const debounced = debounce(spy, 100);

    debounced('first');
    clock.tick(100);
    expect(spy.calledOnce).to.be.true;
    expect(spy.firstCall.args).to.deep.equal(['first']);

    debounced('second');
    clock.tick(100);
    expect(spy.calledTwice).to.be.true;
    expect(spy.secondCall.args).to.deep.equal(['second']);
  });

  it('independent debounced functions do not interfere', () => {
    const spy1 = sinon.spy();
    const spy2 = sinon.spy();
    const debounced1 = debounce(spy1, 100);
    const debounced2 = debounce(spy2, 200);

    debounced1();
    debounced2();

    clock.tick(100);
    expect(spy1.calledOnce).to.be.true;
    expect(spy2.called).to.be.false;

    clock.tick(100);
    expect(spy2.calledOnce).to.be.true;
  });
});
