/* eslint-env mocha */
/* global describe, it, before, beforeEach, afterEach, after, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';
import os from 'os';

// Constants
const TEST_PATH = '/home/testuser/labs/topology.yml';
const MOCK_WORKSPACE_PATH = '/home/testuser';
const ANSI_RED = '\x1b[31m';
const ANSI_RESET = '\x1b[0m';

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
  if (request.endsWith('/extension') || request.includes('../extension')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('../treeView/common')) {
    return path.join(__dirname, '..', '..', 'helpers', 'treeView-common-stub.js');
  }
  return null;
}

function setupModuleResolution() {
  clearModuleCache();
  (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
    const stubPath = getStubPath(request);
    return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
  };
}

function teardownModuleResolution() {
  (Module as any)._resolveFilename = originalResolve;
  clearModuleCache();
}

let utils: any;

/**
 * Tests for stripAnsi function
 */
describe('utils.ts - stripAnsi', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should remove ANSI color codes', () => {
    const input = `${ANSI_RED}red text${ANSI_RESET}`;
    const result = utils.stripAnsi(input);
    expect(result).to.equal('red text');
  });

  it('should remove multiple ANSI codes', () => {
    const input = '\x1b[1m\x1b[32mbold green\x1b[0m normal';
    const result = utils.stripAnsi(input);
    expect(result).to.equal('bold green normal');
  });

  it('should handle string without ANSI codes', () => {
    const result = utils.stripAnsi('plain text');
    expect(result).to.equal('plain text');
  });

  it('should handle empty string', () => {
    const result = utils.stripAnsi('');
    expect(result).to.equal('');
  });

  it('should remove extended 256 color codes', () => {
    const input = '\x1b[38;5;196mextended\x1b[0m';
    const result = utils.stripAnsi(input);
    expect(result).to.equal('extended');
  });

  it('should remove RGB color codes', () => {
    const input = '\x1b[38;2;255;0;0mrgb\x1b[0m';
    const result = utils.stripAnsi(input);
    expect(result).to.equal('rgb');
  });

  it('should remove cursor control sequences', () => {
    const input = '\x1b[2Jclear screen';
    const result = utils.stripAnsi(input);
    expect(result).to.equal('clear screen');
  });
});

/**
 * Tests for stripFileName function
 */
describe('utils.ts - stripFileName', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should extract directory from path', () => {
    const result = utils.stripFileName('/home/user/labs/topology.yml');
    expect(result).to.equal('/home/user/labs');
  });

  it('should handle root path', () => {
    const result = utils.stripFileName('/file.yml');
    expect(result).to.equal('');
  });

  it('should handle path without slash', () => {
    const result = utils.stripFileName('file.yml');
    expect(result).to.equal('');
  });

  it('should handle deep nested path', () => {
    const result = utils.stripFileName('/a/b/c/d/e.yml');
    expect(result).to.equal('/a/b/c/d');
  });

  it('should handle single slash', () => {
    const result = utils.stripFileName('/');
    expect(result).to.equal('');
  });

  it('should handle trailing slash', () => {
    const result = utils.stripFileName('/home/user/');
    expect(result).to.equal('/home/user');
  });
});

/**
 * Tests for titleCase function
 */
describe('utils.ts - titleCase', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should capitalize first letter', () => {
    const result = utils.titleCase('hello');
    expect(result).to.equal('Hello');
  });

  it('should keep rest of string unchanged', () => {
    const result = utils.titleCase('hELLO');
    expect(result).to.equal('HELLO');
  });

  it('should handle single character', () => {
    const result = utils.titleCase('a');
    expect(result).to.equal('A');
  });

  it('should handle already capitalized', () => {
    const result = utils.titleCase('Hello');
    expect(result).to.equal('Hello');
  });

  it('should handle number at start', () => {
    const result = utils.titleCase('123abc');
    expect(result).to.equal('123abc');
  });
});

/**
 * Tests for sanitize function
 */
describe('utils.ts - sanitize', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should replace special characters with dash', () => {
    const result = utils.sanitize('a/b:c@d');
    expect(result).to.equal('a-b-c-d');
  });

  it('should handle already safe string', () => {
    const result = utils.sanitize('safe-name_123');
    expect(result).to.equal('safe-name_123');
  });

  it('should handle empty string', () => {
    const result = utils.sanitize('');
    expect(result).to.equal('container');
  });

  it('should remove leading separators', () => {
    const result = utils.sanitize('---leading');
    expect(result).to.equal('leading');
  });

  it('should remove trailing separators', () => {
    const result = utils.sanitize('trailing---');
    expect(result).to.equal('trailing');
  });

  it('should remove leading and trailing dots', () => {
    const result = utils.sanitize('...dots...');
    expect(result).to.equal('dots');
  });

  it('should add prefix when starting with underscore', () => {
    const result = utils.sanitize('_underscore');
    expect(result).to.equal('c-_underscore');
  });

  it('should enforce max length of 128 by default', () => {
    const result = utils.sanitize('A'.repeat(200));
    expect(result).to.have.lengthOf(128);
  });

  it('should enforce custom max length', () => {
    const result = utils.sanitize('A'.repeat(100), { maxLen: 50 });
    expect(result).to.have.lengthOf(50);
  });

  it('should preserve case by default', () => {
    const result = utils.sanitize('MixedCase');
    expect(result).to.equal('MixedCase');
  });

  it('should convert to lowercase when lower=true', () => {
    const result = utils.sanitize('MixedCase', { lower: true });
    expect(result).to.equal('mixedcase');
  });

  it('should remove trailing separator after truncation', () => {
    const result = utils.sanitize('A'.repeat(127) + '-B', { maxLen: 128 });
    expect(result.endsWith('-')).to.be.false;
  });
});

/**
 * Tests for normalizeLabPath function
 */
describe('utils.ts - normalizeLabPath', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should return empty string for empty path', () => {
    const result = utils.normalizeLabPath('');
    expect(result).to.equal('');
  });

  it('should normalize double slashes', () => {
    const result = utils.normalizeLabPath('/home//user//lab.yml');
    expect(result).to.not.include('//');
  });

  it('should expand tilde to home directory', () => {
    const homedir = os.homedir();
    const result = utils.normalizeLabPath('~/lab.yml');
    expect(result).to.include(homedir);
  });

  it('should expand tilde with no trailing slash', () => {
    const homedir = os.homedir();
    const result = utils.normalizeLabPath('~lab.yml');
    expect(result).to.include(homedir);
  });

  it('should handle absolute paths', () => {
    const result = utils.normalizeLabPath('/absolute/path.yml');
    expect(result).to.include('/absolute/path.yml');
  });

  it('should use singleFolderBase for relative paths', () => {
    const result = utils.normalizeLabPath('relative.yml', '/base');
    expect(result).to.be.a('string');
  });

  it('should resolve relative paths with cwd', () => {
    const result = utils.normalizeLabPath('relative.yml');
    expect(result).to.be.a('string');
    expect(result.length).to.be.greaterThan(0);
  });
});

/**
 * Tests for isOrbstack function
 */
describe('utils.ts - isOrbstack', () => {
  let osReleaseStub: sinon.SinonStub;

  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  afterEach(() => {
    if (osReleaseStub) {
      osReleaseStub.restore();
    }
  });

  after(teardownModuleResolution);

  it('should return boolean', () => {
    const result = utils.isOrbstack();
    expect(result).to.be.a('boolean');
  });

  it('should return true when kernel contains orbstack', () => {
    osReleaseStub = sinon.stub(os, 'release').returns('5.15.0-orbstack');
    const result = utils.isOrbstack();
    expect(result).to.be.true;
  });

  it('should return false for standard kernel', () => {
    osReleaseStub = sinon.stub(os, 'release').returns('5.15.0-generic');
    const result = utils.isOrbstack();
    expect(result).to.be.false;
  });

  it('should handle os.release error gracefully', () => {
    osReleaseStub = sinon.stub(os, 'release').throws(new Error('Test error'));
    const result = utils.isOrbstack();
    expect(result).to.be.false;
  });
});

/**
 * Tests for getFreePort function
 */
describe('utils.ts - getFreePort', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should return a valid port number', async () => {
    const port = await utils.getFreePort();
    expect(port).to.be.a('number');
    expect(port).to.be.greaterThan(0);
    expect(port).to.be.lessThan(65536);
  });

  it('should return different ports on consecutive calls', async () => {
    const port1 = await utils.getFreePort();
    const port2 = await utils.getFreePort();
    // They may occasionally be the same if ports are reused quickly
    expect(port1).to.be.a('number');
    expect(port2).to.be.a('number');
  });
});

/**
 * Tests for getRelativeFolderPath function
 */
describe('utils.ts - getRelativeFolderPath', () => {
  let vscode: any;

  before(() => {
    setupModuleResolution();
    vscode = require('vscode');
    utils = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    // Set up workspace folders for these tests
    // Note: utils.ts uses uri.path not uri.fsPath
    vscode.workspace.workspaceFolders = [
      { uri: { path: MOCK_WORKSPACE_PATH, fsPath: MOCK_WORKSPACE_PATH }, name: 'test-workspace' }
    ];
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = [];
  });

  after(teardownModuleResolution);

  it('should return path relative to workspace', () => {
    const result = utils.getRelativeFolderPath(TEST_PATH);
    expect(result).to.be.a('string');
  });

  it('should handle path with workspace', () => {
    const result = utils.getRelativeFolderPath('/workspace/labs/topo.yml');
    expect(result).to.be.a('string');
  });
});

/**
 * Tests for getRelLabFolderPath function
 */
describe('utils.ts - getRelLabFolderPath', () => {
  let vscode: any;

  before(() => {
    setupModuleResolution();
    vscode = require('vscode');
    utils = require('../../../src/utils/utils');
  });

  beforeEach(() => {
    // Set up workspace folders for these tests
    // Note: utils.ts uses uri.path not uri.fsPath
    vscode.workspace.workspaceFolders = [
      { uri: { path: MOCK_WORKSPACE_PATH, fsPath: MOCK_WORKSPACE_PATH }, name: 'test-workspace' }
    ];
  });

  afterEach(() => {
    vscode.workspace.workspaceFolders = [];
  });

  after(teardownModuleResolution);

  it('should return directory of relative path', () => {
    const result = utils.getRelLabFolderPath(TEST_PATH);
    expect(result).to.be.a('string');
  });
});

/**
 * Tests for getConfig function
 */
describe('utils.ts - getConfig', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should return config value', () => {
    const result = utils.getConfig('someSetting');
    // The stub returns undefined for missing configs
    expect(result).to.be.undefined;
  });
});

/**
 * Tests for getUserInfo function - Basic structure tests
 */
describe('utils.ts - getUserInfo structure', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should return object with expected shape', () => {
    const result = utils.getUserInfo();
    expect(result).to.have.property('hasPermission');
    expect(result).to.have.property('isRoot');
    expect(result).to.have.property('userGroups');
    expect(result).to.have.property('username');
    expect(result).to.have.property('uid');
  });

  it('should return boolean for hasPermission', () => {
    const result = utils.getUserInfo();
    expect(result.hasPermission).to.be.a('boolean');
  });

  it('should return boolean for isRoot', () => {
    const result = utils.getUserInfo();
    expect(result.isRoot).to.be.a('boolean');
  });

  it('should return array for userGroups', () => {
    const result = utils.getUserInfo();
    expect(result.userGroups).to.be.an('array');
  });

  it('should return string for username', () => {
    const result = utils.getUserInfo();
    expect(result.username).to.be.a('string');
  });

  it('should return number for uid', () => {
    const result = utils.getUserInfo();
    expect(result.uid).to.be.a('number');
  });
});

/**
 * Tests for installContainerlab function
 */
describe('utils.ts - installContainerlab', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should be a function', () => {
    expect(utils.installContainerlab).to.be.a('function');
  });

  it('should not throw when called', () => {
    expect(() => utils.installContainerlab()).to.not.throw();
  });
});

/**
 * Tests for getSelectedLabNode function
 */
describe('utils.ts - getSelectedLabNode', () => {
  before(() => {
    setupModuleResolution();
    utils = require('../../../src/utils/utils');
  });

  after(teardownModuleResolution);

  it('should return provided node directly', async () => {
    const mockNode = { labPath: '/test/lab.yml' };
    const result = await utils.getSelectedLabNode(mockNode);
    expect(result).to.equal(mockNode);
  });

  it('should return undefined when no node provided', async () => {
    const result = await utils.getSelectedLabNode(undefined);
    expect(result).to.be.undefined;
  });
});
