/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, __dirname */
/**
 * Tests for graph.ts - draw.io and TopoViewer graph commands.
 */
import { expect } from 'chai';
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

// Constants
const STUB_PATH_EXTENSION = 'extension-stub.js';
const MOCK_VIEWER_NAME = 'mock-viewer';
const ERR_NO_PANEL = 'No active TopoViewer panel to reload.';
const IT_NO_CMD_NODE_UNDEFINED = 'executes no commands when node is undefined';
const TEST_LAB_NAME = 'test-lab';
const TEST_LAB_PATH = '/path/to/test.clab.yaml';
const MOCK_EXTENSION_PATH = '/extension';

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('/extension') || request.endsWith('\\extension')) {
    return path.join(__dirname, '..', '..', 'helpers', STUB_PATH_EXTENSION);
  }
  if (request.includes('clabCommand') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'clabCommand-stub.js');
  }
  if (request.includes('utils/utils') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  // Stub the TopoViewer class
  if (request.includes('topoViewer') && !request.includes('stub') && !request.includes('test')) {
    return path.join(__dirname, '..', '..', 'helpers', 'topoViewer-stub.js');
  }
  return null;
}

// Shared mock panel creator
function createMockPanel() {
  return {
    webview: { postMessage: async () => true },
    onDidDispose: () => ({ dispose: () => {} })
  };
}

describe('graph commands - topoViewer state', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  describe('getCurrentTopoViewer()', () => {
    it('returns undefined when no viewer is set', () => {
      const viewer = graphModule.getCurrentTopoViewer();

      expect(viewer).to.be.undefined;
    });

    it('returns the viewer when set', () => {
      const mockViewer = { name: MOCK_VIEWER_NAME };
      graphModule.setCurrentTopoViewer(mockViewer);

      const viewer = graphModule.getCurrentTopoViewer();

      expect(viewer).to.equal(mockViewer);
    });
  });

  describe('setCurrentTopoViewer()', () => {
    it('sets the current viewer', () => {
      const mockViewer = { name: MOCK_VIEWER_NAME };

      graphModule.setCurrentTopoViewer(mockViewer);

      expect(graphModule.getCurrentTopoViewer()).to.equal(mockViewer);
    });

    it('clears the viewer when set to undefined', () => {
      const mockViewer = { name: MOCK_VIEWER_NAME };
      graphModule.setCurrentTopoViewer(mockViewer);

      graphModule.setCurrentTopoViewer(undefined);

      expect(graphModule.getCurrentTopoViewer()).to.be.undefined;
    });
  });

  describe('graphTopoviewerReload()', () => {
    it('shows error when no panel exists', async () => {
      graphModule.setCurrentTopoViewer(undefined);

      await graphModule.graphTopoviewerReload();

      expect(vscodeStub.window.lastErrorMessage).to.equal(ERR_NO_PANEL);
    });
  });
});

describe('graph commands - notifications', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  describe('notifyCurrentTopoViewerOfCommandSuccess()', () => {
    it('completes without error when no viewer is set', async () => {
      graphModule.setCurrentTopoViewer(undefined);

      const result = await graphModule.notifyCurrentTopoViewerOfCommandSuccess('deploy');

      // Function should complete without throwing
      expect(result).to.be.undefined;
    });
  });

  describe('notifyCurrentTopoViewerOfCommandFailure()', () => {
    it('completes without error when no viewer is set', async () => {
      graphModule.setCurrentTopoViewer(undefined);

      const result = await graphModule.notifyCurrentTopoViewerOfCommandFailure('deploy', new Error('test error'));

      expect(result).to.be.undefined;
    });

    it('handles string errors without throwing', async () => {
      graphModule.setCurrentTopoViewer(undefined);

      const result = await graphModule.notifyCurrentTopoViewerOfCommandFailure('destroy', 'string error');

      expect(result).to.be.undefined;
    });
  });
});

describe('graph commands - drawIO functions', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  describe('graphDrawIOHorizontal()', () => {
    it(IT_NO_CMD_NODE_UNDEFINED, async () => {
      await graphModule.graphDrawIOHorizontal(undefined);

      expect(vscodeStub.commands.executed).to.have.length(0);
    });
  });

  describe('graphDrawIOVertical()', () => {
    it(IT_NO_CMD_NODE_UNDEFINED, async () => {
      await graphModule.graphDrawIOVertical(undefined);

      expect(vscodeStub.commands.executed).to.have.length(0);
    });
  });

  describe('graphDrawIOInteractive()', () => {
    it(IT_NO_CMD_NODE_UNDEFINED, async () => {
      await graphModule.graphDrawIOInteractive(undefined);

      expect(vscodeStub.commands.executed).to.have.length(0);
    });
  });

  describe('graphTopoviewer()', () => {
    it('shows error when node has no lab path and no active editor', async () => {
      await graphModule.graphTopoviewer(undefined);

      expect(vscodeStub.window.lastErrorMessage).to.include('No lab node');
    });
  });
});

describe('graph - viewer reload with viewer', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  it('shows error when viewer exists but panel is undefined', async () => {
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: undefined,
      updatePanelHtml: async () => {}
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    await graphModule.graphTopoviewerReload();

    expect(vscodeStub.window.lastErrorMessage).to.include('No active TopoViewer');
  });
});

describe('graph - success notifications with viewer', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  it('calls refreshAfterExternalCommand when available', async () => {
    let refreshCalled = false;
    let refreshState = '';
    const mockPanel = createMockPanel();
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: mockPanel,
      refreshAfterExternalCommand: async (state: string) => {
        refreshCalled = true;
        refreshState = state;
      },
      updatePanelHtml: async () => {}
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    await graphModule.notifyCurrentTopoViewerOfCommandSuccess('deploy');

    expect(refreshCalled).to.be.true;
    expect(refreshState).to.equal('deployed');
  });

  it('calls updatePanelHtml as fallback when refreshAfterExternalCommand unavailable', async () => {
    let updateCalled = false;
    const mockPanel = createMockPanel();
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: mockPanel,
      deploymentState: 'unknown',
      isViewMode: false,
      updatePanelHtml: async () => {
        updateCalled = true;
      }
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    await graphModule.notifyCurrentTopoViewerOfCommandSuccess('deploy');

    expect(updateCalled).to.be.true;
    expect(mockViewer.deploymentState).to.equal('deployed');
    expect(mockViewer.isViewMode).to.be.true;
  });

  it('sets undeployed state for destroy command', async () => {
    let refreshState = '';
    const mockPanel = createMockPanel();
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: mockPanel,
      refreshAfterExternalCommand: async (state: string) => {
        refreshState = state;
      }
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    await graphModule.notifyCurrentTopoViewerOfCommandSuccess('destroy');

    expect(refreshState).to.equal('undeployed');
  });

  it('handles errors gracefully without throwing', async () => {
    const mockPanel = createMockPanel();
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: mockPanel,
      refreshAfterExternalCommand: async () => {
        throw new Error('Refresh failed');
      }
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    // Should not throw - verify by running the function and checking no exception
    const result = await graphModule.notifyCurrentTopoViewerOfCommandSuccess('deploy');
    expect(result).to.be.undefined;
  });
});

describe('graph - failure notifications with viewer', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  it('posts error status to webview via postLifecycleStatus', async () => {
    let postedMessage: any = null;
    const mockPanel = {
      webview: {
        postMessage: async (msg: any) => {
          postedMessage = msg;
          return true;
        }
      },
      onDidDispose: () => ({ dispose: () => {} })
    };
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: mockPanel
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    await graphModule.notifyCurrentTopoViewerOfCommandFailure('deploy', new Error('Deploy failed'));

    expect(postedMessage).to.exist;
    expect(postedMessage.type).to.equal('lab-lifecycle-status');
    expect(postedMessage.data.status).to.equal('error');
    expect(postedMessage.data.errorMessage).to.include('Deploy failed');
  });

  it('uses postLifecycleStatus method when available on viewer', async () => {
    let lifecycleStatusCalled = false;
    let statusData: any = null;
    const mockPanel = createMockPanel();
    const mockViewer = {
      name: MOCK_VIEWER_NAME,
      currentPanel: mockPanel,
      postLifecycleStatus: async (data: any) => {
        lifecycleStatusCalled = true;
        statusData = data;
      }
    };
    graphModule.setCurrentTopoViewer(mockViewer);

    await graphModule.notifyCurrentTopoViewerOfCommandFailure('destroy', 'String error');

    expect(lifecycleStatusCalled).to.be.true;
    expect(statusData.commandType).to.equal('destroy');
    expect(statusData.status).to.equal('error');
    expect(statusData.errorMessage).to.equal('String error');
  });
});

describe('graph - drawIO with valid node', () => {
  let graphModule: any;
  let vscodeStub: any;
  let clabCommandStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    clabCommandStub = require('../../helpers/clabCommand-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
    clabCommandStub.instances.length = 0;
  });

  it('runs graph command with horizontal layout', async () => {
    const mockNode = {
      name: TEST_LAB_NAME,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await graphModule.graphDrawIOHorizontal(mockNode);

    // Verify ClabCommand was instantiated
    expect(clabCommandStub.instances.length).to.be.greaterThan(0);
    expect(clabCommandStub.instances[0].action).to.equal('graph');
  });

  it('runs graph command with vertical layout', async () => {
    const mockNode = {
      name: TEST_LAB_NAME,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await graphModule.graphDrawIOVertical(mockNode);

    expect(clabCommandStub.instances.length).to.be.greaterThan(0);
    expect(clabCommandStub.instances[0].action).to.equal('graph');
  });

  it('runs graph command in interactive mode', async () => {
    const mockNode = {
      name: TEST_LAB_NAME,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await graphModule.graphDrawIOInteractive(mockNode);

    expect(clabCommandStub.instances.length).to.be.greaterThan(0);
    expect(clabCommandStub.instances[0].action).to.equal('graph');
  });
});

describe('graph - topoviewer with context', () => {
  let graphModule: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    graphModule = require('../../../src/commands/graph');
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    vscodeStub.resetVscodeStub();
    graphModule.setCurrentTopoViewer(undefined);
  });

  it('opens in view mode for deployed lab', async () => {
    const mockNode = {
      name: TEST_LAB_NAME,
      labPath: { absolute: TEST_LAB_PATH },
      contextValue: 'containerlabLabDeployed'
    };
    const mockContext = {
      extensionUri: { fsPath: MOCK_EXTENSION_PATH },
      subscriptions: []
    };

    await graphModule.graphTopoviewer(mockNode, mockContext);

    // Viewer should have been created
    const viewer = graphModule.getCurrentTopoViewer();
    expect(viewer).to.exist;
  });

  it('opens in view mode for deployed favorite lab', async () => {
    const mockNode = {
      name: TEST_LAB_NAME,
      labPath: { absolute: TEST_LAB_PATH },
      contextValue: 'containerlabLabDeployedFavorite'
    };
    const mockContext = {
      extensionUri: { fsPath: MOCK_EXTENSION_PATH },
      subscriptions: []
    };

    await graphModule.graphTopoviewer(mockNode, mockContext);

    const viewer = graphModule.getCurrentTopoViewer();
    expect(viewer).to.exist;
  });

  it('shows error when context is not provided', async () => {
    const mockNode = {
      name: TEST_LAB_NAME,
      labPath: { absolute: TEST_LAB_PATH }
    };

    await graphModule.graphTopoviewer(mockNode, undefined);

    expect(vscodeStub.window.lastErrorMessage).to.include('context not available');
  });
});
