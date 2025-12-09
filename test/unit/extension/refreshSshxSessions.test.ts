/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import Module from 'module';
import path from 'path';

// Constants for repeated test data
const TEST_OWNER = 'tester';
const CLAB_NETWORK = 'clab';
const RUNNING_STATE = 'running';
const EXITED_STATE = 'exited';
const VSCODE_STUB_PATH = 'vscode-stub.js';
const UTILS_STUB_PATH = 'utils-stub.js';
const PACKETFLIX_STUB_PATH = 'packetflix-stub.js';
const SSHX_LAB1_NAME = 'clab-lab1-sshx';
const GOTTY_LAB1_NAME = 'clab-lab1-gotty';

// Shared helper to clear module cache
function clearModuleCache(): void {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// =============================================================================
// refreshSshxSessions Tests - Basic Parsing
// =============================================================================

describe('refreshSshxSessions - parsing', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshSshxSessions: () => Promise<void>;
  let sshxSessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    extension = require('../../../src/extension');
    refreshSshxSessions = extension.refreshSshxSessions;
    sshxSessions = extension.sshxSessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    sshxSessions.clear();
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('parses sessions from container name when network lacks prefix', async () => {
    const sample = JSON.stringify([
      { name: 'clab-atest-sshx', network: CLAB_NETWORK, state: RUNNING_STATE, link: 'https://sshx.io/s/ABC', owner: TEST_OWNER },
      { name: 'sshx-clab', network: CLAB_NETWORK, state: EXITED_STATE, link: 'N/A', owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshSshxSessions();
    expect(utilsStub.calls[0]).to.contain('containerlab tools sshx list -f json');
    expect(sshxSessions.size).to.equal(1);
    expect(sshxSessions.get('atest')).to.equal('https://sshx.io/s/ABC');
  });

  it('parses sessions from network name when network starts with clab-', async () => {
    const sample = JSON.stringify([
      { name: 'some-container', network: 'clab-mylab', state: RUNNING_STATE, link: 'https://sshx.io/s/ABC123', owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(1);
    expect(sshxSessions.get('mylab')).to.equal('https://sshx.io/s/ABC123');
  });

  it('parses sessions with sshx- prefix', async () => {
    const sample = JSON.stringify([
      { name: 'sshx-labname', network: 'bridge', state: RUNNING_STATE, link: 'https://sshx.io/s/XYZ789', owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(1);
    expect(sshxSessions.get('labname')).to.equal('https://sshx.io/s/XYZ789');
  });

  it('handles multiple valid sessions', async () => {
    const sample = JSON.stringify([
      { name: SSHX_LAB1_NAME, network: CLAB_NETWORK, state: RUNNING_STATE, link: 'https://sshx.io/s/link1', owner: TEST_OWNER },
      { name: 'clab-lab2-sshx', network: CLAB_NETWORK, state: RUNNING_STATE, link: 'https://sshx.io/s/link2', owner: TEST_OWNER },
      { name: 'clab-lab3-sshx', network: CLAB_NETWORK, state: EXITED_STATE, link: 'N/A', owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(2);
    expect(sshxSessions.get('lab1')).to.equal('https://sshx.io/s/link1');
    expect(sshxSessions.get('lab2')).to.equal('https://sshx.io/s/link2');
  });
});

// =============================================================================
// refreshSshxSessions Tests - Filtering and Edge Cases
// =============================================================================

describe('refreshSshxSessions - filtering', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshSshxSessions: () => Promise<void>;
  let sshxSessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    extension = require('../../../src/extension');
    refreshSshxSessions = extension.refreshSshxSessions;
    sshxSessions = extension.sshxSessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    sshxSessions.clear();
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('skips sessions with N/A link', async () => {
    const sample = JSON.stringify([
      { name: SSHX_LAB1_NAME, network: CLAB_NETWORK, state: EXITED_STATE, link: 'N/A', owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(0);
  });

  it('skips sessions without link', async () => {
    const sample = JSON.stringify([
      { name: SSHX_LAB1_NAME, network: CLAB_NETWORK, state: RUNNING_STATE, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(0);
  });

  it('clears previous sessions before refreshing', async () => {
    sshxSessions.set('oldlab', 'https://old.link');
    utilsStub.setOutput('[]');
    await refreshSshxSessions();
    expect(sshxSessions.has('oldlab')).to.be.false;
  });
});

// =============================================================================
// refreshSshxSessions Tests - Error Handling
// =============================================================================

describe('refreshSshxSessions - error handling', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshSshxSessions: () => Promise<void>;
  let sshxSessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    extension = require('../../../src/extension');
    refreshSshxSessions = extension.refreshSshxSessions;
    sshxSessions = extension.sshxSessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    sshxSessions.clear();
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('handles empty response', async () => {
    utilsStub.setOutput('');
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(0);
  });

  it('handles empty array response', async () => {
    utilsStub.setOutput('[]');
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(0);
  });

  it('handles command error gracefully', async () => {
    utilsStub.mockCommandError(/sshx list/, new Error('Command failed'));
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(0);
  });

  it('handles invalid JSON gracefully', async () => {
    utilsStub.setOutput('not valid json');
    await refreshSshxSessions();
    expect(sshxSessions.size).to.equal(0);
  });
});

// =============================================================================
// refreshGottySessions Tests - Basic Parsing
// =============================================================================

describe('refreshGottySessions - parsing', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshGottySessions: () => Promise<void>;
  let gottySessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let packetflixStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      if (request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', PACKETFLIX_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');
    extension = require('../../../src/extension');
    refreshGottySessions = extension.refreshGottySessions;
    gottySessions = extension.gottySessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    gottySessions.clear();
    packetflixStub.resetPacketflixStub();
    packetflixStub.setHostname('localhost');
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('parses sessions from gotty list output', async () => {
    const sample = JSON.stringify([
      { name: 'clab-mylab-gotty', network: CLAB_NETWORK, state: RUNNING_STATE, port: 8080, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(utilsStub.calls[0]).to.contain('containerlab tools gotty list -f json');
    expect(gottySessions.size).to.equal(1);
  });

  it('uses network name when it starts with clab-', async () => {
    const sample = JSON.stringify([
      { name: 'some-container', network: 'clab-networklab', state: RUNNING_STATE, port: 9000, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(1);
    expect(gottySessions.get('networklab')).to.include('9000');
  });

  it('uses gotty- prefix pattern', async () => {
    const sample = JSON.stringify([
      { name: 'gotty-testlab', network: 'bridge', state: RUNNING_STATE, port: 8888, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(1);
    expect(gottySessions.get('testlab')).to.include('8888');
  });

  it('handles multiple valid sessions', async () => {
    const sample = JSON.stringify([
      { name: GOTTY_LAB1_NAME, network: CLAB_NETWORK, state: RUNNING_STATE, port: 8080, owner: TEST_OWNER },
      { name: 'clab-lab2-gotty', network: CLAB_NETWORK, state: RUNNING_STATE, port: 8081, owner: TEST_OWNER },
      { name: 'clab-lab3-gotty', network: CLAB_NETWORK, state: EXITED_STATE, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(2);
    expect(gottySessions.get('lab1')).to.include('8080');
    expect(gottySessions.get('lab2')).to.include('8081');
  });
});

// =============================================================================
// refreshGottySessions Tests - Hostname Handling
// =============================================================================

describe('refreshGottySessions - hostname', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshGottySessions: () => Promise<void>;
  let gottySessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let packetflixStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      if (request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', PACKETFLIX_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');
    extension = require('../../../src/extension');
    refreshGottySessions = extension.refreshGottySessions;
    gottySessions = extension.gottySessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    gottySessions.clear();
    packetflixStub.resetPacketflixStub();
    packetflixStub.setHostname('localhost');
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('handles IPv6 hostname with brackets', async () => {
    packetflixStub.setHostname('::1');
    const sample = JSON.stringify([
      { name: GOTTY_LAB1_NAME, network: CLAB_NETWORK, state: RUNNING_STATE, port: 8080, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(1);
    // IPv6 addresses should be bracketed
    expect(gottySessions.get('lab1')).to.include('[::1]');
  });

  it('handles custom hostname', async () => {
    packetflixStub.setHostname('myhost.example.com');
    const sample = JSON.stringify([
      { name: GOTTY_LAB1_NAME, network: CLAB_NETWORK, state: RUNNING_STATE, port: 8080, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(1);
    expect(gottySessions.get('lab1')).to.include('myhost.example.com');
  });
});

// =============================================================================
// refreshGottySessions Tests - Filtering and Error Handling
// =============================================================================

describe('refreshGottySessions - filtering', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshGottySessions: () => Promise<void>;
  let gottySessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let packetflixStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      if (request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', PACKETFLIX_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');
    extension = require('../../../src/extension');
    refreshGottySessions = extension.refreshGottySessions;
    gottySessions = extension.gottySessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    gottySessions.clear();
    packetflixStub.resetPacketflixStub();
    packetflixStub.setHostname('localhost');
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('skips sessions without port', async () => {
    const sample = JSON.stringify([
      { name: GOTTY_LAB1_NAME, network: CLAB_NETWORK, state: EXITED_STATE, owner: TEST_OWNER }
    ]);
    utilsStub.setOutput(sample);
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(0);
  });

  it('clears previous sessions before refreshing', async () => {
    const testHttpUrl = ['http', '://', 'localhost:9999'].join('');
    gottySessions.set('oldlab', testHttpUrl);
    utilsStub.setOutput('[]');
    await refreshGottySessions();
    expect(gottySessions.has('oldlab')).to.be.false;
  });
});

describe('refreshGottySessions - errors', () => {
  const originalResolve = (Module as any)._resolveFilename;
  let refreshGottySessions: () => Promise<void>;
  let gottySessions: Map<string, string>;
  let utilsStub: any;
  let vscodeStub: any;
  let packetflixStub: any;
  let extension: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      if (request === 'vscode') {
        return path.join(__dirname, '..', '..', 'helpers', VSCODE_STUB_PATH);
      }
      if (request.includes('utils') && !request.includes('stub') && !request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', UTILS_STUB_PATH);
      }
      if (request.includes('packetflix')) {
        return path.join(__dirname, '..', '..', 'helpers', PACKETFLIX_STUB_PATH);
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    utilsStub = require('../../helpers/utils-stub');
    packetflixStub = require('../../helpers/packetflix-stub');
    extension = require('../../../src/extension');
    refreshGottySessions = extension.refreshGottySessions;
    gottySessions = extension.gottySessions;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.calls.length = 0;
    utilsStub.clearMocks();
    gottySessions.clear();
    packetflixStub.resetPacketflixStub();
    packetflixStub.setHostname('localhost');
    (extension as any).outputChannel = vscodeStub.window.createOutputChannel('test', { log: true });
  });

  afterEach(() => {
    sinon.restore();
  });

  it('handles empty response', async () => {
    utilsStub.setOutput('');
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(0);
  });

  it('handles empty array response', async () => {
    utilsStub.setOutput('[]');
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(0);
  });

  it('handles command error gracefully', async () => {
    utilsStub.mockCommandError(/gotty list/, new Error('Command failed'));
    await refreshGottySessions();
    expect(gottySessions.size).to.equal(0);
  });
});
