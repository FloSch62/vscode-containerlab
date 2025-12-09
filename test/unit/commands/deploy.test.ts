/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the `deploy` command.
 *
 * The suite verifies that a {@link ClabCommand} instance receives the
 * correct arguments when deploying a topology. By stubbing the `vscode`
 * module and the command implementation we can exercise the logic in a
 * plain Node environment without invoking containerlab.
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
  if (request.includes('deployPopular') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'deployPopular-stub.js');
  }
  return null;
}

const TEST_LAB_PATH = '/home/user/lab.yml';
const TEST_CLAB_PATH = '/home/user/test.clab.yml';
const GITHUB_URL = 'https://github.com/user/repo';
const MODE_SELECT_FILE = 'Select local file';
const MODE_ENTER_URL = 'Enter Git/HTTP URL';

// Shared test context
let deploy: Function;
let deployCleanup: Function;
let deploySpecificFile: Function;
let clabStub: any;
let vscodeStub: any;

function setupDeployTests() {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    clabStub = require('../../helpers/clabCommand-stub');
    vscodeStub = require('../../helpers/vscode-stub');
    const deployModule = require('../../../src/commands/deploy');
    deploy = deployModule.deploy;
    deployCleanup = deployModule.deployCleanup;
    deploySpecificFile = deployModule.deploySpecificFile;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    clabStub.instances.length = 0;
    vscodeStub.window.lastErrorMessage = '';
    vscodeStub.window.lastInfoMessage = '';
    vscodeStub.window.quickPickResult = undefined;
    vscodeStub.window.inputBoxResult = undefined;
    vscodeStub.window.openDialogResult = undefined;
    sinon.spy(clabStub.ClabCommand.prototype, 'run');
  });

  afterEach(() => {
    sinon.restore();
  });
}

describe('deploy command', () => {
  setupDeployTests();

  describe('deploy()', () => {
    it('creates ClabCommand and runs it', async () => {
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      await deploy(node);

      expect(clabStub.instances.length).to.equal(1);
      const instance = clabStub.instances[0];
      expect(instance.action).to.equal('deploy');
      expect(instance.node).to.equal(node);
      expect(instance.spinnerMessages.progressMsg).to.equal('Deploying Lab... ');
      expect(instance.spinnerMessages.successMsg).to.equal('Lab deployed successfully!');

      const spy = clabStub.ClabCommand.prototype.run as sinon.SinonSpy;
      expect(spy.calledOnceWithExactly()).to.be.true;
      expect(instance.runArgs).to.be.undefined;
    });

    it('does nothing when node is undefined (early return)', async () => {
      await deploy(undefined);
      expect(clabStub.instances.length).to.equal(0);
    });
  });

  describe('deployCleanup()', () => {
    it('creates ClabCommand with cleanup flag', async () => {
      vscodeStub.window.lastWarningSelection = 'Yes';
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      await deployCleanup(node);

      expect(clabStub.instances.length).to.equal(1);
      const instance = clabStub.instances[0];
      expect(instance.action).to.equal('deploy');
      expect(instance.runArgs).to.deep.equal(['-c']);
    });

    it('does nothing when user cancels warning dialog', async () => {
      vscodeStub.window.lastWarningSelection = undefined;
      const node = { labPath: { absolute: TEST_LAB_PATH } } as any;
      await deployCleanup(node);

      expect(clabStub.instances.length).to.equal(0);
    });
  });
});

describe('deploySpecificFile command', () => {
  setupDeployTests();

  describe('mode selection', () => {
    it('does nothing when user cancels mode selection', async () => {
      vscodeStub.window.quickPickResult = undefined;
      await deploySpecificFile();

      expect(clabStub.instances.length).to.equal(0);
    });
  });

  describe('local file mode', () => {
    it('opens file dialog for local file selection', async () => {
      vscodeStub.window.quickPickResult = MODE_SELECT_FILE;
      vscodeStub.window.openDialogResult = [{ fsPath: TEST_CLAB_PATH }];
      await deploySpecificFile();

      expect(clabStub.instances.length).to.equal(1);
      expect(clabStub.instances[0].node.labPath.absolute).to.equal(TEST_CLAB_PATH);
    });

    it('does nothing when file dialog is cancelled', async () => {
      vscodeStub.window.quickPickResult = MODE_SELECT_FILE;
      vscodeStub.window.openDialogResult = undefined;
      await deploySpecificFile();

      expect(clabStub.instances.length).to.equal(0);
    });

    it('does nothing when file dialog returns empty array', async () => {
      vscodeStub.window.quickPickResult = MODE_SELECT_FILE;
      vscodeStub.window.openDialogResult = [];
      await deploySpecificFile();

      expect(clabStub.instances.length).to.equal(0);
    });
  });

  describe('URL mode', () => {
    it('prompts for URL when Git/HTTP URL mode selected', async () => {
      vscodeStub.window.quickPickResult = MODE_ENTER_URL;
      vscodeStub.window.inputBoxResult = GITHUB_URL;
      await deploySpecificFile();

      expect(clabStub.instances.length).to.equal(1);
      expect(clabStub.instances[0].node.labPath.absolute).to.equal(GITHUB_URL);
    });

    it('does nothing when URL input is cancelled', async () => {
      vscodeStub.window.quickPickResult = MODE_ENTER_URL;
      vscodeStub.window.inputBoxResult = undefined;
      await deploySpecificFile();

      expect(clabStub.instances.length).to.equal(0);
    });
  });
});
