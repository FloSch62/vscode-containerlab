/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname, setImmediate */
/**
 * Tests for the `inspect` commands.
 */
import { expect } from 'chai';
import sinon from 'sinon';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.includes('/extension') && !request.includes('stub') && !request.includes('node_modules')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('/inspector') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'inspector-stub.js');
  }
  if (request.includes('/inspectHtml') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'inspectHtml-stub.js');
  }
  return null;
}

let inspectModule: any;
let inspectAllLabs: Function;
let inspectOneLab: Function;
let vscodeStub: any;
let inspectorStub: any;
let extensionStub: any;
let inspectHtmlStub: any;

const TEST_EXTENSION_PATH = '/test/extension';
const LAB_NAME_1 = 'lab1';
const LAB_NAME_2 = 'lab2';
const NODE_1 = 'clab-lab1-node1';
const NODE_2 = 'clab-lab2-node1';
const CLAB_INSPECT = 'clabInspect';
const ALL_LABS_TITLE = 'Inspect - All Labs';
const LAB1_PATH = '/home/user/lab1.clab.yml';

function createContext() {
  return {
    extensionUri: { fsPath: TEST_EXTENSION_PATH, toString: () => TEST_EXTENSION_PATH }
  };
}

function createNode(name: string, label: string, labPath: string) {
  return { label, name, labPath: { absolute: labPath } };
}

function setupInspectTests() {
  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      return stubPath ?? originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    inspectorStub = require('../../helpers/inspector-stub');
    extensionStub = require('../../helpers/extension-stub');
    inspectHtmlStub = require('../../helpers/inspectHtml-stub');
    inspectModule = require('../../../src/commands/inspect');
    inspectAllLabs = inspectModule.inspectAllLabs;
    inspectOneLab = inspectModule.inspectOneLab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    inspectorStub.resetForTests();
    extensionStub.resetExtensionStub();
    inspectHtmlStub.resetInspectHtmlStub();

    // Clear inspect module to reset currentPanel
    Object.keys(require.cache).forEach(key => {
      if (key.includes('/commands/inspect') && !key.includes('stub') && !key.includes('node_modules')) {
        delete require.cache[key];
      }
    });

    inspectModule = require('../../../src/commands/inspect');
    inspectAllLabs = inspectModule.inspectAllLabs;
    inspectOneLab = inspectModule.inspectOneLab;
  });

  afterEach(() => {
    sinon.restore();
  });
}

describe('inspect - normalizeInspectOutput', () => {
  setupInspectTests();

  it('handles old format with containers array', () => {
    const oldFormat = { containers: [{ name: NODE_1, lab_name: LAB_NAME_1 }, { name: 'clab-lab1-node2', lab_name: LAB_NAME_1 }] };
    inspectorStub.setRawInspectData(oldFormat as any);

    return inspectAllLabs(createContext() as any).then(() => {
      expect(inspectHtmlStub.getLastContainers().length).to.equal(2);
    });
  });

  it('handles new format with lab names as keys', async () => {
    const newFormat = {
      [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1 }, { name: 'clab-lab1-node2', lab_name: LAB_NAME_1 }],
      [LAB_NAME_2]: [{ name: NODE_2, lab_name: LAB_NAME_2 }]
    };
    inspectorStub.setRawInspectData(newFormat as any);
    await inspectAllLabs(createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(3);
  });

  it('handles empty data gracefully', async () => {
    inspectorStub.setRawInspectData(undefined);
    await inspectAllLabs(createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(0);
  });

  it('skips non-array values in new format', async () => {
    const mixedFormat = { [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1 }], invalidKey: 'not an array', [LAB_NAME_2]: [{ name: NODE_2, lab_name: LAB_NAME_2 }] };
    inspectorStub.setRawInspectData(mixedFormat as any);
    await inspectAllLabs(createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(2);
  });

  it('handles null data', async () => {
    inspectorStub.setRawInspectData(null as any);
    await inspectAllLabs(createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(0);
  });
});

describe('inspect - inspectAllLabs', () => {
  setupInspectTests();

  it('successfully inspects all labs', async () => {
    const testData = { [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1, state: 'running' }], [LAB_NAME_2]: [{ name: NODE_2, lab_name: LAB_NAME_2, state: 'running' }] };
    inspectorStub.setRawInspectData(testData as any);
    await inspectAllLabs(createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(2);
  });

  it('creates webview panel with correct title', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let createArgs: any[] = [];
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { createArgs = args; return originalCreate.apply(vscodeStub.window, args); };
    await inspectAllLabs(createContext() as any);
    expect(createArgs[0]).to.equal(CLAB_INSPECT);
    expect(createArgs[1]).to.equal(ALL_LABS_TITLE);
    vscodeStub.window.createWebviewPanel = originalCreate;
  });

  it('handles inspector.update() failure with error message', async () => {
    const updateStub = sinon.stub(inspectorStub, 'update').rejects(new Error('Failed to get inspect data'));
    await inspectAllLabs(createContext() as any);
    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to refresh inspect data');
    updateStub.restore();
  });

  it('handles non-Error exceptions', async () => {
    const updateStub = sinon.stub(inspectorStub, 'update').rejects('string error');
    await inspectAllLabs(createContext() as any);
    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to refresh inspect data');
    updateStub.restore();
  });
});

describe('inspect - inspectAllLabs panel reuse', () => {
  setupInspectTests();

  it('reuses existing panel when already open', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let createCallCount = 0;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { createCallCount++; return originalCreate.apply(vscodeStub.window, args); };
    await inspectAllLabs(createContext() as any);
    expect(createCallCount).to.equal(1);
    await inspectAllLabs(createContext() as any);
    expect(createCallCount).to.equal(1);
    vscodeStub.window.createWebviewPanel = originalCreate;
  });
});

describe('inspect - inspectOneLab validation', () => {
  setupInspectTests();

  it('returns early with error when labPath is missing', async () => {
    const node = createNode('test-lab', 'test-lab', '');
    await inspectOneLab(node as any, createContext() as any);
    expect(vscodeStub.window.lastErrorMessage).to.equal('No lab path found for this lab.');
  });
});

describe('inspect - inspectOneLab success', () => {
  setupInspectTests();

  it('successfully inspects single lab by name', async () => {
    const testData = { [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1, state: 'running' }], [LAB_NAME_2]: [{ name: NODE_2, lab_name: LAB_NAME_2, state: 'running' }] };
    inspectorStub.setRawInspectData(testData as any);
    const node = createNode(LAB_NAME_1, LAB_NAME_1, LAB1_PATH);
    await inspectOneLab(node as any, createContext() as any);
    const containers = inspectHtmlStub.getLastContainers();
    expect(containers.length).to.equal(1);
    expect(containers[0].name).to.equal(NODE_1);
  });

  it('filters containers when lab name does not match', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1, state: 'running' }] } as any);
    const node = createNode('different-name', LAB_NAME_1, LAB1_PATH);
    await inspectOneLab(node as any, createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(0);
  });

  it('creates webview with lab-specific title', async () => {
    inspectorStub.setRawInspectData({ mylab: [{ name: 'clab-mylab-node1', lab_name: 'mylab' }] } as any);
    const node = createNode('mylab', 'My Lab', '/home/user/mylab.clab.yml');
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let createArgs: any[] = [];
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { createArgs = args; return originalCreate.apply(vscodeStub.window, args); };
    await inspectOneLab(node as any, createContext() as any);
    expect(createArgs[1]).to.equal('Inspect - My Lab');
    vscodeStub.window.createWebviewPanel = originalCreate;
  });
});

describe('inspect - inspectOneLab errors', () => {
  setupInspectTests();

  it('handles inspector.update() failure', async () => {
    const updateStub = sinon.stub(inspectorStub, 'update').rejects(new Error('Update failed'));
    const node = createNode('test-lab', 'test-lab', '/home/user/test.clab.yml');
    await inspectOneLab(node as any, createContext() as any);
    expect(vscodeStub.window.lastErrorMessage).to.include('Failed to refresh lab test-lab');
    updateStub.restore();
  });

  it('handles case when lab is not found in inspect data', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1 }] } as any);
    const node = createNode(LAB_NAME_2, LAB_NAME_2, '/home/user/lab2.clab.yml');
    await inspectOneLab(node as any, createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(0);
  });

  it('skips non-array entries when filtering', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: NODE_1, lab_name: LAB_NAME_1 }], invalidEntry: 'not an array' } as any);
    const node = createNode(LAB_NAME_1, LAB_NAME_1, LAB1_PATH);
    await inspectOneLab(node as any, createContext() as any);
    expect(inspectHtmlStub.getLastContainers().length).to.equal(1);
  });
});

describe('inspect - webview panel basic', () => {
  setupInspectTests();

  it('sets webview HTML via getInspectHtml', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    await inspectAllLabs(createContext() as any);
    expect(inspectHtmlStub.getLastWebview()).to.not.be.undefined;
  });

  it('sets icon path on webview panel', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let capturedPanel: any;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { capturedPanel = originalCreate.apply(vscodeStub.window, args); return capturedPanel; };
    await inspectAllLabs(createContext() as any);
    expect(capturedPanel.iconPath).to.not.be.undefined;
    vscodeStub.window.createWebviewPanel = originalCreate;
  });
});

describe('inspect - webview messages', () => {
  setupInspectTests();

  it('handles refresh message from webview for all labs', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let capturedPanel: any;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { capturedPanel = originalCreate.apply(vscodeStub.window, args); return capturedPanel; };
    await inspectAllLabs(createContext() as any);
    inspectHtmlStub.resetInspectHtmlStub();
    capturedPanel.simulateMessage({ command: 'refresh' });
    await new Promise(resolve => setImmediate(resolve));
    expect(inspectHtmlStub.getLastContainers().length).to.equal(1);
    vscodeStub.window.createWebviewPanel = originalCreate;
  });

  it('handles refresh message from webview for single lab', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const node = createNode(LAB_NAME_1, LAB_NAME_1, LAB1_PATH);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let capturedPanel: any;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { capturedPanel = originalCreate.apply(vscodeStub.window, args); return capturedPanel; };
    await inspectOneLab(node as any, createContext() as any);
    inspectHtmlStub.resetInspectHtmlStub();
    capturedPanel.simulateMessage({ command: 'refresh' });
    await new Promise(resolve => setImmediate(resolve));
    expect(inspectHtmlStub.getLastContainers().length).to.equal(1);
    vscodeStub.window.createWebviewPanel = originalCreate;
  });

  it('handles openPort message from webview', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let capturedPanel: any;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { capturedPanel = originalCreate.apply(vscodeStub.window, args); return capturedPanel; };
    const openExternalSpy = sinon.spy(vscodeStub.env, 'openExternal');
    await inspectAllLabs(createContext() as any);
    capturedPanel.simulateMessage({ command: 'openPort', containerName: 'test-container', port: '8080', protocol: 'tcp' });
    await new Promise(resolve => setImmediate(resolve));
    expect(openExternalSpy.calledOnce).to.be.true;
    expect(vscodeStub.window.lastInfoMessage).to.include('Opening port 8080 in browser');
    vscodeStub.window.createWebviewPanel = originalCreate;
  });
});

describe('inspect - webview dispose', () => {
  setupInspectTests();

  it('cleans up panel reference on dispose', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let firstPanel: any;
    let secondPanel: any;
    let callCount = 0;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => {
      const panel = originalCreate.apply(vscodeStub.window, args);
      callCount++;
      if (callCount === 1) firstPanel = panel;
      else if (callCount === 2) secondPanel = panel;
      return panel;
    };
    await inspectAllLabs(createContext() as any);
    firstPanel.dispose();
    await inspectAllLabs(createContext() as any);
    expect(secondPanel).to.not.be.undefined;
    expect(callCount).to.equal(2);
    vscodeStub.window.createWebviewPanel = originalCreate;
  });

  it('updates existing panel title and HTML when reused', async () => {
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }] } as any);
    const originalCreate = vscodeStub.window.createWebviewPanel;
    let capturedPanel: any;
    vscodeStub.window.createWebviewPanel = (...args: any[]) => { capturedPanel = originalCreate.apply(vscodeStub.window, args); return capturedPanel; };
    await inspectAllLabs(createContext() as any);
    const firstHtml = capturedPanel.webview.html;
    inspectorStub.setRawInspectData({ [LAB_NAME_1]: [{ name: 'node1', lab_name: LAB_NAME_1 }], [LAB_NAME_2]: [{ name: 'node2', lab_name: LAB_NAME_2 }] } as any);
    await inspectAllLabs(createContext() as any);
    expect(capturedPanel.webview.html).to.not.equal(firstHtml);
    vscodeStub.window.createWebviewPanel = originalCreate;
  });
});
