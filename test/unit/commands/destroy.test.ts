/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the `destroy` and `destroyCleanup` commands.
 *
 * These tests verify that the destroy commands properly invoke ClabCommand
 * with the correct action and cleanup flags.
 */
import { expect } from 'chai';
import sinon from 'sinon';
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

const TEST_LAB_PATH = '/home/user/lab.yml';

describe('destroy command', () => {
  let destroy: Function;
  let destroyCleanup: Function;
  let clabStub: any;
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

    clabStub = require('../../helpers/clabCommand-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const destroyModule = require('../../../src/commands/destroy');
    destroy = destroyModule.destroy;
    destroyCleanup = destroyModule.destroyCleanup;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    clabStub.instances.length = 0;
    sinon.spy(clabStub.ClabCommand.prototype, 'run');
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
    vscodeStub.window.lastWarningSelection = 'Yes'; // Default to confirm cleanup warning
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('destroy()', () => {
    it('creates ClabCommand with destroy action and runs it', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      await destroy(node);

      expect(clabStub.instances.length).to.equal(1);
      const instance = clabStub.instances[0];
      expect(instance.action).to.equal('destroy');
      expect(instance.node).to.equal(node);

      const spy = clabStub.ClabCommand.prototype.run as sinon.SinonSpy;
      expect(spy.calledOnce).to.be.true;
      expect(instance.runArgs).to.be.undefined; // No cleanup flag
    });

    it('does not create ClabCommand when node is undefined', async () => {
      await destroy(undefined);

      expect(clabStub.instances.length).to.equal(0);
    });
  });

  describe('destroyCleanup()', () => {
    it('creates ClabCommand with destroy action and -c flag', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      await destroyCleanup(node);

      expect(clabStub.instances.length).to.equal(1);
      const instance = clabStub.instances[0];
      expect(instance.action).to.equal('destroy');
      expect(instance.node).to.equal(node);

      const spy = clabStub.ClabCommand.prototype.run as sinon.SinonSpy;
      expect(spy.calledOnce).to.be.true;
      expect(instance.runArgs).to.deep.equal(['-c']); // Cleanup flag
    });

    it('does not run when user cancels warning dialog', async () => {
      vscodeStub.window.lastWarningSelection = undefined; // User cancels

      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      await destroyCleanup(node);

      // Command should not be created if user cancels
      expect(clabStub.instances.length).to.equal(0);
    });

    it('does not create ClabCommand when node is undefined', async () => {
      await destroyCleanup(undefined);

      expect(clabStub.instances.length).to.equal(0);
    });
  });
});
