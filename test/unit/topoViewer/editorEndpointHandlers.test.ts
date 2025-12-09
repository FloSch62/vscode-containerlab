/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import Module from 'module';
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';

// Redirect vscode and logger imports to stubs for the module under test
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

const handlerModule = require('../../../src/topoViewer/extension/services/EditorEndpointHandlers') as typeof import('../../../src/topoViewer/extension/services/EditorEndpointHandlers');
const { editorEndpointHandlers } = handlerModule;
type EndpointHandlerContext = import('../../../src/topoViewer/extension/services/EditorEndpointHandlers').EndpointHandlerContext;

const saveViewportModule = require('../../../src/topoViewer/extension/services/SaveViewport');
const imagesModule = require('../../../src/utils/docker/images');
const yamlSettingsManager = require('../../../src/topoViewer/extension/services/YamlSettingsManager').yamlSettingsManager;
const annotationsManager = require('../../../src/topoViewer/extension/services/AnnotationsFile').annotationsManager;
const iconManager = require('../../../src/topoViewer/extension/services/IconManager').iconManager;
const splitViewManager = require('../../../src/topoViewer/extension/services/SplitViewManager').splitViewManager;
const resolveNodeConfigModule = require('../../../src/topoViewer/webview/core/nodeConfig');
const customNodeConfigManager = require('../../../src/topoViewer/extension/services/CustomNodeConfigManager').customNodeConfigManager;
const simpleEndpointHandlers = require('../../../src/topoViewer/extension/services/SimpleEndpointHandlers').simpleEndpointHandlers;

function createEndpointContext(overrides: Partial<EndpointHandlerContext> = {}): EndpointHandlerContext {
  const adaptor = overrides.adaptor ?? ({ currentClabTopo: undefined } as any);
  const ctx: EndpointHandlerContext = {
    lastYamlFilePath: overrides.lastYamlFilePath ?? '/labs/test.clab.yml',
    currentLabName: overrides.currentLabName ?? 'test',
    adaptor: adaptor as any,
    context: overrides.context ?? ({} as any),
    currentPanel: overrides.currentPanel,
    isInternalUpdate: overrides.isInternalUpdate ?? false,
    setInternalUpdate: value => {
      ctx.isInternalUpdate = value;
      if (overrides.setInternalUpdate) {
        overrides.setInternalUpdate(value);
      }
    },
    updateCachedYaml: overrides.updateCachedYaml ?? sinon.stub().resolves(),
    postMessage: overrides.postMessage ?? sinon.stub()
  };
  return ctx;
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
});

describe('EditorEndpointHandlers - viewport saves', () => {
  it('saves viewport in view mode and returns success message', async () => {
    const saveStub = sinon.stub(saveViewportModule, 'saveViewport').resolves();
    const ctx = createEndpointContext();

    const result = await editorEndpointHandlers.handleViewportSaveEndpoint('payload', ctx);

    expect(saveStub.calledOnceWith({
      yamlFilePath: ctx.lastYamlFilePath,
      payload: 'payload',
      mode: 'view'
    })).to.be.true;
    expect(result).to.deep.equal({ result: 'Saved viewport positions successfully.', error: null });
  });

  it('resets internal update flag when edit-mode save fails', async () => {
    sinon.stub(saveViewportModule, 'saveViewport').rejects(new Error('fail'));
    const setInternalUpdate = sinon.spy();
    const updateCachedYaml = sinon.stub().resolves();
    const ctx = createEndpointContext({ setInternalUpdate, updateCachedYaml });

    const result = await editorEndpointHandlers.handleViewportSaveEditEndpoint('payload', ctx);

    expect(setInternalUpdate.calledWith(false)).to.be.true;
    expect(updateCachedYaml.called).to.be.false;
    expect(result).to.deep.equal({ result: null, error: null });
  });

  it('saves edit-mode viewport without notification and updates cache', async () => {
    const saveStub = sinon.stub(saveViewportModule, 'saveViewport').resolves();
    const updateCachedYaml = sinon.stub().resolves();
    const ctx = createEndpointContext({ updateCachedYaml });

    const result = await editorEndpointHandlers.handleViewportSaveSuppressNotificationEndpoint('payload', ctx);

    expect(saveStub.calledOnce).to.be.true;
    expect(updateCachedYaml.calledOnce).to.be.true;
    expect(result).to.deep.equal({ result: null, error: null });
  });
});

describe('EditorEndpointHandlers - lab settings', () => {
  const UPDATED_YAML_CONTENT = 'updated-yaml';

  it('updates lab settings and writes merged YAML', async () => {
    const readStub = sinon.stub(fs.promises, 'readFile').resolves('name: test');
    const applyStub = sinon.stub(yamlSettingsManager, 'applyExistingSettings').returns({ hadPrefix: false, hadMgmt: true });
    const insertStub = sinon.stub(yamlSettingsManager, 'insertMissingSettings').returns(UPDATED_YAML_CONTENT);
    const writeStub = sinon.stub(fs.promises, 'writeFile').resolves();
    const postMessage = sinon.spy();
    const ctx = createEndpointContext({ postMessage });

    const result = await editorEndpointHandlers.updateLabSettings({ prefix: 'clab', mgmt: {} }, ctx);

    expect(readStub.calledOnceWith(ctx.lastYamlFilePath, 'utf8')).to.be.true;
    expect(applyStub.calledOnce).to.be.true;
    expect(insertStub.calledOnce).to.be.true;
    expect(writeStub.calledWith(ctx.lastYamlFilePath, UPDATED_YAML_CONTENT, 'utf8')).to.be.true;
    expect(postMessage.calledOnce).to.be.true;
    expect(result).to.deep.equal({ success: true, yamlContent: UPDATED_YAML_CONTENT });
    expect(ctx.isInternalUpdate).to.be.false;
  });

  it('returns error result when reading settings fails', async () => {
    sinon.stub(fs.promises, 'readFile').rejects(new Error('read-fail'));

    const result = await editorEndpointHandlers.handleLabSettingsGetEndpoint(createEndpointContext());

    const payload = result.result as { success: boolean; error?: unknown };
    expect(payload.success).to.be.false;
    expect(String(payload.error)).to.include('read-fail');
  });

  it('propagates update result when handling settings update endpoint', async () => {
    const updateStub = sinon.stub(editorEndpointHandlers as any, 'updateLabSettings').resolves({ success: false, error: 'bad' });

    const result = await editorEndpointHandlers.handleLabSettingsUpdateEndpoint(undefined, { prefix: 'x' }, createEndpointContext());

    expect(updateStub.calledOnce).to.be.true;
    const payload = result.result as { success: boolean; error?: string };
    expect(payload).to.deep.equal({ success: false, error: 'bad' });
  });
});

describe('EditorEndpointHandlers - viewer and annotations', () => {
  it('loads viewer settings from annotations', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').resolves({ viewerSettings: { locked: true } });

    const result = await editorEndpointHandlers.handleLoadViewerSettingsEndpoint(createEndpointContext());

    expect(result.result).to.deep.equal({ viewerSettings: { locked: true } });
  });

  it('merges and saves viewer settings', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').resolves({
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: [],
      viewerSettings: { theme: 'dark' }
    });
    const saveStub = sinon.stub(annotationsManager, 'saveAnnotations').resolves();
    const payload = { viewerSettings: { zoom: 1 } };

    const result = await editorEndpointHandlers.handleSaveViewerSettingsEndpoint(payload, createEndpointContext());

    expect(saveStub.calledOnce).to.be.true;
    const saved = saveStub.firstCall.args[1] as any;
    expect(saved.viewerSettings).to.deep.equal({ theme: 'dark', zoom: 1 });
    expect(result.result).to.deep.equal({ success: true });
  });

  it('saves annotations while preserving cloud/node data', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').resolves({
      freeTextAnnotations: [{ id: 'old' }],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [{ id: 'cloud' }],
      nodeAnnotations: [{ id: 'node' }],
      viewerSettings: { locked: true }
    });
    const saveStub = sinon.stub(annotationsManager, 'saveAnnotations').resolves();
    const payload = {
      annotations: [{ id: 'new' }],
      freeShapeAnnotations: [{ id: 'shape' }],
      groupStyles: [{ id: 'group' }]
    };

    const result = await editorEndpointHandlers.handleSaveAnnotationsEndpoint(payload, createEndpointContext());

    expect(saveStub.calledOnce).to.be.true;
    const saved = saveStub.firstCall.args[1] as any;
    expect(saved.freeTextAnnotations).to.deep.equal(payload.annotations);
    expect(saved.freeShapeAnnotations).to.deep.equal(payload.freeShapeAnnotations);
    expect(saved.groupStyleAnnotations).to.deep.equal(payload.groupStyles);
    expect(saved.cloudNodeAnnotations).to.deep.equal([{ id: 'cloud' }]);
    expect(saved.nodeAnnotations).to.deep.equal([{ id: 'node' }]);
    expect(result.result).to.deep.equal({ success: true });
  });
});

describe('EditorEndpointHandlers - icon handlers', () => {
  it('returns cancelled result when upload is not started', async () => {
    sinon.stub(iconManager, 'promptIconUploadSource').resolves(undefined);

    const result = await editorEndpointHandlers.handleUploadIconEndpoint();

    expect(result.result).to.deep.equal({ cancelled: true });
  });

  it('deletes custom icons and reloads list', async () => {
    sinon.stub(iconManager, 'deleteCustomIcon').resolves(true);
    sinon.stub(iconManager, 'loadCustomIcons').resolves([{ name: 'router' }]);

    const result = await editorEndpointHandlers.handleDeleteIconEndpoint({ iconName: 'router' });

    const payload = result.result as { success?: boolean; deletedIcon?: string };
    expect(payload?.success).to.be.true;
    expect(payload?.deletedIcon).to.equal('router');
    expect(vscode.window.lastInfoMessage).to.include('Deleted custom icon');
  });

  it('returns error when icon name is missing', async () => {
    const result = await editorEndpointHandlers.handleDeleteIconEndpoint({});

    expect(result.error).to.include('Icon name is required');
  });
});

describe('EditorEndpointHandlers - node config and misc endpoints', () => {
  it('returns merged node config with inherited keys', async () => {
    const yamlContent = 'name: lab\ntopology:\n  nodes:\n    r1:\n      kind: linux\n      type: ixr\n  defaults:\n    kind: linux\n';
    sinon.stub(fs.promises, 'readFile').resolves(yamlContent);
    const resolveStub = sinon.stub(resolveNodeConfigModule, 'resolveNodeConfig').returns({ kind: 'linux', type: 'ixr', image: 'img:1' });
    const adaptor = { currentClabTopo: undefined } as any;
    const ctx = createEndpointContext({ adaptor });

    const result = await editorEndpointHandlers.handleGetNodeConfigEndpoint('r1', ctx);

    expect(resolveStub.calledOnce).to.be.true;
    expect((result.result as any).inherited).to.include('image');
    expect(adaptor.currentClabTopo).to.be.an('object');
  });

  it('returns error when node name is missing', async () => {
    const result = await editorEndpointHandlers.handleGetNodeConfigEndpoint({}, createEndpointContext());

    expect(result.error).to.include('Node name is required');
  });

  it('refreshes docker images and returns list', async () => {
    sinon.stub(imagesModule, 'refreshDockerImages').resolves();
    sinon.stub(imagesModule, 'getDockerImages').returns(['img:latest']);

    const result = await editorEndpointHandlers.handleRefreshDockerImagesEndpoint();

    const payload = result.result as { success?: boolean; dockerImages?: string[] };
    expect(payload?.success).to.be.true;
    expect(payload?.dockerImages).to.deep.equal(['img:latest']);
  });

  it('handles errors when refreshing docker images', async () => {
    sinon.stub(imagesModule, 'refreshDockerImages').rejects(new Error('fail'));

    const result = await editorEndpointHandlers.handleRefreshDockerImagesEndpoint();

    expect(result.error).to.include('fail');
  });

  it('toggles split view using manager', async () => {
    sinon.stub(splitViewManager, 'toggleSplitView').resolves(true);
    const ctx = createEndpointContext({ lastYamlFilePath: '/labs/lab.clab.yml', currentPanel: {} as any });

    const result = await editorEndpointHandlers.handleToggleSplitViewEndpoint(ctx);

    const payload = result.result as { splitViewOpen?: boolean };
    expect(payload?.splitViewOpen).to.be.true;
  });

  it('returns error when lastYamlFilePath is missing', async () => {
    const ctx = createEndpointContext({ lastYamlFilePath: '' });

    const result = await editorEndpointHandlers.handleGetNodeConfigEndpoint('r1', ctx);

    expect(result.error).to.include('No lab YAML file loaded');
  });
});

describe('EditorEndpointHandlers - viewport error paths', () => {
  it('returns error result when view-mode save fails', async () => {
    sinon.stub(saveViewportModule, 'saveViewport').rejects(new Error('view-save-fail'));
    const ctx = createEndpointContext();

    const result = await editorEndpointHandlers.handleViewportSaveEndpoint('payload', ctx);

    expect(result).to.deep.equal({ result: null, error: null });
  });

  it('returns error and resets internal update on suppress notification failure', async () => {
    sinon.stub(saveViewportModule, 'saveViewport').rejects(new Error('suppress-fail'));
    const setInternalUpdate = sinon.spy();
    const ctx = createEndpointContext({ setInternalUpdate });

    const result = await editorEndpointHandlers.handleViewportSaveSuppressNotificationEndpoint('payload', ctx);

    expect(setInternalUpdate.calledWith(false)).to.be.true;
    expect(result.result).to.include('Error executing');
  });

  it('successfully saves edit-mode viewport and returns success', async () => {
    sinon.stub(saveViewportModule, 'saveViewport').resolves();
    const updateCachedYaml = sinon.stub().resolves();
    const ctx = createEndpointContext({ updateCachedYaml });

    const result = await editorEndpointHandlers.handleViewportSaveEditEndpoint('payload', ctx);

    expect(updateCachedYaml.calledOnce).to.be.true;
    expect(result).to.deep.equal({ result: 'Saved topology with preserved comments!', error: null });
  });
});

describe('EditorEndpointHandlers - lab settings success paths', () => {
  it('successfully retrieves lab settings from YAML file', async () => {
    const yamlContent = 'name: mylab\nprefix: clab\nmgmt:\n  network: custom\n';
    sinon.stub(fs.promises, 'readFile').resolves(yamlContent);

    const result = await editorEndpointHandlers.handleLabSettingsGetEndpoint(createEndpointContext());

    const payload = result.result as { success: boolean; settings?: any };
    expect(payload.success).to.be.true;
    expect(payload.settings.name).to.equal('mylab');
    expect(payload.settings.prefix).to.equal('clab');
  });

  it('handles updateLabSettings failure with proper error result', async () => {
    sinon.stub(fs.promises, 'readFile').rejects(new Error('update-fail'));
    const ctx = createEndpointContext();

    const result = await editorEndpointHandlers.updateLabSettings({ name: 'test' }, ctx);

    expect(result.success).to.be.false;
    expect(result.error).to.include('update-fail');
    expect(ctx.isInternalUpdate).to.be.false;
  });

  it('parses payload string in handleLabSettingsUpdateEndpoint', async () => {
    const updateStub = sinon.stub(editorEndpointHandlers as any, 'updateLabSettings');
    updateStub.resolves({ success: true, yamlContent: 'updated' });

    await editorEndpointHandlers.handleLabSettingsUpdateEndpoint('{"name":"test"}', undefined, createEndpointContext());

    expect(updateStub.calledOnce).to.be.true;
    expect(updateStub.firstCall.args[0]).to.deep.equal({ name: 'test' });
  });
});

describe('EditorEndpointHandlers - viewer settings error paths', () => {
  it('returns empty viewerSettings on load error', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').rejects(new Error('load-fail'));

    const result = await editorEndpointHandlers.handleLoadViewerSettingsEndpoint(createEndpointContext());

    expect(result.result).to.deep.equal({ viewerSettings: {} });
    expect(result.error).to.be.null;
  });

  it('returns error when saving viewer settings fails', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').resolves({});
    sinon.stub(annotationsManager, 'saveAnnotations').rejects(new Error('save-fail'));

    const result = await editorEndpointHandlers.handleSaveViewerSettingsEndpoint(
      { viewerSettings: { zoom: 1 } },
      createEndpointContext()
    );

    expect(result.result).to.be.null;
    expect(result.error).to.include('save-fail');
  });
});

describe('EditorEndpointHandlers - annotations error paths', () => {
  it('returns empty annotations on load error', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').rejects(new Error('anno-load-fail'));

    const result = await editorEndpointHandlers.handleLoadAnnotationsEndpoint(createEndpointContext());

    expect(result.result).to.deep.equal({
      annotations: [],
      freeShapeAnnotations: [],
      groupStyles: []
    });
    expect(result.error).to.be.null;
  });

  it('returns error when saving annotations fails', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').resolves({
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    });
    sinon.stub(annotationsManager, 'saveAnnotations').rejects(new Error('anno-save-fail'));

    const result = await editorEndpointHandlers.handleSaveAnnotationsEndpoint(
      { annotations: [{ id: 'test' }] },
      createEndpointContext()
    );

    expect(result.result).to.be.null;
    expect(result.error).to.include('anno-save-fail');
  });

  it('loads annotations with counts logged', async () => {
    sinon.stub(annotationsManager, 'loadAnnotations').resolves({
      freeTextAnnotations: [{ id: 't1' }, { id: 't2' }],
      freeShapeAnnotations: [{ id: 's1' }],
      groupStyleAnnotations: [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }]
    });

    const result = await editorEndpointHandlers.handleLoadAnnotationsEndpoint(createEndpointContext());

    const payload = result.result as any;
    expect(payload.annotations).to.have.length(2);
    expect(payload.freeShapeAnnotations).to.have.length(1);
    expect(payload.groupStyles).to.have.length(3);
  });
});

describe('EditorEndpointHandlers - icon upload full flow', () => {
  it('returns cancelled when user cancels file selection', async () => {
    sinon.stub(iconManager, 'promptIconUploadSource').resolves('local');
    sinon.stub(iconManager, 'getIconPickerOptions').returns({});
    vscode.setOpenDialogResult([]);

    const result = await editorEndpointHandlers.handleUploadIconEndpoint();

    expect(result.result).to.deep.equal({ cancelled: true });
  });

  it('successfully uploads icon and returns updated list', async () => {
    sinon.stub(iconManager, 'promptIconUploadSource').resolves('local');
    sinon.stub(iconManager, 'getIconPickerOptions').returns({});
    sinon.stub(iconManager, 'importCustomIcon').resolves({ name: 'myicon' });
    sinon.stub(iconManager, 'loadCustomIcons').resolves([{ name: 'myicon' }]);
    vscode.setOpenDialogResult([{ fsPath: '/path/to/icon.png' }]);

    const result = await editorEndpointHandlers.handleUploadIconEndpoint();

    const payload = result.result as any;
    expect(payload.success).to.be.true;
    expect(payload.lastAddedIcon).to.equal('myicon');
    expect(vscode.window.lastInfoMessage).to.include('Added custom icon');
  });

  it('returns error when import fails', async () => {
    sinon.stub(iconManager, 'promptIconUploadSource').resolves('local');
    sinon.stub(iconManager, 'getIconPickerOptions').returns({});
    sinon.stub(iconManager, 'importCustomIcon').rejects(new Error('import-failed'));
    vscode.setOpenDialogResult([{ fsPath: '/path/to/icon.png' }]);

    const result = await editorEndpointHandlers.handleUploadIconEndpoint();

    expect(result.result).to.be.null;
    expect(result.error).to.include('import-failed');
    expect(vscode.window.lastErrorMessage).to.include('Failed to add custom icon');
  });

  it('returns error when icon not found during deletion', async () => {
    sinon.stub(iconManager, 'deleteCustomIcon').resolves(false);

    const result = await editorEndpointHandlers.handleDeleteIconEndpoint({ iconName: 'nonexistent' });

    expect(result.result).to.be.null;
    expect(result.error).to.include('was not found');
  });
});

describe('EditorEndpointHandlers - custom node delegation', () => {
  it('delegates saveCustomNode to customNodeConfigManager', async () => {
    const stub = sinon.stub(customNodeConfigManager, 'saveCustomNode').resolves({ result: { success: true }, error: null });

    const result = await editorEndpointHandlers.handleSaveCustomNodeEndpoint({ name: 'mynode' });

    expect(stub.calledOnceWith({ name: 'mynode' })).to.be.true;
    expect((result.result as any).success).to.be.true;
  });

  it('delegates setDefaultCustomNode to customNodeConfigManager', async () => {
    const stub = sinon.stub(customNodeConfigManager, 'setDefaultCustomNode').resolves({ result: { success: true }, error: null });

    const result = await editorEndpointHandlers.handleSetDefaultCustomNodeEndpoint({ name: 'default-node' });

    expect(stub.calledOnceWith('default-node')).to.be.true;
    expect((result.result as any).success).to.be.true;
  });

  it('delegates deleteCustomNode with empty name when not provided', async () => {
    const stub = sinon.stub(customNodeConfigManager, 'deleteCustomNode').resolves({ result: { success: false }, error: null });

    await editorEndpointHandlers.handleDeleteCustomNodeEndpoint({});

    expect(stub.calledOnceWith('')).to.be.true;
  });
});

describe('EditorEndpointHandlers - simple endpoint delegation', () => {
  it('delegates handleShowErrorMessageEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleShowErrorMessageEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handleShowErrorMessageEndpoint('error message');

    expect(stub.calledOnceWith('error message')).to.be.true;
  });

  it('delegates handlePerformanceMetricsEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handlePerformanceMetricsEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handlePerformanceMetricsEndpoint('payload', { metric: 'data' });

    expect(stub.calledOnceWith('payload', { metric: 'data' })).to.be.true;
  });

  it('delegates handleShowVscodeMessageEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleShowVscodeMessageEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handleShowVscodeMessageEndpoint('message');

    expect(stub.calledOnceWith('message')).to.be.true;
  });

  it('delegates handleOpenExternalEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleOpenExternalEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handleOpenExternalEndpoint('https://example.com');

    expect(stub.calledOnceWith('https://example.com')).to.be.true;
  });

  it('delegates handleOpenExternalLinkEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleOpenExternalLinkEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handleOpenExternalLinkEndpoint('https://link.com');

    expect(stub.calledOnceWith('https://link.com')).to.be.true;
  });

  it('delegates handleShowErrorEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleShowErrorEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handleShowErrorEndpoint({ message: 'error' });

    expect(stub.calledOnceWith({ message: 'error' })).to.be.true;
  });

  it('delegates handleCopyElementsEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleCopyElementsEndpoint').resolves({ result: { success: true }, error: null });
    const extCtx = {} as any;

    await editorEndpointHandlers.handleCopyElementsEndpoint(extCtx, { elements: [] });

    expect(stub.calledOnceWith(extCtx, { elements: [] })).to.be.true;
  });

  it('delegates handleGetCopiedElementsEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleGetCopiedElementsEndpoint').resolves({ result: { elements: [] }, error: null });
    const extCtx = {} as any;
    const panel = {} as any;

    await editorEndpointHandlers.handleGetCopiedElementsEndpoint(extCtx, panel);

    expect(stub.calledOnceWith(extCtx, panel)).to.be.true;
  });

  it('delegates handleDebugLogEndpoint', async () => {
    const stub = sinon.stub(simpleEndpointHandlers, 'handleDebugLogEndpoint').resolves({ result: null, error: null });

    await editorEndpointHandlers.handleDebugLogEndpoint({ level: 'debug', message: 'test' });

    expect(stub.calledOnceWith({ level: 'debug', message: 'test' })).to.be.true;
  });
});
