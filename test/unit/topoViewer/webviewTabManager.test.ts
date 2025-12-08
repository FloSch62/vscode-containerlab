/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import Module from 'module';
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';

// Ensure module resolution uses stubs for vscode and logger
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

const WEBVIEW_TAB_MANAGER_PATH = '../../../src/topoViewer/extension/services/WebviewTabManager';
const webviewTabManagerModule = require(WEBVIEW_TAB_MANAGER_PATH) as typeof import('../../../src/topoViewer/extension/services/WebviewTabManager');
const { webviewTabManager } = webviewTabManagerModule;
type TemplateParamsContext = Parameters<typeof webviewTabManager.getViewerTemplateParams>[0];
type PanelInitContext = Parameters<typeof webviewTabManager.loadYamlViewMode>[2];

const extensionModule = require('../../../src/extension') as typeof import('../../../src/extension');
const imagesModule = require('../../../src/utils/docker/images');
const customNodeConfigManager = require('../../../src/topoViewer/extension/services/CustomNodeConfigManager').customNodeConfigManager;
const iconManager = require('../../../src/topoViewer/extension/services/IconManager').iconManager;
const runningLabsProvider =
  extensionModule.runningLabsProvider ??
  (extensionModule.runningLabsProvider = { discoverInspectLabs: async () => ({}) } as any);
const asyncUtils = require('../../../src/topoViewer/shared/utilities/AsyncUtils') as typeof import('../../../src/topoViewer/shared/utilities/AsyncUtils');
const VIEW_YAML_PATH = '/home/test/view.clab.yml';
const CACHED_YAML_PATH = '/home/test/cached.clab.yml';
const CORRECT_YAML_PATH = '/home/test/correct.clab.yml';
const MISSING_YAML_PATH = '/home/test/missing.clab.yml';
const NEW_YAML_PATH = '/home/test/new-lab.clab.yaml';
const OTHER_FILE_PATH = '/home/test/other.clab.yml';

function createPanelInitContext(overrides: Partial<PanelInitContext> = {}): PanelInitContext {
  const context: PanelInitContext = {
    isViewMode: false,
    lastYamlFilePath: '',
    skipInitialValidation: false,
    cacheClabTreeDataToTopoviewer: undefined,
    setLastYamlFilePath: value => {
      context.lastYamlFilePath = value;
    },
    setSkipInitialValidation: value => {
      context.skipInitialValidation = value;
    },
    setCacheClabTreeData: data => {
      context.cacheClabTreeDataToTopoviewer = data;
    },
    validateYaml: async () => true,
    buildDefaultLabYaml: name => `name: ${name}`,
    setInternalUpdate: () => {}
  };
  return Object.assign(context, overrides);
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
  delete (vscode.workspace.fs as any).stat;
});

  describe('WebviewTabManager - template params', () => {
    it('returns viewer params respecting configuration defaults', () => {
      const configGet = sinon.stub().callsFake((key: string, defaultValue?: unknown) => {
        if (key === 'lockLabByDefault') return false;
        return defaultValue;
      });
      sinon.stub(vscode.workspace, 'getConfiguration').returns({ get: configGet } as any);
      const ctx: TemplateParamsContext = {
        deploymentState: 'deployed',
        lastYamlFilePath: '/home/test/lab1.clab.yml',
        currentClabTopo: undefined
      };

      const params = webviewTabManager.getViewerTemplateParams(ctx);

      expect(params.viewerMode).to.equal('viewer');
      expect(params.currentLabPath).to.equal(ctx.lastYamlFilePath);
      expect(params.lockLabByDefault).to.be.false;
    });

    it('builds editor params using custom node and docker data', async () => {
      const configValues = {
        lockLabByDefault: false,
        updateLinkEndpointsOnKindChange: false,
        customNodes: []
      } as Record<string, unknown>;
      const configGet = sinon.stub().callsFake(<T>(key: string, defaultValue?: T) => {
        return (configValues[key] as T | undefined) ?? defaultValue;
      });
      sinon.stub(vscode.workspace, 'getConfiguration').returns({ get: configGet } as any);
      const ctx: TemplateParamsContext = {
        deploymentState: 'deployed',
        lastYamlFilePath: '/home/test/lab2.clab.yml',
        currentClabTopo: { topology: { defaults: { mgmt: 'oob' }, kinds: { router: {} }, groups: { core: {} } } } as any
      };
      const refreshStub = sinon.stub(imagesModule, 'refreshDockerImages').resolves();
      sinon.stub(imagesModule, 'getDockerImages').returns(['img:1']);
      const legacyMap = { linux: 'eth{n}' };
      sinon.stub(customNodeConfigManager, 'getLegacyInterfacePatternMapping').returns(legacyMap);
      const customNodes = [{ name: 'Node A', kind: 'linux', type: 'ixr', icon: 'router' }];
      const ensureStub = sinon.stub(customNodeConfigManager, 'ensureCustomNodeInterfacePatterns').resolves(customNodes);
      sinon.stub(customNodeConfigManager, 'buildInterfacePatternMapping').returns({ 'Node A': 'eth{n}' });
      sinon.stub(customNodeConfigManager, 'getDefaultCustomNode').returns({ defaultNode: 'Node A', defaultKind: 'linux', defaultType: 'ixr' });
      sinon.stub(customNodeConfigManager, 'buildImageMapping').returns({ 'Node A': 'img:1' });
      sinon.stub(iconManager, 'loadCustomIcons').resolves([{ name: 'router', dataUri: 'data:image/png;base64,x' }]);
      vscode.setConfigValue('containerlab.editor.updateLinkEndpointsOnKindChange', false);
      vscode.setConfigValue('containerlab.editor.lockLabByDefault', false);

      const params = await webviewTabManager.getEditorTemplateParams(ctx);

      expect(refreshStub.calledOnce).to.be.true;
      expect(ensureStub.calledOnce).to.be.true;
    expect(params.dockerImages).to.deep.equal(['img:1']);
    expect(params.ifacePatternMapping).to.deep.equal({ 'Node A': 'eth{n}' });
    expect(params.defaultKind).to.equal('linux');
    expect(params.defaultType).to.equal('ixr');
    expect(params.lockLabByDefault).to.be.false;
    expect(params.customNodes).to.deep.equal(customNodes);
    expect(params.topologyDefaults).to.deep.equal({ mgmt: 'oob' });
    expect(params.topologyKinds).to.deep.equal({ router: {} });
    expect(params.topologyGroups).to.deep.equal({ core: {} });
  });
});

  describe('WebviewTabManager - panel and html helpers', () => {
    it('escapes lab names and builds loading HTML', () => {
      const html = webviewTabManager.buildInitialLoadingHtml('<script>alert(1)</script>');
      expect(html).to.include('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(html).to.include('Loading TopoViewer');
    });

    it('creates panels with icon path and initial content', () => {
      const context = { extensionUri: vscode.Uri.file('/ext') } as any;
      const panel = webviewTabManager.createPanel(context, 'tv', 'Lab A', undefined) as unknown as vscode.MockWebviewPanel;
      expect(panel.viewType).to.equal('tv');
      expect(panel.title).to.equal('Lab A');
      expect((panel as any).iconPath.fsPath).to.contain('resources/containerlab.png');

      webviewTabManager.setInitialLoadingContent(panel as any, 'Lab A');
      expect(panel.webview.html).to.include('Loading TopoViewer');
    });
  });

  describe('WebviewTabManager - lab data and file utilities', () => {
    it('returns discovered running labs and logs warnings on failure', async () => {
      const labs = { lab1: { label: 'Lab One' } as any };
      const discoverStub = sinon.stub(runningLabsProvider, 'discoverInspectLabs').resolves(labs);

      const result = await webviewTabManager.loadRunningLabData();

      expect(result).to.equal(labs);
      expect(discoverStub.calledOnce).to.be.true;

      discoverStub.restore();
      sinon.stub(runningLabsProvider, 'discoverInspectLabs').rejects(new Error('boom'));
      const fallback = await webviewTabManager.loadRunningLabData();
      expect(fallback).to.be.undefined;
    });

  it('normalizes file URIs and reveals panels when present', () => {
    const uri = vscode.Uri.file(OTHER_FILE_PATH);
    const corrected = webviewTabManager.normalizeFileUri(uri as any, CORRECT_YAML_PATH);
    expect(corrected.fsPath).to.equal(CORRECT_YAML_PATH);

    const reveal = sinon.spy();
    const revealed = webviewTabManager.revealIfPanelExists({ reveal } as any, vscode.ViewColumn.One);
    const missing = webviewTabManager.revealIfPanelExists(undefined, undefined);
    expect(revealed).to.be.true;
    expect(missing).to.be.false;
    expect(reveal.calledOnceWith(vscode.ViewColumn.One)).to.be.true;
  });
});

describe('WebviewTabManager - YAML loading', () => {
  it('loads YAML in view mode and marks validation as skipped', async () => {
    const ctx = createPanelInitContext({ isViewMode: true });
    const fileUri = vscode.Uri.file(VIEW_YAML_PATH);
    const readStub = sinon.stub(fs.promises, 'readFile').resolves('name: view');

    await webviewTabManager.loadYamlViewMode(fileUri as any, 'View Lab', ctx);

    expect(ctx.lastYamlFilePath).to.equal(VIEW_YAML_PATH);
    expect(ctx.skipInitialValidation).to.be.true;
    expect(readStub.calledOnceWith(VIEW_YAML_PATH, 'utf8')).to.be.true;
  });

  it('uses cached path when edit mode stat fails and loads YAML', async () => {
    const ctx = createPanelInitContext({ lastYamlFilePath: CACHED_YAML_PATH });
    (vscode.workspace.fs as any).stat = async () => { throw new Error('missing'); };
    sinon.stub(fs.promises, 'readFile').resolves('name: cached');
    const validateYaml = sinon.stub().resolves(true);
    ctx.validateYaml = validateYaml;

    await webviewTabManager.loadYamlEditMode(vscode.Uri.file(MISSING_YAML_PATH) as any, ctx);

    expect(ctx.lastYamlFilePath).to.equal(CACHED_YAML_PATH);
    expect(validateYaml.calledOnce).to.be.true;
  });

  it('populates empty YAML with defaults in edit mode', async () => {
    const ctx = createPanelInitContext();
    (vscode.workspace.fs as any).stat = async () => ({});
    sinon.stub(fs.promises, 'readFile').resolves('   ');
    const writeStub = sinon.stub(fs.promises, 'writeFile').resolves();
    const sleepStub = sinon.stub(asyncUtils, 'sleep').resolves();
    const setInternalUpdate = sinon.spy();
    ctx.setInternalUpdate = setInternalUpdate;
    ctx.buildDefaultLabYaml = name => `name: ${name}`;
    const validateYaml = sinon.stub().resolves(true);
    ctx.validateYaml = validateYaml;

    await webviewTabManager.loadYamlEditMode(vscode.Uri.file(NEW_YAML_PATH) as any, ctx);

    expect(writeStub.calledWith(NEW_YAML_PATH, 'name: new-lab', 'utf8')).to.be.true;
    expect(sleepStub.calledOnce).to.be.true;
    expect(setInternalUpdate.calledTwice).to.be.true;
    expect(validateYaml.calledOnce).to.be.true;
    expect(ctx.lastYamlFilePath).to.equal(NEW_YAML_PATH);
  });
});
