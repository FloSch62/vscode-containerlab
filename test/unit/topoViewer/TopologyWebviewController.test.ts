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
});
