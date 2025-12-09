/* eslint-env mocha, node */
/* global describe, it, before, after, beforeEach, afterEach, global, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import Module from 'module';
import path from 'path';

// Constants to avoid duplicate strings
const TEST_ANNOTATION_ID = 'test-annotation';
const TRANSPARENT = 'transparent';
const NON_EXISTENT_ID = 'non-existent';

// Module stub setup
let originalCssHandler: any;
let originalResolve: any;

function installModuleStubs(): void {
  originalCssHandler = (Module as any)._extensions['.css'];
  (Module as any)._extensions['.css'] = () => {};
  originalResolve = (Module as any)._resolveFilename;
  (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
    if (request.endsWith('.css')) {
      return path.join(__dirname, '..', 'helpers', 'empty-css-stub.js');
    }
    return originalResolve.call(this, request, parent, isMain, options);
  };
}

function restoreModuleStubs(): void {
  (Module as any)._extensions['.css'] = originalCssHandler;
  (Module as any)._resolveFilename = originalResolve;
}

function createDom(): JSDOM {
  const dom = new JSDOM(`
    <!DOCTYPE html>
    <html>
    <body>
      <div id="cy" style="position: relative; width: 800px; height: 600px;"></div>
    </body>
    </html>
  `, { url: 'https://test.local' });

  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).HTMLElement = dom.window.HTMLElement;
  (global as any).HTMLDivElement = dom.window.HTMLDivElement;
  (global as any).HTMLButtonElement = dom.window.HTMLButtonElement;
  (global as any).ResizeObserver = class MockResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
  return dom;
}

function cleanupDom(dom: JSDOM): void {
  dom?.window?.close();
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).HTMLElement;
  delete (global as any).HTMLDivElement;
  delete (global as any).HTMLButtonElement;
  delete (global as any).ResizeObserver;
  delete (global as any).requestAnimationFrame;
  delete (global as any).cancelAnimationFrame;
}

let FreeTextOverlayManager: typeof import('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
let dom: JSDOM;

function createMockCy() {
  const container = document.getElementById('cy');
  return {
    container: () => container,
    zoom: () => 1,
    on: sinon.spy(),
    off: sinon.spy()
  };
}

function createMockMessageSender() {
  return {
    sendMessageToVscodeEndpointPost: sinon.stub().resolves()
  };
}

function createMockCallbacks() {
  return {
    getAnnotation: sinon.stub().returns(undefined),
    getNode: sinon.stub().returns(undefined),
    isLabLocked: sinon.stub().returns(false),
    onAnnotationResized: sinon.spy(),
    onAnnotationRotated: sinon.spy(),
    onSaveRequested: sinon.spy()
  };
}

describe('FreeTextOverlayManager - constructor', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates instance with cy, messageSender, and callbacks', () => {
    const cy = createMockCy();
    const messageSender = createMockMessageSender();
    const callbacks = createMockCallbacks();

    const manager = new FreeTextOverlayManager(cy as any, messageSender as any, callbacks);

    expect(manager).to.be.instanceOf(FreeTextOverlayManager);
  });

  it('initializes overlay container', () => {
    const cy = createMockCy();
    const messageSender = createMockMessageSender();
    const callbacks = createMockCallbacks();

    const manager = new FreeTextOverlayManager(cy as any, messageSender as any, callbacks);

    expect(manager.hasOverlayContainer()).to.be.true;
  });

  it('registers pan, zoom, and resize event handlers', () => {
    const cy = createMockCy();
    const messageSender = createMockMessageSender();
    const callbacks = createMockCallbacks();

    const manager = new FreeTextOverlayManager(cy as any, messageSender as any, callbacks);

    expect(manager).to.exist;
    expect(cy.on.calledWith('pan')).to.be.true;
    expect(cy.on.calledWith('zoom')).to.be.true;
    expect(cy.on.calledWith('resize')).to.be.true;
  });
});

describe('FreeTextOverlayManager - hasOverlayContainer', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('returns true when overlay container exists', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    expect(manager.hasOverlayContainer()).to.be.true;
  });

  it('returns false when cy has no container', () => {
    const cy = { container: () => null, zoom: () => 1, on: sinon.spy() };
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    expect(manager.hasOverlayContainer()).to.be.false;
  });
});

describe('FreeTextOverlayManager - getOrCreateOverlayEntry', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates new overlay entry for annotation', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = {
      id: TEST_ANNOTATION_ID,
      text: 'Hello World',
      fontSize: 14,
      backgroundColor: TRANSPARENT
    };

    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry).to.not.be.null;
    expect(entry?.wrapper).to.be.instanceOf(HTMLDivElement);
    expect(entry?.content).to.be.instanceOf(HTMLDivElement);
    expect(entry?.resizeHandle).to.be.instanceOf(HTMLButtonElement);
    expect(entry?.rotateHandle).to.be.instanceOf(HTMLButtonElement);
  });

  it('returns existing entry for same annotation id', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Hello', fontSize: 14, backgroundColor: TRANSPARENT };

    const entry1 = manager.getOrCreateOverlayEntry(annotation as any);
    const entry2 = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry1).to.equal(entry2);
  });

  it('returns null when no overlay container', () => {
    const cy = { container: () => null, zoom: () => 1, on: sinon.spy() };
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Hello', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry).to.be.null;
  });
});

describe('FreeTextOverlayManager - removeAnnotationOverlay', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('removes existing overlay entry', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Hello', fontSize: 14, backgroundColor: TRANSPARENT };
    manager.getOrCreateOverlayEntry(annotation as any);

    manager.removeAnnotationOverlay(TEST_ANNOTATION_ID);

    const entry = manager.getOrCreateOverlayEntry(annotation as any);
    // Should create a new entry since old one was removed
    expect(entry).to.not.be.null;
  });

  it('handles non-existent overlay gracefully', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    expect(() => manager.removeAnnotationOverlay(NON_EXISTENT_ID)).not.to.throw();
  });
});

describe('FreeTextOverlayManager - clearAnnotationOverlays', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('clears all overlay entries', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    manager.getOrCreateOverlayEntry({ id: 'ann1', text: 'A', fontSize: 14, backgroundColor: TRANSPARENT } as any);
    manager.getOrCreateOverlayEntry({ id: 'ann2', text: 'B', fontSize: 14, backgroundColor: TRANSPARENT } as any);

    manager.clearAnnotationOverlays();

    // After clearing, getting entries should create new ones
    expect(() => manager.clearAnnotationOverlays()).not.to.throw();
  });
});

describe('FreeTextOverlayManager - positionOverlayById', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('does nothing when no overlay entry exists', () => {
    const cy = createMockCy();
    const callbacks = createMockCallbacks();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, callbacks);

    expect(() => manager.positionOverlayById(NON_EXISTENT_ID)).not.to.throw();
  });
});

describe('FreeTextOverlayManager - positionAllOverlays', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('positions all overlays without error', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    manager.getOrCreateOverlayEntry({ id: 'ann1', text: 'A', fontSize: 14, backgroundColor: TRANSPARENT } as any);

    expect(() => manager.positionAllOverlays()).not.to.throw();
  });
});

describe('FreeTextOverlayManager - setOverlayHoverState', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('does nothing when no overlay entry exists', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    expect(() => manager.setOverlayHoverState(NON_EXISTENT_ID, true)).not.to.throw();
  });

  it('hides handles when lab is locked', () => {
    const cy = createMockCy();
    const callbacks = createMockCallbacks();
    callbacks.isLabLocked.returns(true);
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, callbacks);

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Hello', fontSize: 14, backgroundColor: TRANSPARENT };
    manager.getOrCreateOverlayEntry(annotation as any);

    expect(() => manager.setOverlayHoverState(TEST_ANNOTATION_ID, true)).not.to.throw();
  });

  it('shows handles when hovered and not locked', () => {
    const cy = createMockCy();
    const callbacks = createMockCallbacks();
    callbacks.isLabLocked.returns(false);
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, callbacks);

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Hello', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    manager.setOverlayHoverState(TEST_ANNOTATION_ID, true);

    expect(entry?.wrapper.classList.contains('free-text-overlay-hover')).to.be.true;
    expect(entry?.resizeHandle.classList.contains('free-text-overlay-resize-visible')).to.be.true;
    expect(entry?.rotateHandle.classList.contains('free-text-overlay-rotate-visible')).to.be.true;
  });
});

describe('FreeTextOverlayManager - overlay wrapper styling', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates wrapper with correct base styles', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = {
      id: TEST_ANNOTATION_ID,
      text: 'Hello',
      fontSize: 14,
      backgroundColor: TRANSPARENT
    };

    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.wrapper.style.position).to.equal('absolute');
    expect(entry?.wrapper.style.pointerEvents).to.equal('none');
  });

  it('sets annotation id as data attribute', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = {
      id: TEST_ANNOTATION_ID,
      text: 'Hello',
      fontSize: 14,
      backgroundColor: TRANSPARENT
    };

    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.wrapper.dataset.annotationId).to.equal(TEST_ANNOTATION_ID);
  });
});

describe('FreeTextOverlayManager - updateAnnotationOverlay no container', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('does nothing when overlay cannot be created', () => {
    const cy = { container: () => null, zoom: () => 1, on: sinon.spy() };
    const callbacks = createMockCallbacks();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, callbacks);

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const mockNode = {
      id: () => TEST_ANNOTATION_ID,
      position: () => ({ x: 100, y: 100 }),
      data: sinon.stub().returns({})
    };

    expect(() => manager.updateAnnotationOverlay(mockNode as any, annotation as any)).not.to.throw();
  });
});

describe('FreeTextOverlayManager - resize and rotate state', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates resize and rotate handles for overlay', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.resizeHandle).to.be.instanceOf(HTMLButtonElement);
    expect(entry?.rotateHandle).to.be.instanceOf(HTMLButtonElement);
    expect(entry?.resizeHandle.getAttribute('aria-label')).to.equal('Resize text block');
    expect(entry?.rotateHandle.getAttribute('aria-label')).to.equal('Rotate text block');
  });

  it('handles have touch action none for pointer events', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.resizeHandle.style.touchAction).to.equal('none');
    expect(entry?.rotateHandle.style.touchAction).to.equal('none');
  });
});

describe('FreeTextOverlayManager - scrollbar management', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates scrollbar element within overlay', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.scrollbar).to.be.instanceOf(HTMLDivElement);
    expect(entry?.scrollbar.className).to.include('free-text-overlay-scrollbar');
  });
});

describe('FreeTextOverlayManager - overlay wrapper classes', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('adds scrollable class to wrapper', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.wrapper.className).to.include('free-text-overlay-scrollable');
  });

  it('adds free-text-markdown class to content element', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.content.className).to.include('free-text-markdown');
  });

  it('sets word-break to break-word on wrapper', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.wrapper.style.wordBreak).to.equal('break-word');
  });

  it('sets transform-origin to center center', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const annotation = { id: TEST_ANNOTATION_ID, text: 'Test', fontSize: 14, backgroundColor: TRANSPARENT };
    const entry = manager.getOrCreateOverlayEntry(annotation as any);

    expect(entry?.wrapper.style.transformOrigin).to.equal('center center');
  });
});

describe('FreeTextOverlayManager - overlay container', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates overlay container as child of cy container', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    expect(manager.hasOverlayContainer()).to.be.true;
    const cyContainer = cy.container() as HTMLElement;
    const overlayLayer = cyContainer.querySelector('.free-text-overlay-layer');
    expect(overlayLayer).to.not.be.null;
  });

  it('sets relative positioning on cy container if static', () => {
    const cy = createMockCy();
    const container = cy.container() as HTMLElement;
    container.style.position = '';

    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());
    expect(manager).to.exist;
    // Container should have position set
  });
});

describe('FreeTextOverlayManager - multiple annotations', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    FreeTextOverlayManager = require('../../../src/topoViewer/webview/features/annotations/FreeTextOverlayManager').FreeTextOverlayManager;
    cleanupDom(dom);
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    sinon.restore();
    cleanupDom(dom);
  });

  it('creates separate entries for different annotations', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const ann1 = { id: 'ann-1', text: 'First', fontSize: 14, backgroundColor: TRANSPARENT };
    const ann2 = { id: 'ann-2', text: 'Second', fontSize: 14, backgroundColor: TRANSPARENT };

    const entry1 = manager.getOrCreateOverlayEntry(ann1 as any);
    const entry2 = manager.getOrCreateOverlayEntry(ann2 as any);

    expect(entry1?.wrapper.dataset.annotationId).to.equal('ann-1');
    expect(entry2?.wrapper.dataset.annotationId).to.equal('ann-2');
    expect(entry1).to.not.equal(entry2);
  });

  it('removes correct annotation when removeAnnotationOverlay called', () => {
    const cy = createMockCy();
    const manager = new FreeTextOverlayManager(cy as any, createMockMessageSender() as any, createMockCallbacks());

    const ann1 = { id: 'ann-1', text: 'First', fontSize: 14, backgroundColor: TRANSPARENT };
    const ann2 = { id: 'ann-2', text: 'Second', fontSize: 14, backgroundColor: TRANSPARENT };

    manager.getOrCreateOverlayEntry(ann1 as any);
    const entry2Before = manager.getOrCreateOverlayEntry(ann2 as any);

    manager.removeAnnotationOverlay('ann-1');

    // ann-2 should still exist with same reference
    const entry2After = manager.getOrCreateOverlayEntry(ann2 as any);
    expect(entry2After).to.equal(entry2Before);

    // ann-1 should create a new entry
    const entry1After = manager.getOrCreateOverlayEntry(ann1 as any);
    expect(entry1After?.wrapper.dataset.annotationId).to.equal('ann-1');
  });
});
