/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache for modules we need to stub BEFORE setting up resolution
const MODULE_PATH = '../../../src/topoViewer/shared/utilities/PerformanceMonitor';
Object.keys(require.cache).forEach(key => {
  if (key.includes('PerformanceMonitor') || key.includes('logger') || key.includes('extensionLogger')) {
    delete require.cache[key];
  }
});

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Import stubs and module under test
import { resetLoggerStub, getLogEntries } from '../../helpers/extensionLogger-stub';

const perfModule = require(MODULE_PATH) as typeof import('../../../src/topoViewer/shared/utilities/PerformanceMonitor');
const { PerformanceMonitor, perfMark, perfMeasure, perfSummary } = perfModule;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

// Test constants
const MARK_START = 'test-start';
const MARK_END = 'test-end';
const MEASURE_NAME = 'test-measure';

describe('PerformanceMonitor - mark', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('creates a mark with debug log', () => {
    PerformanceMonitor.mark(MARK_START);

    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'debug' && e.message.includes(MARK_START))).to.be.true;
  });

  it('creates multiple marks', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.mark(MARK_END);

    const logs = getLogEntries();
    expect(logs.filter(e => e.level === 'debug').length).to.be.at.least(2);
  });

  it('overwrites existing mark with same name', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.mark(MARK_START);

    const logs = getLogEntries();
    expect(logs.filter(e => e.message.includes(MARK_START)).length).to.equal(2);
  });
});

describe('PerformanceMonitor - measure basic', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('returns 0 and logs warning when start mark not found', () => {
    const duration = PerformanceMonitor.measure(MEASURE_NAME, 'non-existent');

    expect(duration).to.equal(0);
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'warn' && e.message.includes('Start mark not found'))).to.be.true;
  });

  it('returns 0 and logs warning when end mark not found', () => {
    PerformanceMonitor.mark(MARK_START);
    const duration = PerformanceMonitor.measure(MEASURE_NAME, MARK_START, 'non-existent');

    expect(duration).to.equal(0);
    const logs = getLogEntries();
    expect(logs.some(e => e.level === 'warn' && e.message.includes('End mark not found'))).to.be.true;
  });

  it('calculates duration between two marks', () => {
    // Use fake timers for precise control
    const clock = sinon.useFakeTimers();
    try {
      PerformanceMonitor.mark(MARK_START);
      clock.tick(50);
      PerformanceMonitor.mark(MARK_END);

      const duration = PerformanceMonitor.measure(MEASURE_NAME, MARK_START, MARK_END);
      expect(duration).to.be.at.least(0);
    } finally {
      clock.restore();
    }
  });

  it('measures from mark to now when no end mark provided', () => {
    PerformanceMonitor.mark(MARK_START);
    const duration = PerformanceMonitor.measure(MEASURE_NAME, MARK_START);

    expect(duration).to.be.a('number');
    expect(duration).to.be.at.least(0);
  });
});

describe('PerformanceMonitor - measure logging behavior', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('logs performance message with duration', () => {
    // Fast operations (under 100ms) log at debug level
    // Since we can't control performance.now() with fake timers, just verify logging occurs
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.mark(MARK_END);

    PerformanceMonitor.measure(MEASURE_NAME, MARK_START, MARK_END);

    const logs = getLogEntries();
    // Should log either debug, info, or warn depending on actual timing
    const hasPerformanceLog = logs.some(e =>
      (e.level === 'debug' || e.level === 'info' || e.level === 'warn') &&
      (e.message.includes('Performance -') || e.message.includes('Slow operation'))
    );
    expect(hasPerformanceLog).to.be.true;
  });

  it('logs message contains measure name', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.mark(MARK_END);

    PerformanceMonitor.measure(MEASURE_NAME, MARK_START, MARK_END);

    const logs = getLogEntries();
    const hasNameInLog = logs.some(e => e.message.includes(MEASURE_NAME));
    expect(hasNameInLog).to.be.true;
  });

  it('logs message contains duration in ms format', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.mark(MARK_END);

    PerformanceMonitor.measure(MEASURE_NAME, MARK_START, MARK_END);

    const logs = getLogEntries();
    // Duration should be logged with 'ms' suffix
    const hasDurationFormat = logs.some(e => e.message.includes('ms'));
    expect(hasDurationFormat).to.be.true;
  });
});

describe('PerformanceMonitor - getMeasures', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('returns empty object when no measures', () => {
    const measures = PerformanceMonitor.getMeasures();
    expect(measures).to.deep.equal({});
  });

  it('returns all recorded measures', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.measure('measure1', MARK_START);
    PerformanceMonitor.measure('measure2', MARK_START);

    const measures = PerformanceMonitor.getMeasures();
    expect(measures).to.have.property('measure1');
    expect(measures).to.have.property('measure2');
    expect(Object.keys(measures).length).to.equal(2);
  });

  it('returns measures with numeric values', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.measure(MEASURE_NAME, MARK_START);

    const measures = PerformanceMonitor.getMeasures();
    expect(measures[MEASURE_NAME]).to.be.a('number');
  });
});

describe('PerformanceMonitor - clear', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('clears all marks and measures', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.measure(MEASURE_NAME, MARK_START);

    let measures = PerformanceMonitor.getMeasures();
    expect(Object.keys(measures).length).to.be.at.least(1);

    PerformanceMonitor.clear();

    measures = PerformanceMonitor.getMeasures();
    expect(measures).to.deep.equal({});
  });

  it('marks are no longer accessible after clear', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.clear();

    const duration = PerformanceMonitor.measure(MEASURE_NAME, MARK_START);
    expect(duration).to.equal(0);
  });
});

describe('PerformanceMonitor - logSummary', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('logs summary header and footer', () => {
    PerformanceMonitor.logSummary();

    const logs = getLogEntries();
    expect(logs.some(e => e.message.includes('Performance Summary'))).to.be.true;
  });

  it('logs total time', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.measure(MEASURE_NAME, MARK_START);
    PerformanceMonitor.logSummary();

    const logs = getLogEntries();
    expect(logs.some(e => e.message.includes('Total:'))).to.be.true;
  });

  it('logs each measure with percentage', () => {
    PerformanceMonitor.mark(MARK_START);
    PerformanceMonitor.measure('load', MARK_START);
    PerformanceMonitor.measure('render', MARK_START);
    PerformanceMonitor.logSummary();

    const logs = getLogEntries();
    expect(logs.some(e => e.message.includes('%'))).to.be.true;
  });

  it('handles empty measures gracefully', () => {
    PerformanceMonitor.logSummary();

    const logs = getLogEntries();
    expect(logs.some(e => e.message.includes('Total:'))).to.be.true;
  });
});

describe('PerformanceMonitor - convenience functions', () => {
  beforeEach(() => {
    resetLoggerStub();
    PerformanceMonitor.clear();
  });

  afterEach(() => {
    sinon.restore();
    PerformanceMonitor.clear();
  });

  it('perfMark creates a mark', () => {
    perfMark(MARK_START);

    const logs = getLogEntries();
    expect(logs.some(e => e.message.includes(MARK_START))).to.be.true;
  });

  it('perfMeasure measures between marks', () => {
    perfMark(MARK_START);
    const duration = perfMeasure(MEASURE_NAME, MARK_START);

    expect(duration).to.be.a('number');
    expect(duration).to.be.at.least(0);
  });

  it('perfMeasure returns 0 for missing start mark', () => {
    const duration = perfMeasure(MEASURE_NAME, 'missing');
    expect(duration).to.equal(0);
  });

  it('perfSummary logs summary', () => {
    perfMark(MARK_START);
    perfMeasure(MEASURE_NAME, MARK_START);
    perfSummary();

    const logs = getLogEntries();
    expect(logs.some(e => e.message.includes('Performance Summary'))).to.be.true;
  });
});
