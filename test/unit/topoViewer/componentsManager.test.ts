/* eslint-env mocha, node */
/* global describe, it, before, after, beforeEach, afterEach, global, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import { JSDOM } from 'jsdom';
import Module from 'module';
import path from 'path';

// Setup for module resolution
let originalCssHandler: any;
let originalResolve: any;

// Constants to avoid duplicate strings
const NOKIA_SRSIM = 'nokia_srsim';
const SR_1 = 'sr-1';
const SR_7S = 'sr-7s';
const SLOT_TYPE_CPM = 'cpm';
const SLOT_TYPE_CARD = 'card';
const SCHEMA_SROS_SFM = 'sros-sfm-types';
const SCHEMA_SROS_XIOM = 'sros-xiom-types';
const SCHEMA_SROS_CPM = 'sros-cpm-types';
const SCHEMA_SROS_CARD = 'sros-card-types';
const SCHEMA_SROS_XIOM_MDA = 'sros-xiom-mda-types';
const SCHEMA_SROS_MDA = 'sros-mda-types';
const TAB_COMPONENTS_BUTTON_ID = 'tab-components-button';
const SFM_TYPE_1 = 'sfm-type-1';

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

// Setup minimal HTML templates needed for ComponentsManager
function createTestHtml(): string {
  return `<!DOCTYPE html>
<html>
<body>
  <button id="tab-components-button" class="hidden">Components</button>
  <div id="tab-components" class="hidden"></div>
  <div id="node-components-container">
    <div id="node-components-actions-distributed"></div>
    <div id="node-components-actions-integrated" class="hidden"></div>
    <div id="node-components-cpm-container"></div>
    <div id="node-components-card-container"></div>
    <div id="node-components-sfm-container"></div>
    <div id="node-components-integrated-section" class="hidden"></div>
    <div id="node-integrated-mda-container"></div>
    <button id="btn-add-integrated-mda"></button>
    <button id="btn-add-cpm"></button>
    <button id="btn-add-card"></button>
  </div>

  <!-- Templates -->
  <template id="tpl-component-entry">
    <div class="component-entry">
      <div data-action="toggle-component">
        <i data-role="component-caret" class="fa-chevron-right"></i>
        <input type="text" data-role="component-slot" value="" />
        <button data-action="component-slot-dec">-</button>
        <button data-action="component-slot-inc">+</button>
        <button data-action="remove-component">X</button>
      </div>
      <div data-role="component-body" class="hidden">
        <input type="hidden" data-role="component-type-value" />
        <div data-role="component-type-dropdown"></div>
        <div data-role="component-mda-group">
          <div data-role="mda-list"></div>
          <button data-action="add-mda">Add MDA</button>
        </div>
        <div class="form-group">
          <div data-role="xiom-list"></div>
          <button data-action="add-xiom">Add XIOM</button>
        </div>
      </div>
    </div>
  </template>

  <template id="tpl-mda-entry">
    <div class="component-mda-entry">
      <span data-role="mda-card-slot"></span>
      <input type="text" data-role="mda-slot" />
      <input type="hidden" data-role="mda-type-value" />
      <div data-role="mda-type-dropdown"></div>
      <button data-action="remove-mda">X</button>
    </div>
  </template>

  <template id="tpl-xiom-entry">
    <div class="component-xiom-entry">
      <span data-role="xiom-card-slot"></span>
      <input type="hidden" data-role="xiom-slot-value" />
      <div data-role="xiom-slot-dropdown"></div>
      <input type="hidden" data-role="xiom-type-value" />
      <div data-role="xiom-type-dropdown"></div>
      <div data-role="xiom-mda-list"></div>
      <button data-action="add-xiom-mda">Add XIOM MDA</button>
      <button data-action="remove-xiom">X</button>
    </div>
  </template>

  <template id="tpl-xiom-mda-entry">
    <div class="component-xiom-mda-entry">
      <span data-role="xiom-mda-card-slot"></span>
      <input type="text" data-role="xiom-mda-slot" />
      <input type="hidden" data-role="xiom-mda-type-value" />
      <div data-role="xiom-mda-type-dropdown"></div>
      <button data-action="remove-xiom-mda">X</button>
    </div>
  </template>

  <template id="tpl-sfm-entry">
    <div class="component-sfm-entry">
      <input type="hidden" data-role="sfm-value" />
      <div data-role="sfm-dropdown"></div>
    </div>
  </template>

  <template id="tpl-integrated-mda-entry">
    <div class="integrated-mda-entry">
      <input type="text" data-role="integrated-mda-slot" />
      <input type="hidden" data-role="integrated-mda-type-value" />
      <div data-role="integrated-mda-type-dropdown"></div>
      <button data-action="remove-integrated-mda">X</button>
    </div>
  </template>
</body>
</html>`;
}

let dom: JSDOM;
let ComponentsManager: typeof import('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;

function createDom(): JSDOM {
  const newDom = new JSDOM(createTestHtml(), { url: 'https://test.local' });
  (global as any).window = newDom.window;
  (global as any).document = newDom.window.document;
  (global as any).MutationObserver = class {
    observe() {}
    disconnect() {}
  };
  return newDom;
}

function cleanupDom(): void {
  dom?.window?.close();
  delete (global as any).window;
  delete (global as any).document;
  delete (global as any).MutationObserver;
}

// Mock utilities
function createMockUtilities() {
  const values: Record<string, string> = {};
  return {
    getInputValue: (id: string) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      return el?.value ?? values[id] ?? '';
    },
    setInputValue: (id: string, value: string | number) => {
      const el = document.getElementById(id) as HTMLInputElement | null;
      if (el) el.value = String(value);
      values[id] = String(value);
    },
    extractIndex: (id: string, re: RegExp): number | null => {
      const m = re.exec(id);
      return m ? parseInt(m[1], 10) : null;
    },
    switchToTab: sinon.stub(),
  };
}

// Mock cytoscape node
function createMockNode(extraData: any = {}) {
  return {
    data: (key?: string) => {
      if (key === 'extraData') return extraData;
      return extraData;
    },
  } as any;
}

describe('ComponentsManager - constructor and basic methods', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should instantiate with utilities', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager).to.be.instanceOf(ComponentsManager);
  });

  it('should set and check current node', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    const node = createMockNode({ kind: NOKIA_SRSIM });

    manager.setCurrentNode(node);
    expect(manager.isIntegratedMode()).to.be.false;
  });

  it('should correctly identify component kinds', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    expect(manager.isComponentKind(NOKIA_SRSIM)).to.be.true;
    expect(manager.isComponentKind('linux')).to.be.false;
    expect(manager.isComponentKind('srl')).to.be.false;
  });

  it('should start in non-integrated mode', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedMode()).to.be.false;
  });
});

describe('ComponentsManager - schema extraction', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should extract component enums from schema', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const schema = {
      definitions: {
        [SCHEMA_SROS_SFM]: { enum: [SFM_TYPE_1, 'sfm-type-2'] },
        [SCHEMA_SROS_XIOM]: { enum: ['xiom-a', 'xiom-b'] },
        [SCHEMA_SROS_CPM]: { enum: ['cpm-1'] },
        [SCHEMA_SROS_CARD]: { enum: ['card-1', 'card-2', 'card-3'] },
        [SCHEMA_SROS_XIOM_MDA]: { enum: ['xmda-1'] },
        [SCHEMA_SROS_MDA]: { enum: ['mda-1', 'mda-2'] },
      },
    };

    manager.extractComponentEnumsFromSchema(schema);
    // The enums are private, but we can verify they work via dropdown refresh
    expect(() => manager.refreshComponentsDropdowns()).not.to.throw();
  });

  it('should handle empty schema gracefully', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.extractComponentEnumsFromSchema({});
    expect(() => manager.refreshComponentsDropdowns()).not.to.throw();
  });

  it('should handle null schema gracefully', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.extractComponentEnumsFromSchema(null);
    expect(() => manager.refreshComponentsDropdowns()).not.to.throw();
  });
});

describe('ComponentsManager - integrated SROS type detection', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should identify sr-1 as integrated type', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, SR_1)).to.be.true;
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'SR-1')).to.be.true;
  });

  it('should identify sr-1s as integrated type', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'sr-1s')).to.be.true;
  });

  it('should identify ixr variants as integrated types', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'ixr-r6')).to.be.true;
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'ixr-ec')).to.be.true;
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'ixr-e2')).to.be.true;
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'ixr-e2c')).to.be.true;
  });

  it('should return false for non-nokia_srsim kinds', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedSrosType('linux', SR_1)).to.be.false;
    expect(manager.isIntegratedSrosType('srl', 'ixr-r6')).to.be.false;
  });

  it('should return false for undefined kind or type', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedSrosType(undefined, SR_1)).to.be.false;
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, undefined)).to.be.false;
    expect(manager.isIntegratedSrosType(undefined, undefined)).to.be.false;
  });

  it('should return false for distributed types', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, SR_7S)).to.be.false;
    expect(manager.isIntegratedSrosType(NOKIA_SRSIM, 'sr-12s')).to.be.false;
  });
});

describe('ComponentsManager - tab visibility', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should show components tab for nokia_srsim kind', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.updateComponentsTabVisibility(NOKIA_SRSIM);

    const btn = document.getElementById(TAB_COMPONENTS_BUTTON_ID);
    expect(btn?.classList.contains('hidden')).to.be.false;
  });

  it('should hide components tab for non-component kinds', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.updateComponentsTabVisibility('linux');

    const btn = document.getElementById(TAB_COMPONENTS_BUTTON_ID);
    expect(btn?.classList.contains('hidden')).to.be.true;
  });

  it('should switch to basic tab when hiding active components tab', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const btn = document.getElementById(TAB_COMPONENTS_BUTTON_ID);
    btn?.classList.add('tab-active');
    btn?.classList.remove('hidden');

    manager.updateComponentsTabVisibility('linux');

    expect(utils.switchToTab.calledOnceWith('basic')).to.be.true;
  });
});

describe('ComponentsManager - component mode updates', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should set integrated mode for sr-1 type', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    const node = createMockNode({ kind: NOKIA_SRSIM, type: SR_1 });

    manager.setCurrentNode(node);
    manager.updateComponentMode(false);

    expect(manager.isIntegratedMode()).to.be.true;
  });

  it('should set distributed mode for sr-7s type', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    const node = createMockNode({ kind: NOKIA_SRSIM, type: SR_7S });

    manager.setCurrentNode(node);
    manager.updateComponentMode(false);

    expect(manager.isIntegratedMode()).to.be.false;
  });

  it('should reset to non-integrated mode when node is null', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    // First set an integrated node
    const node = createMockNode({ kind: NOKIA_SRSIM, type: SR_1 });
    manager.setCurrentNode(node);
    manager.updateComponentMode(false);
    expect(manager.isIntegratedMode()).to.be.true;

    // Then clear the node
    manager.setCurrentNode(null);
    manager.updateComponentMode(false);
    expect(manager.isIntegratedMode()).to.be.false;
  });
});

describe('ComponentsManager - CPM slot detection', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should identify A as CPM slot', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isCpmSlot('A')).to.be.true;
    expect(manager.isCpmSlot('a')).to.be.true;
  });

  it('should identify B as CPM slot', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isCpmSlot('B')).to.be.true;
    expect(manager.isCpmSlot('b')).to.be.true;
  });

  it('should not identify numeric slots as CPM', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isCpmSlot('1')).to.be.false;
    expect(manager.isCpmSlot('2')).to.be.false;
    expect(manager.isCpmSlot('10')).to.be.false;
  });

  it('should handle empty and invalid values', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);
    expect(manager.isCpmSlot('')).to.be.false;
    expect(manager.isCpmSlot('AB')).to.be.false;
    expect(manager.isCpmSlot('C')).to.be.false;
  });
});

describe('ComponentsManager - slot parsing', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should parse CPM slots correctly', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    expect(manager.parseComponentSlot('A')).to.deep.equal({ value: 'A' });
    expect(manager.parseComponentSlot('a')).to.deep.equal({ value: 'A' });
    expect(manager.parseComponentSlot('B')).to.deep.equal({ value: 'B' });
    expect(manager.parseComponentSlot('b')).to.deep.equal({ value: 'B' });
  });

  it('should parse numeric slots correctly', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    expect(manager.parseComponentSlot('1')).to.deep.equal({ value: 1 });
    expect(manager.parseComponentSlot('5')).to.deep.equal({ value: 5 });
    expect(manager.parseComponentSlot('10')).to.deep.equal({ value: 10 });
  });

  it('should return null for empty or invalid slots', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    expect(manager.parseComponentSlot('')).to.be.null;
    expect(manager.parseComponentSlot('   ')).to.be.null;
    expect(manager.parseComponentSlot('0')).to.be.null;
    expect(manager.parseComponentSlot('-1')).to.be.null;
    expect(manager.parseComponentSlot('AB')).to.be.null;
  });
});

describe('ComponentsManager - component entry management', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should add component entry with default values', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry();

    expect(idx).to.be.greaterThan(0);
    const entry = document.getElementById(`component-entry-${idx}`);
    expect(entry).to.not.be.null;
  });

  it('should add CPM entry to CPM container', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry({ slot: 'A' }, { slotType: SLOT_TYPE_CPM });

    const cpmContainer = document.getElementById('node-components-cpm-container');
    const entry = document.getElementById(`component-entry-${idx}`);
    expect(cpmContainer?.contains(entry)).to.be.true;
  });

  it('should add card entry to card container', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry({ slot: 1 }, { slotType: SLOT_TYPE_CARD });

    const cardContainer = document.getElementById('node-components-card-container');
    const entry = document.getElementById(`component-entry-${idx}`);
    expect(cardContainer?.contains(entry)).to.be.true;
  });

  it('should remove component entry', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry();
    expect(document.getElementById(`component-entry-${idx}`)).to.not.be.null;

    manager.removeComponentEntry(idx);
    expect(document.getElementById(`component-entry-${idx}`)).to.be.null;
  });

  it('should expand component entry', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry({ slot: '1' });
    const entry = document.getElementById(`component-entry-${idx}`);
    const body = entry?.querySelector('[data-role="component-body"]');

    // Initially collapsed (added without expand)
    body?.classList.add('hidden');

    manager.expandComponentEntry(idx);

    expect(body?.classList.contains('hidden')).to.be.false;
  });
});

describe('ComponentsManager - MDA management', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should add MDA entry to component', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addMdaEntry(compIdx);

    const container = document.getElementById(`component-${compIdx}-mda-container`);
    const mdaEntries = container?.querySelectorAll('.component-mda-entry');
    expect(mdaEntries?.length).to.equal(1);
  });

  it('should add MDA entry with prefill values', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addMdaEntry(compIdx, { slot: 5, type: 'mda-type-1' });

    const slotInput = document.getElementById(`component-${compIdx}-mda-1-slot`) as HTMLInputElement;
    const typeInput = document.getElementById(`component-${compIdx}-mda-1-type`) as HTMLInputElement;

    expect(slotInput?.value).to.equal('5');
    expect(typeInput?.value).to.equal('mda-type-1');
  });

  it('should collect MDAs from component', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addMdaEntry(compIdx, { slot: 1, type: 'mda-1' });
    manager.addMdaEntry(compIdx, { slot: 2, type: 'mda-2' });

    const mdas = manager.collectMdas(compIdx);

    expect(mdas).to.have.length(2);
    expect(mdas[0]).to.deep.equal({ slot: 1, type: 'mda-1' });
    expect(mdas[1]).to.deep.equal({ slot: 2, type: 'mda-2' });
  });
});

describe('ComponentsManager - XIOM management', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should add XIOM entry to card component', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addXiomEntry(compIdx);

    const container = document.getElementById(`component-${compIdx}-xiom-container`);
    const xiomEntries = container?.querySelectorAll('.component-xiom-entry');
    expect(xiomEntries?.length).to.equal(1);
  });

  it('should add XIOM MDA entry', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addXiomEntry(compIdx, { slot: 1, type: 'xiom-type-1' });
    manager.addXiomMdaEntry(compIdx, 1, { slot: 1, type: 'xiom-mda-type-1' });

    const container = document.getElementById(`component-${compIdx}-xiom-1-mda-container`);
    const mdaEntries = container?.querySelectorAll('.component-xiom-mda-entry');
    expect(mdaEntries?.length).to.equal(1);
  });

  it('should collect XIOMsfrom component', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addXiomEntry(compIdx, { slot: 1, type: 'xiom-1' });

    const xioms = manager.collectXioms(compIdx);

    expect(xioms).to.have.length(1);
    expect(xioms[0].slot).to.equal(1);
    expect(xioms[0].type).to.equal('xiom-1');
  });

  it('should collect XIOM MDAs', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const compIdx = manager.addComponentEntry({ slot: '1' }, { slotType: SLOT_TYPE_CARD });
    manager.addXiomEntry(compIdx, { slot: 1, type: 'xiom-1' });
    manager.addXiomMdaEntry(compIdx, 1, { slot: 1, type: 'xmda-1' });
    manager.addXiomMdaEntry(compIdx, 1, { slot: 2, type: 'xmda-2' });

    const xiomMdas = manager.collectXiomMdas(compIdx, 1);

    expect(xiomMdas).to.have.length(2);
  });
});

describe('ComponentsManager - SFM management', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should get SFM value', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    // Load components which creates SFM entry
    manager.setCurrentNode(createMockNode({ kind: NOKIA_SRSIM, type: SR_7S, components: [] }));
    manager.loadComponentsFromNode();

    const sfmValue = manager.getSfmValue();
    expect(sfmValue).to.be.a('string');
  });

  it('should apply SFM to components', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const components: any[] = [
      { slot: 'A', type: 'cpm-1' },
      { slot: 1, type: 'card-1' },
    ];

    manager.applySfmToComponents(components, SFM_TYPE_1);

    expect(components[0].sfm).to.equal(SFM_TYPE_1);
    expect(components[1].sfm).to.equal(SFM_TYPE_1);
  });

  it('should remove SFM from components when empty', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const components: any[] = [
      { slot: 'A', type: 'cpm-1', sfm: 'old-sfm' },
    ];

    manager.applySfmToComponents(components, '');

    expect(components[0]).to.not.have.property('sfm');
  });
});

describe('ComponentsManager - integrated MDA mode', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should add integrated MDA entry', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    // Set to integrated mode
    manager.setCurrentNode(createMockNode({ kind: NOKIA_SRSIM, type: SR_1 }));
    manager.updateComponentMode(false);

    const mdaId = manager.addIntegratedMdaEntry({ slot: 1, type: 'mda-1' });

    expect(mdaId).to.be.greaterThan(0);
    const entry = document.getElementById(`integrated-mda-entry-${mdaId}`);
    expect(entry).to.not.be.null;
  });

  it('should collect integrated MDAs', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.setCurrentNode(createMockNode({ kind: NOKIA_SRSIM, type: SR_1 }));
    manager.updateComponentMode(false);

    manager.addIntegratedMdaEntry({ slot: 1, type: 'mda-1' });
    manager.addIntegratedMdaEntry({ slot: 2, type: 'mda-2' });

    const mdas = manager.collectIntegratedMdas();

    expect(mdas).to.have.length(2);
    expect(mdas[0]).to.deep.equal({ slot: 1, type: 'mda-1' });
    expect(mdas[1]).to.deep.equal({ slot: 2, type: 'mda-2' });
  });
});

describe('ComponentsManager - building component from entry', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should build component object from CPM entry', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry({ slot: 'A', type: 'cpm-type-1' }, { slotType: SLOT_TYPE_CPM });
    const entry = document.getElementById(`component-entry-${idx}`) as HTMLElement;

    const comp = manager.buildComponentFromEntry(entry);

    expect(comp).to.not.be.null;
    expect(comp.slot).to.equal('A');
    expect(comp.type).to.equal('cpm-type-1');
    expect(comp).to.not.have.property('mda');
    expect(comp).to.not.have.property('xiom');
  });

  it('should build component object from card entry with MDAs', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx = manager.addComponentEntry({ slot: 1, type: 'card-type-1' }, { slotType: SLOT_TYPE_CARD });
    manager.addMdaEntry(idx, { slot: 1, type: 'mda-1' });

    const entry = document.getElementById(`component-entry-${idx}`) as HTMLElement;
    const comp = manager.buildComponentFromEntry(entry);

    expect(comp).to.not.be.null;
    expect(comp.slot).to.equal(1);
    expect(comp.type).to.equal('card-type-1');
    expect(comp.mda).to.have.length(1);
  });

  it('should return null for invalid entry', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const fakeEntry = document.createElement('div');
    fakeEntry.id = 'invalid-entry';

    const comp = manager.buildComponentFromEntry(fakeEntry);

    expect(comp).to.be.null;
  });
});

describe('ComponentsManager - collecting all entries', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should get all component entries', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.addComponentEntry({ slot: 'A' }, { slotType: SLOT_TYPE_CPM });
    manager.addComponentEntry({ slot: 'B' }, { slotType: SLOT_TYPE_CPM });
    manager.addComponentEntry({ slot: 1 }, { slotType: SLOT_TYPE_CARD });

    const entries = manager.getAllComponentEntries();

    expect(entries).to.have.length(3);
  });

  it('should collect expanded component slots', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const idx1 = manager.addComponentEntry({ slot: 'A' }, { slotType: SLOT_TYPE_CPM });
    const idx2 = manager.addComponentEntry({ slot: 1 }, { slotType: SLOT_TYPE_CARD });

    // Expand first, collapse second
    manager.expandComponentEntry(idx1);
    const entry2 = document.getElementById(`component-entry-${idx2}`);
    const body2 = entry2?.querySelector('[data-role="component-body"]');
    body2?.classList.add('hidden');

    const expandedSlots = manager.collectExpandedComponentSlots();

    expect(expandedSlots.has('A')).to.be.true;
    expect(expandedSlots.has('1')).to.be.false;
  });

  it('should set pending expanded slots', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const slots = new Set(['A', '1']);
    manager.setPendingExpandedSlots(slots);

    // This is used internally during loadComponentsFromNode
    expect(() => manager.loadComponentsFromNode(slots)).not.to.throw();
  });
});

describe('ComponentsManager - add button states', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should disable CPM button when both slots are used', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.addComponentEntry({ slot: 'A' }, { slotType: SLOT_TYPE_CPM });
    manager.addComponentEntry({ slot: 'B' }, { slotType: SLOT_TYPE_CPM });

    manager.updateComponentAddButtonStates();

    const addCpmBtn = document.getElementById('btn-add-cpm') as HTMLButtonElement;
    expect(addCpmBtn?.disabled).to.be.true;
  });

  it('should enable CPM button when slots are available', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.addComponentEntry({ slot: 'A' }, { slotType: SLOT_TYPE_CPM });

    manager.updateComponentAddButtonStates();

    const addCpmBtn = document.getElementById('btn-add-cpm') as HTMLButtonElement;
    expect(addCpmBtn?.disabled).to.be.false;
  });

  it('should always enable card button', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.addComponentEntry({ slot: 1 }, { slotType: SLOT_TYPE_CARD });
    manager.addComponentEntry({ slot: 2 }, { slotType: SLOT_TYPE_CARD });

    manager.updateComponentAddButtonStates();

    const addCardBtn = document.getElementById('btn-add-card') as HTMLButtonElement;
    expect(addCardBtn?.disabled).to.be.false;
  });
});

describe('ComponentsManager - dropdown commits', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should commit component dropdowns without error', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.addComponentEntry({ slot: 1, type: 'card-1' }, { slotType: SLOT_TYPE_CARD });

    expect(() => manager.commitComponentDropdowns()).not.to.throw();
  });

  it('should commit SFM dropdown without error', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.setCurrentNode(createMockNode({ kind: NOKIA_SRSIM, type: SR_7S, components: [] }));
    manager.loadComponentsFromNode();

    expect(() => manager.commitSfmDropdown()).not.to.throw();
  });

  it('should commit integrated MDA dropdowns without error', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.setCurrentNode(createMockNode({ kind: NOKIA_SRSIM, type: SR_1 }));
    manager.updateComponentMode(false);
    manager.addIntegratedMdaEntry({ slot: 1, type: 'mda-1' });

    expect(() => manager.commitIntegratedMdaDropdowns()).not.to.throw();
  });
});

describe('ComponentsManager - loading from node', () => {
  before(() => {
    installModuleStubs();
    dom = createDom();
    ComponentsManager = require('../../../src/topoViewer/webview/features/node-editor/ComponentsManager').ComponentsManager;
    cleanupDom();
  });

  after(() => {
    restoreModuleStubs();
  });

  beforeEach(() => {
    dom = createDom();
  });

  afterEach(() => {
    cleanupDom();
    sinon.restore();
  });

  it('should load distributed components from node', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const node = createMockNode({
      kind: NOKIA_SRSIM,
      type: SR_7S,
      components: [
        { slot: 'A', type: 'cpm-1' },
        { slot: 1, type: 'card-1', mda: [{ slot: 1, type: 'mda-1' }] },
      ],
    });

    manager.setCurrentNode(node);
    manager.loadComponentsFromNode();

    const entries = manager.getAllComponentEntries();
    expect(entries.length).to.be.greaterThan(0);
  });

  it('should load integrated MDAs from node', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const node = createMockNode({
      kind: NOKIA_SRSIM,
      type: SR_1,
      components: [
        { mda: [{ slot: 1, type: 'mda-1' }, { slot: 2, type: 'mda-2' }] },
      ],
    });

    manager.setCurrentNode(node);
    manager.updateComponentMode(false);
    manager.loadComponentsFromNode();

    const container = document.getElementById('node-integrated-mda-container');
    const mdaEntries = container?.querySelectorAll('.integrated-mda-entry');
    expect(mdaEntries?.length).to.equal(2);
  });

  it('should handle node with no components', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    const node = createMockNode({
      kind: NOKIA_SRSIM,
      type: SR_7S,
    });

    manager.setCurrentNode(node);

    expect(() => manager.loadComponentsFromNode()).not.to.throw();
  });

  it('should handle null node', () => {
    const utils = createMockUtilities();
    const manager = new ComponentsManager(utils);

    manager.setCurrentNode(null);

    expect(() => manager.loadComponentsFromNode()).not.to.throw();
  });
});
