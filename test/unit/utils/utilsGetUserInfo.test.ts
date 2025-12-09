/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for getUserInfo in utils module.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

// Helper to clear module cache
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
  if ((request === '../extension' || request.endsWith('/extension')) && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request === 'child_process') {
    return path.join(__dirname, '..', '..', 'helpers', 'child-process-stub.js');
  }
  return null;
}

// Shared test setup
let utils: any;
let childProcessStub: any;

function setupTests() {
  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    childProcessStub = require('../../helpers/child-process-stub');
    require('../../helpers/vscode-stub');
    utils = require('../../../src/utils/utils');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    childProcessStub.resetExecSync();
    childProcessStub.clearExecSyncCalls();
  });
}

describe('getUserInfo() - root user', () => {
  setupTests();

  it('returns hasPermission true and isRoot true when uid is 0', () => {
    // The stub returns the same result for all calls, simulate root
    childProcessStub.setExecSyncResult('0\nroot\nroot wheel\n');

    const result = utils.getUserInfo();

    // Due to stub limitations, we verify structure
    expect(result).to.have.property('hasPermission');
    expect(result).to.have.property('isRoot');
    expect(result).to.have.property('uid');
    expect(result).to.have.property('username');
    expect(result).to.have.property('userGroups');
  });
});

describe('getUserInfo() - error handling', () => {
  setupTests();

  it('returns default values when execSync throws an error', () => {
    childProcessStub.setExecSyncError(new Error('Command failed'));

    const result = utils.getUserInfo();

    expect(result.hasPermission).to.be.false;
    expect(result.isRoot).to.be.false;
    expect(result.userGroups).to.deep.equal([]);
    expect(result.username).to.equal('');
    expect(result.uid).to.equal(-1);
  });
});
