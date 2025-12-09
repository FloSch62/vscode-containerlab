/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the inspector module.
 *
 * Tests the data fetching logic that switches between events and polling modes.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

// Helper to clear module cache
function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Mock config values
let mockRefreshMode = 'events';
let mockRuntime = 'docker';
let mockEnableInterfaceStats = true;
let mockEnsureEventStreamShouldFail = false;

// Helper to resolve stub paths
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('containerlabEvents') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'containerlabEvents-stub.js');
  }
  if (request.includes('containerlabInspectFallback') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'containerlabInspectFallback-stub.js');
  }
  return null;
}

// eslint-disable-next-line aggregate-complexity/aggregate-complexity
describe('inspector module', () => {
  let inspector: any;
  let eventsStub: any;
  let fallbackStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    eventsStub = require('../../helpers/containerlabEvents-stub');
    fallbackStub = require('../../helpers/containerlabInspectFallback-stub');
    vscodeStub = require('../../helpers/vscode-stub');

    // Override workspace.getConfiguration to return our mock values
    vscodeStub.workspace.getConfiguration = () => ({
      get: (key: string, defaultValue?: any) => {
        if (key === 'refreshMode') return mockRefreshMode;
        if (key === 'runtime') return mockRuntime;
        if (key === 'enableInterfaceStats') return mockEnableInterfaceStats;
        return defaultValue;
      }
    });

    // Override ensureEventStream to optionally throw
    const originalEnsure = eventsStub.ensureEventStream;
    eventsStub.ensureEventStream = async (runtime: string) => {
      if (mockEnsureEventStreamShouldFail) {
        throw new Error('Events stream not available');
      }
      return originalEnsure(runtime);
    };

    inspector = require('../../../src/treeView/inspector');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    // Reset all stubs and mocks
    eventsStub.resetForTests();
    fallbackStub.resetForTests();
    inspector.resetForcedPollingMode();
    mockRefreshMode = 'events';
    mockRuntime = 'docker';
    mockEnableInterfaceStats = true;
    mockEnsureEventStreamShouldFail = false;
  });

  describe('isPollingMode()', () => {
    it('returns false when refreshMode is events', () => {
      mockRefreshMode = 'events';
      expect(inspector.isPollingMode()).to.be.false;
    });

    it('returns true when refreshMode is polling', () => {
      mockRefreshMode = 'polling';
      expect(inspector.isPollingMode()).to.be.true;
    });

    it('returns true when forcedPollingMode is set', async () => {
      mockRefreshMode = 'events';
      mockEnsureEventStreamShouldFail = true;

      // Force an update which will fail and set forcedPollingMode
      await inspector.update();

      expect(inspector.isPollingMode()).to.be.true;
      expect(inspector.isUsingForcedPolling()).to.be.true;
    });
  });

  describe('isInterfaceStatsEnabled()', () => {
    it('returns true when enabled', () => {
      mockEnableInterfaceStats = true;
      expect(inspector.isInterfaceStatsEnabled()).to.be.true;
    });

    it('returns false when disabled', () => {
      mockEnableInterfaceStats = false;
      expect(inspector.isInterfaceStatsEnabled()).to.be.false;
    });
  });

  describe('update()', () => {
    it('uses events when refreshMode is events', async () => {
      mockRefreshMode = 'events';
      const testData = {
        '/test/lab.yml': [{ ShortID: 'abc123', State: 'running' }]
      };
      eventsStub.setGroupedContainers(testData);

      await inspector.update();

      expect(inspector.rawInspectData).to.deep.equal(testData);
    });

    it('uses polling when refreshMode is polling', async () => {
      mockRefreshMode = 'polling';
      const testData = {
        '/test/lab.yml': [{ ShortID: 'def456', State: 'running' }]
      };
      fallbackStub.setGroupedContainers(testData);

      await inspector.update();

      expect(inspector.rawInspectData).to.deep.equal(testData);
    });

    it('falls back to polling when events fail', async () => {
      mockRefreshMode = 'events';
      mockEnsureEventStreamShouldFail = true;
      const testData = {
        '/test/lab.yml': [{ ShortID: 'ghi789', State: 'running' }]
      };
      fallbackStub.setGroupedContainers(testData);

      await inspector.update();

      expect(inspector.rawInspectData).to.deep.equal(testData);
      expect(inspector.isUsingForcedPolling()).to.be.true;
    });
  });

  describe('getInterfacesSnapshot()', () => {
    it('uses events when not in polling mode', () => {
      mockRefreshMode = 'events';
      const interfaces = [{ name: 'eth0', interfaces: [{ name: 'eth0', mac: '00:11:22:33:44:55' }] }];
      eventsStub.setInterfaceSnapshot('abc123', interfaces);

      const result = inspector.getInterfacesSnapshot('abc123', 'node1');

      expect(result).to.deep.equal(interfaces);
    });

    it('uses fallback when in polling mode', () => {
      mockRefreshMode = 'polling';
      const interfaces = [{ name: 'eth1', interfaces: [{ name: 'eth1', mac: 'aa:bb:cc:dd:ee:ff' }] }];
      fallbackStub.setInterfaceSnapshot('def456', interfaces);

      const result = inspector.getInterfacesSnapshot('def456', 'node2');

      expect(result).to.deep.equal(interfaces);
    });
  });

  describe('getInterfaceVersion()', () => {
    it('uses events when not in polling mode', () => {
      mockRefreshMode = 'events';
      eventsStub.setInterfaceVersion('abc123', 5);

      const result = inspector.getInterfaceVersion('abc123');

      expect(result).to.equal(5);
    });

    it('uses fallback when in polling mode', () => {
      mockRefreshMode = 'polling';
      fallbackStub.setInterfaceVersion('def456', 3);

      const result = inspector.getInterfaceVersion('def456');

      expect(result).to.equal(3);
    });
  });

  describe('refreshFromEventStream()', () => {
    it('updates rawInspectData from events', () => {
      mockRefreshMode = 'events';
      const testData = {
        '/test/lab.yml': [{ ShortID: 'xyz789', State: 'running' }]
      };
      eventsStub.setGroupedContainers(testData);

      inspector.refreshFromEventStream();

      expect(inspector.rawInspectData).to.deep.equal(testData);
    });

    it('updates rawInspectData from fallback when in polling mode', () => {
      mockRefreshMode = 'polling';
      const testData = {
        '/test/lab.yml': [{ ShortID: 'uvw456', State: 'stopped' }]
      };
      fallbackStub.setGroupedContainers(testData);

      inspector.refreshFromEventStream();

      expect(inspector.rawInspectData).to.deep.equal(testData);
    });
  });

  describe('resetForcedPollingMode()', () => {
    it('resets the forced polling state', async () => {
      mockRefreshMode = 'events';
      mockEnsureEventStreamShouldFail = true;

      // Force polling mode
      await inspector.update();
      expect(inspector.isUsingForcedPolling()).to.be.true;

      // Reset it
      inspector.resetForcedPollingMode();
      expect(inspector.isUsingForcedPolling()).to.be.false;
    });
  });
});
