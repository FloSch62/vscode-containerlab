/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the deleteLab command.
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

// Mock fs module
let fsUnlinkCalls: string[] = [];
let fsUnlinkShouldFail = false;
let fsUnlinkError: Error | null = null;

const fsMock = {
  promises: {
    unlink: async (filePath: string) => {
      fsUnlinkCalls.push(filePath);
      if (fsUnlinkShouldFail) {
        throw fsUnlinkError ?? new Error('Mock unlink error');
      }
    }
  }
};

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('extension') && !request.includes('stub') && !request.includes('.test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request === 'fs') {
    // Return a special marker - we'll handle fs differently
    return 'FS_MOCK';
  }
  return null;
}

// Constants
const NO_LAB_ERROR = 'No lab file found.';
const TEST_LAB_LABEL = 'test-lab';
const TEST_LAB_PATH = '/path/to/lab.clab.yml';

// Table-driven test cases
interface DeleteLabErrorCase {
  description: string;
  node: any;
  expectedError: string;
}

const errorCases: DeleteLabErrorCase[] = [
  {
    description: 'shows error when node is undefined',
    node: undefined,
    expectedError: NO_LAB_ERROR
  },
  {
    description: 'shows error when node has no labPath',
    node: { label: TEST_LAB_LABEL },
    expectedError: NO_LAB_ERROR
  },
  {
    description: 'shows error when labPath has no absolute',
    node: { label: TEST_LAB_LABEL, labPath: {} },
    expectedError: NO_LAB_ERROR
  }
];

// Shared context
let deleteLab: Function;
let vscodeStub: any;
let extensionStub: any;

let originalModuleRequire: any;

function setupDeleteLabTests() {
  before(() => {
    clearModuleCache();

    // Set up module interception with fs mock
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath === 'FS_MOCK') {
        // For fs, we need to return a path that exists but we'll intercept the require
        return originalResolve.call(this, request, parent, isMain, options);
      }
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    // Intercept require for fs
    originalModuleRequire = Module.prototype.require;
    (Module.prototype as any).require = function(id: string) {
      if (id === 'fs') {
        return fsMock;
      }
      return originalModuleRequire.call(this, id);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    extensionStub = require('../../helpers/extension-stub');

    const deleteLabModule = require('../../../src/commands/deleteLab');
    deleteLab = deleteLabModule.deleteLab;
  });

  after(() => {
    // Restore original require
    if (originalModuleRequire) {
      Module.prototype.require = originalModuleRequire;
    }
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    extensionStub.resetExtensionStub();
    fsUnlinkCalls = [];
    fsUnlinkShouldFail = false;
    fsUnlinkError = null;
    // Set default to confirm delete
    vscodeStub.window.lastWarningSelection = 'Delete';
  });
}

describe('deleteLab() - error handling', () => {
  setupDeleteLabTests();

  errorCases.forEach(({ description, node, expectedError }) => {
    it(description, async () => {
      await deleteLab(node);
      expect(vscodeStub.window.lastErrorMessage).to.equal(expectedError);
    });
  });
});

describe('deleteLab() - confirmation dialog', () => {
  setupDeleteLabTests();

  it('does not delete when user cancels', async () => {
    vscodeStub.window.lastWarningSelection = undefined; // User cancelled
    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(fsUnlinkCalls).to.have.length(0);
    expect(vscodeStub.window.lastInfoMessage).to.equal('');
  });

  it('shows warning message with correct text', async () => {
    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(vscodeStub.window.lastWarningMessage).to.include('Delete lab');
    expect(vscodeStub.window.lastWarningMessage).to.include('lab.clab.yml');
    expect(vscodeStub.window.lastWarningMessage).to.include('cannot be undone');
  });
});

describe('deleteLab() - successful deletion', () => {
  setupDeleteLabTests();

  it('deletes lab file when confirmed', async () => {
    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(fsUnlinkCalls).to.have.length(1);
    expect(fsUnlinkCalls[0]).to.equal(TEST_LAB_PATH);
  });

  it('shows success message after deletion', async () => {
    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(vscodeStub.window.lastInfoMessage).to.include('Deleted lab file');
    expect(vscodeStub.window.lastInfoMessage).to.include(TEST_LAB_LABEL);
  });

  it('removes lab from favorites', async () => {
    extensionStub.favoriteLabs.add(TEST_LAB_PATH);

    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(extensionStub.favoriteLabs.has(TEST_LAB_PATH)).to.be.false;
  });

  it('executes refresh command after deletion', async () => {
    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    const refreshCmd = vscodeStub.commands.executed.find(
      (c: any) => c.command === 'containerlab.refresh'
    );
    expect(refreshCmd).to.exist;
  });
});

describe('deleteLab() - deletion errors', () => {
  setupDeleteLabTests();

  it('shows error message when deletion fails', async () => {
    fsUnlinkShouldFail = true;
    fsUnlinkError = new Error('Permission denied');

    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to delete lab');
    expect(vscodeStub.window.lastErrorMessage).to.include('Permission denied');
  });

  it('handles non-Error exceptions', async () => {
    fsUnlinkShouldFail = true;
    fsUnlinkError = { toString: () => 'Custom error' } as any;

    const node = {
      label: TEST_LAB_LABEL,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await deleteLab(node);

    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to delete lab');
  });
});
