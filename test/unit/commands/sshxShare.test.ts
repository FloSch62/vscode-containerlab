/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for sshxShare.ts - SSHX sharing commands.
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
  if (request.endsWith('/extension') || request.endsWith('\\extension')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('utils/utils') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

const ERR_NO_LAB_ATTACH = 'No lab selected for SSHX attach.';
const ERR_NO_LAB_DETACH = 'No lab selected for SSHX detach.';
const ERR_NO_LAB_REATTACH = 'No lab selected for SSHX reattach.';
const TEST_LAB_NAME = 'test-lab';
const TEST_LAB_PATH = '/test/lab.clab.yml';
const SSHX_LINK_1 = 'https://sshx.io/s/test-session';
const SSHX_LINK_2 = 'https://sshx.io/s/abc123';
const SSHX_LINK_TEST = 'https://sshx.io/s/test';
const MSG_COPY_CLIPBOARD = 'SSHX link copied to clipboard';
const DESC_ERROR_HANDLING = 'error handling';
const IT_ERR_NODE_UNDEFINED = 'shows error when node is undefined';

function createTestNode(name?: string) {
  return name
    ? { name, labPath: { absolute: TEST_LAB_PATH } }
    : { labPath: { absolute: TEST_LAB_PATH } };
}

describe('sshxShare - sshxAttach', () => {
  let sshxShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    utilsStub = require('../../helpers/utils-stub');
    sshxShareModule = require('../../../src/commands/sshxShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
  });

  describe(DESC_ERROR_HANDLING, () => {
    it(IT_ERR_NODE_UNDEFINED, async () => {
      await sshxShareModule.sshxAttach(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_ATTACH);
    });

    it('shows error when node has no name', async () => {
      const node = createTestNode() as any;

      await sshxShareModule.sshxAttach(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_ATTACH);
    });

    it('shows error on command failure', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommandError(/sshx attach/, new Error('Connection failed'));

      await sshxShareModule.sshxAttach(node);

      expect(vscodeStub.window.lastErrorMessage).to.include('Failed to attach SSHX');
    });
  });

  describe('successful attach', () => {
    it('runs SSHX attach command successfully', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/sshx attach/, SSHX_LINK_1);

      await sshxShareModule.sshxAttach(node);

      expect(utilsStub.calls.length).to.be.greaterThan(0);
      expect(utilsStub.calls[0]).to.include('sshx attach');
      expect(extensionStub.sshxSessions.get(TEST_LAB_NAME)).to.equal(SSHX_LINK_1);
    });

    it('copies link to clipboard on success', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/sshx attach/, `Session started at ${SSHX_LINK_2}`);

      await sshxShareModule.sshxAttach(node);

      expect(vscodeStub.env.clipboard.lastText).to.equal(SSHX_LINK_2);
    });

    it('shows info message when no link found', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/sshx attach/, 'Session started but no URL');

      await sshxShareModule.sshxAttach(node);

      expect(vscodeStub.window.lastInfoMessage).to.include('SSHX session started');
    });
  });
});

describe('sshxShare - sshxDetach', () => {
  let sshxShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    utilsStub = require('../../helpers/utils-stub');
    sshxShareModule = require('../../../src/commands/sshxShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
  });

  describe(DESC_ERROR_HANDLING, () => {
    it(IT_ERR_NODE_UNDEFINED, async () => {
      await sshxShareModule.sshxDetach(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_DETACH);
    });

    it('shows error when node has no name', async () => {
      const node = createTestNode() as any;

      await sshxShareModule.sshxDetach(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_DETACH);
    });

    it('shows error on command failure', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommandError(/sshx detach/, new Error('Detach failed'));

      await sshxShareModule.sshxDetach(node);

      expect(vscodeStub.window.lastErrorMessage).to.include('Failed to detach SSHX');
    });
  });

  describe('successful detach', () => {
    it('runs SSHX detach command successfully', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      extensionStub.sshxSessions.set(TEST_LAB_NAME, 'https://sshx.io/s/abc');
      utilsStub.mockCommand(/sshx detach/, 'Session detached');

      await sshxShareModule.sshxDetach(node);

      expect(utilsStub.calls[0]).to.include('sshx detach');
      expect(extensionStub.sshxSessions.has(TEST_LAB_NAME)).to.be.false;
      expect(vscodeStub.window.lastInfoMessage).to.equal('SSHX session detached');
    });
  });
});

describe('sshxShare - sshxReattach and sshxCopyLink', () => {
  let sshxShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    utilsStub = require('../../helpers/utils-stub');
    sshxShareModule = require('../../../src/commands/sshxShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
  });

  describe('sshxReattach()', () => {
    it(IT_ERR_NODE_UNDEFINED, async () => {
      await sshxShareModule.sshxReattach(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_REATTACH);
    });

    it('runs SSHX reattach command successfully', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/sshx reattach/, 'https://sshx.io/s/reattached');

      await sshxShareModule.sshxReattach(node);

      expect(utilsStub.calls[0]).to.include('sshx reattach');
      expect(extensionStub.sshxSessions.get(TEST_LAB_NAME)).to.equal('https://sshx.io/s/reattached');
    });

    it('shows different info message for reattach when no link found', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/sshx reattach/, 'no url here');

      await sshxShareModule.sshxReattach(node);

      expect(vscodeStub.window.lastInfoMessage).to.include('SSHX session reattached');
    });
  });

  describe('sshxCopyLink()', () => {
    it('copies link to clipboard', () => {
      sshxShareModule.sshxCopyLink(SSHX_LINK_TEST);

      expect(vscodeStub.env.clipboard.lastText).to.equal(SSHX_LINK_TEST);
    });

    it('shows info message', () => {
      sshxShareModule.sshxCopyLink(SSHX_LINK_TEST);

      expect(vscodeStub.window.lastInfoMessage).to.equal(MSG_COPY_CLIPBOARD);
    });
  });
});
