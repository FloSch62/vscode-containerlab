/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for utils.ts getSelectedLabNode with tree view selection.
 * Tests the logic for selecting nodes from running and local tree views.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('../treeView/common')) {
    return path.join(__dirname, '..', '..', 'helpers', 'treeView-common-stub.js');
  }
  return null;
}

let utilsModule: any;
let extensionStub: any;

// Constants for test paths
const RUNNING_LAB_PATH = '/running/lab.yml';
const LOCAL_LAB_PATH = '/local/lab.yml';

// Mock tree node that mimics ClabLabTreeNode
function createMockLabNode(labPath: string = '/test/lab.clab.yml') {
  // Get the ClabLabTreeNode class from the stub
  const treeViewStub = require('../../helpers/treeView-common-stub');
  return new treeViewStub.ClabLabTreeNode('test-lab', labPath);
}

// Mock tree node that's NOT a ClabLabTreeNode (e.g., container node)
function createMockContainerNode() {
  return { label: 'container-node', containerId: 'abc123' };
}

describe('getSelectedLabNode() - direct node parameter', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns the provided node immediately', async () => {
    const node = createMockLabNode();
    const result = await utilsModule.getSelectedLabNode(node);
    expect(result).to.equal(node);
  });

  it('returns node with all properties intact', async () => {
    const node = createMockLabNode('/custom/path.yml');
    const result = await utilsModule.getSelectedLabNode(node);
    expect(result.labPath).to.equal('/custom/path.yml');
    expect(result.label).to.equal('test-lab');
  });

  it('bypasses tree selection when node is provided', async () => {
    // Set up tree views with different selections
    extensionStub.setRunningTreeView({
      selection: [createMockLabNode(RUNNING_LAB_PATH)]
    });
    extensionStub.setLocalTreeView({
      selection: [createMockLabNode(LOCAL_LAB_PATH)]
    });

    const providedNode = createMockLabNode('/provided/lab.yml');
    const result = await utilsModule.getSelectedLabNode(providedNode);

    // Should return provided node, not tree selection
    expect(result.labPath).to.equal('/provided/lab.yml');
  });
});

describe('getSelectedLabNode() - no node parameter', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns undefined when no trees have selection', async () => {
    extensionStub.setRunningTreeView({ selection: [] });
    extensionStub.setLocalTreeView({ selection: [] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });

  it('returns undefined when trees are undefined', async () => {
    extensionStub.setRunningTreeView(undefined);
    extensionStub.setLocalTreeView(undefined);

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });

  it('returns undefined when no node parameter and empty trees', async () => {
    const result = await utilsModule.getSelectedLabNode();
    expect(result).to.be.undefined;
  });
});

describe('getSelectedLabNode() - running tree priority', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('checks running tree before local tree', async () => {
    const runningNode = createMockLabNode(RUNNING_LAB_PATH);
    const localNode = createMockLabNode(LOCAL_LAB_PATH);

    extensionStub.setRunningTreeView({ selection: [runningNode] });
    extensionStub.setLocalTreeView({ selection: [localNode] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    // Running tree has priority
    expect(result?.labPath).to.equal(RUNNING_LAB_PATH);
  });

  it('falls back to local tree when running has no selection', async () => {
    const localNode = createMockLabNode(LOCAL_LAB_PATH);

    extensionStub.setRunningTreeView({ selection: [] });
    extensionStub.setLocalTreeView({ selection: [localNode] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result?.labPath).to.equal(LOCAL_LAB_PATH);
  });

  it('falls back to local tree when running tree is undefined', async () => {
    const localNode = createMockLabNode(LOCAL_LAB_PATH);

    extensionStub.setRunningTreeView(undefined);
    extensionStub.setLocalTreeView({ selection: [localNode] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result?.labPath).to.equal(LOCAL_LAB_PATH);
  });
});

describe('getSelectedLabNode() - type checking', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('skips non-ClabLabTreeNode in running tree', async () => {
    const containerNode = createMockContainerNode();
    const localLabNode = createMockLabNode(LOCAL_LAB_PATH);

    extensionStub.setRunningTreeView({ selection: [containerNode] });
    extensionStub.setLocalTreeView({ selection: [localLabNode] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    // Should skip container node and get local lab node
    expect(result?.labPath).to.equal(LOCAL_LAB_PATH);
  });

  it('skips non-ClabLabTreeNode in local tree', async () => {
    const containerNode = createMockContainerNode();

    extensionStub.setRunningTreeView({ selection: [] });
    extensionStub.setLocalTreeView({ selection: [containerNode] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    // Should return undefined since container node is not ClabLabTreeNode
    expect(result).to.be.undefined;
  });

  it('returns first ClabLabTreeNode in selection', async () => {
    const labNode = createMockLabNode('/first/lab.yml');

    extensionStub.setRunningTreeView({ selection: [labNode] });
    extensionStub.setLocalTreeView({ selection: [] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.equal(labNode);
  });
});

describe('getSelectedLabNode() - async behavior', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns a Promise', () => {
    const result = utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.instanceOf(Promise);
  });

  it('resolves with undefined when awaited without selection', async () => {
    extensionStub.setRunningTreeView({ selection: [] });
    extensionStub.setLocalTreeView({ selection: [] });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });

  it('resolves with node when awaited with direct parameter', async () => {
    const node = createMockLabNode();
    const result = await utilsModule.getSelectedLabNode(node);
    expect(result).to.equal(node);
  });
});
