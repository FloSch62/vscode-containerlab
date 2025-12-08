/* eslint-env mocha */
/* global describe, it */
/**
 * Tests for the async utility module.
 */
import { expect } from 'chai';
import { delay } from '../../../src/utils/async';

describe('delay() - basic functionality', () => {
  it('returns a promise', () => {
    const result = delay(0);
    expect(result).to.be.instanceOf(Promise);
  });

  it('resolves to undefined', async () => {
    const result = await delay(0);
    expect(result).to.be.undefined;
  });

  it('resolves after approximately the specified time', async () => {
    const start = Date.now();
    await delay(50);
    const elapsed = Date.now() - start;
    // Allow some tolerance for timing
    expect(elapsed).to.be.at.least(40);
    expect(elapsed).to.be.lessThan(150);
  });
});

describe('delay() - zero and small values', () => {
  it('handles zero milliseconds', async () => {
    const start = Date.now();
    await delay(0);
    const elapsed = Date.now() - start;
    expect(elapsed).to.be.lessThan(50);
  });

  it('handles one millisecond', async () => {
    const result = await delay(1);
    expect(result).to.be.undefined;
  });

  it('handles small values', async () => {
    const start = Date.now();
    await delay(10);
    const elapsed = Date.now() - start;
    expect(elapsed).to.be.at.least(5);
  });
});

describe('delay() - concurrent calls', () => {
  it('can run multiple delays concurrently', async () => {
    const start = Date.now();
    await Promise.all([delay(20), delay(20), delay(20)]);
    const elapsed = Date.now() - start;
    // Should complete in roughly 20ms, not 60ms
    expect(elapsed).to.be.lessThan(100);
  });

  it('resolves in correct order when sequential', async () => {
    const results: number[] = [];
    await delay(10).then(() => results.push(1));
    await delay(10).then(() => results.push(2));
    expect(results).to.deep.equal([1, 2]);
  });
});
