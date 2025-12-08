/* eslint-env mocha, node */
/* global describe, it, beforeEach, afterEach, global */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';

import {
  ModeManager,
  type ModeManagerDependencies,
  type ModeSwitchPayload
} from '../../../src/topoViewer/webview/core/ModeManager';
import topoViewerState from '../../../src/topoViewer/webview/app/state';
import * as logger from '../../../src/topoViewer/webview/platform/logging/logger';

function createSimpleManager(): { manager: ModeManager; dom: JSDOM } {
  const dom = new JSDOM('<div></div>');
  (global as any).window = dom.window as any;
  (global as any).document = dom.window.document;

  const deps: ModeManagerDependencies = {
    getCurrentMode: () => 'edit',
    setCurrentMode: () => {},
    setIsViewportDrawerClabEditorChecked: () => {},
    applyLockState: () => {},
    setLabLocked: () => {},
    getLabLocked: () => false,
    fetchAndLoadData: async () => {},
    isInitialGraphLoaded: () => true,
    setInitialGraphLoaded: () => {},
    ensureModeResources: async () => {},
    clearEdgeLinkStates: () => {},
    initializeContextMenu: async () => {}
  };

  return { manager: new ModeManager(deps), dom };
}

function cleanupDom(dom: JSDOM): void {
  dom.window.close();
  delete (global as any).window;
  delete (global as any).document;
}

describe('ModeManager - handleModeSwitchMessage', () => {
  let dom: JSDOM;
  let deps: ModeManagerDependencies;
  let manager: ModeManager;
  let lockedState = false;

  beforeEach(() => {
    dom = new JSDOM('<div id="mode-indicator"></div>');
    (global as any).window = dom.window as any;
    (global as any).document = dom.window.document;
    (global as any).CustomEvent = dom.window.CustomEvent;
    lockedState = false;

    deps = {
      getCurrentMode: sinon.stub().returns('edit'),
      setCurrentMode: sinon.spy(),
      setIsViewportDrawerClabEditorChecked: sinon.spy(),
      applyLockState: sinon.spy(),
      setLabLocked: sinon.spy((locked: boolean) => {
        lockedState = locked;
      }),
      getLabLocked: sinon.stub().callsFake(() => lockedState),
      fetchAndLoadData: sinon.stub().resolves(),
      isInitialGraphLoaded: sinon.stub().returns(false),
      setInitialGraphLoaded: sinon.spy(),
      ensureModeResources: sinon.stub().resolves(),
      clearEdgeLinkStates: sinon.spy(),
      initializeContextMenu: sinon.stub().resolves()
    };

    sinon.stub(logger.log, 'info');
    sinon.stub(logger.log, 'warn');
    manager = new ModeManager(deps);
  });

  afterEach(() => {
    sinon.restore();
    dom.window.close();
    delete (global as any).window;
    delete (global as any).document;
    delete (global as any).CustomEvent;
  });

  it('loads data on first switch, applies lock state, and updates UI', async () => {
    const eventSpy = sinon.spy();
    document.addEventListener('topo-mode-changed', eventSpy);

    const payload: ModeSwitchPayload = {
      mode: 'viewer',
      deploymentState: 'deployed',
      viewerParams: { lockLabByDefault: false, currentLabPath: '/labs/a' }
    };

    await manager.handleModeSwitchMessage(payload);

    expect(eventSpy.calledOnce).to.be.true;
    expect(document.title).to.equal('TopoViewer');
    expect(document.getElementById('mode-indicator')?.textContent).to.equal('viewer');
    expect(topoViewerState.deploymentType).to.equal('deployed');
  });

  it('ignores new requests while a transition is in progress', async () => {
    (manager as any).modeTransitionInProgress = true;

    await manager.handleModeSwitchMessage({ mode: 'viewer' });

    expect((deps.fetchAndLoadData as sinon.SinonStub).called).to.be.false;
    expect((deps.ensureModeResources as sinon.SinonStub).called).to.be.false;
  });
});

describe('ModeManager - parameter handling helpers', () => {
  it('normalizes payloads and sets global mode state', () => {
    const { manager, dom } = createSimpleManager();
    const { normalized, target } = manager.normalizeModeFromPayload({ mode: 'editor' });
    expect(normalized).to.equal('editor');
    expect(target).to.equal('edit');

    manager.setGlobalModeState('viewer', 'view', 'running');
    expect((window as any).topoViewerMode).to.equal('viewer');
    expect((topoViewerState as any).currentMode).to.equal('view');
    expect(topoViewerState.deploymentType).to.equal('running');
    cleanupDom(dom);
  });

  it('applies editor parameters with sensible defaults', () => {
    const { manager, dom } = createSimpleManager();
    manager.applyEditorParameters({});

    expect((window as any).defaultKind).to.equal('nokia_srlinux');
    expect((window as any).defaultType).to.equal('');
    expect((window as any).customNodes).to.deep.equal([]);
    expect((window as any).lockLabByDefault).to.be.undefined;
    cleanupDom(dom);
  });
});
