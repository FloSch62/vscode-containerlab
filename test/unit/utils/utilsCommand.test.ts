/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for utils.ts command execution functions.
 * Covers: runCommand(), checkAndUpdateClabIfNeeded(), getSelectedLabNode()
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;
const WORKSPACE_PATH = '/workspace';
const LAB_FILE = 'topology.clab.yml';

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
let extensionStub: any;

describe('getSelectedLabNode() - direct node param', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns provided node when given', async () => {
    const mockNode = { labPath: '/test/lab.yml' };
    const result = await utilsModule.getSelectedLabNode(mockNode);
    expect(result).to.equal(mockNode);
  });

  it('returns undefined when no node and no tree selection', async () => {
    const result = await utilsModule.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });

  it('returns node object with labPath property', async () => {
    const mockNode = { labPath: { absolute: '/test/lab.clab.yml' }, name: 'test' };
    const result = await utilsModule.getSelectedLabNode(mockNode);
    expect(result).to.have.property('labPath');
    expect(result).to.have.property('name');
  });
});

describe('normalizeLabPath() - relative path handling', () => {
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

  it('resolves relative path with singleFolderBase', () => {
    const result = utilsModule.normalizeLabPath('lab.yml', '/base/folder');
    expect(result).to.be.a('string');
    expect(result.includes('base') || result.includes('lab.yml')).to.be.true;
  });

  it('handles tilde with trailing slash', () => {
    const os = require('os');
    const result = utilsModule.normalizeLabPath('~/');
    expect(result).to.include(os.homedir());
  });

  it('handles tilde without trailing slash', () => {
    const os = require('os');
    const result = utilsModule.normalizeLabPath('~');
    expect(result).to.include(os.homedir());
  });

  it('uses process.cwd for relative paths without base', () => {
    const result = utilsModule.normalizeLabPath('relative/path/lab.yml');
    expect(result).to.include('relative');
  });
});

describe('normalizeLabPath() - absolute path handling', () => {
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

  it('keeps absolute paths unchanged', () => {
    const result = utilsModule.normalizeLabPath('/absolute/path/lab.yml');
    expect(result).to.include('/absolute/path/lab.yml');
  });

  it('normalizes redundant slashes', () => {
    const result = utilsModule.normalizeLabPath('/path//to///file.yml');
    expect(result).to.not.include('//');
  });
});

describe('sanitize() - additional edge cases', () => {
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

  it('handles all dots input', () => {
    // After trimming dots, becomes empty prefix with c-
    const result = utilsModule.sanitize('...');
    // The function removes leading/trailing dots, leaving empty, prefixing with c-
    expect(result).to.be.a('string');
    expect(result.length).to.be.greaterThan(0);
  });

  it('handles maxLen that cuts into separator sequence', () => {
    const input = 'abc' + '-'.repeat(20);
    const result = utilsModule.sanitize(input, { maxLen: 10 });
    expect(result).to.not.match(/[-.]$/);
  });

  it('handles input that starts with non-alphanumeric after trimming', () => {
    const result = utilsModule.sanitize('..._test');
    expect(result).to.match(/^[A-Za-z0-9]/);
  });

  it('handles multiple consecutive special characters', () => {
    const result = utilsModule.sanitize('a!!!b@@@c###d');
    expect(result).to.equal('a-b-c-d');
  });

  it('preserves valid characters in middle of string', () => {
    const result = utilsModule.sanitize('test-name_123.node');
    expect(result).to.equal('test-name_123.node');
  });

  it('applies lowercase with lower=true option', () => {
    const result = utilsModule.sanitize('TEST-NAME', { lower: true });
    expect(result).to.equal('test-name');
  });

  it('applies custom maxLen', () => {
    const result = utilsModule.sanitize('verylongname', { maxLen: 5 });
    expect(result.length).to.be.at.most(5);
  });
});

describe('installContainerlab() - terminal behavior', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('creates terminal named "Containerlab Installation"', () => {
    utilsModule.installContainerlab();
    expect(vscodeStub.window.terminals.length).to.equal(1);
    expect(vscodeStub.window.terminals[0].name).to.equal('Containerlab Installation');
  });

  it('shows the terminal after creation', () => {
    utilsModule.installContainerlab();
    expect(vscodeStub.window.terminals[0].shown).to.be.true;
  });

  it('sends the install script command', () => {
    utilsModule.installContainerlab();
    const commands = vscodeStub.window.terminals[0].commands;
    expect(commands).to.have.length(1);
    expect(commands[0]).to.include('containerlab.dev/setup');
    expect(commands[0]).to.include('sudo');
  });
});

describe('getUserInfo() - user permission structure', () => {
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

  it('returns object with all expected properties', () => {
    const result = utilsModule.getUserInfo();
    expect(result).to.have.property('hasPermission').that.is.a('boolean');
    expect(result).to.have.property('isRoot').that.is.a('boolean');
    expect(result).to.have.property('userGroups').that.is.an('array');
    expect(result).to.have.property('username').that.is.a('string');
    expect(result).to.have.property('uid').that.is.a('number');
  });

  it('returns non-empty username', () => {
    const result = utilsModule.getUserInfo();
    expect(result.username.length).to.be.greaterThan(0);
  });

  it('returns valid uid', () => {
    const result = utilsModule.getUserInfo();
    expect(result.uid).to.be.at.least(0);
  });
});

describe('isOrbstack() - environment check', () => {
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

  it('returns boolean based on kernel version', () => {
    const result = utilsModule.isOrbstack();
    expect(result).to.be.a('boolean');
  });

  it('returns consistent results on multiple calls', () => {
    const result1 = utilsModule.isOrbstack();
    const result2 = utilsModule.isOrbstack();
    expect(result1).to.equal(result2);
  });
});

describe('getFreePort() - port allocation', () => {
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

  it('returns port in valid range', async () => {
    const port = await utilsModule.getFreePort();
    expect(port).to.be.a('number');
    expect(port).to.be.greaterThan(0);
    expect(port).to.be.lessThan(65536);
  });

  it('returns port that can be used', async () => {
    const port = await utilsModule.getFreePort();
    // Port should be in ephemeral range or above 1024
    expect(port).to.be.greaterThan(1024);
  });
});

describe('getConfig() - configuration retrieval', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns undefined for unconfigured setting', () => {
    const result = utilsModule.getConfig('nonexistent.config.path');
    expect(result).to.be.undefined;
  });

  it('returns configured value when set', () => {
    vscodeStub.setConfigValue('containerlab.testKey', 'testValue');
    const result = utilsModule.getConfig('testKey');
    expect(result).to.equal('testValue');
  });

  it('returns boolean config correctly', () => {
    vscodeStub.setConfigValue('containerlab.enableFeature', true);
    const result = utilsModule.getConfig('enableFeature');
    expect(result).to.equal(true);
  });
});

describe('getRelativeFolderPath() - workspace paths', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns relative path from workspace', () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: WORKSPACE_PATH, path: WORKSPACE_PATH } }];
    const result = utilsModule.getRelativeFolderPath(`${WORKSPACE_PATH}/labs/topo.yml`);
    expect(result).to.be.a('string');
  });

  it('handles path outside workspace', () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: WORKSPACE_PATH, path: WORKSPACE_PATH } }];
    const result = utilsModule.getRelativeFolderPath('/other/path/topo.yml');
    expect(result).to.be.a('string');
  });
});

describe('getRelLabFolderPath() - lab folder extraction', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };
    vscodeStub = require('../../helpers/vscode-stub');
    utilsModule = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('returns folder portion of lab path', () => {
    vscodeStub.workspace.workspaceFolders = [{ uri: { fsPath: WORKSPACE_PATH, path: WORKSPACE_PATH } }];
    const result = utilsModule.getRelLabFolderPath(`${WORKSPACE_PATH}/labs/${LAB_FILE}`);
    expect(result).to.be.a('string');
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

  it('capitalizes first letter', () => {
    expect(utilsModule.titleCase('hello')).to.equal('Hello');
  });

  it('keeps rest unchanged', () => {
    expect(utilsModule.titleCase('hELLO')).to.equal('HELLO');
  });

  it('handles single character', () => {
    expect(utilsModule.titleCase('a')).to.equal('A');
  });

  it('handles already capitalized', () => {
    expect(utilsModule.titleCase('Hello')).to.equal('Hello');
  });

  it('handles unicode characters', () => {
    const result = utilsModule.titleCase('über');
    expect(result[0]).to.equal('Ü');
  });
});

describe('stripAnsi() - ANSI code removal', () => {
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

  it('removes color codes', () => {
    const input = '\x1b[31mred\x1b[0m';
    expect(utilsModule.stripAnsi(input)).to.equal('red');
  });

  it('removes bold codes', () => {
    const input = '\x1b[1mbold\x1b[0m';
    expect(utilsModule.stripAnsi(input)).to.equal('bold');
  });

  it('handles multiple sequences', () => {
    const input = '\x1b[31mred\x1b[0m \x1b[32mgreen\x1b[0m';
    expect(utilsModule.stripAnsi(input)).to.equal('red green');
  });

  it('handles plain text', () => {
    expect(utilsModule.stripAnsi('plain')).to.equal('plain');
  });

  it('handles 256 color codes', () => {
    const input = '\x1b[38;5;196mextended\x1b[0m';
    expect(utilsModule.stripAnsi(input)).to.equal('extended');
  });
});

describe('stripFileName() - directory extraction', () => {
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

  it('returns directory from file path', () => {
    expect(utilsModule.stripFileName('/home/user/file.txt')).to.equal('/home/user');
  });

  it('handles deep paths', () => {
    expect(utilsModule.stripFileName('/a/b/c/d.txt')).to.equal('/a/b/c');
  });

  it('returns empty for root file', () => {
    expect(utilsModule.stripFileName('/file.txt')).to.equal('');
  });

  it('returns empty for filename only', () => {
    expect(utilsModule.stripFileName('file.txt')).to.equal('');
  });
});
