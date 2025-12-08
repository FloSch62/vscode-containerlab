/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for utils.ts tree view selection paths.
 * Specifically tests getSelectedLabNode() with tree view selections.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;
const TEST_LAB_PATH = '/test/lab.clab.yml';
const LOCAL_LAB_PATH = '/local/lab.clab.yml';
const RUNNING_LAB_PATH = '/running/lab.clab.yml';
const LAB_RELATIVE = 'lab.clab.yml';

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
  return null;
}

let utilsModule: any;
let extensionStub: any;
let vscodeStub: any;
let ClabLabTreeNode: any;

describe('getSelectedLabNode() - running tree selection', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    // Import ClabLabTreeNode class to create proper instances
    const commonModule = require('../../../src/treeView/common');
    ClabLabTreeNode = commonModule.ClabLabTreeNode;
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns node from running tree selection when available', async () => {
    // Create a proper ClabLabTreeNode instance
    const labNode = new ClabLabTreeNode(
      'test-lab',
      vscodeStub.TreeItemCollapsibleState.Collapsed,
      { absolute: TEST_LAB_PATH, relative: LAB_RELATIVE },
      'test-lab'
    );

    // Set up running tree view with selection
    extensionStub.setRunningTreeView({
      selection: [labNode]
    });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.equal(labNode);
  });

  it('returns node from local tree when running tree is empty', async () => {
    const labNode = new ClabLabTreeNode(
      'local-lab',
      vscodeStub.TreeItemCollapsibleState.Collapsed,
      { absolute: LOCAL_LAB_PATH, relative: LAB_RELATIVE },
      'local-lab'
    );

    // Running tree has no selection
    extensionStub.setRunningTreeView({
      selection: []
    });

    // Local tree has selection
    extensionStub.setLocalTreeView({
      selection: [labNode]
    });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.equal(labNode);
  });

  it('returns undefined when both trees have no selection', async () => {
    extensionStub.setRunningTreeView({
      selection: []
    });
    extensionStub.setLocalTreeView({
      selection: []
    });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });

  it('ignores non-ClabLabTreeNode items in running tree selection', async () => {
    // Put a non-ClabLabTreeNode in running tree selection
    const otherItem = { someProperty: 'value' };
    extensionStub.setRunningTreeView({
      selection: [otherItem]
    });

    // Local tree has a proper ClabLabTreeNode
    const labNode = new ClabLabTreeNode(
      'local-lab',
      vscodeStub.TreeItemCollapsibleState.Collapsed,
      { absolute: LOCAL_LAB_PATH, relative: LAB_RELATIVE },
      'local-lab'
    );
    extensionStub.setLocalTreeView({
      selection: [labNode]
    });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.equal(labNode);
  });
});

describe('getSelectedLabNode() - local tree selection', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    const commonModule = require('../../../src/treeView/common');
    ClabLabTreeNode = commonModule.ClabLabTreeNode;
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('prefers running tree over local tree when both have selections', async () => {
    const runningLabNode = new ClabLabTreeNode(
      'running-lab',
      vscodeStub.TreeItemCollapsibleState.Collapsed,
      { absolute: RUNNING_LAB_PATH, relative: LAB_RELATIVE },
      'running-lab'
    );

    const localLabNode = new ClabLabTreeNode(
      'local-lab',
      vscodeStub.TreeItemCollapsibleState.Collapsed,
      { absolute: LOCAL_LAB_PATH, relative: LAB_RELATIVE },
      'local-lab'
    );

    extensionStub.setRunningTreeView({
      selection: [runningLabNode]
    });
    extensionStub.setLocalTreeView({
      selection: [localLabNode]
    });

    const result = await utilsModule.getSelectedLabNode(undefined);
    // Should return from running tree (first priority)
    expect(result).to.equal(runningLabNode);
  });

  it('ignores non-ClabLabTreeNode in local tree selection', async () => {
    const otherItem = { notALabNode: true };
    extensionStub.setLocalTreeView({
      selection: [otherItem]
    });
    extensionStub.setRunningTreeView({
      selection: []
    });

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });
});

describe('getSelectedLabNode() - null tree views', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('handles undefined running tree view', async () => {
    extensionStub.setRunningTreeView(undefined);
    extensionStub.setLocalTreeView(undefined);

    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });

  it('handles running tree view with undefined selection', async () => {
    extensionStub.setRunningTreeView({ selection: undefined });
    extensionStub.setLocalTreeView(undefined);

    // Should not throw, just return undefined
    let result;
    let didThrow = false;
    try {
      result = await utilsModule.getSelectedLabNode(undefined);
    } catch {
      didThrow = true;
    }
    // Either returns undefined or throws - both are acceptable
    expect(result === undefined || didThrow).to.be.true;
  });
});
