/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the packetflix module.
 * Uses module interception to mock vscode and other dependencies.
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
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('edgeshark') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'edgeshark-stub.js');
  }
  return null;
}

// Shared context
let packetflixModule: any;
let vscodeStub: any;

describe('setSessionHostname() - input handling', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    packetflixModule = require('../../../src/utils/packetflix');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns false when user cancels input', async () => {
    vscodeStub.window.inputBoxResult = undefined;
    const result = await packetflixModule.setSessionHostname();
    expect(result).to.be.false;
  });

  it('returns true when user provides hostname', async () => {
    vscodeStub.window.inputBoxResult = '192.168.1.100';
    const result = await packetflixModule.setSessionHostname();
    expect(result).to.be.true;
  });

  it('shows confirmation message after setting hostname', async () => {
    vscodeStub.window.inputBoxResult = 'my-host.local';
    await packetflixModule.setSessionHostname();
    expect(vscodeStub.window.lastInfoMessage).to.include('my-host.local');
  });

  it('trims whitespace from hostname', async () => {
    vscodeStub.window.inputBoxResult = '  hostname  ';
    await packetflixModule.setSessionHostname();
    expect(vscodeStub.window.lastInfoMessage).to.include('hostname');
    expect(vscodeStub.window.lastInfoMessage).to.not.include('  ');
  });
});

describe('getHostname() - config-based hostname', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    packetflixModule = require('../../../src/utils/packetflix');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns configured hostname when set', async () => {
    vscodeStub.setConfigValue('containerlab.capture.remoteHostname', 'configured-host.local');
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('configured-host.local');
  });

  it('returns localhost when no config and not remote', async () => {
    vscodeStub.env.remoteName = undefined;
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('localhost');
  });
});

describe('getHostname() - WSL environment', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    packetflixModule = require('../../../src/utils/packetflix');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns localhost for WSL environment', async () => {
    vscodeStub.env.remoteName = 'wsl';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('localhost');
  });
});

describe('getHostname() - SSH environment', () => {
  let originalSshConnection: string | undefined;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    packetflixModule = require('../../../src/utils/packetflix');
    originalSshConnection = process.env.SSH_CONNECTION;
  });

  after(() => {
    if (originalSshConnection !== undefined) {
      process.env.SSH_CONNECTION = originalSshConnection;
    } else {
      delete process.env.SSH_CONNECTION;
    }
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('extracts IP from SSH_CONNECTION for ssh-remote', async () => {
    vscodeStub.env.remoteName = 'ssh-remote';
    process.env.SSH_CONNECTION = '192.168.1.10 54321 192.168.1.20 22';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('192.168.1.20');
  });

  it('falls back to localhost when SSH_CONNECTION missing', async () => {
    vscodeStub.env.remoteName = 'ssh-remote';
    delete process.env.SSH_CONNECTION;
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('localhost');
  });
});

describe('genPacketflixURI() - error handling', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    packetflixModule = require('../../../src/utils/packetflix');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns undefined for empty nodes array', async () => {
    const result = await packetflixModule.genPacketflixURI([]);
    expect(result).to.be.undefined;
    expect(vscodeStub.window.lastErrorMessage).to.include('No interface');
  });

  it('returns undefined for null/undefined nodes', async () => {
    const result = await packetflixModule.genPacketflixURI(null);
    expect(result).to.be.undefined;
  });
});
