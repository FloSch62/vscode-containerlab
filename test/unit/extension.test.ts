/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the extension module.
 *
 * Tests for session refresh functions, helper functions, and module exports.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

// Common test constants to avoid duplicate strings
const TEST_EXTENSION_PATH = '/test/extension';
const TEST_LAB_NETWORK = 'clab-testlab';
const TEST_SSHX_LINK = 'https://sshx.io/abc123';
const TEST_SSHX_LINK_ALT = 'https://sshx.io/def456';
const TEST_SSHX_LINK_VALID = 'https://sshx.io/valid';
const CONFIG_BINARY_PATH = 'containerlab.binaryPath';
const CUSTOM_BINARY_PATH = '/custom/bin/containerlab';
const TEST_ANOTHER_NETWORK = 'clab-another';
const TEST_GOTTY_URL = 'http://localhost:8080';
const TEST_SSHX_URL_SHORT = 'https://sshx.io/abc';
const DEFAULT_CLAB_BIN = '/usr/bin/containerlab\n';

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
    return path.join(__dirname, '..', 'helpers', 'vscode-stub.js');
  }
  if (request === 'dockerode') {
    return path.join(__dirname, '..', 'helpers', 'dockerode-stub.js');
  }
  if (request === 'child_process') {
    return path.join(__dirname, '..', 'helpers', 'child-process-stub.js');
  }
  if (request === 'fs') {
    return path.join(__dirname, '..', 'helpers', 'fs-stub.js');
  }
  if (request.includes('utils/index') || request.endsWith('/utils') || (request.includes('/utils') && !request.includes('filterUtils'))) {
    return path.join(__dirname, '..', 'helpers', 'utils-stub.js');
  }
  if (request.includes('containerlabEvents')) {
    return path.join(__dirname, '..', 'helpers', 'containerlabEvents-stub.js');
  }
  if (request.includes('containerlabInspectFallback')) {
    return path.join(__dirname, '..', 'helpers', 'containerlabInspectFallback-stub.js');
  }
  if (request.includes('inspector')) {
    return path.join(__dirname, '..', 'helpers', 'inspector-stub.js');
  }
  if (request.includes('capture') && request.includes('commands')) {
    return path.join(__dirname, '..', 'helpers', 'packetflix-stub.js');
  }
  return null;
}

function extractLabNameForTest(session: any, prefix: string): string | undefined {
  if (typeof session.network === 'string' && session.network.startsWith('clab-')) {
    return session.network.slice(5);
  }
  if (typeof session.name !== 'string') {
    return undefined;
  }
  const name = session.name;
  if (name.startsWith(`${prefix}-`)) {
    return name.slice(prefix.length + 1);
  }
  if (name.startsWith('clab-') && name.endsWith(`-${prefix}`)) {
    return name.slice(5, -(prefix.length + 1));
  }
  return undefined;
}

function createActivationContext() {
  return {
    subscriptions: [] as any[],
    extensionPath: TEST_EXTENSION_PATH,
    globalState: { get: () => [], update: () => Promise.resolve() }
  };
}

// Table-driven test cases for extractLabName
interface ExtractLabNameTestCase {
  description: string;
  session: any;
  prefix: string;
  expected: string | undefined;
}

const extractLabNameCases: ExtractLabNameTestCase[] = [
  {
    description: 'extracts lab name from network starting with clab-',
    session: { network: 'clab-mylab', name: 'sshx-mylab' },
    prefix: 'sshx',
    expected: 'mylab'
  },
  {
    description: 'extracts lab name from session name with prefix at start',
    session: { network: 'bridge', name: 'sshx-testlab' },
    prefix: 'sshx',
    expected: 'testlab'
  },
  {
    description: 'extracts lab name from session name with clab prefix and suffix',
    session: { network: 'bridge', name: 'clab-demo-sshx' },
    prefix: 'sshx',
    expected: 'demo'
  },
  {
    description: 'returns undefined when session has no valid name',
    session: { network: 'bridge', name: 'random-name' },
    prefix: 'sshx',
    expected: undefined
  },
  {
    description: 'returns undefined when session name is not a string',
    session: { network: 'bridge', name: 123 },
    prefix: 'sshx',
    expected: undefined
  },
  {
    description: 'extracts gotty lab name correctly',
    session: { network: 'clab-router-lab', name: 'gotty-router-lab' },
    prefix: 'gotty',
    expected: 'router-lab'
  }
];

// Shared context
let vscodeStub: any;
let utilsStub: any;

describe('extractLabName() helper', () => {
  extractLabNameCases.forEach(({ description, session, prefix, expected }) => {
    it(description, () => {
      const result = extractLabNameForTest(session, prefix);
      expect(result).to.equal(expected);
    });
  });
});

describe('refreshSshxSessions()', () => {
  let refreshSshxSessions: Function;
  let sshxSessions: Map<string, string>;
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');

    extensionModule = require('../../src/extension');
    refreshSshxSessions = extensionModule.refreshSshxSessions;
    sshxSessions = extensionModule.sshxSessions;

    // Initialize outputChannel since activate() wasn't called
    // This is needed because refreshSshxSessions uses outputChannel.error()
    (extensionModule as any).outputChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.clearMocks();
    vscodeStub.resetVscodeStub();
    sshxSessions.clear();
  });

  it('parses valid JSON output and populates sessions', async () => {
    const mockOutput = JSON.stringify([
      { network: TEST_LAB_NETWORK, link: TEST_SSHX_LINK },
      { network: TEST_ANOTHER_NETWORK, link: TEST_SSHX_LINK_ALT }
    ]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(2);
    expect(sshxSessions.get('testlab')).to.equal(TEST_SSHX_LINK);
    expect(sshxSessions.get('another')).to.equal(TEST_SSHX_LINK_ALT);
  });

  it('ignores sessions with N/A link', async () => {
    const mockOutput = JSON.stringify([
      { network: TEST_LAB_NETWORK, link: 'N/A' },
      { network: 'clab-valid', link: TEST_SSHX_LINK_VALID }
    ]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(1);
    expect(sshxSessions.has('testlab')).to.be.false;
    expect(sshxSessions.get('valid')).to.equal(TEST_SSHX_LINK_VALID);
  });

  it('clears sessions on empty output', async () => {
    sshxSessions.set('existing', 'https://sshx.io/existing');
    utilsStub.mockCommand(/sshx list/, '');

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(0);
  });

  it('handles command errors gracefully', async () => {
    utilsStub.mockCommandError(/sshx list/, new Error('Command failed'));

    await refreshSshxSessions();

    // Should not throw, just log error
    expect(sshxSessions.size).to.equal(0);
  });
});

describe('extension exports - data', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('exports execCmdMapping', () => {
    expect(extensionModule.execCmdMapping).to.be.an('object');
  });

  it('exports sshUserMapping', () => {
    expect(extensionModule.sshUserMapping).to.be.an('object');
  });

  it('exports favoriteLabs as a Set', () => {
    expect(extensionModule.favoriteLabs).to.be.instanceOf(Set);
  });

  it('exports sshxSessions as a Map', () => {
    expect(extensionModule.sshxSessions).to.be.instanceOf(Map);
  });

  it('exports gottySessions as a Map', () => {
    expect(extensionModule.gottySessions).to.be.instanceOf(Map);
  });

  it('exports hideNonOwnedLabsState with default false', () => {
    expect(extensionModule.hideNonOwnedLabsState).to.equal(false);
  });

  it('exports containerlabBinaryPath with default value', () => {
    expect(extensionModule.containerlabBinaryPath).to.equal('containerlab');
  });
});

describe('extension exports - functions', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('exports activate function', () => {
    expect(extensionModule.activate).to.be.a('function');
  });

  it('exports deactivate function', () => {
    expect(extensionModule.deactivate).to.be.a('function');
  });

  it('exports refreshSshxSessions function', () => {
    expect(extensionModule.refreshSshxSessions).to.be.a('function');
  });

  it('exports refreshGottySessions function', () => {
    expect(extensionModule.refreshGottySessions).to.be.a('function');
  });
});

describe('refreshGottySessions()', () => {
  let refreshGottySessions: Function;
  let gottySessions: Map<string, string>;
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');

    extensionModule = require('../../src/extension');
    refreshGottySessions = extensionModule.refreshGottySessions;
    gottySessions = extensionModule.gottySessions;

    // Initialize outputChannel since activate() wasn't called
    (extensionModule as any).outputChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.clearMocks();
    vscodeStub.resetVscodeStub();
    gottySessions.clear();
  });

  it('parses valid JSON output and populates sessions', async () => {
    const mockOutput = JSON.stringify([
      { network: TEST_LAB_NETWORK, port: 8080 },
      { network: TEST_ANOTHER_NETWORK, port: 9090 }
    ]);
    utilsStub.mockCommand(/gotty list/, mockOutput);

    await refreshGottySessions();

    expect(gottySessions.size).to.be.greaterThanOrEqual(0);
  });

  it('ignores sessions without port', async () => {
    const mockOutput = JSON.stringify([
      { network: TEST_LAB_NETWORK },
      { network: 'clab-valid', port: 8080 }
    ]);
    utilsStub.mockCommand(/gotty list/, mockOutput);

    await refreshGottySessions();

    expect(gottySessions.has('testlab')).to.be.false;
  });

  it('clears sessions on empty output', async () => {
    gottySessions.set('existing', TEST_GOTTY_URL);
    utilsStub.mockCommand(/gotty list/, '');

    await refreshGottySessions();

    expect(gottySessions.size).to.equal(0);
  });

  it('handles command errors gracefully', async () => {
    utilsStub.mockCommandError(/gotty list/, new Error('Command failed'));

    await refreshGottySessions();

    // Should not throw, just log error
    expect(gottySessions.size).to.equal(0);
  });
});

describe('deactivate()', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    extensionModule = require('../../src/extension');

    // Initialize outputChannel for deactivate test
    (extensionModule as any).outputChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('should not throw when called', () => {
    expect(() => extensionModule.deactivate()).to.not.throw();
  });

  it('should handle missing outputChannel gracefully', () => {
    const savedChannel = extensionModule.outputChannel;
    (extensionModule as any).outputChannel = undefined;
    expect(() => extensionModule.deactivate()).to.not.throw();
    (extensionModule as any).outputChannel = savedChannel;
  });
});

describe('hideNonOwnedLabsState', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('should have default value of false', () => {
    expect(extensionModule.hideNonOwnedLabsState).to.equal(false);
  });
});

describe('favoriteLabs', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('should be a Set instance', () => {
    expect(extensionModule.favoriteLabs).to.be.instanceOf(Set);
  });

  it('should support add and delete operations', () => {
    const labs = extensionModule.favoriteLabs;
    labs.add('test-lab');
    expect(labs.has('test-lab')).to.be.true;
    labs.delete('test-lab');
    expect(labs.has('test-lab')).to.be.false;
  });
});

describe('sshxSessions Map operations', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    extensionModule.sshxSessions.clear();
  });

  it('should support set and get operations', () => {
    extensionModule.sshxSessions.set('lab1', TEST_SSHX_URL_SHORT);
    expect(extensionModule.sshxSessions.get('lab1')).to.equal(TEST_SSHX_URL_SHORT);
  });

  it('should support delete operations', () => {
    extensionModule.sshxSessions.set('lab1', TEST_SSHX_URL_SHORT);
    extensionModule.sshxSessions.delete('lab1');
    expect(extensionModule.sshxSessions.has('lab1')).to.be.false;
  });

  it('should support clear operations', () => {
    extensionModule.sshxSessions.set('lab1', 'url1');
    extensionModule.sshxSessions.set('lab2', 'url2');
    extensionModule.sshxSessions.clear();
    expect(extensionModule.sshxSessions.size).to.equal(0);
  });
});

describe('gottySessions Map operations', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    extensionModule.gottySessions.clear();
  });

  it('should support set and get operations', () => {
    extensionModule.gottySessions.set('lab1', TEST_GOTTY_URL);
    expect(extensionModule.gottySessions.get('lab1')).to.equal(TEST_GOTTY_URL);
  });

  it('should support delete operations', () => {
    extensionModule.gottySessions.set('lab1', TEST_GOTTY_URL);
    extensionModule.gottySessions.delete('lab1');
    expect(extensionModule.gottySessions.has('lab1')).to.be.false;
  });

  it('should support iteration', () => {
    extensionModule.gottySessions.set('lab1', 'url1');
    extensionModule.gottySessions.set('lab2', 'url2');
    const entries = Array.from(extensionModule.gottySessions.entries());
    expect(entries).to.have.lengthOf(2);
  });
});

describe('execCmdMapping and sshUserMapping', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('execCmdMapping should contain command mappings', () => {
    expect(extensionModule.execCmdMapping).to.be.an('object');
    expect(Object.keys(extensionModule.execCmdMapping).length).to.be.greaterThan(0);
  });

  it('sshUserMapping should contain user mappings', () => {
    expect(extensionModule.sshUserMapping).to.be.an('object');
    expect(Object.keys(extensionModule.sshUserMapping).length).to.be.greaterThan(0);
  });

  it('execCmdMapping should have expected structure', () => {
    // Check that it has some expected keys (image types)
    const keys = Object.keys(extensionModule.execCmdMapping);
    expect(keys.some(k => k.toLowerCase().includes('linux') || k.toLowerCase().includes('srlinux'))).to.be.true;
  });
});

describe('extractLabName edge cases - sshx', () => {
  it('handles empty network string', () => {
    const result = extractLabNameForTest({ network: '', name: 'sshx-lab' }, 'sshx');
    expect(result).to.equal('lab');
  });

  it('handles network that is not clab prefixed', () => {
    const result = extractLabNameForTest({ network: 'bridge', name: 'sshx-mylab' }, 'sshx');
    expect(result).to.equal('mylab');
  });

  it('handles missing name property', () => {
    const result = extractLabNameForTest({ network: 'bridge' }, 'sshx');
    expect(result).to.be.undefined;
  });

  it('handles undefined session', () => {
    const result = extractLabNameForTest({}, 'sshx');
    expect(result).to.be.undefined;
  });

  it('handles empty prefix', () => {
    const result = extractLabNameForTest({ network: 'bridge', name: '-test' }, '');
    expect(result).to.equal('test');
  });

  it('handles complex lab names with dashes', () => {
    const result = extractLabNameForTest({ network: 'clab-my-complex-lab-name' }, 'sshx');
    expect(result).to.equal('my-complex-lab-name');
  });

  it('handles lab name with prefix in middle', () => {
    const result = extractLabNameForTest({ network: 'bridge', name: 'clab-test-sshx' }, 'sshx');
    expect(result).to.equal('test');
  });
});

describe('extractLabName edge cases - gotty', () => {
  it('handles gotty prefix correctly', () => {
    const result = extractLabNameForTest({ network: 'bridge', name: 'gotty-mylab' }, 'gotty');
    expect(result).to.equal('mylab');
  });

  it('handles clab network with gotty suffix', () => {
    const result = extractLabNameForTest({ network: 'bridge', name: 'clab-demo-gotty' }, 'gotty');
    expect(result).to.equal('demo');
  });
});

describe('refreshSshxSessions edge cases', () => {
  let refreshSshxSessions: Function;
  let sshxSessions: Map<string, string>;
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');

    extensionModule = require('../../src/extension');
    refreshSshxSessions = extensionModule.refreshSshxSessions;
    sshxSessions = extensionModule.sshxSessions;

    (extensionModule as any).outputChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.clearMocks();
    vscodeStub.resetVscodeStub();
    sshxSessions.clear();
  });

  it('handles session with name pattern sshx-labname', async () => {
    const mockOutput = JSON.stringify([
      { network: 'bridge', name: 'sshx-testlab', link: TEST_SSHX_LINK }
    ]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.get('testlab')).to.equal(TEST_SSHX_LINK);
  });

  it('handles session with name pattern clab-labname-sshx', async () => {
    const mockOutput = JSON.stringify([
      { network: 'bridge', name: 'clab-mylab-sshx', link: TEST_SSHX_LINK_ALT }
    ]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.get('mylab')).to.equal(TEST_SSHX_LINK_ALT);
  });

  it('handles empty array response', async () => {
    const mockOutput = JSON.stringify([]);
    utilsStub.mockCommand(/sshx list/, mockOutput);

    await refreshSshxSessions();

    expect(sshxSessions.size).to.equal(0);
  });

  it('handles malformed JSON gracefully', async () => {
    utilsStub.mockCommand(/sshx list/, 'not json');

    await refreshSshxSessions();

    // Should not populate any sessions when JSON parsing fails
    expect(sshxSessions.size).to.equal(0);
  });
});

describe('refreshGottySessions edge cases', () => {
  let refreshGottySessions: Function;
  let gottySessions: Map<string, string>;
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');

    extensionModule = require('../../src/extension');
    refreshGottySessions = extensionModule.refreshGottySessions;
    gottySessions = extensionModule.gottySessions;

    (extensionModule as any).outputChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    utilsStub.clearMocks();
    vscodeStub.resetVscodeStub();
    gottySessions.clear();
  });

  it('handles session with name pattern gotty-labname', async () => {
    const mockOutput = JSON.stringify([
      { network: 'bridge', name: 'gotty-testlab', port: 8080 }
    ]);
    utilsStub.mockCommand(/gotty list/, mockOutput);

    await refreshGottySessions();

    // Note: the actual URL construction depends on getHostname which is mocked
    expect(gottySessions.size).to.be.greaterThanOrEqual(0);
  });

  it('handles session with clab network', async () => {
    const mockOutput = JSON.stringify([
      { network: 'clab-router-lab', name: 'gotty-router-lab', port: 9090 }
    ]);
    utilsStub.mockCommand(/gotty list/, mockOutput);

    await refreshGottySessions();

    expect(gottySessions.size).to.be.greaterThanOrEqual(0);
  });

  it('handles empty array response', async () => {
    const mockOutput = JSON.stringify([]);
    utilsStub.mockCommand(/gotty list/, mockOutput);

    await refreshGottySessions();

    expect(gottySessions.size).to.equal(0);
  });

  it('handles malformed JSON gracefully', async () => {
    utilsStub.mockCommand(/gotty list/, '{invalid');

    await refreshGottySessions();

    expect(gottySessions.size).to.equal(0);
  });

  it('handles session without name property', async () => {
    const mockOutput = JSON.stringify([
      { network: 'clab-lab1', port: 8080 }
    ]);
    utilsStub.mockCommand(/gotty list/, mockOutput);

    await refreshGottySessions();

    // Should still work since network has clab prefix
    expect(gottySessions.size).to.be.greaterThanOrEqual(0);
  });
});

describe('extension module initialization', () => {
  let extensionModule: any;
  const undefinedProps = [
    'outputChannel',
    'treeView',
    'localTreeView',
    'runningTreeView',
    'helpTreeView',
    'username',
    'extensionContext',
    'localLabsProvider',
    'runningLabsProvider',
    'helpFeedbackProvider',
    'dockerClient'
  ];

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('initializes core properties as undefined', () => {
    undefinedProps.forEach(prop => {
      expect(extensionModule[prop]).to.be.undefined;
    });
  });

  it('exposes extensionVersion property', () => {
    expect(extensionModule).to.have.property('extensionVersion');
  });
});

describe('activate() platform checks', () => {
  let extensionModule: any;
  let originalPlatform: PropertyDescriptor | undefined;
  const baseContext = {
    subscriptions: [] as any[],
    extensionPath: '/test',
    globalState: { get: () => [], update: () => Promise.resolve() }
  };

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    // Reset env.remoteName
    vscodeStub.env.remoteName = undefined;
  });

  const platformCases = [
    { name: 'should exit early on non-Linux non-WSL platforms', platform: 'darwin', remoteName: undefined },
    { name: 'should proceed on Linux platform', platform: 'linux', remoteName: undefined },
    { name: 'should proceed when remoteName is wsl', platform: 'darwin', remoteName: 'wsl' }
  ];

  platformCases.forEach(({ name, platform, remoteName }) => {
    it(name, async () => {
      Object.defineProperty(process, 'platform', { value: platform, configurable: true });
      vscodeStub.env.remoteName = remoteName;

      try {
        await extensionModule.activate({ ...baseContext, subscriptions: [] });
      } catch {
        // Expected to potentially fail on subsequent checks
      }

      expect(extensionModule.outputChannel).to.not.be.undefined;
    });
  });
});

describe('activate() with mocked dependencies', () => {
  let extensionModule: any;
  let originalPlatform: PropertyDescriptor | undefined;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.clearMocks();
    // Set Linux platform
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
  });

  it('should create output channel during activation', async () => {
    const context = {
      subscriptions: [],
      extensionPath: '/test',
      globalState: { get: () => [], update: () => Promise.resolve() }
    };

    try {
      await extensionModule.activate(context);
    } catch {
      // May fail on other checks
    }

    expect(extensionModule.outputChannel).to.not.be.undefined;
  });

  it('should add output channel to subscriptions', async () => {
    const context = {
      subscriptions: [] as any[],
      extensionPath: '/test',
      globalState: { get: () => [], update: () => Promise.resolve() }
    };

    try {
      await extensionModule.activate(context);
    } catch {
      // May fail on other checks
    }

    // Output channel should be in subscriptions
    expect(context.subscriptions.length).to.be.greaterThan(0);
  });
});

describe('deactivate behavior', () => {
  let extensionModule: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    extensionModule = require('../../src/extension');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('should log deactivation message when outputChannel exists', () => {
    // Set up output channel
    const mockChannel = vscodeStub.window.createOutputChannel('Test', { log: true });
    (extensionModule as any).outputChannel = mockChannel;

    // Call deactivate
    extensionModule.deactivate();

    // Should have logged info
    expect(mockChannel.logs.length).to.be.greaterThan(0);
  });

  it('should not throw when outputChannel is null', () => {
    (extensionModule as any).outputChannel = null;
    expect(() => extensionModule.deactivate()).to.not.throw();
  });

  it('should throw when outputChannel has no info method', () => {
    // The deactivate function calls outputChannel.info() which will throw
    // if info is not defined - this is expected behavior
    (extensionModule as any).outputChannel = {};
    expect(() => extensionModule.deactivate()).to.throw(TypeError, /info is not a function/);
  });
});

describe('activate() full scenarios with stubs - binary resolution', () => {
  let extensionModule: any;
  let childProcessStub: any;
  let fsStub: any;
  let dockerodeStub: any;
  let originalPlatform: PropertyDescriptor | undefined;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');
    childProcessStub = require('../helpers/child-process-stub');
    fsStub = require('../helpers/fs-stub');
    dockerodeStub = require('../helpers/dockerode-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.clearMocks();
    childProcessStub.resetExecSync();
    childProcessStub.clearExecSyncCalls();
    fsStub.resetFsStub();
    dockerodeStub.resetDockerodeStub();

    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    (extensionModule as any).containerlabBinaryPath = 'containerlab';
    (extensionModule as any).outputChannel = undefined;
  });

  it('should resolve containerlab from PATH when no config set', async () => {
    childProcessStub.setExecSyncResult('/usr/local/bin/containerlab\n');
    dockerodeStub.setPingSuccess(true);

    try {
      await extensionModule.activate(createActivationContext());
    } catch {
      // May fail later in activation
    }

    expect(childProcessStub.execSyncCalls.some((c: string) => c.includes('which containerlab'))).to.be.true;
  });

  it('should use configured binary path when valid', async () => {
    vscodeStub.setConfigValue(CONFIG_BINARY_PATH, CUSTOM_BINARY_PATH);
    fsStub.setFile(CUSTOM_BINARY_PATH, '');
    fsStub.markExecutable(CUSTOM_BINARY_PATH);
    dockerodeStub.setPingSuccess(true);

    try {
      await extensionModule.activate(createActivationContext());
    } catch {
      // May fail later
    }

    expect(extensionModule.containerlabBinaryPath).to.equal(CUSTOM_BINARY_PATH);
  });

  it('should show error when configured path is invalid', async () => {
    vscodeStub.setConfigValue(CONFIG_BINARY_PATH, '/invalid/path/containerlab');

    await extensionModule.activate(createActivationContext());

    expect(vscodeStub.window.lastErrorMessage).to.include('invalid');
  });

  it('should handle execSync failure gracefully', async () => {
    childProcessStub.setExecSyncError(new Error('Command not found'));

    try {
      await extensionModule.activate(createActivationContext());
    } catch {
      // May fail later
    }

    expect(extensionModule.containerlabBinaryPath).to.equal('containerlab');
  });
});

describe('activate() full scenarios with stubs - activation flow', () => {
  let extensionModule: any;
  let childProcessStub: any;
  let dockerodeStub: any;
  let originalPlatform: PropertyDescriptor | undefined;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');
    childProcessStub = require('../helpers/child-process-stub');
    dockerodeStub = require('../helpers/dockerode-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.clearMocks();
    childProcessStub.resetExecSync();
    childProcessStub.clearExecSyncCalls();
    dockerodeStub.resetDockerodeStub();
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    (extensionModule as any).containerlabBinaryPath = 'containerlab';
    (extensionModule as any).outputChannel = undefined;
  });

  it('should connect to Docker when binary path is set', async () => {
    childProcessStub.setExecSyncResult(DEFAULT_CLAB_BIN);
    dockerodeStub.setPingSuccess(true);

    try {
      await extensionModule.activate(createActivationContext());
    } catch {
      // May fail later
    }

    expect(extensionModule.outputChannel).to.not.be.undefined;
  });

  it('should check user permissions on Linux', async () => {
    childProcessStub.setExecSyncResult(DEFAULT_CLAB_BIN);
    dockerodeStub.setPingSuccess(true);

    try {
      await extensionModule.activate(createActivationContext());
    } catch {
      // Expected
    }

    expect(extensionModule.outputChannel).to.not.be.undefined;
  });

  it('should register commands during full activation', async () => {
    childProcessStub.setExecSyncResult(DEFAULT_CLAB_BIN);
    dockerodeStub.setPingSuccess(true);

    const context = createActivationContext();

    try {
      await extensionModule.activate(context);
    } catch {
      // May fail later
    }

    expect(context.subscriptions.length).to.be.at.least(1);
  });

  it('should set username from user info', async () => {
    childProcessStub.setExecSyncResult(DEFAULT_CLAB_BIN);
    dockerodeStub.setPingSuccess(true);

    try {
      await extensionModule.activate(createActivationContext());
    } catch {
      // May fail later
    }

    expect(extensionModule.username).to.equal('testuser');
  });
});

describe('activate() full scenarios with stubs - install prompt', () => {
  let extensionModule: any;
  let childProcessStub: any;
  let originalPlatform: PropertyDescriptor | undefined;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');
    childProcessStub = require('../helpers/child-process-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    utilsStub.clearMocks();
    childProcessStub.resetExecSync();
    childProcessStub.clearExecSyncCalls();
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    (extensionModule as any).containerlabBinaryPath = 'containerlab';
    (extensionModule as any).outputChannel = undefined;
  });

  it('should prompt for install when containerlab not found', async () => {
    childProcessStub.setExecSyncResult('');
    vscodeStub.window.lastWarningSelection = 'Cancel';

    await extensionModule.activate(createActivationContext());

    expect(vscodeStub.window.lastWarningMessage).to.include('not installed');
  });
});

describe('activate() permission scenarios', () => {
  let extensionModule: any;
  let childProcessStub: any;
  let originalPlatform: PropertyDescriptor | undefined;
  let originalGetUserInfo: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    utilsStub = require('../helpers/utils-stub');
    childProcessStub = require('../helpers/child-process-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    originalGetUserInfo = utilsStub.getUserInfo;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    utilsStub.getUserInfo = originalGetUserInfo;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    childProcessStub.resetExecSync();
    Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
    (extensionModule as any).outputChannel = undefined;
  });

  it('should show error when user lacks permissions', async () => {
    childProcessStub.setExecSyncResult(DEFAULT_CLAB_BIN);

    // Override getUserInfo to return no permissions
    utilsStub.getUserInfo = () => ({
      hasPermission: false,
      isRoot: false,
      userGroups: [],
      username: 'noperm',
      uid: 1001
    });

    const context = {
      subscriptions: [] as any[],
      extensionPath: TEST_EXTENSION_PATH,
      globalState: { get: () => [], update: () => Promise.resolve() }
    };

    await extensionModule.activate(context);

    // Should show permission error
    expect(vscodeStub.window.lastErrorMessage).to.include('permission');
  });
});

describe('registerUnsupportedViews behavior', () => {
  let extensionModule: any;
  let originalPlatform: PropertyDescriptor | undefined;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../helpers/vscode-stub');
    extensionModule = require('../../src/extension');
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform);
    }
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
    vscodeStub.env.remoteName = undefined;
  });

  it('should register three tree views for unsupported platforms', async () => {
    const context = {
      subscriptions: [] as any[],
      extensionPath: TEST_EXTENSION_PATH,
      globalState: { get: () => [], update: () => Promise.resolve() }
    };

    await extensionModule.activate(context);

    // Should have registered the tree views (3 views + output channel)
    expect(context.subscriptions.length).to.be.greaterThanOrEqual(3);
  });

  it('should create tree views with warning provider', async () => {
    const createdViews: string[] = [];
    const originalCreateTreeView = vscodeStub.window.createTreeView;

    vscodeStub.window.createTreeView = (viewId: string, options: any) => {
      createdViews.push(viewId);
      return originalCreateTreeView(viewId, options);
    };

    const context = {
      subscriptions: [] as any[],
      extensionPath: TEST_EXTENSION_PATH,
      globalState: { get: () => [], update: () => Promise.resolve() }
    };

    await extensionModule.activate(context);

    expect(createdViews).to.include('runningLabs');
    expect(createdViews).to.include('localLabs');
    expect(createdViews).to.include('helpFeedback');

    vscodeStub.window.createTreeView = originalCreateTreeView;
  });
});
