/* eslint-env mocha */
/* global describe, it, before, after, __dirname */
/**
 * Tests for inspectHtml.ts - Webview HTML generation for container inspection.
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

// Constants for tests
const CONTAINER_STATE_RUNNING = 'running';
const CONTAINER_STATE_EXITED = 'exited';
const CONTAINER_STATE_STOPPED = 'stopped';
const STATE_CLASS_RUNNING = 'state-running';
const STATE_CLASS_EXITED = 'state-exited';
const STATE_CLASS_OTHER = 'state-other';

/**
 * Tests for stateToClass helper function
 */
describe('inspectHtml - stateToClass', () => {
  let inspectHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    // Import after redirect setup - need to access internal functions
    // Since stateToClass is not exported, we'll test it through getInspectHtml
    inspectHtml = require('../../../src/webview/inspectHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should return state-running class for running state', () => {
    // Test via HTML output
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'test',
      state: CONTAINER_STATE_RUNNING,
      lab_name: 'testlab'
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include(STATE_CLASS_RUNNING);
  });

  it('should return state-exited class for exited state', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'test',
      state: CONTAINER_STATE_EXITED,
      lab_name: 'testlab'
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include(STATE_CLASS_EXITED);
  });

  it('should return state-exited class for stopped state', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'test',
      state: CONTAINER_STATE_STOPPED,
      lab_name: 'testlab'
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include(STATE_CLASS_EXITED);
  });

  it('should return state-other class for unknown state', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'test',
      state: 'paused',
      lab_name: 'testlab'
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include(STATE_CLASS_OTHER);
  });
});

/**
 * Tests for getInspectHtml basic structure
 */
describe('inspectHtml - getInspectHtml structure', () => {
  let inspectHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectHtml = require('../../../src/webview/inspectHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should return valid HTML document', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };

    const html = inspectHtml.getInspectHtml(mockWebview, [], mockUri);
    expect(html).to.include('<!DOCTYPE html>');
    expect(html).to.include('<html lang="en">');
    expect(html).to.include('</html>');
  });

  it('should include search box', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };

    const html = inspectHtml.getInspectHtml(mockWebview, [], mockUri);
    expect(html).to.include('id="searchBox"');
  });

  it('should include refresh button', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };

    const html = inspectHtml.getInspectHtml(mockWebview, [], mockUri);
    expect(html).to.include('id="refreshButton"');
  });

  it('should show no containers message when empty', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };

    const html = inspectHtml.getInspectHtml(mockWebview, [], mockUri);
    expect(html).to.include('No containers found.');
  });
});

/**
 * Tests for getInspectHtml with container data
 */
describe('inspectHtml - getInspectHtml with containers', () => {
  let inspectHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectHtml = require('../../../src/webview/inspectHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should include container name in HTML', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'clab-mylab-router1',
      state: CONTAINER_STATE_RUNNING,
      lab_name: 'mylab'
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('clab-mylab-router1');
  });

  it('should group containers by lab_name', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [
      { name: 'router1', state: CONTAINER_STATE_RUNNING, lab_name: 'lab1' },
      { name: 'router2', state: CONTAINER_STATE_RUNNING, lab_name: 'lab2' }
    ];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('data-lab-name="lab1"');
    expect(html).to.include('data-lab-name="lab2"');
  });

  it('should use labPath as fallback for lab grouping', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'router1',
      state: CONTAINER_STATE_RUNNING,
      labPath: '/path/to/lab'
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('/path/to/lab');
  });

  it('should use containerlab label as fallback for lab grouping', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'router1',
      state: CONTAINER_STATE_RUNNING,
      Labels: { containerlab: 'labeled-lab' }
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('labeled-lab');
  });

  it('should use unknown-lab when no lab identifier found', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'router1',
      state: CONTAINER_STATE_RUNNING
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('unknown-lab');
  });
});

// Create mock webview and uri
function createMocks() {
  return {
    mockWebview: { asWebviewUri: (uri: any) => uri.toString() },
    mockUri: { fsPath: '/mock/ext' }
  };
}

/**
 * Tests for getInspectHtml container fields
 */
describe('inspectHtml - container fields', () => {
  let inspectHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectHtml = require('../../../src/webview/inspectHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should include kind field', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ name: 'router1', state: CONTAINER_STATE_RUNNING, kind: 'nokia_srlinux', lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('nokia_srlinux');
  });

  it('should include image field', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ name: 'router1', state: CONTAINER_STATE_RUNNING, image: 'ghcr.io/nokia/srlinux:latest', lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('ghcr.io/nokia/srlinux:latest');
  });

  it('should include IPv4 address', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ name: 'router1', state: CONTAINER_STATE_RUNNING, ipv4_address: '172.20.20.2', lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('172.20.20.2');
  });

  it('should include IPv6 address', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ name: 'router1', state: CONTAINER_STATE_RUNNING, ipv6_address: '2001:db8::2', lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('2001:db8::2');
  });
});

/**
 * Tests for getInspectHtml fallback values
 */
describe('inspectHtml - fallback values', () => {
  let inspectHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectHtml = require('../../../src/webview/inspectHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should use Labels fallback for kind', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ name: 'router1', state: CONTAINER_STATE_RUNNING, Labels: { 'clab-node-kind': 'arista_ceos' }, lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('arista_ceos');
  });

  it('should use Names array fallback for container name', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ Names: ['/clab-test-router1'], state: CONTAINER_STATE_RUNNING, lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('/clab-test-router1');
  });

  it('should include owner label', () => {
    const { mockWebview, mockUri } = createMocks();
    const containers = [{ name: 'router1', state: CONTAINER_STATE_RUNNING, Labels: { 'clab-owner': 'testuser' }, lab_name: 'testlab' }];
    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('testuser');
  });
});

/**
 * Tests for buildPortsHtml functionality
 */
describe('inspectHtml - port links', () => {
  let inspectHtml: any;

  before(() => {
    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    inspectHtml = require('../../../src/webview/inspectHtml');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  it('should render port links for containers with ports', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'router1',
      ID: 'abc123',
      state: CONTAINER_STATE_RUNNING,
      lab_name: 'testlab',
      Ports: [{ port: 443, protocol: 'tcp' }]
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('class="port-link"');
    expect(html).to.include('data-port="443"');
    expect(html).to.include('data-protocol="tcp"');
  });

  it('should render multiple port links', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'router1',
      ID: 'abc123',
      state: CONTAINER_STATE_RUNNING,
      lab_name: 'testlab',
      Ports: [
        { port: 443, protocol: 'tcp' },
        { port: 80, protocol: 'tcp' }
      ]
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    expect(html).to.include('443/tcp');
    expect(html).to.include('80/tcp');
  });

  it('should show dash when no ports', () => {
    const mockWebview = {
      asWebviewUri: (uri: any) => uri.toString()
    };
    const mockUri = { fsPath: '/mock/ext' };
    const containers = [{
      name: 'router1',
      ID: 'abc123',
      state: CONTAINER_STATE_RUNNING,
      lab_name: 'testlab',
      Ports: []
    }];

    const html = inspectHtml.getInspectHtml(mockWebview, containers, mockUri);
    // The ports column should show '-' when empty
    expect(html).to.match(/<td>-<\/td>/);
  });
});
