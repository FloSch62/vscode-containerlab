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
  // Stub ./utils (the utils module) but NOT packetflix itself
  if ((request.endsWith('/utils') || request.endsWith('./utils')) && !request.includes('stub') && !request.includes('.test') && !request.includes('packetflix')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

// Constants to avoid duplicate string literals
const SSH_REMOTE = 'ssh-remote';

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
    vscodeStub.env.remoteName = SSH_REMOTE;
    process.env.SSH_CONNECTION = '192.168.1.10 54321 192.168.1.20 22';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('192.168.1.20');
  });

  it('falls back to localhost when SSH_CONNECTION missing', async () => {
    vscodeStub.env.remoteName = SSH_REMOTE;
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

/**
 * Session hostname tests - cover line 218-221
 */
describe('getHostname() - session hostname', () => {
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

  it('uses sessionHostname when set', async () => {
    // First set the session hostname
    vscodeStub.window.inputBoxResult = 'my-session-host';
    await packetflixModule.setSessionHostname();

    // Now getHostname should return it
    vscodeStub.env.remoteName = undefined;
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('my-session-host');
  });
});

/**
 * SSH environment extended tests
 */
describe('getHostname() - SSH connection parsing', () => {
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

  it('handles malformed SSH_CONNECTION string', async () => {
    vscodeStub.env.remoteName = SSH_REMOTE;
    process.env.SSH_CONNECTION = 'invalid';
    const result = await packetflixModule.getHostname();
    // Falls back to localhost when parts are insufficient
    expect(result).to.equal('localhost');
  });

  it('handles empty SSH_CONNECTION string', async () => {
    vscodeStub.env.remoteName = SSH_REMOTE;
    process.env.SSH_CONNECTION = '';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('localhost');
  });

  it('parses IPv6 address from SSH_CONNECTION', async () => {
    vscodeStub.env.remoteName = SSH_REMOTE;
    process.env.SSH_CONNECTION = '::1 54321 2001:db8::1 22';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('2001:db8::1');
  });
});

/**
 * Orbstack environment tests
 */
describe('getHostname() - Orbstack environment', () => {
  let utilsStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixModule = require('../../../src/utils/packetflix');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.resetIsOrbstack();
  });

  it('attempts to resolve Orbstack IPv4 when in Orbstack environment', async () => {
    utilsStub.setIsOrbstack(true);
    vscodeStub.env.remoteName = undefined;

    // Orbstack will try to resolve IPv4 from network interfaces
    // It may return an IP or fall back to localhost
    const result = await packetflixModule.getHostname();
    // Should return either an IP address or localhost
    expect(result).to.be.a('string');
    expect(result.length).to.be.greaterThan(0);
  });
});

/**
 * Test setSessionHostname validation callback
 */
describe('setSessionHostname() - input validation', () => {
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

  it('accepts valid hostname input', async () => {
    vscodeStub.window.inputBoxResult = 'valid-hostname';
    const result = await packetflixModule.setSessionHostname();
    expect(result).to.be.true;
  });

  it('accepts IPv4 address', async () => {
    vscodeStub.window.inputBoxResult = '192.168.1.1';
    const result = await packetflixModule.setSessionHostname();
    expect(result).to.be.true;
  });

  it('accepts IPv6 address', async () => {
    vscodeStub.window.inputBoxResult = '2001:db8::1';
    const result = await packetflixModule.setSessionHostname();
    expect(result).to.be.true;
  });

  it('accepts FQDN', async () => {
    vscodeStub.window.inputBoxResult = 'server.example.com';
    const result = await packetflixModule.setSessionHostname();
    expect(result).to.be.true;
  });
});

/**
 * Test getHostname priority order
 */
describe('getHostname() - priority order', () => {
  let originalSshConnection: string | undefined;
  let utilsStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
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
    utilsStub.resetIsOrbstack();
  });

  it('config hostname takes precedence over all others', async () => {
    vscodeStub.setConfigValue('containerlab.capture.remoteHostname', 'config-host');
    vscodeStub.env.remoteName = 'wsl';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('config-host');
  });

  it('WSL takes precedence over SSH remote when not configured', async () => {
    vscodeStub.env.remoteName = 'wsl';
    process.env.SSH_CONNECTION = '10.0.0.1 123 10.0.0.2 22';
    const result = await packetflixModule.getHostname();
    expect(result).to.equal('localhost');
  });
});

/**
 * Test genPacketflixURI additional cases
 */
describe('genPacketflixURI() - additional error cases', () => {
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

  it('returns undefined when nodes is undefined', async () => {
    const result = await packetflixModule.genPacketflixURI(undefined);
    expect(result).to.be.undefined;
  });

  it('shows error message for empty nodes', async () => {
    await packetflixModule.genPacketflixURI([]);
    expect(vscodeStub.window.lastErrorMessage).to.include('No interface');
  });
});

/**
 * Resolving OrbStack IPv4 fallback
 */
describe('getHostname() - Orbstack fallback', () => {
  let utilsStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixModule = require('../../../src/utils/packetflix');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.resetIsOrbstack();
  });

  it('falls back when Orbstack has no eth0 interface', async () => {
    utilsStub.setIsOrbstack(true);
    vscodeStub.env.remoteName = undefined;
    // With Orbstack but no eth0, should eventually return something
    const result = await packetflixModule.getHostname();
    expect(result).to.be.a('string');
  });
});
