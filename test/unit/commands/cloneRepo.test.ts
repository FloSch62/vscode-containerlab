/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the cloneRepo commands.
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

// Constants
const TEST_REPO_URL = 'https://github.com/user/test-repo.git';
const TEST_WORKSPACE = '/workspace';
const TEST_HOME = '/home/testuser';

// Mock fs module
let fsExistsCalls: string[] = [];
let fsMkdirCalls: string[] = [];
let fsExistsReturn = true;

const fsMock = {
  existsSync: (p: string) => {
    fsExistsCalls.push(p);
    return fsExistsReturn;
  },
  mkdirSync: (p: string, _opts?: any) => {
    fsMkdirCalls.push(p);
  }
};

// Mock os module
const osMock = {
  homedir: () => TEST_HOME
};

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('utils/utils') || request.endsWith('/utils')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  if (request === 'fs' || request === 'os') {
    return 'MOCK_MODULE';
  }
  return null;
}

// Shared context
let cloneRepoFromUrl: Function;
let cloneRepo: Function;
let vscodeStub: any;
let utilsStub: any;
let originalModuleRequire: any;

function setupCloneRepoTests() {
  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath === 'MOCK_MODULE') {
        return originalResolve.call(this, request, parent, isMain, options);
      }
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    originalModuleRequire = Module.prototype.require;
    (Module.prototype as any).require = function(id: string) {
      if (id === 'fs') {
        return fsMock;
      }
      if (id === 'os') {
        return osMock;
      }
      return originalModuleRequire.call(this, id);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');

    const cloneRepoModule = require('../../../src/commands/cloneRepo');
    cloneRepoFromUrl = cloneRepoModule.cloneRepoFromUrl;
    cloneRepo = cloneRepoModule.cloneRepo;
  });

  after(() => {
    if (originalModuleRequire) {
      Module.prototype.require = originalModuleRequire;
    }
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.clearMocks();
    fsExistsCalls = [];
    fsMkdirCalls = [];
    fsExistsReturn = true;
  });
}

describe('cloneRepoFromUrl() - input handling', () => {
  setupCloneRepoTests();

  it('returns early when no URL provided and user cancels input', async () => {
    vscodeStub.window.inputBoxResult = undefined;

    await cloneRepoFromUrl();

    expect(utilsStub.calls).to.have.length(0);
  });

  it('uses provided URL directly', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(utilsStub.calls).to.have.length(1);
    expect(utilsStub.calls[0]).to.include('git clone');
    expect(utilsStub.calls[0]).to.include(TEST_REPO_URL);
  });

  it('prompts for URL when not provided', async () => {
    vscodeStub.window.inputBoxResult = TEST_REPO_URL;
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl();

    expect(utilsStub.calls).to.have.length(1);
    expect(utilsStub.calls[0]).to.include(TEST_REPO_URL);
  });
});

describe('cloneRepoFromUrl() - destination handling', () => {
  setupCloneRepoTests();

  it('uses workspace folder as base when available', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(utilsStub.calls[0]).to.include(TEST_WORKSPACE);
  });

  it('uses home .clab folder when no workspace', async () => {
    vscodeStub.workspace.workspaceFolders = [];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(utilsStub.calls[0]).to.include('.clab');
  });

  it('creates destination directory if not exists', async () => {
    fsExistsReturn = false;
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(fsExistsCalls).to.have.length(1);
    expect(fsMkdirCalls).to.have.length(1);
  });

  it('extracts repo name from URL', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(utilsStub.calls[0]).to.include('test-repo');
  });

  it('strips .git suffix from repo name', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl('https://github.com/user/my-lab.git');

    // The destination path should contain my-lab (without .git suffix)
    // The URL still contains .git but the destination folder should not end with .git
    expect(utilsStub.calls[0]).to.include('my-lab');
    // Check that the destination path ends with my-lab" not my-lab.git"
    expect(utilsStub.calls[0]).to.match(/my-lab"/);
  });
});

describe('cloneRepoFromUrl() - success and error handling', () => {
  setupCloneRepoTests();

  it('shows success message after clone', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(vscodeStub.window.lastInfoMessage).to.include('Repository cloned to');
  });

  it('executes refresh command after success', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommand(/git clone/, '');

    await cloneRepoFromUrl(TEST_REPO_URL);

    const refreshCmd = vscodeStub.commands.executed.find(
      (c: any) => c.command === 'containerlab.refresh'
    );
    expect(refreshCmd).to.exist;
  });

  it('shows error message when clone fails', async () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: TEST_WORKSPACE } }];
    utilsStub.mockCommandError(/git clone/, new Error('Authentication failed'));

    await cloneRepoFromUrl(TEST_REPO_URL);

    expect(vscodeStub.window.lastErrorMessage).to.include('Git clone failed');
    expect(vscodeStub.window.lastErrorMessage).to.include('Authentication failed');
  });
});

describe('cloneRepo() - menu selection', () => {
  setupCloneRepoTests();

  it('returns when user cancels quick pick', async () => {
    vscodeStub.window.quickPickResult = undefined;

    await cloneRepo();

    expect(utilsStub.calls).to.have.length(0);
  });
});
