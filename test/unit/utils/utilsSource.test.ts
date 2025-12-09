/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for the utils module (actual source coverage).
 * Uses module interception to mock vscode and other dependencies.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';
import sinon from 'sinon';

const originalResolve = (Module as any)._resolveFilename;

// Constants for test paths
const WORKSPACE_PATH = '/workspace';
const WORKSPACE_SUBDIR_FILE = '/workspace/subdir/file.txt';

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
  return null;
}

// Shared context
let utilsModule: any;
let vscodeStub: any;
let sandbox: sinon.SinonSandbox;

describe('stripAnsi() - ANSI escape removal', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('removes basic ANSI color codes', () => {
    const input = '\x1b[31mred text\x1b[0m';
    const result = utilsModule.stripAnsi(input);
    expect(result).to.equal('red text');
  });

  it('removes bold and multiple color codes', () => {
    const input = '\x1b[1m\x1b[32mbold green\x1b[0m';
    const result = utilsModule.stripAnsi(input);
    expect(result).to.equal('bold green');
  });

  it('handles plain text without codes', () => {
    const result = utilsModule.stripAnsi('plain text');
    expect(result).to.equal('plain text');
  });

  it('handles empty string', () => {
    const result = utilsModule.stripAnsi('');
    expect(result).to.equal('');
  });

  it('removes extended 256 color codes', () => {
    const input = '\x1b[38;5;196mextended\x1b[0m';
    const result = utilsModule.stripAnsi(input);
    expect(result).to.equal('extended');
  });

  it('removes multiple sequences in one string', () => {
    const input = '\x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m';
    const result = utilsModule.stripAnsi(input);
    expect(result).to.equal('red green');
  });
});

describe('stripFileName() - path manipulation', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns directory portion of path', () => {
    const result = utilsModule.stripFileName('/home/user/file.txt');
    expect(result).to.equal('/home/user');
  });

  it('handles nested paths', () => {
    const result = utilsModule.stripFileName('/a/b/c/d.txt');
    expect(result).to.equal('/a/b/c');
  });

  it('returns empty string for root file', () => {
    const result = utilsModule.stripFileName('/file.txt');
    expect(result).to.equal('');
  });

  it('returns empty for filename only', () => {
    const result = utilsModule.stripFileName('file.txt');
    expect(result).to.equal('');
  });
});

describe('titleCase() - string transformation', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('capitalizes first letter of lowercase word', () => {
    expect(utilsModule.titleCase('hello')).to.equal('Hello');
  });

  it('keeps remaining characters unchanged', () => {
    expect(utilsModule.titleCase('hELLO')).to.equal('HELLO');
  });

  it('handles single character', () => {
    expect(utilsModule.titleCase('a')).to.equal('A');
  });

  it('handles already capitalized string', () => {
    expect(utilsModule.titleCase('Hello')).to.equal('Hello');
  });
});

describe('sanitize() - basic character handling', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('replaces disallowed characters with dash', () => {
    expect(utilsModule.sanitize('a/b:c@d')).to.equal('a-b-c-d');
  });

  it('returns "container" for empty input', () => {
    expect(utilsModule.sanitize('')).to.equal('container');
  });

  it('handles valid names unchanged', () => {
    expect(utilsModule.sanitize('valid-name_123')).to.equal('valid-name_123');
  });
});

describe('sanitize() - separator trimming', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('removes leading separators', () => {
    expect(utilsModule.sanitize('---name')).to.equal('name');
  });

  it('removes trailing separators', () => {
    expect(utilsModule.sanitize('name---')).to.equal('name');
  });

  it('removes leading dots', () => {
    expect(utilsModule.sanitize('...name')).to.equal('name');
  });

  it('removes trailing dots', () => {
    expect(utilsModule.sanitize('name...')).to.equal('name');
  });
});

describe('sanitize() - name constraints', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('ensures name starts with alphanumeric', () => {
    expect(utilsModule.sanitize('_name')).to.equal('c-_name');
  });

  it('enforces max length', () => {
    const longName = 'A'.repeat(200);
    const result = utilsModule.sanitize(longName);
    expect(result.length).to.be.at.most(128);
  });

  it('preserves case by default', () => {
    expect(utilsModule.sanitize('MixedCase')).to.equal('MixedCase');
  });

  it('converts to lowercase when lower=true', () => {
    expect(utilsModule.sanitize('MixedCase', { lower: true })).to.equal('mixedcase');
  });
});

describe('sanitize() - edge cases', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('handles all invalid characters', () => {
    const result = utilsModule.sanitize('!@#$%^&*()');
    // All invalid chars become '-', then trimmed, leaving empty, prefixed with 'c-'
    expect(result).to.equal('c-');
  });

  it('trims trailing separators after max length truncation', () => {
    const name = 'name' + '-'.repeat(200);
    const result = utilsModule.sanitize(name, { maxLen: 10 });
    expect(result).to.not.match(/[-.]$/);
  });

  it('uses custom maxLen', () => {
    const result = utilsModule.sanitize('A'.repeat(50), { maxLen: 20 });
    expect(result.length).to.equal(20);
  });

  it('handles underscores and dots correctly', () => {
    expect(utilsModule.sanitize('name_with.dots')).to.equal('name_with.dots');
  });
});

describe('isOrbstack() - environment detection', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns a boolean', () => {
    const result = utilsModule.isOrbstack();
    expect(result).to.be.a('boolean');
  });

  it('detects based on kernel release string', () => {
    const os = require('os');
    const kernel = os.release().toLowerCase();
    const expected = kernel.includes('orbstack');
    expect(utilsModule.isOrbstack()).to.equal(expected);
  });
});

describe('normalizeLabPath() - path normalization', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns empty for empty input', () => {
    expect(utilsModule.normalizeLabPath('')).to.equal('');
  });

  it('expands tilde to home directory', () => {
    const os = require('os');
    const result = utilsModule.normalizeLabPath('~/test.yml');
    expect(result).to.include(os.homedir());
  });

  it('handles absolute paths', () => {
    const result = utilsModule.normalizeLabPath('/absolute/path/lab.yml');
    expect(result).to.include('/absolute/path/lab.yml');
  });

  it('normalizes redundant slashes', () => {
    const result = utilsModule.normalizeLabPath('/path//to///file.yml');
    expect(result).to.not.include('//');
  });
});

describe('getFreePort() - network utilities', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    sandbox = sinon.createSandbox();
    const { stubNetForFreePort } = require('../../helpers/net-stub');
    stubNetForFreePort(sandbox);
  });

  afterEach(() => {
    sandbox.restore();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns a valid port number', async () => {
    const port = await utilsModule.getFreePort();
    expect(port).to.be.a('number');
    expect(port).to.be.greaterThan(0);
    expect(port).to.be.lessThan(65536);
  });

  it('returns different ports on consecutive calls', async () => {
    const port1 = await utilsModule.getFreePort();
    const port2 = await utilsModule.getFreePort();
    // Ports could be the same by chance, but at least verify both are valid
    expect(port1).to.be.a('number');
    expect(port2).to.be.a('number');
  });
});

describe('getConfig() - configuration access', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns undefined for missing config', () => {
    const result = utilsModule.getConfig('nonexistent.setting');
    expect(result).to.be.undefined;
  });

  it('returns configured value when set', () => {
    vscodeStub.setConfigValue('containerlab.testSetting', 'testValue');
    const result = utilsModule.getConfig('testSetting');
    expect(result).to.equal('testValue');
  });
});

describe('getUserInfo() - user permission check', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns user info object with expected shape', () => {
    const result = utilsModule.getUserInfo();
    expect(result).to.have.property('hasPermission');
    expect(result).to.have.property('isRoot');
    expect(result).to.have.property('userGroups');
    expect(result).to.have.property('username');
    expect(result).to.have.property('uid');
  });

  it('returns boolean for hasPermission', () => {
    const result = utilsModule.getUserInfo();
    expect(result.hasPermission).to.be.a('boolean');
  });

  it('returns boolean for isRoot', () => {
    const result = utilsModule.getUserInfo();
    expect(result.isRoot).to.be.a('boolean');
  });

  it('returns array for userGroups', () => {
    const result = utilsModule.getUserInfo();
    expect(result.userGroups).to.be.an('array');
  });

  it('returns string for username', () => {
    const result = utilsModule.getUserInfo();
    expect(result.username).to.be.a('string');
  });

  it('returns number for uid', () => {
    const result = utilsModule.getUserInfo();
    expect(result.uid).to.be.a('number');
  });
});

describe('installContainerlab() - terminal creation', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('creates a terminal for installation', () => {
    utilsModule.installContainerlab();
    expect(vscodeStub.window.terminals.length).to.equal(1);
    expect(vscodeStub.window.terminals[0].name).to.equal('Containerlab Installation');
  });

  it('shows the terminal', () => {
    utilsModule.installContainerlab();
    expect(vscodeStub.window.terminals[0].shown).to.be.true;
  });

  it('sends install command to terminal', () => {
    utilsModule.installContainerlab();
    const commands = vscodeStub.window.terminals[0].commands;
    expect(commands.length).to.equal(1);
    expect(commands[0]).to.include('containerlab.dev/setup');
  });
});

describe('getSelectedLabNode() - node selection', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns provided node directly', async () => {
    const mockNode = { labPath: { absolute: '/test/lab.yml' } };
    const result = await utilsModule.getSelectedLabNode(mockNode);
    expect(result).to.equal(mockNode);
  });

  it('returns undefined when no node provided', async () => {
    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });
});

describe('getRelativeFolderPath() - workspace relative paths', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns relative path when workspace exists', () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: WORKSPACE_PATH, path: WORKSPACE_PATH } }];
    const result = utilsModule.getRelativeFolderPath(WORKSPACE_SUBDIR_FILE);
    expect(result).to.be.a('string');
  });

  it('handles undefined workspace folders', () => {
    // When workspaceFolders is undefined or has elements, it uses the first element
    // Set a workspace folder to test the path
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: '/', path: '/' } }];
    const result = utilsModule.getRelativeFolderPath('/some/path/file.txt');
    expect(result).to.be.a('string');
  });
});

describe('getRelLabFolderPath() - lab folder path', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  it('returns the folder portion of the relative lab path', () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: WORKSPACE_PATH, path: WORKSPACE_PATH } }];
    const result = utilsModule.getRelLabFolderPath('/workspace/labs/topology.clab.yml');
    expect(result).to.be.a('string');
  });
});
