/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for node action commands (start, stop, pause, unpause).
 *
 * These tests verify that container actions are properly executed
 * via the utils.runContainerAction function.
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
  if (request.includes('utils') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

const ERR_NO_CONTAINER_SELECTED = 'No container node selected.';
const ERR_NO_CONTAINER_ID = 'No containerId found.';

// Table-driven test cases for node actions
interface NodeActionTestCase {
  name: string;
  funcName: string;
  actionName: string;
  containerId: string;
}

const nodeActionTestCases: NodeActionTestCase[] = [
  { name: 'startNode', funcName: 'startNode', actionName: 'Start', containerId: 'container-123' },
  { name: 'stopNode', funcName: 'stopNode', actionName: 'Stop', containerId: 'container-456' },
  { name: 'pauseNode', funcName: 'pauseNode', actionName: 'Pause', containerId: 'container-789' },
  { name: 'unpauseNode', funcName: 'unpauseNode', actionName: 'Unpause', containerId: 'container-abc' },
];

describe('nodeActions commands', () => {
  let nodeActionFunctions: Record<string, Function>;
  let utilsStub: any;
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

    utilsStub = require('../../helpers/utils-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const nodeActionsModule = require('../../../src/commands/nodeActions');
    nodeActionFunctions = {
      startNode: nodeActionsModule.startNode,
      stopNode: nodeActionsModule.stopNode,
      pauseNode: nodeActionsModule.pauseNode,
      unpauseNode: nodeActionsModule.unpauseNode,
    };
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.clearContainerActionCalls();
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
  });

  // Table-driven tests for common behavior across all node actions
  nodeActionTestCases.forEach(({ name, funcName, actionName, containerId }) => {
    describe(`${name}()`, () => {
      it(`calls runContainerAction with ${actionName} action`, async () => {
        const node = { cID: containerId, name: 'node1' } as any;

        await nodeActionFunctions[funcName](node);

        expect(utilsStub.containerActionCalls).to.have.length(1);
        expect(utilsStub.containerActionCalls[0]).to.deep.equal({
          containerId: containerId,
          action: utilsStub.ContainerAction[actionName]
        });
      });

      it('shows error when node is undefined', async () => {
        await nodeActionFunctions[funcName](undefined);

        expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_SELECTED);
        expect(utilsStub.containerActionCalls).to.have.length(0);
      });
    });
  });

  // Additional tests for containerId validation (only need to test once)
  describe('containerId validation', () => {
    it('shows error when containerId is missing on startNode', async () => {
      const node = { name: 'node1' } as any;
      await nodeActionFunctions.startNode(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_ID);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });

    it('shows error when containerId is missing on stopNode', async () => {
      const node = { name: 'node2' } as any;
      await nodeActionFunctions.stopNode(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_ID);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });
  });
});
