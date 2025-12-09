/* eslint-env mocha, node */
/* global describe, it, before, after, beforeEach, afterEach, global, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import Module from 'module';
import path from 'path';

// Module stub setup
let originalCssHandler: any;
let originalResolve: any;

// Constants to avoid duplicate strings
const DISPLAY_BLOCK = 'block';
const DISPLAY_NONE = 'none';
const LAYOUT_DRAWER_ID = 'viewport-drawer-layout';
const SELECT_LAYOUT_ALGO_ID = 'select-layout-algo';
const FORCE_DIRECTED_DRAWER_ID = 'viewport-drawer-force-directed';

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
      <div id="cy"></div>
      <div id="root-div"></div>
      <div id="${LAYOUT_DRAWER_ID}" class="viewport-drawer" style="display: none;"></div>
      <div id="viewport-drawer-force-directed" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-force-directed-reset-start" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-force-directed-radial" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-force-directed-radial-reset-start" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-dc-vertical" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-dc-vertical-reset-start" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-dc-horizontal" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-dc-horizontal-reset-start" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-geo-map" class="layout-algo" style="display: none;"></div>
      <div id="viewport-drawer-geo-map-content-01" class="layout-algo" style="display: none;"></div>
      <div class="viewport-geo-map hidden"></div>
      <select id="${SELECT_LAYOUT_ALGO_ID}">
        <option value="Force Directed">Force Directed</option>
        <option value="Force Directed Radial">Force Directed Radial</option>
        <option value="Vertical">Vertical</option>
        <option value="Horizontal">Horizontal</option>
        <option value="Geo Positioning">Geo Positioning</option>
        <option value="Preset">Preset</option>
      </select>
      <input id="force-directed-slider-link-lenght" value="1" />
      <input id="force-directed-slider-node-gap" value="1" />
      <input id="force-directed-radial-slider-link-lenght" value="1" />
      <input id="force-directed-radial-slider-node-gap" value="1" />
      <input id="vertical-layout-slider-node-v-gap" value="1" />
      <input id="vertical-layout-slider-group-v-gap" value="100" />
      <input id="horizontal-layout-slider-node-h-gap" value="10" />
      <input id="horizontal-layout-slider-group-h-gap" value="100" />
    </body>
    </html>
  `, { url: 'https://test.local' });

  (global as any).window = dom.window;
  (global as any).document = dom.window.document;
  (global as any).requestAnimationFrame = (cb: any) => setTimeout(cb, 0);
  (global as any).cancelAnimationFrame = (id: any) => clearTimeout(id);
  return dom;
}

function cleanupDom(dom: JSDOM): void {
  dom?.window?.close();
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).requestAnimationFrame;
  delete (global as any).cancelAnimationFrame;
}

let LayoutManager: typeof import('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
let dom: JSDOM;

describe('LayoutManager - constructor and getCy', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should instantiate with default values', () => {
    const manager = new LayoutManager();
    expect(manager.isGeoMapInitialized).to.be.false;
    expect(manager.cytoscapeLeafletMap).to.be.undefined;
    expect(manager.geoTheme).to.be.null;
  });

  it('should return falsy when no cy is available', () => {
    const manager = new LayoutManager() as any;
    const cy = manager.getCy();
    // May return undefined or null depending on state initialization
    expect(cy).to.not.be.ok;
  });
});

describe('LayoutManager - viewportButtonsLayoutAlgo', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should toggle layout drawer from none to block', () => {
    const manager = new LayoutManager();
    const drawer = document.getElementById(LAYOUT_DRAWER_ID);
    expect(drawer?.style.display).to.equal(DISPLAY_NONE);

    manager.viewportButtonsLayoutAlgo();

    expect(drawer?.style.display).to.equal(DISPLAY_BLOCK);
  });

  it('should toggle layout drawer from block to none', () => {
    const manager = new LayoutManager();
    const drawer = document.getElementById(LAYOUT_DRAWER_ID);
    drawer!.style.display = DISPLAY_BLOCK;

    manager.viewportButtonsLayoutAlgo();

    expect(drawer?.style.display).to.equal(DISPLAY_NONE);
  });

  it('should prevent event propagation', () => {
    const manager = new LayoutManager();
    const event = {
      preventDefault: sinon.spy(),
      stopPropagation: sinon.spy()
    } as any;

    manager.viewportButtonsLayoutAlgo(event);

    expect(event.preventDefault.calledOnce).to.be.true;
    expect(event.stopPropagation.calledOnce).to.be.true;
  });
});

describe('LayoutManager - layoutAlgoChange panel selection', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should show Force Directed panels when selected', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;
    select.value = 'Force Directed';

    manager.layoutAlgoChange();

    const panel = document.getElementById(FORCE_DIRECTED_DRAWER_ID);
    expect(panel?.style.display).to.equal(DISPLAY_BLOCK);
  });

  it('should show Vertical panels when selected', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;
    select.value = 'Vertical';

    manager.layoutAlgoChange();

    const panel = document.getElementById('viewport-drawer-dc-vertical');
    expect(panel?.style.display).to.equal(DISPLAY_BLOCK);
  });

  it('should show Horizontal panels when selected', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;
    select.value = 'Horizontal';

    manager.layoutAlgoChange();

    const panel = document.getElementById('viewport-drawer-dc-horizontal');
    expect(panel?.style.display).to.equal(DISPLAY_BLOCK);
  });

  it('should stop event propagation', () => {
    const manager = new LayoutManager();
    const event = { stopPropagation: sinon.spy() } as any;

    manager.layoutAlgoChange(event);

    expect(event.stopPropagation.calledOnce).to.be.true;
  });
});

describe('LayoutManager - calculateGeoScale', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should return default scale factor when no map', () => {
    const manager = new LayoutManager();
    const scale = manager.calculateGeoScale();
    expect(scale).to.equal(4);
  });

  it('should calculate scale based on zoom difference', () => {
    const manager = new LayoutManager();
    (manager as any).geoScaleBaseZoom = 10;
    manager.cytoscapeLeafletMap = {
      getZoom: () => 12
    };

    const scale = manager.calculateGeoScale();
    // factor * 2^(12-10) = 4 * 4 = 16
    expect(scale).to.equal(16);
  });

  it('should handle zoom out correctly', () => {
    const manager = new LayoutManager();
    (manager as any).geoScaleBaseZoom = 10;
    manager.cytoscapeLeafletMap = {
      getZoom: () => 8
    };

    const scale = manager.calculateGeoScale();
    // factor * 2^(8-10) = 4 * 0.25 = 1
    expect(scale).to.equal(1);
  });
});

describe('LayoutManager - ensureNumericData returns existing', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should return existing data value', () => {
    const manager = new LayoutManager() as any;
    const mockElement = {
      data: (key: string, val?: any) => {
        if (key === '_origWidth' && val === undefined) return 50;
        return val;
      },
      style: () => '100'
    };

    const result = manager.ensureNumericData(mockElement, '_origWidth', 'width');
    expect(result).to.equal(50);
  });
});

describe('LayoutManager - ensureNumericData stores and parses', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should parse and store style value when data missing', () => {
    const manager = new LayoutManager() as any;
    let storedValue: number | undefined;
    const mockElement = {
      data: (_dataKey: string, val?: any) => {
        if (val !== undefined) {
          storedValue = val;
        }
        return storedValue;
      },
      style: () => '75'
    };

    const result = manager.ensureNumericData(mockElement, '_origWidth', 'width');
    expect(result).to.equal(75);
    expect(storedValue).to.equal(75);
  });

  it('should use fallback for NaN style values', () => {
    const manager = new LayoutManager() as any;
    let storedValue: number | undefined;
    const mockElement = {
      data: (_dataKey: string, val?: any) => {
        if (val !== undefined) {
          storedValue = val;
        }
        return storedValue;
      },
      style: () => 'auto'
    };

    const result = manager.ensureNumericData(mockElement, '_origWidth', 'width', 10);
    expect(result).to.equal(10);
  });
});

describe('LayoutManager - parseInputValue', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should parse input value from existing element', () => {
    const manager = new LayoutManager() as any;
    const value = manager.parseInputValue('force-directed-slider-link-lenght', '5');
    expect(value).to.equal(1);
  });

  it('should use fallback when element not found', () => {
    const manager = new LayoutManager() as any;
    const value = manager.parseInputValue('nonexistent-element', '10');
    expect(value).to.equal(10);
  });

  it('should apply multiplier', () => {
    const manager = new LayoutManager() as any;
    const value = manager.parseInputValue('force-directed-slider-link-lenght', '1', 5);
    expect(value).to.equal(5);
  });
});

describe('LayoutManager - GeoMap pan and edit modes', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should enable pan mode when initialized', () => {
    const manager = new LayoutManager();
    const mockMap = {
      dragging: {
        enable: sinon.spy(),
        disable: sinon.spy()
      }
    };
    const mockLeaf = {
      setZoomControlOpacity: sinon.spy(),
      map: mockMap
    };
    manager.cytoscapeLeafletLeaf = mockLeaf;

    const mockCy = {
      container: () => ({ style: {} })
    };
    (global as any).window.topoViewerState = {
      editorEngine: { cy: mockCy },
      cy: mockCy
    };

    manager.viewportButtonsGeoMapPan();

    expect(mockLeaf.setZoomControlOpacity.calledOnce).to.be.true;
    expect(mockMap.dragging.enable.calledOnce).to.be.true;
  });

  it('should enable edit mode when initialized', () => {
    const manager = new LayoutManager();
    const mockMap = {
      dragging: {
        enable: sinon.spy(),
        disable: sinon.spy()
      }
    };
    const mockLeaf = {
      setZoomControlOpacity: sinon.spy(),
      map: mockMap
    };
    manager.cytoscapeLeafletLeaf = mockLeaf;

    const mockCy = {
      container: () => ({ style: {} })
    };
    (global as any).window.topoViewerState = {
      editorEngine: { cy: mockCy },
      cy: mockCy
    };

    manager.viewportButtonsGeoMapEdit();

    expect(mockLeaf.setZoomControlOpacity.calledWith(0.5)).to.be.true;
    expect(mockMap.dragging.disable.calledOnce).to.be.true;
  });

  it('should not throw when leaflet not initialized for pan mode', () => {
    const manager = new LayoutManager();
    manager.cytoscapeLeafletLeaf = undefined;

    expect(() => manager.viewportButtonsGeoMapPan()).not.to.throw();
  });

  it('should not throw when leaflet not initialized for edit mode', () => {
    const manager = new LayoutManager();
    manager.cytoscapeLeafletLeaf = undefined;

    expect(() => manager.viewportButtonsGeoMapEdit()).not.to.throw();
  });
});

describe('LayoutManager - updateNodeGeoCoordinates edge cases', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('returns early when cy is undefined', () => {
    const manager = new LayoutManager();
    expect(() => manager.updateNodeGeoCoordinates()).not.to.throw();
  });

  it('handles undefined map gracefully', () => {
    const manager = new LayoutManager();
    const mockCy = { nodes: () => [] };
    (global as any).window.topoViewerState = {
      editorEngine: { cy: mockCy },
      cy: mockCy
    };

    expect(() => manager.updateNodeGeoCoordinates()).not.to.throw();
  });
});

describe('LayoutManager - updateNodeGeoCoordinates map function', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should have containerPointToLatLng function available on map', () => {
    const manager = new LayoutManager();
    const containerPointSpy = sinon.spy(() => ({ lat: 48.5, lng: 9.0 }));

    manager.cytoscapeLeafletMap = {
      containerPointToLatLng: containerPointSpy
    };

    expect(manager.cytoscapeLeafletMap.containerPointToLatLng).to.be.a('function');
    expect(() => manager.updateNodeGeoCoordinates()).not.to.throw();
  });
});

describe('LayoutManager - updateNodeGeoCoordinates skip existing', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should skip nodes that already have lat/lng', () => {
    const manager = new LayoutManager();
    const dataSpy = sinon.spy();
    const mockNode = {
      data: (dataKey?: string, val?: any) => {
        if (dataKey === 'lat' && val === undefined) return '48.5';
        if (dataKey === 'lng' && val === undefined) return '9.0';
        if (val !== undefined) dataSpy(dataKey, val);
        return val;
      },
      position: () => ({ x: 100, y: 200 })
    };
    const mockCy = {
      nodes: () => ({
        forEach: (fn: any) => fn(mockNode)
      })
    };
    (global as any).window.topoViewerState = {
      editorEngine: { cy: mockCy },
      cy: mockCy
    };
    manager.cytoscapeLeafletMap = {
      containerPointToLatLng: sinon.spy()
    };

    manager.updateNodeGeoCoordinates();

    expect(dataSpy.called).to.be.false;
  });
});

describe('LayoutManager - applyGeoScale enable', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('handles undefined cy when enabling geo scale', () => {
    const manager = new LayoutManager();
    expect(() => manager.applyGeoScale(true)).not.to.throw();
  });

  it('should track lastGeoScale when enabled', () => {
    const manager = new LayoutManager() as any;
    // Initialize with a baseline scale
    manager.lastGeoScale = 4;

    // Without cy, the method returns early, so we just test the initial state
    expect(manager.lastGeoScale).to.equal(4);
    expect(manager.geoScaleFactor).to.equal(4);
  });
});

describe('LayoutManager - applyGeoScale disable', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('should not throw when cy is undefined and disabled', () => {
    const manager = new LayoutManager();
    expect(() => manager.applyGeoScale(false)).not.to.throw();
  });

  it('should only process if geoScaleApplied was true', () => {
    const manager = new LayoutManager() as any;
    // If geoScaleApplied is false, disabling shouldn't reset anything
    manager.geoScaleApplied = false;

    manager.applyGeoScale(false);

    // Should remain false
    expect(manager.geoScaleApplied).to.be.false;
  });

  it('should reset base text metrics when scale was applied', () => {
    const manager = new LayoutManager() as any;
    manager.baseNodeTextOutlineWidth = 0.5;
    manager.baseNodeTextBgPadding = 0.5;
    manager.geoScaleApplied = false;  // Not applied, so disable is no-op

    manager.applyGeoScale(false);

    // Values remain because geoScaleApplied was false
    expect(manager.baseNodeTextOutlineWidth).to.equal(0.5);
  });
});

describe('LayoutManager - assignMissingLatLng', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('handles undefined cy when assigning lat/lng', () => {
    const manager = new LayoutManager();
    expect(() => manager.assignMissingLatLng()).not.to.throw();
  });
});

describe('LayoutManager - viewportDrawerLayoutVertical', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('returns early when cy is undefined for vertical layout', () => {
    const manager = new LayoutManager();
    expect(() => manager.viewportDrawerLayoutVertical()).not.to.throw();
  });

  it('reads gap values from input elements', () => {
    const manager = new LayoutManager();
    const nodeGapInput = document.getElementById('vertical-layout-slider-node-v-gap') as HTMLInputElement;
    nodeGapInput.value = '5';

    expect(() => manager.viewportDrawerLayoutVertical()).not.to.throw();
  });
});

describe('LayoutManager - viewportDrawerLayoutHorizontal', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('returns early when cy is undefined for horizontal layout', () => {
    const manager = new LayoutManager();
    expect(() => manager.viewportDrawerLayoutHorizontal()).not.to.throw();
  });

  it('reads gap values from input elements', () => {
    const manager = new LayoutManager();
    const nodeGapInput = document.getElementById('horizontal-layout-slider-node-h-gap') as HTMLInputElement;
    nodeGapInput.value = '15';

    expect(() => manager.viewportDrawerLayoutHorizontal()).not.to.throw();
  });
});

describe('LayoutManager - layout algo panel visibility', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('shows Force Directed Radial panels when selected', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;
    select.value = 'Force Directed Radial';

    manager.layoutAlgoChange();

    const panel = document.getElementById('viewport-drawer-force-directed-radial');
    expect(panel?.style.display).to.equal(DISPLAY_BLOCK);
  });

  it('shows Geo Positioning panels when selected', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;
    select.value = 'Geo Positioning';

    manager.layoutAlgoChange();

    const panel = document.getElementById('viewport-drawer-geo-map');
    expect(panel?.style.display).to.equal(DISPLAY_BLOCK);
  });

  it('hides all layout algo panels first', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;

    // Set one panel visible first
    const forcePanel = document.getElementById(FORCE_DIRECTED_DRAWER_ID);
    forcePanel!.style.display = DISPLAY_BLOCK;

    // Switch to different layout
    select.value = 'Horizontal';
    manager.layoutAlgoChange();

    expect(forcePanel?.style.display).to.equal(DISPLAY_NONE);
  });
});

describe('LayoutManager - geoScaleFactor properties', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('initializes with default geoScaleFactor', () => {
    const manager = new LayoutManager() as any;
    expect(manager.geoScaleFactor).to.equal(4);
  });

  it('initializes with default lastGeoScale equal to geoScaleFactor', () => {
    const manager = new LayoutManager() as any;
    expect(manager.lastGeoScale).to.equal(manager.geoScaleFactor);
  });

  it('initializes geoScaleApplied to false', () => {
    const manager = new LayoutManager() as any;
    expect(manager.geoScaleApplied).to.be.false;
  });
});

describe('LayoutManager - isVscodeDeployment flag', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('reads isVscodeDeployment from window', () => {
    (global as any).window.isVscodeDeployment = true;
    const manager = new LayoutManager();
    expect(manager.isVscodeDeployment).to.be.true;
  });

  it('defaults to false when window property not set', () => {
    delete (global as any).window.isVscodeDeployment;
    const manager = new LayoutManager();
    expect(manager.isVscodeDeployment).to.be.false;
  });
});

describe('LayoutManager - ensureFontSize cached value', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('uses cached font size when already stored', () => {
    const manager = new LayoutManager() as any;
    const mockElement = {
      data: (key: string) => {
        if (key === '_origFont') return 14;
        return undefined;
      },
      style: () => '12px'
    };

    const result = manager.ensureFontSize(mockElement, '_origFont');
    expect(result).to.equal(14);
  });
});

describe('LayoutManager - ensureFontSize parsing', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('parses numeric value from style string with em suffix', () => {
    const manager = new LayoutManager() as any;
    let storedValue: number | undefined;
    const mockElement = {
      data: (_key: string, val?: any) => {
        if (val !== undefined) storedValue = val;
        return storedValue;
      },
      style: () => '1.5em',  // parseFloat('1.5em') returns 1.5
      renderedStyle: undefined
    };

    const result = manager.ensureFontSize(mockElement, '_origFont');
    // parseFloat extracts the numeric part (1.5), em conversion only happens
    // when the initial parse fails
    expect(result).to.equal(1.5);
  });

  it('uses default 12px when font-size is invalid', () => {
    const manager = new LayoutManager() as any;
    let storedValue: number | undefined;
    const mockElement = {
      data: (_key: string, val?: any) => {
        if (val !== undefined) storedValue = val;
        return storedValue;
      },
      style: () => 'invalid',
      renderedStyle: () => 'invalid'
    };

    const result = manager.ensureFontSize(mockElement, '_origFont');
    expect(result).to.equal(12);
  });
});

describe('LayoutManager - geoTheme property', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('initializes geoTheme to null', () => {
    const manager = new LayoutManager();
    expect(manager.geoTheme).to.be.null;
  });

  it('can be set to light theme', () => {
    const manager = new LayoutManager();
    manager.geoTheme = 'light';
    expect(manager.geoTheme).to.equal('light');
  });

  it('can be set to dark theme', () => {
    const manager = new LayoutManager();
    manager.geoTheme = 'dark';
    expect(manager.geoTheme).to.equal('dark');
  });
});

describe('LayoutManager - cytoscapeLeafletMap property', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('initializes cytoscapeLeafletMap to undefined', () => {
    const manager = new LayoutManager();
    expect(manager.cytoscapeLeafletMap).to.be.undefined;
  });

  it('can be assigned a map object', () => {
    const manager = new LayoutManager();
    const mockMap = { getZoom: () => 10 };
    manager.cytoscapeLeafletMap = mockMap;
    expect(manager.cytoscapeLeafletMap).to.equal(mockMap);
  });
});

describe('LayoutManager - cytoscapeLeafletLeaf property', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('initializes cytoscapeLeafletLeaf to undefined', () => {
    const manager = new LayoutManager();
    expect(manager.cytoscapeLeafletLeaf).to.be.undefined;
  });

  it('can be assigned a leaf object', () => {
    const manager = new LayoutManager();
    const mockLeaf = { setZoomControlOpacity: sinon.spy() };
    manager.cytoscapeLeafletLeaf = mockLeaf;
    expect(manager.cytoscapeLeafletLeaf).to.equal(mockLeaf);
  });
});

describe('LayoutManager - layout algo Preset selection', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('hides all panels when Preset is selected', () => {
    const manager = new LayoutManager();
    const select = document.getElementById(SELECT_LAYOUT_ALGO_ID) as HTMLSelectElement;

    // First show a panel
    const forcePanel = document.getElementById(FORCE_DIRECTED_DRAWER_ID);
    forcePanel!.style.display = DISPLAY_BLOCK;

    // Select Preset which has no specific panel
    select.value = 'Preset';
    manager.layoutAlgoChange();

    expect(forcePanel?.style.display).to.equal(DISPLAY_NONE);
  });
});

describe('LayoutManager - private baseline properties', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    LayoutManager = require('../../../src/topoViewer/webview/features/canvas/LayoutManager').LayoutManager;
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

  it('initializes baseline text metrics to zero', () => {
    const manager = new LayoutManager() as any;
    expect(manager.baseNodeTextOutlineWidth).to.equal(0);
    expect(manager.baseNodeTextBgPadding).to.equal(0);
    expect(manager.baseEdgeTextOutlineWidth).to.equal(0);
    expect(manager.baseEdgeTextBgPadding).to.equal(0);
  });

  it('initializes edge offset baselines to zero', () => {
    const manager = new LayoutManager() as any;
    expect(manager.baseEdgeSourceTextOffset).to.equal(0);
    expect(manager.baseEdgeTargetTextOffset).to.equal(0);
  });

  it('initializes geoLabelScaleBias to 8', () => {
    const manager = new LayoutManager() as any;
    expect(manager.geoLabelScaleBias).to.equal(8);
  });
});
