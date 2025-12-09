/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the `save` command.
 *
 * Tests saveLab and saveNode functions that save containerlab configurations.
 */
import { expect } from 'chai';
import sinon from 'sinon';
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
  if (request.includes('clabCommand') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'clabCommand-stub.js');
  }
  if (request.includes('utils') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  if ((request === './graph' || request.endsWith('/graph')) && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'graph-stub.js');
  }
  return null;
}

const TEST_LAB_PATH = '/home/user/lab.clab.yml';
const TEST_LAB_REL = 'lab.clab.yml';
const TEST_LABS_PATH = '/home/user/labs/mylab.clab.yml';
const ERR_NO_LAB_SELECTED = 'No lab node selected.';
const ERR_NO_LAB_PATH = 'No labPath found for the lab.';
const ERR_NO_CONTAINER_SELECTED = 'No container node selected.';
const ERR_COULD_NOT_DETERMINE = 'Error: Could not determine lab path for this node.';

// Shared context
let saveLab: Function;
let saveNode: Function;
let clabStub: any;
let vscodeStub: any;

function setupSaveTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    clabStub = require('../../helpers/clabCommand-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const saveModule = require('../../../src/commands/save');
    saveLab = saveModule.saveLab;
    saveNode = saveModule.saveNode;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    clabStub.instances.length = 0;
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
    sinon.spy(clabStub.ClabCommand.prototype, 'run');
  });

  afterEach(() => {
    sinon.restore();
  });
}

describe('saveLab() - success cases', () => {
  setupSaveTests();

  it('creates ClabCommand with save action for lab node', async () => {
    const node = { labPath: { absolute: TEST_LAB_PATH, relative: TEST_LAB_REL } } as any;
    await saveLab(node);

    expect(clabStub.instances.length).to.equal(1);
    const instance = clabStub.instances[0];
    expect(instance.action).to.equal('save');
    expect(instance.node).to.equal(node);

    const spy = clabStub.ClabCommand.prototype.run as sinon.SinonSpy;
    expect(spy.calledOnce).to.be.true;
  });
});

describe('saveLab() - error cases', () => {
  setupSaveTests();

  it('shows error when node is undefined', async () => {
    await saveLab(undefined as any);

    expect(clabStub.instances.length).to.equal(0);
    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_SELECTED);
  });

  it('shows error when node has no labPath', async () => {
    await saveLab({} as any);

    expect(clabStub.instances.length).to.equal(0);
    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_PATH);
  });

  it('shows error when labPath has no absolute path', async () => {
    await saveLab({ labPath: { relative: 'lab.yml' } } as any);

    expect(clabStub.instances.length).to.equal(0);
    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_PATH);
  });
});

describe('saveNode() - success cases', () => {
  setupSaveTests();

  it('creates ClabCommand with save action and node-filter', async () => {
    const node = {
      name: 'clab-mylab-node1',
      name_short: 'node1',
      labPath: { absolute: TEST_LAB_PATH, relative: TEST_LAB_REL }
    } as any;
    await saveNode(node);

    expect(clabStub.instances.length).to.equal(1);
    const instance = clabStub.instances[0];
    expect(instance.action).to.equal('save');
    expect(instance.runArgs).to.deep.equal(['--node-filter', 'node1']);
  });

  it('extracts short name from full name when name_short not available', async () => {
    const node = {
      name: 'clab-mylab-router1',
      labPath: { absolute: TEST_LAB_PATH, relative: TEST_LAB_REL }
    } as any;
    await saveNode(node);

    expect(clabStub.instances.length).to.equal(1);
    expect(clabStub.instances[0].runArgs).to.deep.equal(['--node-filter', 'router1']);
  });

  it('creates temp lab node with correct basename', async () => {
    const node = {
      name: 'clab-test-node1',
      name_short: 'node1',
      labPath: { absolute: TEST_LABS_PATH, relative: 'labs/mylab.clab.yml' }
    } as any;
    await saveNode(node);

    expect(clabStub.instances.length).to.equal(1);
    expect(clabStub.instances[0].node.label).to.equal('mylab.clab.yml');
  });
});

describe('saveNode() - error cases', () => {
  setupSaveTests();

  it('shows error when node is undefined', async () => {
    await saveNode(undefined as any);

    expect(clabStub.instances.length).to.equal(0);
    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_SELECTED);
  });

  it('shows error when labPath is missing', async () => {
    await saveNode({ name: 'node1' } as any);

    expect(clabStub.instances.length).to.equal(0);
    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_COULD_NOT_DETERMINE);
  });

  it('shows error when labPath.absolute is missing', async () => {
    await saveNode({ name: 'node1', labPath: { relative: 'lab.yml' } } as any);

    expect(clabStub.instances.length).to.equal(0);
    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_COULD_NOT_DETERMINE);
  });
});
