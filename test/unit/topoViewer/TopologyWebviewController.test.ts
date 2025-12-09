/* eslint-env mocha, node */
/* global describe, it, before, after, beforeEach, afterEach, global, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import Module from 'module';
import path from 'path';

import * as logger from '../../../src/topoViewer/webview/platform/logging/logger';

let TopologyWebviewController: typeof import('../../../src/topoViewer/webview/app/TopologyWebviewController').default;
let fetchModule: typeof import('../../../src/topoViewer/webview/features/canvas/FetchAndLoad');
let originalCssHandler: any;
let originalResolve: any;

function installCssAndImportController(): void {
  originalCssHandler = (Module as any)._extensions['.css'];
  (Module as any)._extensions['.css'] = () => {};
  originalResolve = (Module as any)._resolveFilename;
  (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    if (request.endsWith('.css')) {
      return path.join(__dirname, '..', '..', 'helpers', 'empty-css-stub.js');
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };

  const importDom = createDom();
  fetchModule =
    require('../../../src/topoViewer/webview/features/canvas/FetchAndLoad') as typeof import('../../../src/topoViewer/webview/features/canvas/FetchAndLoad');
  TopologyWebviewController =
    require('../../../src/topoViewer/webview/app/TopologyWebviewController').default;
  cleanupDom(importDom);
}

function restoreModuleResolution(): void {
  (Module as any)._extensions['.css'] = originalCssHandler;
  (Module as any)._resolveFilename = originalResolve;
}

function createDom(): JSDOM {
  const dom = new JSDOM('<div id="cy"></div>', { url: 'https://example.test' });
  (global as any).window = dom.window as any;
  (global as any).document = dom.window.document;
  (global as any).document.addEventListener = () => {};
  (global as any).window.dispatchEvent = () => true;
  (global as any).devicePixelRatio = 1;
  (global as any).window.devicePixelRatio = 1;
  (global as any).CustomEvent = dom.window.CustomEvent;
  (global as any).matchMedia = () => ({
    matches: false,
    addEventListener: () => {},
    removeEventListener: () => {}
  });
  (global as any).Event = dom.window.Event;
  return dom;
}

function cleanupDom(dom: JSDOM): void {
  dom.window.close();
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).devicePixelRatio;
  delete (global as any).matchMedia;
  delete (global as any).Event;
  delete (global as any).CustomEvent;
}

function createController(): any {
  const controller = Object.create(TopologyWebviewController.prototype) as any;
  controller.cy = {};
  controller.messageSender = {};
  controller.modeManager = { handleModeSwitchMessage: sinon.stub().resolves() };
  controller.updateTopology = sinon.spy();
  controller.handleCopiedElements = sinon.spy();
  controller.handleDockerImagesUpdatedMessage = sinon.spy();
  return controller;
}

describe('TopologyWebviewController - message routing', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
    sinon.stub(logger.log, 'error');
    sinon.stub(logger.log, 'debug');
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('routes yaml-saved to fetchAndLoadData with incremental flag', async () => {
    const fetchStub = sinon.stub(fetchModule, 'fetchAndLoadData').resolves();
    const controller = createController();

    controller.dispatchIncomingMessage({ type: 'yaml-saved' });
    await fetchStub.firstCall?.returnValue;

    expect(fetchStub.calledOnce).to.be.true;
    expect(fetchStub.firstCall.args[0]).to.equal(controller.cy);
    expect(fetchStub.firstCall.args[1]).to.equal(controller.messageSender);
    expect(fetchStub.firstCall.args[2]).to.deep.equal({ incremental: true });
  });

  it('invokes updateTopology and copy handlers for respective messages', async () => {
    const controller = createController();

    controller.dispatchIncomingMessage({ type: 'updateTopology', data: { x: 1 } });
    controller.dispatchIncomingMessage({ type: 'copiedElements', data: { y: 2 } });

    expect(controller.updateTopology.calledOnceWith({ x: 1 })).to.be.true;
    expect(controller.handleCopiedElements.calledOnceWith({ y: 2 })).to.be.true;
  });

  it('forwards topo-mode-changed payload to mode manager', async () => {
    const controller = createController();
    const payload = { mode: 'viewer' };

    controller.dispatchIncomingMessage({ type: 'topo-mode-changed', data: payload });
    await (controller.modeManager.handleModeSwitchMessage as sinon.SinonStub).firstCall?.returnValue;

    expect(
      (controller.modeManager.handleModeSwitchMessage as sinon.SinonStub).calledOnceWith(payload)
    ).to.be.true;
  });

  it('handles docker image updates safely', () => {
    const controller = createController();
    const images = ['img1', 'img2'];

    controller.dispatchIncomingMessage({ type: 'docker-images-updated', dockerImages: images });

    expect(controller.handleDockerImagesUpdatedMessage.calledOnceWith(images)).to.be.true;
  });

  it('ignores unknown message types', () => {
    const controller = createController();

    // Should not throw
    expect(() => controller.dispatchIncomingMessage({ type: 'unknown-type' })).not.to.throw();
  });

  it('handles messages without type gracefully', () => {
    const controller = createController();

    expect(() => controller.dispatchIncomingMessage({})).not.to.throw();
    expect(() => controller.dispatchIncomingMessage({ data: {} })).not.to.throw();
  });
});

describe('TopologyWebviewController - theme detection', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
    sinon.stub(logger.log, 'debug');
    sinon.stub(logger.log, 'warn');
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('detects dark theme from body class', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.applyTheme = sinon.spy();

    document.body.classList.add('vscode-dark');

    const theme = controller.detectColorScheme();

    expect(theme).to.equal('dark');
    expect(controller.applyTheme.calledOnceWith('dark')).to.be.true;
  });

  it('detects light theme by default', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.applyTheme = sinon.spy();

    // No vscode-dark or vscode-high-contrast class
    document.body.classList.remove('vscode-dark');
    document.body.classList.remove('vscode-high-contrast');

    const theme = controller.detectColorScheme();

    expect(theme).to.equal('light');
    expect(controller.applyTheme.calledOnceWith('light')).to.be.true;
  });

  it('detects high contrast as dark theme', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.applyTheme = sinon.spy();

    document.body.classList.add('vscode-high-contrast');

    const theme = controller.detectColorScheme();

    expect(theme).to.equal('dark');
  });
});

describe('TopologyWebviewController - subtitle update', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('updates subtitle element when present', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;

    const subtitleEl = document.createElement('div');
    subtitleEl.id = 'ClabSubtitle';
    document.body.appendChild(subtitleEl);

    controller.updateSubtitle('test-lab');

    expect(subtitleEl.textContent).to.equal('Topology Editor ::: test-lab');
  });

  it('handles missing subtitle element gracefully', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;

    // Should not throw when element is missing
    expect(() => controller.updateSubtitle('test-lab')).not.to.throw();
  });
});

describe('TopologyWebviewController - topology overview', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('toggles overview drawer visibility', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;

    // Create the drawer element
    const drawerEl = document.createElement('div');
    drawerEl.id = 'viewport-drawer-topology-overview';
    drawerEl.style.display = 'none';
    drawerEl.classList.add('viewport-drawer');
    document.body.appendChild(drawerEl);

    // First call - should show
    controller.viewportButtonsTopologyOverview();
    expect(drawerEl.style.display).to.equal('block');

    // Second call - should hide
    controller.viewportButtonsTopologyOverview();
    expect(drawerEl.style.display).to.equal('none');
  });

  it('handles missing overview drawer gracefully', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;

    // Should not throw when drawer is missing
    expect(() => controller.viewportButtonsTopologyOverview()).not.to.throw();
  });
});

describe('TopologyWebviewController - lock state', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('gets initial lock state from window config', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;

    // Default should be true
    let lockState = controller.getInitialLockState();
    expect(lockState).to.be.true;

    // Set to false
    (global as any).window.lockLabByDefault = false;
    lockState = controller.getInitialLockState();
    expect(lockState).to.be.false;

    // Set back to true
    (global as any).window.lockLabByDefault = true;
    lockState = controller.getInitialLockState();
    expect(lockState).to.be.true;
  });

  it('applies lock state to nodes', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const lockSpy = sinon.spy();
    const unlockSpy = sinon.spy();

    controller.cy = {
      nodes: () => ({
        lock: lockSpy,
        unlock: unlockSpy
      })
    };
    controller.contextMenuManager = { initialize: sinon.stub().resolves() };

    // Test locking
    controller.applyLockState(true);
    expect(lockSpy.calledOnce).to.be.true;
    expect(controller.labLocked).to.be.true;

    // Test unlocking
    controller.applyLockState(false);
    expect(unlockSpy.calledOnce).to.be.true;
    expect(controller.labLocked).to.be.false;
  });
});

describe('TopologyWebviewController - auto save', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('suspends and resumes auto save correctly', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.autoSaveSuspendCount = 0;

    expect(controller.isAutoSaveSuspended()).to.be.false;

    controller.suspendAutoSave();
    expect(controller.isAutoSaveSuspended()).to.be.true;
    expect(controller.autoSaveSuspendCount).to.equal(1);

    controller.suspendAutoSave();
    expect(controller.autoSaveSuspendCount).to.equal(2);

    controller.resumeAutoSave();
    expect(controller.autoSaveSuspendCount).to.equal(1);
    expect(controller.isAutoSaveSuspended()).to.be.true;

    controller.resumeAutoSave();
    expect(controller.autoSaveSuspendCount).to.equal(0);
    expect(controller.isAutoSaveSuspended()).to.be.false;
  });

  it('does not go below zero on resume', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.autoSaveSuspendCount = 0;

    controller.resumeAutoSave();
    expect(controller.autoSaveSuspendCount).to.equal(0);
  });

  it('checks auto save conditions correctly', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.autoSaveSuspendCount = 0;
    controller.edgeCreationManager = { isActive: () => false };

    expect(controller.canAutoSaveNow()).to.be.true;

    controller.autoSaveSuspendCount = 1;
    expect(controller.canAutoSaveNow()).to.be.false;

    controller.autoSaveSuspendCount = 0;
    controller.edgeCreationManager.isActive = () => true;
    expect(controller.canAutoSaveNow()).to.be.false;
  });
});

describe('TopologyWebviewController - event target handling for edges', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('skips auto save for undefined target', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;

    expect(controller.shouldSkipAutoSaveForTarget(undefined)).to.be.true;
  });

  it('allows edges to trigger auto save', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const mockEdge = {
      isEdge: () => true,
      isNode: () => false,
      data: () => ({})
    };

    expect(controller.shouldSkipAutoSaveForTarget(mockEdge)).to.be.false;
  });
});

describe('TopologyWebviewController - event target handling for nodes', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('skips freeText nodes', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const mockFreeTextNode = {
      isEdge: () => false,
      isNode: () => true,
      data: (key: string) => key === 'topoViewerRole' ? 'freeText' : undefined
    };

    expect(controller.shouldSkipAutoSaveForTarget(mockFreeTextNode)).to.be.true;
  });

  it('allows regular nodes to trigger auto save', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const mockNode = {
      isEdge: () => false,
      isNode: () => true,
      data: () => 'regular'
    };

    expect(controller.shouldSkipAutoSaveForTarget(mockNode)).to.be.false;
  });
});

describe('TopologyWebviewController - updateTopology', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
    sinon.stub(logger.log, 'error');
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('updates existing element data', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const dataSpy = sinon.spy();
    const classesSpy = sinon.spy();
    const addSpy = sinon.spy();

    controller.currentMode = 'edit';
    controller.linkPanelManager = { refreshLinkPanelIfSelected: sinon.spy() };
    controller.cy = {
      getElementById: () => ({
        length: 1,
        data: dataSpy,
        classes: classesSpy,
        isEdge: () => false
      }),
      add: addSpy
    };

    controller.updateTopology([{ data: { id: 'node1', name: 'test' }, classes: 'test-class' }]);

    expect(dataSpy.calledOnce).to.be.true;
    expect(classesSpy.calledOnce).to.be.true;
    expect(addSpy.called).to.be.false;
  });

  it('adds new elements', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const addSpy = sinon.spy();

    controller.currentMode = 'edit';
    controller.cy = {
      getElementById: () => ({ length: 0 }),
      add: addSpy
    };

    controller.updateTopology([{ data: { id: 'new-node' } }]);

    expect(addSpy.calledOnce).to.be.true;
  });

  it('handles non-array data gracefully', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    controller.cy = { getElementById: sinon.spy() };

    expect(() => controller.updateTopology('not-an-array')).not.to.throw();
    expect(() => controller.updateTopology(null)).not.to.throw();
    expect(() => controller.updateTopology(undefined)).not.to.throw();
  });

  it('skips elements without id', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const getByIdSpy = sinon.spy();
    controller.cy = { getElementById: getByIdSpy, add: sinon.spy() };

    controller.updateTopology([{ data: {} }, { data: { name: 'no-id' } }]);

    expect(getByIdSpy.called).to.be.false;
  });
});

describe('TopologyWebviewController - clearEdgeLinkStates', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('removes link-up and link-down classes from edges', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const removeClassSpy = sinon.spy();
    const mockEdges = [
      { removeClass: removeClassSpy },
      { removeClass: removeClassSpy }
    ];

    controller.cy = {
      edges: () => ({
        forEach: (fn: (edge: any) => void) => mockEdges.forEach(fn)
      })
    };

    controller.clearEdgeLinkStates();

    expect(removeClassSpy.callCount).to.equal(4);
    expect(removeClassSpy.calledWith('link-up')).to.be.true;
    expect(removeClassSpy.calledWith('link-down')).to.be.true;
  });
});

describe('TopologyWebviewController - docker images update', () => {
  let dom: JSDOM;

  before(() => {
    installCssAndImportController();
  });

  after(() => {
    restoreModuleResolution();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('updates window dockerImages and notifies node editor', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const updateSpy = sinon.spy();
    controller.nodeEditor = { handleDockerImagesUpdated: updateSpy };

    const images = ['image1:latest', 'image2:v1'];
    controller.handleDockerImagesUpdatedMessage(images);

    expect((global as any).window.dockerImages).to.deep.equal(images);
    expect(updateSpy.calledOnceWith(images)).to.be.true;
  });

  it('handles undefined images array', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const updateSpy = sinon.spy();
    controller.nodeEditor = { handleDockerImagesUpdated: updateSpy };

    controller.handleDockerImagesUpdatedMessage(undefined);

    expect((global as any).window.dockerImages).to.deep.equal([]);
    expect(updateSpy.calledOnceWith([])).to.be.true;
  });

  it('handles non-array images gracefully', () => {
    const controller = Object.create(TopologyWebviewController.prototype) as any;
    const updateSpy = sinon.spy();
    controller.nodeEditor = { handleDockerImagesUpdated: updateSpy };

    controller.handleDockerImagesUpdatedMessage('not-an-array');

    expect((global as any).window.dockerImages).to.deep.equal([]);
  });
});
