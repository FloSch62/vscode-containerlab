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

// Common test image names to avoid duplication
const IMG_ALPINE_LATEST = 'alpine:latest';
const IMG_NGINX_LATEST = 'nginx:latest';
const IMG_NGINX_125 = 'nginx:1.25';
const IMG_ALPINE_318 = 'alpine:3.18';
const IMG_CEOS_LATEST = 'ceos:latest';
const IMG_MYIMAGE_V1 = 'myimage:v1';

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('utils/index') || request.endsWith('/utils')) {
    return 'UTILS_MOCK';
  }
  return null;
}

// Helper to create mock document
function createMockDocument(lines: string[], filePath = '/test/topology.clab.yml') {
  return {
    uri: { fsPath: filePath },
    lineAt: (lineIndex: number) => ({
      text: lines[lineIndex] || ''
    }),
    lineCount: lines.length
  };
}

// Helper to create mock position
function createPosition(line: number, character: number) {
  return { line, character };
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

// -----------------------------------------------------------------------------
// Basic Registration Tests
// -----------------------------------------------------------------------------

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

  it('captures completion provider for YAML files', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    registerClabImageCompletion(mockContext);

    expect(vscodeStub.capturedCompletionProviders).to.have.length(1);
    expect(vscodeStub.capturedCompletionProviders[0].selector).to.deep.equal({
      language: 'yaml',
      scheme: 'file'
    });
  });

  it('registers trigger characters', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    registerClabImageCompletion(mockContext);

    const provider = vscodeStub.capturedCompletionProviders[0];
    expect(provider.triggerCharacters).to.include(':');
    expect(provider.triggerCharacters).to.include(' ');
    expect(provider.triggerCharacters).to.include('/');
  });
});

// -----------------------------------------------------------------------------
// Completion Provider - Non-clab Files
// -----------------------------------------------------------------------------

describe('imageCompletion - non-clab file handling', () => {
  setupImageCompletionTests();

  it('returns undefined for non-clab YAML files', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockIsClabYamlFile = false;

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ], '/test/regular.yaml');

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.be.undefined;
  });
});

// -----------------------------------------------------------------------------
// Completion Provider - inline image: detection
// -----------------------------------------------------------------------------

describe('imageCompletion - inline image detection', () => {
  setupImageCompletionTests();

  it('detects inline image: with cursor after colon', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_NGINX_LATEST, IMG_ALPINE_318];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(2);
  });

  it('detects inline image: with partial text after', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_NGINX_LATEST, IMG_NGINX_125, IMG_ALPINE_318];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: ngi'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 16));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(2);
    expect(result.items[0].label).to.equal(IMG_NGINX_LATEST);
  });

  it('handles case-insensitive image key detection', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      IMAGE: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(1);
  });

  it('returns undefined when image: is inside a comment', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      # image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 15));

    expect(result).to.be.undefined;
  });

  it('detects image: with dash prefix (list item)', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      - image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 15));

    expect(result).to.not.be.undefined;
  });

  it('returns undefined when text before image: is not empty or dash', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      foo: image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 18));

    expect(result).to.be.undefined;
  });
});

// -----------------------------------------------------------------------------
// Completion Provider - previous line ending with image:
// -----------------------------------------------------------------------------

describe('imageCompletion - multiline image value', () => {
  setupImageCompletionTests();

  it('detects image value on line after image:', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image:',
      '        alpine'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(4, 14));

    expect(result).to.not.be.undefined;
  });

  it('does not match when indentation is less than previous image: line', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '        image:',
      '      alpine'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(4, 12));

    expect(result).to.be.undefined;
  });
});

// -----------------------------------------------------------------------------
// Completion Provider - YAML context validation (nodes, defaults, kinds, groups)
// -----------------------------------------------------------------------------

describe('imageCompletion - nodes context', () => {
  setupImageCompletionTests();

  it('provides completions in topology.nodes context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(1);
  });

  it('provides completions in standalone nodes context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'nodes:',
      '  node1:',
      '    image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(2, 11));

    expect(result).to.not.be.undefined;
  });

  it('returns undefined when not inside a node definition', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(2, 11));

    expect(result).to.be.undefined;
  });
});

describe('imageCompletion - defaults context', () => {
  setupImageCompletionTests();

  it('provides completions in topology.defaults context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  defaults:',
      '    image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(2, 11));

    expect(result).to.not.be.undefined;
  });

  it('provides completions in standalone defaults context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'defaults:',
      '  image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(1, 9));

    expect(result).to.not.be.undefined;
  });
});

describe('imageCompletion - kinds context', () => {
  setupImageCompletionTests();

  it('provides completions in topology.kinds context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_CEOS_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  kinds:',
      '    ceos:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
  });

  it('provides completions in standalone kinds context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_CEOS_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'kinds:',
      '  ceos:',
      '    image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(2, 11));

    expect(result).to.not.be.undefined;
  });
});

describe('imageCompletion - groups context', () => {
  setupImageCompletionTests();

  it('provides completions in topology.groups context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  groups:',
      '    spines:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
  });

  it('provides completions in standalone groups context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'groups:',
      '  spines:',
      '    image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(2, 11));

    expect(result).to.not.be.undefined;
  });
});

describe('imageCompletion - invalid contexts', () => {
  setupImageCompletionTests();

  it('returns undefined at root level', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(0, 7));

    expect(result).to.be.undefined;
  });

  it('returns undefined in links context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  links:',
      '    - endpoints:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.be.undefined;
  });
});

// -----------------------------------------------------------------------------
// Completion Provider - filtering and building items
// -----------------------------------------------------------------------------

describe('imageCompletion - filtering images', () => {
  setupImageCompletionTests();

  it('filters images by partial text', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_NGINX_LATEST, IMG_NGINX_125, IMG_ALPINE_318, 'redis:7'];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: ngin'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 17));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(2);
    expect(result.items.every((item: any) => item.label.includes('nginx'))).to.be.true;
  });

  it('filters case-insensitively', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = ['NGINX:latest', IMG_NGINX_125];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: NGI'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 16));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(2);
  });

  it('returns all images when no filter text', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = ['a', 'b', 'c'];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(3);
  });
});

describe('imageCompletion - building completion items', () => {
  setupImageCompletionTests();

  it('returns undefined when no docker images available', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.be.undefined;
  });

  it('creates CompletionItem with correct properties', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_MYIMAGE_V1];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result).to.not.be.undefined;
    expect(result.items[0].label).to.equal(IMG_MYIMAGE_V1);
    expect(result.items[0].insertText).to.equal(IMG_MYIMAGE_V1);
    expect(result.items[0].detail).to.equal('Docker image');
    expect(result.items[0].sortText).to.equal('000000');
  });

  it('assigns incremental sortText for ordering', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = ['first', 'second', 'third'];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result.items[0].sortText).to.equal('000000');
    expect(result.items[1].sortText).to.equal('000001');
    expect(result.items[2].sortText).to.equal('000002');
  });

  it('marks CompletionList as incomplete for dynamic loading', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = ['test'];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 13));

    expect(result.isIncomplete).to.be.true;
  });
});

// -----------------------------------------------------------------------------
// Edge cases and complex scenarios
// -----------------------------------------------------------------------------

describe('imageCompletion - edge cases', () => {
  setupImageCompletionTests();

  it('handles empty document', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([]);

    const result = await provider.provideCompletionItems(doc, createPosition(0, 0));

    expect(result).to.be.undefined;
  });

  it('handles deeply nested structure', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      extra:',
      '        nested:',
      '          deep:',
      '            image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(6, 19));

    // Should still be in nodes context
    expect(result).to.not.be.undefined;
  });

  it('handles tabs for indentation', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '\tnodes:',
      '\t\tnode1:',
      '\t\t\timage: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 10));

    expect(result).to.not.be.undefined;
  });

  it('skips blank lines when determining context', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '',
      '',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(5, 13));

    expect(result).to.not.be.undefined;
  });

  it('handles comment-only lines in path', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    # This is a comment',
      '    node1:',
      '      image: '
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(4, 13));

    expect(result).to.not.be.undefined;
  });

  it('handles image: with quoted value - includes quote in filter', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    // The filter includes the quote, so we need an image that matches '"alp'
    mockDockerImages = ['alpine:latest', '"alpine:special'];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: "alp'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 17));

    // Filter text is '"alp' which only matches images containing that substring
    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(1);
    expect(result.items[0].label).to.equal('"alpine:special');
  });

  it('handles image: with empty quoted value', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [IMG_ALPINE_LATEST];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: "'
    ]);

    // With just a quote, the filter is '"' which won't match typical images
    const result = await provider.provideCompletionItems(doc, createPosition(3, 14));

    // No match because filter is '"' and alpine:latest doesn't contain a quote
    expect(result).to.be.undefined;
  });

  it('handles filter text with registry prefix', async () => {
    const mockContext = { subscriptions: [] as any[] };
    registerClabImageCompletion(mockContext);
    mockDockerImages = [
      'ghcr.io/nokia/srlinux:latest',
      'docker.io/library/nginx:latest',
      'nginx:latest'
    ];

    const provider = vscodeStub.capturedCompletionProviders[0].provider;
    const doc = createMockDocument([
      'topology:',
      '  nodes:',
      '    node1:',
      '      image: ghcr'
    ]);

    const result = await provider.provideCompletionItems(doc, createPosition(3, 17));

    expect(result).to.not.be.undefined;
    expect(result.items).to.have.length(1);
    expect(result.items[0].label).to.equal('ghcr.io/nokia/srlinux:latest');
  });
});

// -----------------------------------------------------------------------------
// Module loading tests
// -----------------------------------------------------------------------------

describe('imageCompletion - module behavior', () => {
  setupImageCompletionTests();

  it('module loads without errors', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    expect(() => registerClabImageCompletion(mockContext)).to.not.throw();
  });

  it('can be registered multiple times without error', () => {
    const mockContext = {
      subscriptions: [] as any[]
    };

    expect(() => {
      registerClabImageCompletion(mockContext);
      registerClabImageCompletion(mockContext);
    }).to.not.throw();

    expect(mockContext.subscriptions.length).to.be.at.least(4);
  });
});
