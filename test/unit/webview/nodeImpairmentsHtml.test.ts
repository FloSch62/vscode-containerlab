/* eslint-env mocha */
/* global describe, it, before, after, __dirname */
/**
 * Tests for nodeImpairmentsHtml.ts - Webview HTML generation for link impairments.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

// Module redirect for vscode stub
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  return null;
}

// Create mock webview and uri
function createMocks() {
  return {
    mockWebview: { asWebviewUri: (uri: any) => uri.toString() },
    mockUri: { fsPath: '/mock/ext' }
  };
}

// Constants
const NODE_NAME_ROUTER1 = 'router1';
const INTERFACE_ETH1 = 'eth1';
const INTERFACE_ETH2 = 'eth2';

/**
 * Tests for getNodeImpairmentsHtml basic structure
 */
describe('nodeImpairmentsHtml - basic structure', () => {
  let nodeImpairmentsHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    nodeImpairmentsHtml = require('../../../src/webview/nodeImpairmentsHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should return valid HTML document', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<!DOCTYPE html>');
    expect(html).to.include('<html lang="en">');
    expect(html).to.include('</html>');
  });

  it('should include node name in title', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include(`Manage Link Impairments for ${NODE_NAME_ROUTER1}`);
  });

  it('should include node name in header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include(`Link Impairments: ${NODE_NAME_ROUTER1}`);
  });

  it('should include Apply button', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('id="applyBtn"');
    expect(html).to.include('Apply');
  });

  it('should include Clear All button', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('id="clearAllBtn"');
    expect(html).to.include('Clear All');
  });

  it('should include Refresh button', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('id="refreshBtn"');
    expect(html).to.include('Refresh');
  });
});

/**
 * Tests for getNodeImpairmentsHtml table structure
 */
describe('nodeImpairmentsHtml - table headers', () => {
  let nodeImpairmentsHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    nodeImpairmentsHtml = require('../../../src/webview/nodeImpairmentsHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should include Interface header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<th>Interface</th>');
  });

  it('should include Delay header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<th>Delay</th>');
  });

  it('should include Jitter header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<th>Jitter</th>');
  });

  it('should include Loss header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<th>Loss</th>');
  });

  it('should include Rate-limit header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<th>Rate-limit</th>');
  });

  it('should include Corruption header', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('<th>Corruption</th>');
  });
});

/**
 * Tests for interface rows
 */
describe('nodeImpairmentsHtml - interface rows', () => {
  let nodeImpairmentsHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    nodeImpairmentsHtml = require('../../../src/webview/nodeImpairmentsHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should render interface row with data attribute', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include(`data-intf="${INTERFACE_ETH1}"`);
  });

  it('should render interface name in table cell', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include(`<td data-label="Interface">${INTERFACE_ETH1}</td>`);
  });

  it('should sort interfaces alphabetically', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH2]: {}, [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    const eth1Index = html.indexOf(`data-label="Interface">${INTERFACE_ETH1}`);
    const eth2Index = html.indexOf(`data-label="Interface">${INTERFACE_ETH2}`);
    expect(eth1Index).to.be.lessThan(eth2Index);
  });

  it('should render multiple interfaces', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {}, [INTERFACE_ETH2]: {}, 'eth3': {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include(INTERFACE_ETH1);
    expect(html).to.include(INTERFACE_ETH2);
    expect(html).to.include('eth3');
  });
});

/**
 * Tests for input field values
 */
describe('nodeImpairmentsHtml - field values', () => {
  let nodeImpairmentsHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    nodeImpairmentsHtml = require('../../../src/webview/nodeImpairmentsHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should render delay input with value', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: { delay: '100' } };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('data-field="delay"');
    expect(html).to.include('value="100"');
  });

  it('should render jitter input with value', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: { jitter: '10' } };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('data-field="jitter"');
    expect(html).to.include('value="10"');
  });

  it('should render loss input with value', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: { loss: '5' } };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('data-field="loss"');
    expect(html).to.include('value="5"');
  });

  it('should render rate input with value', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: { rate: '1000' } };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('data-field="rate"');
    expect(html).to.include('value="1000"');
  });

  it('should render corruption input with value', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: { corruption: '2' } };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('data-field="corruption"');
    expect(html).to.include('value="2"');
  });

  it('should render empty value when field is undefined', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('value=""');
  });
});

/**
 * Tests for input field units
 */
describe('nodeImpairmentsHtml - field units', () => {
  let nodeImpairmentsHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    nodeImpairmentsHtml = require('../../../src/webview/nodeImpairmentsHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should show ms/s/m unit for delay', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('ms/s/m');
  });

  it('should show ms/s unit for jitter', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('ms/s');
  });

  it('should show % unit for loss', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('<span class="unit">%</span>');
  });

  it('should show kb/s unit for rate', () => {
    const { mockWebview, mockUri } = createMocks();
    const interfacesData = { [INTERFACE_ETH1]: {} };
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, interfacesData, mockUri);
    expect(html).to.include('kb/s');
  });
});

/**
 * Tests for JavaScript behavior inclusion
 */
describe('nodeImpairmentsHtml - JavaScript', () => {
  let nodeImpairmentsHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    nodeImpairmentsHtml = require('../../../src/webview/nodeImpairmentsHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should include vscode API acquisition', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('acquireVsCodeApi()');
  });

  it('should include apply command handler', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('command: "apply"');
  });

  it('should include clearAll command handler', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('command: "clearAll"');
  });

  it('should include refresh command handler', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('command: "refresh"');
  });

  it('should include updateFields message handler', () => {
    const { mockWebview, mockUri } = createMocks();
    const html = nodeImpairmentsHtml.getNodeImpairmentsHtml(mockWebview, NODE_NAME_ROUTER1, {}, mockUri);
    expect(html).to.include('command === "updateFields"');
  });
});
