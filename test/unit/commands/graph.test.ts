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

function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('/extension') || request.endsWith('\\extension')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
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

const MOCK_VIEWER_NAME = 'mock-viewer';
const ERR_NO_PANEL = 'No active TopoViewer panel to reload.';
const IT_NO_CMD_NODE_UNDEFINED = 'executes no commands when node is undefined';

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
