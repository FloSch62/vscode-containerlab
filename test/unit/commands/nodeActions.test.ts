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

// Helper to clear module cache for all vscode-containerlab modules
function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Helper to resolve stub paths for module interception
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('utils') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

// Error message constants
const ERR_NO_CONTAINER_SELECTED = 'No container node selected.';
const ERR_NO_CONTAINER_ID = 'No containerId found.';
const TEST_ERR_NODE_UNDEFINED = 'shows error when node is undefined';

// eslint-disable-next-line aggregate-complexity/aggregate-complexity
describe('nodeActions commands', () => {
  let startNode: Function;
  let stopNode: Function;
  let pauseNode: Function;
  let unpauseNode: Function;
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
    startNode = nodeActionsModule.startNode;
    stopNode = nodeActionsModule.stopNode;
    pauseNode = nodeActionsModule.pauseNode;
    unpauseNode = nodeActionsModule.unpauseNode;
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

  describe('startNode()', () => {
    it('calls runContainerAction with Start action', async () => {
      const node = { cID: 'container-123', name: 'node1' } as any;

      await startNode(node);

      expect(utilsStub.containerActionCalls).to.have.length(1);
      expect(utilsStub.containerActionCalls[0]).to.deep.equal({
        containerId: 'container-123',
        action: utilsStub.ContainerAction.Start
      });
    });

    it(TEST_ERR_NODE_UNDEFINED, async () => {
      await startNode(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_SELECTED);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });

    it('shows error when containerId is missing', async () => {
      const node = { name: 'node1' } as any;

      await startNode(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_ID);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });
  });

  describe('stopNode()', () => {
    it('calls runContainerAction with Stop action', async () => {
      const node = { cID: 'container-456', name: 'node2' } as any;

      await stopNode(node);

      expect(utilsStub.containerActionCalls).to.have.length(1);
      expect(utilsStub.containerActionCalls[0]).to.deep.equal({
        containerId: 'container-456',
        action: utilsStub.ContainerAction.Stop
      });
    });

    it(TEST_ERR_NODE_UNDEFINED, async () => {
      await stopNode(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_SELECTED);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });

    it('shows error when containerId is missing', async () => {
      const node = { name: 'node2' } as any;

      await stopNode(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_ID);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });
  });

  describe('pauseNode()', () => {
    it('calls runContainerAction with Pause action', async () => {
      const node = { cID: 'container-789', name: 'node3' } as any;

      await pauseNode(node);

      expect(utilsStub.containerActionCalls).to.have.length(1);
      expect(utilsStub.containerActionCalls[0]).to.deep.equal({
        containerId: 'container-789',
        action: utilsStub.ContainerAction.Pause
      });
    });

    it(TEST_ERR_NODE_UNDEFINED, async () => {
      await pauseNode(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_SELECTED);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });
  });

  describe('unpauseNode()', () => {
    it('calls runContainerAction with Unpause action', async () => {
      const node = { cID: 'container-abc', name: 'node4' } as any;

      await unpauseNode(node);

      expect(utilsStub.containerActionCalls).to.have.length(1);
      expect(utilsStub.containerActionCalls[0]).to.deep.equal({
        containerId: 'container-abc',
        action: utilsStub.ContainerAction.Unpause
      });
    });

    it(TEST_ERR_NODE_UNDEFINED, async () => {
      await unpauseNode(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_CONTAINER_SELECTED);
      expect(utilsStub.containerActionCalls).to.have.length(0);
    });
  });
});
