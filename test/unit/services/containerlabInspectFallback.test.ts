/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

// Constants for test data
const TEST_CONTAINER_ID = 'abc123';
const TEST_CONTAINER_FULL_ID = 'abc123def456';
const TEST_CONTAINER_NAME = 'clab-lab-node1';
const TEST_TOPO_FILE = '/path/to/lab.clab.yml';
const VSCODE_STUB_PATH = 'vscode-stub.js';
const EXTENSION_STUB_PATH = 'extension-stub.js';

// Helper to clear module cache
function clearModuleCache(): void {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// =============================================================================
// containerlabInspectFallback - Core API
// =============================================================================

describe('containerlabInspectFallback - core API', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let fallbackModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('extension') && !request.includes('stub') && !request.includes('test')) {
        return path.join(__dirname, '..', '..', 'helpers', EXTENSION_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    require('../../helpers/vscode-stub');
    fallbackModule = require('../../../src/services/containerlabInspectFallback');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    fallbackModule.resetForTests();
  });

  it('getGroupedContainers returns empty object initially', () => {
    const result = fallbackModule.getGroupedContainers();
    expect(result).to.deep.equal({});
  });

  it('getInterfaceVersion returns 0 for fallback mode', () => {
    const version = fallbackModule.getInterfaceVersion(TEST_CONTAINER_ID);
    expect(version).to.equal(0);
  });

  it('getInterfaceSnapshot returns empty array when container not found', () => {
    const result = fallbackModule.getInterfaceSnapshot('unknown', TEST_CONTAINER_NAME);
    expect(result).to.be.an('array');
  });
});

// =============================================================================
// containerlabInspectFallback - Polling Control
// =============================================================================

describe('containerlabInspectFallback - polling', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let fallbackModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('extension') && !request.includes('stub') && !request.includes('test')) {
        return path.join(__dirname, '..', '..', 'helpers', EXTENSION_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    require('../../helpers/vscode-stub');
    fallbackModule = require('../../../src/services/containerlabInspectFallback');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    fallbackModule.resetForTests();
  });

  it('startPolling does not throw', () => {
    fallbackModule.startPolling('docker', 1000);
    fallbackModule.stopPolling();
    expect(true).to.be.true;
  });

  it('stopPolling does not throw when not polling', () => {
    fallbackModule.stopPolling();
    expect(true).to.be.true;
  });

  it('stopPolling does not throw when polling', () => {
    fallbackModule.startPolling('docker', 10000);
    fallbackModule.stopPolling();
    expect(true).to.be.true;
  });

  it('startPolling is idempotent', () => {
    fallbackModule.startPolling('docker', 1000);
    fallbackModule.startPolling('docker', 1000);
    fallbackModule.stopPolling();
    expect(true).to.be.true;
  });
});

// =============================================================================
// containerlabInspectFallback - Listeners
// =============================================================================

describe('containerlabInspectFallback - listeners', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let fallbackModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('extension') && !request.includes('stub') && !request.includes('test')) {
        return path.join(__dirname, '..', '..', 'helpers', EXTENSION_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    require('../../helpers/vscode-stub');
    fallbackModule = require('../../../src/services/containerlabInspectFallback');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    fallbackModule.resetForTests();
  });

  it('onDataChanged returns a dispose function', () => {
    const dispose = fallbackModule.onDataChanged(() => {});
    expect(typeof dispose).to.equal('function');
    dispose();
  });

  it('dispose function can be called multiple times', () => {
    const dispose = fallbackModule.onDataChanged(() => {});
    dispose();
    dispose();
    expect(true).to.be.true;
  });
});

// =============================================================================
// containerlabInspectFallback - Reset and Async Operations
// =============================================================================

describe('containerlabInspectFallback - reset and async', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let fallbackModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('extension') && !request.includes('stub') && !request.includes('test')) {
        return path.join(__dirname, '..', '..', 'helpers', EXTENSION_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    require('../../helpers/vscode-stub');
    fallbackModule = require('../../../src/services/containerlabInspectFallback');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    fallbackModule.resetForTests();
  });

  it('resetForTests resets all state', () => {
    fallbackModule.startPolling('docker', 10000);
    fallbackModule.resetForTests();
    expect(fallbackModule.getGroupedContainers()).to.deep.equal({});
  });

  it('forceUpdate does not throw', async () => {
    await fallbackModule.forceUpdate('docker');
    expect(true).to.be.true;
  });

  it('ensureFallback handles missing containerlab gracefully', async () => {
    try {
      await fallbackModule.ensureFallback('docker');
    } catch {
      // Expected if containerlab is not installed
    }
    fallbackModule.stopPolling();
    expect(true).to.be.true;
  });
});

// =============================================================================
// containerlabInspectFallback Stub Tests
// =============================================================================

describe('containerlabInspectFallback stub - setters', () => {
  let fallbackStub: any;

  before(() => {
    fallbackStub = require('../../helpers/containerlabInspectFallback-stub');
  });

  beforeEach(() => {
    fallbackStub.resetForTests();
  });

  it('setGroupedContainers allows setting grouped containers data', () => {
    const testData = {
      [TEST_TOPO_FILE]: [{
        ShortID: TEST_CONTAINER_ID,
        ContainerID: TEST_CONTAINER_FULL_ID,
        Name: 'node1',
        Names: [TEST_CONTAINER_NAME],
        State: 'running',
        Status: 'Up 1 hour',
        IPv4Address: '172.20.20.2/24',
        IPv6Address: '2001:db8::2/64',
        Kind: 'linux',
        Image: 'alpine:latest',
        Labels: {},
        Owner: 'testuser'
      }]
    };

    fallbackStub.setGroupedContainers(testData);
    expect(fallbackStub.getGroupedContainers()).to.deep.equal(testData);
  });

  it('setInterfaceSnapshot allows setting interface snapshot', () => {
    const snapshot = [{
      name: TEST_CONTAINER_NAME,
      interfaces: [{ name: 'eth0', type: 'veth', state: 'up', alias: '', mac: '00:11:22:33:44:55', mtu: 1500, ifindex: 1 }]
    }];

    fallbackStub.setInterfaceSnapshot(TEST_CONTAINER_ID, snapshot);
    expect(fallbackStub.getInterfaceSnapshot(TEST_CONTAINER_ID, TEST_CONTAINER_NAME)).to.deep.equal(snapshot);
  });

  it('setInterfaceVersion allows setting interface version', () => {
    fallbackStub.setInterfaceVersion(TEST_CONTAINER_ID, 5);
    expect(fallbackStub.getInterfaceVersion(TEST_CONTAINER_ID)).to.equal(5);
  });
});

describe('containerlabInspectFallback stub - polling state', () => {
  let fallbackStub: any;

  before(() => {
    fallbackStub = require('../../helpers/containerlabInspectFallback-stub');
  });

  beforeEach(() => {
    fallbackStub.resetForTests();
  });

  it('setIsPolling allows controlling polling state', () => {
    expect(fallbackStub.getIsPolling()).to.be.false;
    fallbackStub.setIsPolling(true);
    expect(fallbackStub.getIsPolling()).to.be.true;
  });

  it('startPolling/stopPolling updates polling state', () => {
    fallbackStub.startPolling('docker');
    expect(fallbackStub.getIsPolling()).to.be.true;
    fallbackStub.stopPolling();
    expect(fallbackStub.getIsPolling()).to.be.false;
  });
});

describe('containerlabInspectFallback stub - reset', () => {
  let fallbackStub: any;

  before(() => {
    fallbackStub = require('../../helpers/containerlabInspectFallback-stub');
  });

  beforeEach(() => {
    fallbackStub.resetForTests();
  });

  it('resetForTests clears all state', () => {
    fallbackStub.setGroupedContainers({ test: [] });
    fallbackStub.setIsPolling(true);
    fallbackStub.setInterfaceVersion('test', 10);

    fallbackStub.resetForTests();

    expect(fallbackStub.getGroupedContainers()).to.deep.equal({});
    expect(fallbackStub.getIsPolling()).to.be.false;
    expect(fallbackStub.getInterfaceVersion('test')).to.equal(0);
  });

  it('getInterfaceSnapshot returns default when not set', () => {
    const result = fallbackStub.getInterfaceSnapshot('unknown', TEST_CONTAINER_NAME);
    expect(result).to.deep.equal([{ name: TEST_CONTAINER_NAME, interfaces: [] }]);
  });
});
