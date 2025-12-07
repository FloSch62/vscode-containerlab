/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for the imageCompletion module.
 *
 * Tests YAML completion for image: directive in clab.yml files.
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

// Mock for utils module
let mockDockerImages: string[] = [];
let mockIsClabYamlFile = true;

const utilsMock = {
  getDockerImages: () => mockDockerImages,
  isClabYamlFile: (_path: string) => mockIsClabYamlFile
};

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('utils/index') || request.endsWith('/utils')) {
    return 'UTILS_MOCK';
  }
  return null;
}

// Shared context
let registerClabImageCompletion: Function;
let vscodeStub: any;
let originalModuleRequire: any;

function setupImageCompletionTests() {
  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath === 'UTILS_MOCK') {
        return originalResolve.call(this, request, parent, isMain, options);
      }
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    originalModuleRequire = Module.prototype.require;
    (Module.prototype as any).require = function(id: string) {
      if (id.includes('utils/index') || id.endsWith('/utils')) {
        return utilsMock;
      }
      return originalModuleRequire.call(this, id);
    };

    vscodeStub = require('../../helpers/vscode-stub');

    const imageCompletionModule = require('../../../src/yaml/imageCompletion');
    registerClabImageCompletion = imageCompletionModule.registerClabImageCompletion;
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
    mockDockerImages = [];
    mockIsClabYamlFile = true;
  });
}

describe('registerClabImageCompletion()', () => {
  setupImageCompletionTests();

  it('registers completion provider', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    registerClabImageCompletion(mockContext);

    // Should register both completion provider and auto-trigger listener
    expect(mockContext.subscriptions).to.have.length(2);
  });

  it('adds disposables to context subscriptions', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    registerClabImageCompletion(mockContext);

    mockContext.subscriptions.forEach(sub => {
      expect(sub).to.have.property('dispose');
    });
  });
});

describe('imageCompletion - helper functions behavior', () => {
  setupImageCompletionTests();

  // Test through module registration

  it('module loads without errors', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    expect(() => registerClabImageCompletion(mockContext)).to.not.throw();
  });
});
