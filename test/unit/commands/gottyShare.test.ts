/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for gottyShare.ts - GoTTY sharing commands.
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
  // Stub the capture module for getHostname
  if ((request.endsWith('/capture') || request.endsWith('\\capture')) && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'packetflix-stub.js');
  }
  return null;
}

const ERR_NO_LAB_ATTACH = 'No lab selected for GoTTY attach.';
const ERR_NO_LAB_DETACH = 'No lab selected for GoTTY detach.';
const ERR_NO_LAB_REATTACH = 'No lab selected for GoTTY reattach.';
const TEST_LAB_NAME = 'test-lab';
const TEST_LAB_PATH = '/test/lab.clab.yml';
const GOTTY_URL_LOCALHOST = 'https://localhost:8080';
const GOTTY_URL_IP = 'https://192.168.1.1:8080';
const MSG_COPY_CLIPBOARD = 'GoTTY link copied to clipboard';
const IT_ERR_NODE_UNDEFINED = 'shows error when node is undefined';

function createTestNode(name?: string) {
  return name
    ? { name, labPath: { absolute: TEST_LAB_PATH } }
    : { labPath: { absolute: TEST_LAB_PATH } };
}

describe('gottyAttach - error handling', () => {
  let gottyShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;
  let packetflixStub: any;

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
    packetflixStub = require('../../helpers/packetflix-stub');
    gottyShareModule = require('../../../src/commands/gottyShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
    packetflixStub.resetPacketflixStub();
  });

  it(IT_ERR_NODE_UNDEFINED, async () => {
    await gottyShareModule.gottyAttach(undefined);

    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_ATTACH);
  });

  it('shows error when node has no name', async () => {
    const node = createTestNode() as any;

    await gottyShareModule.gottyAttach(node);

    expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_ATTACH);
  });

  it('shows error on command failure', async () => {
    const node = createTestNode(TEST_LAB_NAME) as any;
    utilsStub.mockCommandError(/gotty attach/, new Error('Connection failed'));

    await gottyShareModule.gottyAttach(node);

    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to attach GoTTY');
  });
});

describe('gottyAttach - successful attach', () => {
  let gottyShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;
  let packetflixStub: any;

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
    packetflixStub = require('../../helpers/packetflix-stub');
    gottyShareModule = require('../../../src/commands/gottyShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
    packetflixStub.resetPacketflixStub();
  });

  it('runs GoTTY attach command successfully', async () => {
    const node = createTestNode(TEST_LAB_NAME) as any;
    utilsStub.mockCommand(/gotty attach/, GOTTY_URL_LOCALHOST);

    await gottyShareModule.gottyAttach(node);

    expect(utilsStub.calls.length).to.be.greaterThan(0);
    expect(utilsStub.calls[0]).to.include('gotty attach');
  });

  it('parses link from JSON output', async () => {
    const node = createTestNode(TEST_LAB_NAME) as any;
    // JSON output format with port
    utilsStub.mockCommand(/gotty attach/, '[{"port": 9090}]');

    await gottyShareModule.gottyAttach(node);

    expect(extensionStub.gottySessions.has(TEST_LAB_NAME)).to.be.true;
    expect(extensionStub.gottySessions.get(TEST_LAB_NAME)).to.include('9090');
  });

  it('copies link to clipboard on success', async () => {
    const node = createTestNode(TEST_LAB_NAME) as any;
    utilsStub.mockCommand(/gotty attach/, GOTTY_URL_IP);

    await gottyShareModule.gottyAttach(node);

    expect(vscodeStub.env.clipboard.lastText).to.include('https://');
  });

  it('shows info message when no link found', async () => {
    const node = createTestNode(TEST_LAB_NAME) as any;
    utilsStub.mockCommand(/gotty attach/, 'Session started but no URL');

    await gottyShareModule.gottyAttach(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('GoTTY session started');
  });

  it('handles HOST_IP placeholder in URL', async () => {
    const node = createTestNode(TEST_LAB_NAME) as any;
    utilsStub.mockCommand(/gotty attach/, 'https://HOST_IP:8080');
    packetflixStub.setHostname('192.168.1.100');

    await gottyShareModule.gottyAttach(node);

    // Should replace HOST_IP with actual hostname
    expect(extensionStub.gottySessions.get(TEST_LAB_NAME)).to.include('192.168.1.100');
  });
});

describe('gottyShare - gottyDetach', () => {
  let gottyShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;
  let packetflixStub: any;

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
    packetflixStub = require('../../helpers/packetflix-stub');
    gottyShareModule = require('../../../src/commands/gottyShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
    packetflixStub.resetPacketflixStub();
  });

  describe('error handling', () => {
    it(IT_ERR_NODE_UNDEFINED, async () => {
      await gottyShareModule.gottyDetach(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_DETACH);
    });

    it('shows error when node has no name', async () => {
      const node = createTestNode() as any;

      await gottyShareModule.gottyDetach(node);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_DETACH);
    });

    it('shows error on command failure', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommandError(/gotty detach/, new Error('Detach failed'));

      await gottyShareModule.gottyDetach(node);

      expect(vscodeStub.window.lastErrorMessage).to.include('Failed to detach GoTTY');
    });
  });

  describe('successful detach', () => {
    it('runs GoTTY detach command successfully', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      extensionStub.gottySessions.set(TEST_LAB_NAME, GOTTY_URL_LOCALHOST);
      utilsStub.mockCommand(/gotty detach/, 'Session detached');

      await gottyShareModule.gottyDetach(node);

      expect(utilsStub.calls[0]).to.include('gotty detach');
      expect(extensionStub.gottySessions.has(TEST_LAB_NAME)).to.be.false;
      expect(vscodeStub.window.lastInfoMessage).to.equal('GoTTY session detached');
    });
  });
});

describe('gottyShare - gottyReattach and gottyCopyLink', () => {
  let gottyShareModule: any;
  let vscodeStub: any;
  let extensionStub: any;
  let utilsStub: any;
  let packetflixStub: any;

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
    packetflixStub = require('../../helpers/packetflix-stub');
    gottyShareModule = require('../../../src/commands/gottyShare');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    utilsStub.clearMocks();
    packetflixStub.resetPacketflixStub();
  });

  describe('gottyReattach()', () => {
    it(IT_ERR_NODE_UNDEFINED, async () => {
      await gottyShareModule.gottyReattach(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_LAB_REATTACH);
    });

    it('runs GoTTY reattach command successfully', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/gotty reattach/, GOTTY_URL_LOCALHOST);

      await gottyShareModule.gottyReattach(node);

      expect(utilsStub.calls[0]).to.include('gotty reattach');
    });

    it('shows different info message for reattach when no link found', async () => {
      const node = createTestNode(TEST_LAB_NAME) as any;
      utilsStub.mockCommand(/gotty reattach/, 'no url here');

      await gottyShareModule.gottyReattach(node);

      expect(vscodeStub.window.lastInfoMessage).to.include('GoTTY session reattached');
    });
  });

  describe('gottyCopyLink()', () => {
    it('copies link to clipboard', () => {
      gottyShareModule.gottyCopyLink(GOTTY_URL_LOCALHOST);

      expect(vscodeStub.env.clipboard.lastText).to.equal(GOTTY_URL_LOCALHOST);
    });

    it('shows info message', () => {
      gottyShareModule.gottyCopyLink(GOTTY_URL_LOCALHOST);

      expect(vscodeStub.window.lastInfoMessage).to.equal(MSG_COPY_CLIPBOARD);
    });
  });
});
