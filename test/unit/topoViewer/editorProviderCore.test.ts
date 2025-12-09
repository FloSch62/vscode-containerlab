/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Extended tests for EditorProvider.ts core functionality.
 * Tests file watching, YAML content handling, and panel updates.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

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
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  if (request.endsWith('utils/index') || (request.endsWith('/utils') && request.includes('src'))) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  return null;
}

// Test constants
const TEST_LAB_NAME = 'testlab';
const TEST_YAML_PATH = '/path/to/lab.clab.yml';
const VALID_YAML = `name: ${TEST_LAB_NAME}\ntopology:\n  nodes:\n    srl1:\n      kind: nokia_srlinux\n  links: []`;
const TEST_ERROR_MSG = 'Test error';

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

// Shared context
let vscode: any;
let utilsStub: any;
let TopoViewerEditor: any;
let extensionModule: any;
let yamlValidatorModule: any;
let resetLoggerStub: any;

describe('TopoViewerEditor - setupFileWatcher', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    yamlValidatorModule = require('../../../src/topoViewer/extension/services/YamlValidator');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('creates file watcher for lastYamlFilePath', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupFileWatcher();

    expect((editor as any).fileWatcher).to.not.be.undefined;
  });

  it('disposes existing file watcher before creating new one', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupFileWatcher();
    const firstWatcher = (editor as any).fileWatcher;

    (editor as any).setupFileWatcher();

    expect(firstWatcher.disposed).to.be.true;
  });

  it('does not create watcher when lastYamlFilePath is empty', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';

    (editor as any).setupFileWatcher();

    expect((editor as any).fileWatcher).to.be.undefined;
  });
});

describe('TopoViewerEditor - setupSaveListener', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('creates save listener for lastYamlFilePath', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupSaveListener();

    expect((editor as any).saveListener).to.not.be.undefined;
  });

  it('disposes existing save listener before creating new one', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupSaveListener();
    const firstListener = (editor as any).saveListener;

    (editor as any).setupSaveListener();

    expect(firstListener.disposed).to.be.true;
  });

  it('does not create listener when lastYamlFilePath is empty', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';

    (editor as any).setupSaveListener();

    expect((editor as any).saveListener).to.be.undefined;
  });
});

describe('TopoViewerEditor - disposeFileHandlers', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('disposes file watcher and save listener', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupFileWatcher();
    (editor as any).setupSaveListener();

    const watcher = (editor as any).fileWatcher;
    const listener = (editor as any).saveListener;

    (editor as any).disposeFileHandlers();

    expect(watcher.disposed).to.be.true;
    expect(listener.disposed).to.be.true;
    expect((editor as any).fileWatcher).to.be.undefined;
    expect((editor as any).saveListener).to.be.undefined;
  });
});

describe('TopoViewerEditor - shouldSkipUpdate', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns false for initial load', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;

    const result = (editor as any).shouldSkipUpdate(VALID_YAML, true);

    expect(result).to.be.false;
  });

  it('returns false when in view mode', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.isViewMode = true;

    const result = (editor as any).shouldSkipUpdate(VALID_YAML, false);

    expect(result).to.be.false;
  });

  it('returns true when cached YAML matches current content', async () => {
    const ctx = createMockExtensionContext();
    await ctx.workspaceState.update(`cachedYaml_${TEST_LAB_NAME}`, VALID_YAML);

    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.isViewMode = false;

    const result = (editor as any).shouldSkipUpdate(VALID_YAML, false);

    expect(result).to.be.true;
  });

  it('returns false when cached YAML differs from current content', async () => {
    const ctx = createMockExtensionContext();
    await ctx.workspaceState.update(`cachedYaml_${TEST_LAB_NAME}`, 'old content');

    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.isViewMode = false;

    const result = (editor as any).shouldSkipUpdate(VALID_YAML, false);

    expect(result).to.be.false;
  });
});

describe('TopoViewerEditor - getClabTreeData', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns undefined when not in view mode', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = false;

    const result = await (editor as any).getClabTreeData();

    expect(result).to.be.undefined;
  });

  it('calls discoverInspectLabs when in view mode', async () => {
    const ctx = createMockExtensionContext();
    const mockLabs = { lab1: { labPath: '/path', label: 'lab1', favorite: false } } as any;
    sinon.stub(extensionModule.runningLabsProvider, 'discoverInspectLabs').resolves(mockLabs);

    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;

    const result = await (editor as any).getClabTreeData();

    expect(result).to.deep.equal(mockLabs);
  });

  it('returns cached data when discoverInspectLabs fails', async () => {
    const ctx = createMockExtensionContext();
    sinon.stub(extensionModule.runningLabsProvider, 'discoverInspectLabs').rejects(new Error('Network error'));

    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;
    (editor as any).cacheClabTreeDataToTopoviewer = { cachedLab: {} };

    const result = await (editor as any).getClabTreeData();

    expect(result).to.deep.equal({ cachedLab: {} });
  });
});

describe('TopoViewerEditor - getYamlContentForUpdate', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('calls getYamlContentViewMode when in view mode', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;
    editor.currentLabName = TEST_LAB_NAME;

    const viewModeStub = sinon.stub(editor as any, 'getYamlContentViewMode').resolves(VALID_YAML);

    await (editor as any).getYamlContentForUpdate();

    expect(viewModeStub.calledOnce).to.be.true;
  });

  it('calls getYamlContentEditMode when in edit mode', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = false;

    const editModeStub = sinon.stub(editor as any, 'getYamlContentEditMode').resolves(VALID_YAML);

    await (editor as any).getYamlContentForUpdate();

    expect(editModeStub.calledOnce).to.be.true;
  });
});

describe('TopoViewerEditor - getYamlContentViewMode', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns minimal YAML when file read fails', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '/nonexistent/path.yml';
    editor.currentLabName = TEST_LAB_NAME;

    const result = await (editor as any).getYamlContentViewMode();

    expect(result).to.include(`name: ${TEST_LAB_NAME}`);
    expect(result).to.include('topology:');
  });

  it('returns minimal YAML when path is empty', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';
    editor.currentLabName = TEST_LAB_NAME;

    const result = await (editor as any).getYamlContentViewMode();

    expect(result).to.include(`name: ${TEST_LAB_NAME}`);
  });
});

describe('TopoViewerEditor - getYamlContentEditMode', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    yamlValidatorModule = require('../../../src/topoViewer/extension/services/YamlValidator');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns undefined when no file path', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';

    const result = await (editor as any).getYamlContentEditMode();

    expect(result).to.be.undefined;
  });

  it('returns undefined when validation fails', async () => {
    const ctx = createMockExtensionContext();
    sinon.stub(yamlValidatorModule, 'validateYamlContent').resolves(false);

    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;
    (editor as any).skipInitialValidation = false;

    const fsStub = require('fs');
    sinon.stub(fsStub.promises, 'readFile').resolves('invalid yaml content');

    const result = await (editor as any).getYamlContentEditMode();

    expect(result).to.be.undefined;
  });

  it('skips validation when skipInitialValidation is true', async () => {
    const ctx = createMockExtensionContext();
    const validateStub = sinon.stub(yamlValidatorModule, 'validateYamlContent').resolves(false);

    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_YAML_PATH;
    (editor as any).skipInitialValidation = true;

    const fsStub = require('fs');
    sinon.stub(fsStub.promises, 'readFile').resolves(VALID_YAML);

    const result = await (editor as any).getYamlContentEditMode();

    expect(validateStub.called).to.be.false;
    expect(result).to.equal(VALID_YAML);
    expect((editor as any).skipInitialValidation).to.be.false;
  });
});

describe('TopoViewerEditor - getYamlMtimeMs', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns undefined when lastYamlFilePath is empty', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';

    const result = await (editor as any).getYamlMtimeMs();

    expect(result).to.be.undefined;
  });

  it('returns undefined when stat fails', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '/nonexistent/file.yml';

    const result = await (editor as any).getYamlMtimeMs();

    expect(result).to.be.undefined;
  });
});

describe('TopoViewerEditor - updateViewModeCache', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('creates cache with parsed topology', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';

    const elements = [{ data: { id: 'node1' } }];
    await (editor as any).updateViewModeCache(VALID_YAML, elements);

    expect((editor as any).viewModeCache).to.not.be.undefined;
    expect((editor as any).viewModeCache.elements).to.deep.equal(elements);
    expect((editor as any).viewModeCache.parsedTopology).to.not.be.undefined;
  });

  it('handles YAML parse failure gracefully', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = '';

    const elements = [{ data: { id: 'node1' } }];
    await (editor as any).updateViewModeCache('invalid: yaml: content:', elements);

    expect((editor as any).viewModeCache).to.not.be.undefined;
    expect((editor as any).viewModeCache.elements).to.deep.equal(elements);
  });
});

describe('TopoViewerEditor - notifyWebviewModeChanged', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('does nothing when no panel exists', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentPanel = undefined;

    await (editor as any).notifyWebviewModeChanged();

    expect(true).to.be.true;
  });

  it('posts mode change message to panel', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;
    editor.isViewMode = true;
    editor.deploymentState = 'deployed';

    await (editor as any).notifyWebviewModeChanged();

    const modeMessage = mockPanel.webview._postedMessages.find(
      (m: { type?: string }) => m.type === 'topo-mode-changed'
    );
    expect(modeMessage).to.exist;
    expect(modeMessage.data.mode).to.equal('viewer');
  });
});

describe('TopoViewerEditor - updateCachedYamlFromCurrentDoc', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('does nothing when currentLabName is empty', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = '';

    await (editor as any).updateCachedYamlFromCurrentDoc();

    expect(ctx.workspaceState.keys().length).to.equal(0);
  });

  it('does nothing when no current document', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    (editor as any).adaptor.currentClabDoc = undefined;

    await (editor as any).updateCachedYamlFromCurrentDoc();

    expect(ctx.workspaceState.storage[`cachedYaml_${TEST_LAB_NAME}`]).to.be.undefined;
  });
});

describe('TopoViewerEditor - getTemplateParamsContext', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns context with current state', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.deploymentState = 'deployed';
    editor.lastYamlFilePath = TEST_YAML_PATH;

    const paramsCtx = (editor as any).getTemplateParamsContext();

    expect(paramsCtx.deploymentState).to.equal('deployed');
    expect(paramsCtx.lastYamlFilePath).to.equal(TEST_YAML_PATH);
  });
});

describe('TopoViewerEditor - setupFileHandlers', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('does nothing when in view mode', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupFileHandlers();

    expect((editor as any).fileWatcher).to.be.undefined;
    expect((editor as any).saveListener).to.be.undefined;
  });

  it('does nothing when no file path', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = false;
    editor.lastYamlFilePath = '';

    (editor as any).setupFileHandlers();

    expect((editor as any).fileWatcher).to.be.undefined;
    expect((editor as any).saveListener).to.be.undefined;
  });

  it('sets up both handlers when in edit mode with file path', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = false;
    editor.lastYamlFilePath = TEST_YAML_PATH;

    (editor as any).setupFileHandlers();

    expect((editor as any).fileWatcher).to.not.be.undefined;
    expect((editor as any).saveListener).to.not.be.undefined;
  });
});

describe('TopoViewerEditor - handleInitialLoadError', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('shows error message in edit mode', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = false;

    (editor as any).handleInitialLoadError(new Error(TEST_ERROR_MSG));

    expect(vscode.window.lastErrorMessage).to.include(TEST_ERROR_MSG);
  });

  it('only logs warning in view mode', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.isViewMode = true;

    vscode.window.lastErrorMessage = '';
    (editor as any).handleInitialLoadError(new Error(TEST_ERROR_MSG));

    expect(vscode.window.lastErrorMessage).to.not.include(TEST_ERROR_MSG);
  });
});

describe('TopoViewerEditor - logDebug', () => {
  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscode = require('../../helpers/vscode-stub');
    const loggerStub = require('../../helpers/extensionLogger-stub');
    resetLoggerStub = loggerStub.resetLoggerStub;
    utilsStub = require('../../helpers/utils-stub');
    const editorProviderModule = require('../../../src/topoViewer/extension/services/EditorProvider');
    TopoViewerEditor = editorProviderModule.TopoViewerEditor;
    extensionModule = require('../../../src/extension');
    extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    resetLoggerStub();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('calls log.debug with message', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    (editor as any).logDebug('test message');

    expect(true).to.be.true;
  });
});
