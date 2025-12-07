/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the impairments commands.
 *
 * Tests setLinkDelay, setLinkJitter, setLinkLoss, setLinkRate, setLinkCorruption.
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

// Helper to resolve stub paths
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if ((request === '../extension' || request.endsWith('/extension')) && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request === './command') {
    return path.join(__dirname, '..', '..', 'helpers', 'command-stub.js');
  }
  return null;
}

const ERR_NO_INTERFACE = 'No interface selected to set ';
const ERR_CANNOT_READ_PROPS = 'Cannot read properties of undefined';

// Helper to create interface node mock
function createInterfaceNode(name: string, parentName: string) {
  const { ClabInterfaceTreeNode } = require('../../../src/treeView/common');
  return new ClabInterfaceTreeNode(
    name,
    0,
    { name, type: 'veth', state: 'up', mac: '00:11:22:33:44:55', mtu: 1500, ifindex: 1, alias: '' },
    parentName,
    'container123'
  );
}

// Table-driven test cases for impairment functions
interface ImpairmentTestCase {
  name: string;
  flag: string;
  inputValue: string;
}

const impairmentTestCases: ImpairmentTestCase[] = [
  { name: 'setLinkDelay', flag: '--delay', inputValue: '50ms' },
  { name: 'setLinkJitter', flag: '--jitter', inputValue: '10ms' },
  { name: 'setLinkLoss', flag: '--loss', inputValue: '50' },
  { name: 'setLinkRate', flag: '--rate', inputValue: '1000' },
  { name: 'setLinkCorruption', flag: '--corruption', inputValue: '25' },
];

// Shared context
let impairmentFunctions: Record<string, Function>;
let vscodeStub: any;
let commandStub: any;

function setupImpairmentsTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    commandStub = require('../../helpers/command-stub');
    const impairments = require('../../../src/commands/impairments');
    impairmentFunctions = {
      setLinkDelay: impairments.setLinkDelay,
      setLinkJitter: impairments.setLinkJitter,
      setLinkLoss: impairments.setLinkLoss,
      setLinkRate: impairments.setLinkRate,
      setLinkCorruption: impairments.setLinkCorruption,
    };
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
    vscodeStub.window.inputBoxResult = undefined;
    commandStub.resetCommandStub();
  });
}

// Table-driven tests for common behavior across all impairment functions
impairmentTestCases.forEach(({ name, flag, inputValue }) => {
  describe(`${name}()`, () => {
    setupImpairmentsTests();

    it('throws when node is undefined', async () => {
      try {
        await impairmentFunctions[name](undefined);
        expect.fail('Should have thrown');
      } catch (e: any) {
        expect(e.message).to.include(ERR_CANNOT_READ_PROPS);
      }
    });

    it(`executes command with ${flag}`, async () => {
      const node = createInterfaceNode('eth0', 'node1');
      vscodeStub.window.inputBoxResult = inputValue;

      await impairmentFunctions[name](node);

      expect(commandStub.lastCommand).to.include('netem set');
      expect(commandStub.lastCommand).to.include(flag);
      expect(commandStub.lastCommand).to.include(inputValue);
    });
  });
});

describe('setLinkDelay() additional cases', () => {
  setupImpairmentsTests();

  it('shows error when node is not ClabInterfaceTreeNode', async () => {
    const fakeNode = { name: 'fake', parentName: 'parent' };
    await impairmentFunctions.setLinkDelay(fakeNode);
    expect(vscodeStub.window.lastErrorMessage).to.include(ERR_NO_INTERFACE);
  });

  it('does not execute when user cancels input', async () => {
    const node = createInterfaceNode('eth0', 'node1');
    vscodeStub.window.inputBoxResult = undefined;

    await impairmentFunctions.setLinkDelay(node);

    expect(commandStub.lastCommand).to.be.undefined;
  });
});

describe('WSL detection', () => {
  setupImpairmentsTests();

  it('shows warning when running in WSL', async () => {
    const originalRemoteName = vscodeStub.env.remoteName;
    vscodeStub.env.remoteName = 'wsl';

    const node = createInterfaceNode('eth0', 'node1');
    await impairmentFunctions.setLinkDelay(node);

    expect(vscodeStub.window.lastWarningMessage).to.include('WSL');

    vscodeStub.env.remoteName = originalRemoteName;
  });
});
