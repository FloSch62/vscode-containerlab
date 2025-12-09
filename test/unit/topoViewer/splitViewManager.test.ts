/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach, after, __dirname */

import { expect } from 'chai';
import sinon from 'sinon';
import path from 'path';
import Module from 'module';

// Clear require cache for modules we need to stub BEFORE setting up resolution
const MODULE_PATH = '../../../src/topoViewer/extension/services/SplitViewManager';
Object.keys(require.cache).forEach(key => {
  // Clear all topoViewer modules and stubs to ensure fresh loads
  if (key.includes('topoViewer') || key.includes('vscode-stub') || key.includes('extensionLogger-stub') || key.includes('asyncUtils-stub')) {
    delete require.cache[key];
  }
});

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  // Mock the sleep function to resolve immediately
  if (request.includes('AsyncUtils')) {
    return path.join(__dirname, '..', '..', 'helpers', 'asyncUtils-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

// Now import stubs and module under test
import * as vscode from '../../helpers/vscode-stub';
import { resetLoggerStub } from '../../helpers/extensionLogger-stub';

const splitViewModule = require(MODULE_PATH) as typeof import('../../../src/topoViewer/extension/services/SplitViewManager');
const { SplitViewManager } = splitViewModule;

after(() => {
  (Module as any)._resolveFilename = originalResolve;
});

// Constants to avoid duplicate strings
const TEST_YAML_PATH = '/home/user/lab.clab.yml';
const SET_EDITOR_LAYOUT_CMD = 'vscode.setEditorLayout';
const CLOSE_EDITOR_CMD = 'workbench.action.closeActiveEditor';

describe('SplitViewManager - initial state', () => {
  let manager: InstanceType<typeof SplitViewManager>;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new SplitViewManager();
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('isOpen returns false initially', () => {
    expect(manager.isOpen).to.be.false;
  });

  it('reset sets isOpen to false', () => {
    // Access private field via any cast
    (manager as any).isSplitViewOpen = true;
    manager.reset();
    expect(manager.isOpen).to.be.false;
  });
});

describe('SplitViewManager - openTemplateFile', () => {
  let manager: InstanceType<typeof SplitViewManager>;
  let mockPanel: any;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new SplitViewManager();
    mockPanel = {
      revealed: false,
      reveal() {
        this.revealed = true;
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('opens document and sets layout', async () => {
    await manager.openTemplateFile(TEST_YAML_PATH, mockPanel);

    expect(manager.isOpen).to.be.true;
    expect(vscode.window.visibleTextEditors.length).to.be.greaterThan(0);

    const layoutCmd = vscode.commands.executed.find(c => c.command === SET_EDITOR_LAYOUT_CMD);
    expect(layoutCmd).to.not.be.undefined;
    expect(layoutCmd?.args[0].groups).to.have.length(2);
  });

  it('reveals panel after opening', async () => {
    await manager.openTemplateFile(TEST_YAML_PATH, mockPanel);

    expect(mockPanel.revealed).to.be.true;
  });

  it('works without panel', async () => {
    await manager.openTemplateFile(TEST_YAML_PATH);

    expect(manager.isOpen).to.be.true;
  });

  it('shows error on failure', async () => {
    sinon.stub(vscode.workspace, 'openTextDocument').rejects(new Error('File not found'));

    await manager.openTemplateFile(TEST_YAML_PATH, mockPanel);

    expect(vscode.window.lastErrorMessage).to.include('Error opening template file');
  });
});

describe('SplitViewManager - toggleSplitView open', () => {
  let manager: InstanceType<typeof SplitViewManager>;
  let mockPanel: any;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new SplitViewManager();
    mockPanel = {
      revealed: false,
      reveal() {
        this.revealed = true;
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('opens split view when closed', async () => {
    const result = await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);

    expect(result).to.be.true;
    expect(manager.isOpen).to.be.true;
  });

  it('warns when yaml path is missing', async () => {
    const result = await manager.toggleSplitView(undefined, mockPanel);

    expect(vscode.window.lastWarningMessage).to.include('No YAML file');
    expect(result).to.be.false;
  });

  it('warns when yaml path is empty string', async () => {
    const result = await manager.toggleSplitView('', mockPanel);

    expect(vscode.window.lastWarningMessage).to.include('No YAML file');
    expect(result).to.be.false;
  });
});

describe('SplitViewManager - toggleSplitView close', () => {
  let manager: InstanceType<typeof SplitViewManager>;
  let mockPanel: any;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new SplitViewManager();
    mockPanel = {
      revealed: false,
      reveal() {
        this.revealed = true;
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('closes split view when already open', async () => {
    // First open the split view
    await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);
    expect(manager.isOpen).to.be.true;

    // Add the yaml file to visible editors
    vscode.addVisibleEditor(TEST_YAML_PATH, 2);

    // Now toggle to close
    const result = await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);

    expect(result).to.be.false;
    expect(manager.isOpen).to.be.false;

    // Should have executed close editor command
    const closeCmd = vscode.commands.executed.find(c => c.command === CLOSE_EDITOR_CMD);
    expect(closeCmd).to.not.be.undefined;
  });

  it('resets layout when closing', async () => {
    // Open first
    await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);
    vscode.addVisibleEditor(TEST_YAML_PATH, 2);

    // Then close
    await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);

    // Find the layout command after the first one
    const layoutCmds = vscode.commands.executed.filter(c => c.command === SET_EDITOR_LAYOUT_CMD);
    expect(layoutCmds.length).to.be.greaterThan(1);
    const lastLayoutCmd = layoutCmds[layoutCmds.length - 1];
    expect(lastLayoutCmd.args[0].groups).to.have.length(1);
    expect(lastLayoutCmd.args[0].groups[0].size).to.equal(1);
  });

  it('reveals panel after closing', async () => {
    await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);
    vscode.addVisibleEditor(TEST_YAML_PATH, 2);
    mockPanel.revealed = false; // Reset

    await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);

    expect(mockPanel.revealed).to.be.true;
  });
});

describe('SplitViewManager - error handling', () => {
  let manager: InstanceType<typeof SplitViewManager>;
  let mockPanel: any;

  beforeEach(() => {
    resetLoggerStub();
    vscode.resetVscodeStub();
    manager = new SplitViewManager();
    mockPanel = {
      revealed: false,
      reveal() {
        this.revealed = true;
      }
    };
  });

  afterEach(() => {
    sinon.restore();
    vscode.resetVscodeStub();
  });

  it('shows error message on toggle failure', async () => {
    sinon.stub(vscode.workspace, 'openTextDocument').rejects(new Error('Access denied'));

    const result = await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);

    expect(vscode.window.lastErrorMessage).to.include('Error');
    expect(result).to.be.false;
  });

  it('preserves state on error', async () => {
    expect(manager.isOpen).to.be.false;

    sinon.stub(vscode.workspace, 'openTextDocument').rejects(new Error('Network error'));
    await manager.toggleSplitView(TEST_YAML_PATH, mockPanel);

    expect(manager.isOpen).to.be.false;
  });
});
