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
});
