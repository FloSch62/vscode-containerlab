/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */
/**
 * Tests for EditorProvider.ts view mode caching and panel operations.
 * Tests ensureViewModeCache, buildEdgeUpdatesFromCache, writeTopologyFiles, etc.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache
Object.keys(require.cache).forEach(key => {
  if (key.includes('topoViewer') || key.includes('vscode-stub') || key.includes('extensionLogger-stub') ||
      (key.includes('utils') && !key.includes('node_modules')) ||
      (key.includes('extension') && !key.includes('node_modules'))) {
    delete require.cache[key];
  }
});

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  if (request.endsWith('utils/index') || (request.endsWith('/utils') && request.includes('src'))) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';
import * as utilsStub from '../../helpers/utils-stub';

const EDITOR_PROVIDER_PATH = '../../../src/topoViewer/extension/services/EditorProvider';
const editorProviderModule = require(EDITOR_PROVIDER_PATH) as typeof import('../../../src/topoViewer/extension/services/EditorProvider');
const { TopoViewerEditor } = editorProviderModule;

const extensionModule = require('../../../src/extension') as typeof import('../../../src/extension');

extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;

const TEST_LAB_NAME = 'testlab';
const TEST_YAML_PATH = '/path/to/lab.clab.yml';
const VALID_YAML = `name: ${TEST_LAB_NAME}\ntopology:\n  nodes:\n    srl1:\n      kind: nokia_srlinux\n  links: []`;

interface MockExtensionContext {
  extensionUri: { fsPath: string };
  extensionPath: string;
  subscriptions: { dispose: () => void }[];
  workspaceState: {
    get: <T>(key: string) => T | undefined;
    update: (key: string, value: any) => Promise<void>;
    keys: () => readonly string[];
    storage: Record<string, any>;
  };
  globalState: {
    get: <T>(key: string) => T | undefined;
    update: (key: string, value: any) => Promise<void>;
  };
}

function createMockExtensionContext(): MockExtensionContext {
  const storage: Record<string, any> = {};
  return {
    extensionUri: { fsPath: '/mock/extension' },
    extensionPath: '/mock/extension',
    subscriptions: [],
    workspaceState: {
      storage,
      get: <T>(key: string): T | undefined => storage[key] as T | undefined,
      update: async (key: string, value: any) => {
        storage[key] = value;
      },
      keys: () => Object.keys(storage)
    },
    globalState: {
      get: () => undefined,
      update: async () => {}
    }
  };
}

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

beforeEach(() => {
  resetLoggerStub();
});

afterEach(() => {
  sinon.restore();
  vscode.resetVscodeStub();
  utilsStub.clearDockerImagesMocks();
});

describe('TopoViewerEditor - ensureViewModeCache', () => {
  it('returns early when not in view mode', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = false;

    await (editor as any).ensureViewModeCache(undefined);

    expect((editor as any).viewModeCache).to.be.undefined;
  });

  it('returns early when cache is valid and not stale', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;
    editor.lastYamlFilePath = '';

    // Set up existing cache with elements
    (editor as any).viewModeCache = {
      elements: [{ data: { id: 'node1' } }],
      parsedTopology: { name: TEST_LAB_NAME },
      yamlMtimeMs: undefined
    };

    await (editor as any).ensureViewModeCache(undefined);

    // Cache should remain unchanged
    expect((editor as any).viewModeCache.elements.length).to.equal(1);
  });

  it('reloads cache when cache is empty', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;
    editor.lastYamlFilePath = '';
    editor.currentLabName = TEST_LAB_NAME;

    // Empty cache
    (editor as any).viewModeCache = {
      elements: [],
      parsedTopology: undefined,
      yamlMtimeMs: undefined
    };

    // Stub the adaptor method
    sinon.stub((editor as any).adaptor, 'clabYamlToCytoscapeElements').resolves([
      { data: { id: 'newNode' } }
    ]);

    await (editor as any).ensureViewModeCache(undefined);

    // Cache should be updated
    expect((editor as any).viewModeCache.elements.length).to.equal(1);
    expect((editor as any).viewModeCache.elements[0].data.id).to.equal('newNode');
  });

  it('reloads cache when no cache exists', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;
    editor.lastYamlFilePath = '';
    editor.currentLabName = TEST_LAB_NAME;
    (editor as any).viewModeCache = undefined;

    sinon.stub((editor as any).adaptor, 'clabYamlToCytoscapeElements').resolves([
      { data: { id: 'node1' } }
    ]);

    await (editor as any).ensureViewModeCache(undefined);

    expect((editor as any).viewModeCache).to.not.be.undefined;
    expect((editor as any).viewModeCache.elements.length).to.equal(1);
  });
});

describe('TopoViewerEditor - buildEdgeUpdatesFromCache', () => {
  it('returns empty array when no cache exists', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    (editor as any).viewModeCache = undefined;

    const result = (editor as any).buildEdgeUpdatesFromCache({});

    expect(result).to.be.an('array');
    expect(result.length).to.equal(0);
  });

  it('calls linkStateManager with cache when cache exists', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    (editor as any).viewModeCache = {
      elements: [{ data: { id: 'edge1' } }],
      parsedTopology: undefined,
      yamlMtimeMs: undefined
    };

    // Stub linkStateManager
    const buildStub = sinon.stub((editor as any).linkStateManager, 'buildEdgeUpdatesFromCache').returns([
      { data: { id: 'edge1', state: 'up' } }
    ]);

    const labs = { lab1: { labPath: '/path' } };
    const result = (editor as any).buildEdgeUpdatesFromCache(labs);

    expect(buildStub.calledOnce).to.be.true;
    expect(result.length).to.equal(1);
  });
});

describe('TopoViewerEditor - writeTopologyFiles', () => {
  it('writes topology files successfully', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    sinon.stub((editor as any).adaptor, 'createFolderAndWriteJson').resolves();

    const result = await (editor as any).writeTopologyFiles(
      TEST_LAB_NAME,
      [{ data: { id: 'node1' } }],
      VALID_YAML,
      false
    );

    expect(result).to.be.true;
    expect(ctx.workspaceState.storage[`cachedYaml_${TEST_LAB_NAME}`]).to.equal(VALID_YAML);
  });

  it('handles write failure in non-initial load', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    sinon.stub((editor as any).adaptor, 'createFolderAndWriteJson').rejects(new Error('Write failed'));

    const result = await (editor as any).writeTopologyFiles(
      TEST_LAB_NAME,
      [{ data: { id: 'node1' } }],
      VALID_YAML,
      false
    );

    expect(result).to.be.false;
    expect(vscode.window.lastErrorMessage).to.include('Write failed');
  });

  it('does not block during initial load even on write failure', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    // During initial load, write is non-blocking
    const writePromise = Promise.resolve();
    sinon.stub((editor as any).adaptor, 'createFolderAndWriteJson').returns(writePromise);

    const result = await (editor as any).writeTopologyFiles(
      TEST_LAB_NAME,
      [{ data: { id: 'node1' } }],
      VALID_YAML,
      true
    );

    // Initial load returns true even before write completes
    expect(result).to.be.true;
  });
});

describe('TopoViewerEditor - updatePanelHtmlCore', () => {
  it('returns false when currentLabName is empty', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = '';

    const result = await (editor as any).updatePanelHtmlCore(undefined);

    expect(result).to.be.false;
  });

  it('returns false when YAML content is undefined', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;

    sinon.stub(editor as any, 'getYamlContentForUpdate').resolves(undefined);

    const result = await (editor as any).updatePanelHtmlCore(undefined, false);

    expect(result).to.be.false;
  });

  it('returns true when skipHtml option is set', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.isViewMode = false;

    sinon.stub(editor as any, 'getClabTreeData').resolves(undefined);
    sinon.stub(editor as any, 'getYamlContentForUpdate').resolves(VALID_YAML);
    sinon.stub(editor as any, 'shouldSkipUpdate').returns(false);
    sinon.stub((editor as any).adaptor, 'clabYamlToCytoscapeElements').resolves([]);
    sinon.stub(editor as any, 'writeTopologyFiles').resolves(true);

    const result = await (editor as any).updatePanelHtmlCore(undefined, false, { skipHtml: true });

    expect(result).to.be.true;
  });

  it('returns false when panel is undefined and skipHtml is false', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.isViewMode = false;

    sinon.stub(editor as any, 'getClabTreeData').resolves(undefined);
    sinon.stub(editor as any, 'getYamlContentForUpdate').resolves(VALID_YAML);
    sinon.stub(editor as any, 'shouldSkipUpdate').returns(false);
    sinon.stub((editor as any).adaptor, 'clabYamlToCytoscapeElements').resolves([]);
    sinon.stub(editor as any, 'writeTopologyFiles').resolves(true);

    const result = await (editor as any).updatePanelHtmlCore(undefined, false, { skipHtml: false });

    expect(result).to.be.false;
  });

  it('clears viewModeCache when not in view mode', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.isViewMode = false;
    (editor as any).viewModeCache = { elements: [] };

    sinon.stub(editor as any, 'getClabTreeData').resolves(undefined);
    sinon.stub(editor as any, 'getYamlContentForUpdate').resolves(VALID_YAML);
    sinon.stub(editor as any, 'shouldSkipUpdate').returns(false);
    sinon.stub((editor as any).adaptor, 'clabYamlToCytoscapeElements').resolves([]);
    sinon.stub(editor as any, 'writeTopologyFiles').resolves(true);

    await (editor as any).updatePanelHtmlCore(undefined, false, { skipHtml: true });

    expect((editor as any).viewModeCache).to.be.undefined;
  });
});

describe('TopoViewerEditor - normalizeFileUri', () => {
  it('calls webviewTabManager.normalizeFileUri', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    const fileUri = vscode.Uri.file('/test/path.yml');
    const result = (editor as any).normalizeFileUri(fileUri);

    expect(result).to.not.be.undefined;
  });
});

describe('TopoViewerEditor - revealIfPanelExists', () => {
  it('returns false when no panel exists', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentPanel = undefined;

    const result = (editor as any).revealIfPanelExists(1);

    expect(result).to.be.false;
  });

  it('returns true when panel exists', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    const result = (editor as any).revealIfPanelExists(1);

    expect(result).to.be.true;
  });
});

describe('TopoViewerEditor - loadRunningLabData', () => {
  it('loads lab data from runningLabsProvider', async () => {
    const ctx = createMockExtensionContext();
    const mockLabs = { lab1: { labPath: '/path' } };
    sinon.stub(extensionModule.runningLabsProvider, 'discoverInspectLabs').resolves(mockLabs as any);

    const editor = new TopoViewerEditor(ctx as any);
    await (editor as any).loadRunningLabData();

    expect((editor as any).cacheClabTreeDataToTopoviewer).to.deep.equal(mockLabs);
  });

  it('handles errors gracefully', async () => {
    const ctx = createMockExtensionContext();
    sinon.stub(extensionModule.runningLabsProvider, 'discoverInspectLabs').rejects(new Error('Network error'));

    const editor = new TopoViewerEditor(ctx as any);
    await (editor as any).loadRunningLabData();

    // Should not throw
    expect(true).to.be.true;
  });
});

describe('TopoViewerEditor - loadYamlViewMode', () => {
  it('sets skipInitialValidation to true', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    (editor as any).skipInitialValidation = false;

    await (editor as any).loadYamlViewMode(undefined, TEST_LAB_NAME);

    expect((editor as any).skipInitialValidation).to.be.true;
  });

  it('sets lastYamlFilePath when file exists', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    const fileUri = vscode.Uri.file(TEST_YAML_PATH);

    // Stub fs to simulate file exists
    const fsStub = require('fs');
    sinon.stub(fsStub.promises, 'readFile').resolves(VALID_YAML);

    await (editor as any).loadYamlViewMode(fileUri, TEST_LAB_NAME);

    expect(editor.lastYamlFilePath).to.equal(TEST_YAML_PATH);
  });

  it('clears lastYamlFilePath when file read fails', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    const fileUri = vscode.Uri.file('/nonexistent/path.yml');

    const fsStub = require('fs');
    sinon.stub(fsStub.promises, 'readFile').rejects(new Error('File not found'));

    await (editor as any).loadYamlViewMode(fileUri, TEST_LAB_NAME);

    expect(editor.lastYamlFilePath).to.equal('');
  });
});

describe('TopoViewerEditor - getViewerTemplateParams', () => {
  it('returns params from webviewTabManager', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.deploymentState = 'deployed';
    editor.lastYamlFilePath = TEST_YAML_PATH;

    const params = (editor as any).getViewerTemplateParams();

    expect(params).to.be.an('object');
  });
});

describe('TopoViewerEditor - getEditorTemplateParams', () => {
  it('returns params from webviewTabManager', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.deploymentState = 'undeployed';
    editor.lastYamlFilePath = TEST_YAML_PATH;

    const params = await (editor as any).getEditorTemplateParams();

    expect(params).to.be.an('object');
  });
});

describe('TopoViewerEditor - registerPanelListeners', () => {
  it('registers dispose and message listeners', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});

    (editor as any).registerPanelListeners(mockPanel, ctx);

    // Dispose the panel to trigger the listener
    mockPanel.dispose();

    expect(editor.currentPanel).to.be.undefined;
  });
});
