/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
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

// Constants for test data
const TEST_LAB_NAME = 'testlab';
const DEPLOYED_STATE = 'deployed';
const UNDEPLOYED_STATE = 'undeployed';
const TEST_LAB_PATH = '/path/to/lab.clab.yml';
const TEST_FILE_PATH = '/path/to/file.yml';
const MKDIR_FAILED_ERROR = 'mkdir failed';

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
let splitViewManagerModule: any;
let deploymentStateCheckerModule: any;
let yamlValidatorModule: any;
let asyncUtils: any;
let resetLoggerStub: any;

function setupModuleResolution() {
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
  splitViewManagerModule = require('../../../src/topoViewer/extension/services/SplitViewManager');
  deploymentStateCheckerModule = require('../../../src/topoViewer/extension/services/DeploymentStateChecker');
  yamlValidatorModule = require('../../../src/topoViewer/extension/services/YamlValidator');
  asyncUtils = require('../../../src/topoViewer/shared/utilities/AsyncUtils');
  extensionModule.runningLabsProvider ??= { discoverInspectLabs: async () => ({}) } as any;
}

function teardownModuleResolution() {
  (Module as any)._resolveFilename = originalResolve;
  clearModuleCache();
}

describe('TopoViewerEditor - Constructor and Initialization', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('initializes with correct default state', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    expect(editor.currentPanel).to.be.undefined;
    expect(editor.lastYamlFilePath).to.equal('');
    expect(editor.lastFolderName).to.be.undefined;
    expect(editor.targetDirPath).to.be.undefined;
    expect(editor.createTopoYamlTemplateSuccess).to.be.false;
    expect(editor.currentLabName).to.equal('');
    expect(editor.isViewMode).to.be.false;
    expect(editor.deploymentState).to.equal('unknown');
  });

  it('subscribes to docker images updates', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    expect(ctx.subscriptions.length).to.be.greaterThan(0);
    expect(editor).to.be.instanceOf(TopoViewerEditor);
  });

  it('posts docker images to panel when updated', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('topoViewer', 'Test Panel', {});
    editor.currentPanel = mockPanel as any;

    utilsStub.triggerDockerImagesUpdate(['image:latest']);

    expect(mockPanel.webview._postedMessages).to.deep.include({
      type: 'docker-images-updated',
      dockerImages: ['image:latest']
    });
  });
});

describe('TopoViewerEditor - buildDefaultLabYaml', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('generates default YAML with lab name', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const yaml = (editor as any).buildDefaultLabYaml('mylab');

    expect(yaml).to.include('name: mylab');
    expect(yaml).to.include('topology:');
    expect(yaml).to.include('srl1:');
    expect(yaml).to.include('srl2:');
    expect(yaml).to.include('nokia_srlinux');
  });

  it('includes saved path comment when provided', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const yaml = (editor as any).buildDefaultLabYaml('testlab', '/path/to/file.clab.yml');

    expect(yaml).to.include('name: testlab # saved as /path/to/file.clab.yml');
  });
});

describe('TopoViewerEditor - createTemplateFile', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('creates template file with correct path normalization', async () => {
    const ctx = createMockExtensionContext();
    sinon.stub(asyncUtils, 'sleep').resolves();
    const createDirStub = sinon.stub().resolves();
    const writeFileStub = sinon.stub().resolves();
    (vscode.workspace.fs as any).createDirectory = createDirStub;
    (vscode.workspace.fs as any).writeFile = writeFileStub;

    const editor = new TopoViewerEditor(ctx as any);
    const fileUri = vscode.Uri.file('/path/to/mylab.yml');

    await editor.createTemplateFile(fileUri as any);

    expect(editor.currentLabName).to.equal('mylab');
    expect(editor.lastFolderName).to.equal('mylab');
    expect(editor.lastYamlFilePath).to.equal('/path/to/mylab.clab.yml');
    expect(editor.createTopoYamlTemplateSuccess).to.be.true;
    expect((editor as any).skipInitialValidation).to.be.true;
  });

  it('strips .clab suffix from name if present', async () => {
    const ctx = createMockExtensionContext();
    sinon.stub(asyncUtils, 'sleep').resolves();
    (vscode.workspace.fs as any).createDirectory = sinon.stub().resolves();
    (vscode.workspace.fs as any).writeFile = sinon.stub().resolves();

    const editor = new TopoViewerEditor(ctx as any);
    const fileUri = vscode.Uri.file('/path/to/test.clab.yml');

    await editor.createTemplateFile(fileUri as any);

    expect(editor.currentLabName).to.equal('test');
    expect(editor.lastYamlFilePath).to.equal('/path/to/test.clab.yml');
  });

  it('handles file creation error and marks failure', async () => {
    const ctx = createMockExtensionContext();
    (vscode.workspace.fs as any).createDirectory = sinon.stub().rejects(new Error(MKDIR_FAILED_ERROR));

    const editor = new TopoViewerEditor(ctx as any);
    const fileUri = vscode.Uri.file('/path/to/lab.yml');

    let errorThrown = false;
    await editor.createTemplateFile(fileUri as any).catch((err: Error) => {
      errorThrown = true;
      expect(err.message).to.equal(MKDIR_FAILED_ERROR);
    });

    expect(errorThrown).to.be.true;
    expect(editor.createTopoYamlTemplateSuccess).to.be.false;
    expect(vscode.window.lastErrorMessage).to.include(MKDIR_FAILED_ERROR);
  });
});

describe('TopoViewerEditor - validateYaml', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('delegates to yamlValidator', async () => {
    const ctx = createMockExtensionContext();
    const validateStub = sinon.stub(yamlValidatorModule, 'validateYamlContent').resolves(true);

    const editor = new TopoViewerEditor(ctx as any);
    const result = await (editor as any).validateYaml('name: test\ntopology:\n  nodes: {}');

    expect(validateStub.calledOnce).to.be.true;
    expect(result).to.be.true;
  });

  it('returns false when validation fails', async () => {
    const ctx = createMockExtensionContext();
    sinon.stub(yamlValidatorModule, 'validateYamlContent').resolves(false);

    const editor = new TopoViewerEditor(ctx as any);
    const result = await (editor as any).validateYaml('invalid');

    expect(result).to.be.false;
  });
});

describe('TopoViewerEditor - updatePanelHtml guards', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns false when currentLabName is empty', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = '';

    const result = await editor.updatePanelHtml(undefined);

    expect(result).to.be.false;
  });

  it('returns false when mode switching is in progress', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    (editor as any).isSwitchingMode = true;

    const result = await editor.updatePanelHtml(undefined);

    expect(result).to.be.false;
  });

  it('returns false when already updating', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    (editor as any).isUpdating = true;

    const result = await editor.updatePanelHtml(undefined);

    expect(result).to.be.false;
  });
});

describe('TopoViewerEditor - triggerUpdate', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('queues update when already updating', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    (editor as any).isUpdating = true;
    (editor as any).queuedUpdate = false;

    await (editor as any).triggerUpdate(false);

    expect((editor as any).queuedUpdate).to.be.true;
  });

  it('skips update when mode switching is in progress', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    (editor as any).isSwitchingMode = true;
    const updateSpy = sinon.spy(editor, 'updatePanelHtml');

    await (editor as any).triggerUpdate(false);

    expect(updateSpy.called).to.be.false;
  });

  it('sends yaml-saved message after successful save-triggered update', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;
    sinon.stub(editor as any, 'updatePanelHtml').resolves(true);

    await (editor as any).triggerUpdate(true);

    expect(mockPanel.webview._postedMessages).to.deep.include({ type: 'yaml-saved' });
  });
});

describe('TopoViewerEditor - postLifecycleStatus', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('posts lifecycle status to panel', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    await editor.postLifecycleStatus({
      commandType: 'deploy',
      status: 'success'
    });

    expect(mockPanel.webview._postedMessages).to.deep.include({
      type: 'lab-lifecycle-status',
      data: { commandType: 'deploy', status: 'success' }
    });
  });

  it('does nothing when panel is undefined', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentPanel = undefined;

    await editor.postLifecycleStatus({
      commandType: 'destroy',
      status: 'error',
      errorMessage: 'failed'
    });

    expect(editor.currentPanel).to.be.undefined;
  });
});

describe('TopoViewerEditor - isModeSwitchInProgress', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns current mode switch state', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    expect(editor.isModeSwitchInProgress).to.be.false;

    (editor as any).isSwitchingMode = true;
    expect(editor.isModeSwitchInProgress).to.be.true;
  });
});

describe('TopoViewerEditor - checkDeploymentState', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('delegates to deploymentStateChecker', async () => {
    const ctx = createMockExtensionContext();
    const checkStub = sinon.stub(deploymentStateCheckerModule.deploymentStateChecker, 'checkDeploymentState')
      .resolves(DEPLOYED_STATE);

    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_LAB_PATH;

    const result = await editor.checkDeploymentState('mylab');

    expect(checkStub.calledOnce).to.be.true;
    expect(result).to.equal(DEPLOYED_STATE);
  });
});

describe('TopoViewerEditor - openTemplateFile and toggleSplitView', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('delegates openTemplateFile to splitViewManager', async () => {
    const ctx = createMockExtensionContext();
    const openStub = sinon.stub(splitViewManagerModule.splitViewManager, 'openTemplateFile').resolves();

    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    await editor.openTemplateFile(TEST_FILE_PATH);

    expect(openStub.calledOnceWith(TEST_FILE_PATH, mockPanel)).to.be.true;
  });

  it('delegates toggleSplitView to splitViewManager', async () => {
    const ctx = createMockExtensionContext();
    const toggleStub = sinon.stub(splitViewManagerModule.splitViewManager, 'toggleSplitView').resolves();

    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_LAB_PATH;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    await editor.toggleSplitView();

    expect(toggleStub.calledOnceWith('/path/to/lab.clab.yml', mockPanel)).to.be.true;
  });
});

describe('TopoViewerEditor - forceUpdateAfterCommand', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('clears switching flags and calls updatePanelHtmlCore', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    (editor as any).isSwitchingMode = true;
    (editor as any).isUpdating = true;
    editor.currentLabName = TEST_LAB_NAME;
    const coreStub = sinon.stub(editor as any, 'updatePanelHtmlCore').resolves(true);

    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    const result = await editor.forceUpdateAfterCommand(mockPanel as any);

    expect((editor as any).isSwitchingMode).to.be.false;
    expect((editor as any).isUpdating).to.be.false;
    expect(coreStub.calledOnceWith(mockPanel, true)).to.be.true;
    expect(result).to.be.true;
  });
});

describe('TopoViewerEditor - refreshAfterExternalCommand', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns false when no panel', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentPanel = undefined;

    const result = await editor.refreshAfterExternalCommand(DEPLOYED_STATE);

    expect(result).to.be.false;
  });

  it('updates deployment state and mode', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;
    sinon.stub(editor as any, 'updatePanelHtmlCore').resolves(true);
    sinon.stub(editor as any, 'notifyWebviewModeChanged').resolves();

    const result = await editor.refreshAfterExternalCommand(DEPLOYED_STATE);

    expect(editor.deploymentState).to.equal(DEPLOYED_STATE);
    expect(editor.isViewMode).to.be.true;
    expect(result).to.be.true;
  });

  it('sets edit mode for undeployed state', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;
    sinon.stub(editor as any, 'updatePanelHtmlCore').resolves(true);
    sinon.stub(editor as any, 'notifyWebviewModeChanged').resolves();

    await editor.refreshAfterExternalCommand(UNDEPLOYED_STATE);

    expect(editor.deploymentState).to.equal(UNDEPLOYED_STATE);
    expect(editor.isViewMode).to.be.false;
  });
});

describe('TopoViewerEditor - handleWebviewMessage', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('ignores invalid messages', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});

    await (editor as any).handleWebviewMessage(null, mockPanel);
    await (editor as any).handleWebviewMessage(undefined, mockPanel);
    await (editor as any).handleWebviewMessage('string', mockPanel);

    expect(true).to.be.true;
  });

  it('processes log messages correctly', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});

    await (editor as any).handleWebviewMessage({
      command: 'topoViewerLog',
      level: 'info',
      message: 'test info message'
    }, mockPanel);

    expect(true).to.be.true;
  });

  it('handles POST messages with missing fields', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});

    await (editor as any).handleWebviewMessage({
      type: 'POST',
    }, mockPanel);

    const errorResponse = mockPanel.webview._postedMessages.find(
      (m: { type?: string }) => m.type === 'POST_RESPONSE'
    );
    expect(errorResponse).to.exist;
    expect(errorResponse.error).to.include('Missing required field');
  });

  it('handles unrecognized message types gracefully', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});

    await (editor as any).handleWebviewMessage({
      type: 'UNKNOWN_TYPE',
      requestId: '123'
    }, mockPanel);

    expect(mockPanel.webview._postedMessages.length).to.equal(0);
  });
});

describe('TopoViewerEditor - processLogMessage', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('processes different log levels', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    (editor as any).processLogMessage({ level: 'error', message: 'error msg' });
    (editor as any).processLogMessage({ level: 'warn', message: 'warn msg' });
    (editor as any).processLogMessage({ level: 'debug', message: 'debug msg' });
    (editor as any).processLogMessage({ level: 'info', message: 'info msg' });
    (editor as any).processLogMessage({ message: 'default msg' });

    expect(true).to.be.true;
  });

  it('includes file line info when provided', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    (editor as any).processLogMessage({
      level: 'info',
      message: 'test',
      fileLine: 'file.ts:123'
    });

    expect(true).to.be.true;
  });
});

describe('TopoViewerEditor - handleGeneralEndpoint', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns error for unknown endpoints', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});

    const result = await (editor as any).handleGeneralEndpoint(
      'unknown-endpoint',
      undefined,
      undefined,
      mockPanel
    );

    expect(result.result).to.be.null;
    expect(result.error).to.include('Unknown endpoint');
  });
});

describe('TopoViewerEditor - handleSwitchModeEndpoint', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('rejects when mode switch is already in progress', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    (editor as any).isSwitchingMode = true;

    const result = await (editor as any).handleSwitchModeEndpoint(
      undefined,
      undefined,
      mockPanel
    );

    expect(result.result).to.be.null;
    expect(result.error).to.include('Mode switch already in progress');
  });

  it('toggles mode when no specific mode requested', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.lastYamlFilePath = TEST_LAB_PATH;
    editor.isViewMode = false;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    sinon.stub(deploymentStateCheckerModule.deploymentStateChecker, 'checkDeploymentState')
      .resolves(DEPLOYED_STATE);
    sinon.stub(editor as any, 'updatePanelHtmlCore').resolves(true);
    sinon.stub(editor as any, 'notifyWebviewModeChanged').resolves();
    sinon.stub(asyncUtils, 'sleep').resolves();

    const result = await (editor as any).handleSwitchModeEndpoint(
      undefined,
      undefined,
      mockPanel
    );

    expect(result.error).to.be.null;
    expect(result.result.mode).to.equal('view');
    expect(editor.isViewMode).to.be.true;
  });

  it('sets view mode when explicitly requested', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.lastYamlFilePath = TEST_LAB_PATH;
    editor.isViewMode = false;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    sinon.stub(deploymentStateCheckerModule.deploymentStateChecker, 'checkDeploymentState')
      .resolves(DEPLOYED_STATE);
    sinon.stub(editor as any, 'updatePanelHtmlCore').resolves(true);
    sinon.stub(editor as any, 'notifyWebviewModeChanged').resolves();
    sinon.stub(asyncUtils, 'sleep').resolves();

    const result = await (editor as any).handleSwitchModeEndpoint(
      JSON.stringify({ mode: 'view' }),
      undefined,
      mockPanel
    );

    expect(result.error).to.be.null;
    expect(result.result.mode).to.equal('view');
    expect(editor.isViewMode).to.be.true;
  });

  it('sets edit mode when explicitly requested', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.lastYamlFilePath = TEST_LAB_PATH;
    editor.isViewMode = true;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    sinon.stub(deploymentStateCheckerModule.deploymentStateChecker, 'checkDeploymentState')
      .resolves(UNDEPLOYED_STATE);
    sinon.stub(editor as any, 'updatePanelHtmlCore').resolves(true);
    sinon.stub(editor as any, 'notifyWebviewModeChanged').resolves();
    sinon.stub(asyncUtils, 'sleep').resolves();

    const result = await (editor as any).handleSwitchModeEndpoint(
      JSON.stringify({ mode: 'edit' }),
      undefined,
      mockPanel
    );

    expect(result.error).to.be.null;
    expect(result.result.mode).to.equal('edit');
    expect(editor.isViewMode).to.be.false;
  });

  it('handles errors during mode switch', async () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.currentLabName = TEST_LAB_NAME;
    editor.lastYamlFilePath = TEST_LAB_PATH;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    sinon.stub(deploymentStateCheckerModule.deploymentStateChecker, 'checkDeploymentState')
      .rejects(new Error('Deployment check failed'));
    sinon.stub(asyncUtils, 'sleep').resolves();

    const result = await (editor as any).handleSwitchModeEndpoint(
      undefined,
      undefined,
      mockPanel
    );

    expect(result.result).to.be.null;
    expect(result.error).to.include('Error switching mode');
    expect((editor as any).isSwitchingMode).to.be.false;
  });
});

describe('TopoViewerEditor - getHandlerContext', () => {
  before(setupModuleResolution);
  after(teardownModuleResolution);
  beforeEach(() => resetLoggerStub());
  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
    utilsStub.clearDockerImagesMocks();
  });

  it('returns correct context object', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);
    editor.lastYamlFilePath = TEST_LAB_PATH;
    editor.currentLabName = TEST_LAB_NAME;
    const mockPanel = new vscode.MockWebviewPanel('test', 'Test', {});
    editor.currentPanel = mockPanel as any;

    const handlerContext = (editor as any).getHandlerContext();

    expect(handlerContext.lastYamlFilePath).to.equal(TEST_LAB_PATH);
    expect(handlerContext.currentLabName).to.equal(TEST_LAB_NAME);
    expect(handlerContext.context).to.equal(ctx);
    expect(handlerContext.currentPanel).to.equal(mockPanel);
    expect(handlerContext.setInternalUpdate).to.be.a('function');
    expect(handlerContext.updateCachedYaml).to.be.a('function');
    expect(handlerContext.postMessage).to.be.a('function');
  });

  it('setInternalUpdate updates the editor flag', () => {
    const ctx = createMockExtensionContext();
    const editor = new TopoViewerEditor(ctx as any);

    const handlerContext = (editor as any).getHandlerContext();
    handlerContext.setInternalUpdate(true);

    expect((editor as any).isInternalUpdate).to.be.true;
  });
});
