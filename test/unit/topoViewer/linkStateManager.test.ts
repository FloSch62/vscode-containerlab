/* eslint-env mocha */
/* eslint-disable sonarjs/no-duplicate-string */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
/**
 * Tests for LinkStateManager class.
 *
 * These tests verify the LinkStateManager's ability to:
 * - Manage link state updates from container lab inspection data
 * - Generate edge updates for the webview
 * - Merge link state classes
 * - Process interface statistics
 */
import { expect } from 'chai';
import sinon from 'sinon';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;

// Helper to clear module cache for all vscode-containerlab modules
function clearModuleCache() {
  Object.keys(require.cache).forEach(key => {
    if (key.includes('vscode-containerlab') && !key.includes('node_modules')) {
      delete require.cache[key];
    }
  });
}

// Helper to resolve stub paths for module interception
function getStubPath(request: string): string | null {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return null;
}

describe('LinkStateManager - constructor and setCurrentLabName', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  it('constructs with adaptor', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    expect(manager).to.not.be.undefined;
  });

  it('sets current lab name', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');
    // No error should occur
    expect(manager).to.not.be.undefined;
  });

  it('handles empty lab name', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('');
    expect(manager).to.not.be.undefined;
  });
});

describe('LinkStateManager - buildEdgeUpdatesFromCache', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('returns empty array when cache is undefined', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    const result = manager.buildEdgeUpdatesFromCache(undefined, {});
    expect(result).to.deep.equal([]);
  });

  it('returns empty array when cache has no elements', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    const cache = { elements: [] };
    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result).to.deep.equal([]);
  });

  it('filters out non-edge elements', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    const cache = {
      elements: [
        { group: 'nodes', data: { id: 'node1' } },
        { group: 'nodes', data: { id: 'node2' } }
      ]
    };
    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result).to.deep.equal([]);
  });

  it('processes edge elements', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: 'node1',
              yamlTargetNodeId: 'node2'
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {
            node1: {},
            node2: {}
          }
        }
      }
    };

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns(undefined);

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result).to.have.length(1);
    expect(result[0].group).to.equal('edges');
    expect(result[0].data.id).to.equal('edge1');
  });

  it('returns null for edges when refreshEdgeWithLatestData cannot process', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);

    // Create a minimal cache with edge that has missing required data
    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            extraData: {}
          }
        }
      ]
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result).to.have.length(1);
  });
});

describe('LinkStateManager - buildEdgeUpdatesFromCache with interface states', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('applies interface state from labs inspection data', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode')
      .onFirstCall().returns({
        state: 'up',
        mac: '00:11:22:33:44:55',
        mtu: 1500,
        type: 'veth'
      })
      .onSecondCall().returns({
        state: 'up',
        mac: '00:11:22:33:44:66',
        mtu: 1500,
        type: 'veth'
      });

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: 'node1',
              yamlTargetNodeId: 'node2'
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {
            node1: {},
            node2: {}
          }
        }
      }
    };

    const labs = {
      'test-lab': {
        name: 'test-lab',
        containers: []
      }
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, labs);
    expect(result).to.have.length(1);
    expect(result[0].data.extraData.clabSourceInterfaceState).to.equal('up');
    expect(result[0].data.extraData.clabTargetInterfaceState).to.equal('up');
    expect(result[0].data.extraData.clabSourceMacAddress).to.equal('00:11:22:33:44:55');
    expect(result[0].data.extraData.clabTargetMacAddress).to.equal('00:11:22:33:44:66');
  });

  it('applies interface statistics when available', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode')
      .onFirstCall().returns({
        state: 'up',
        mac: '00:11:22:33:44:55',
        mtu: 1500,
        type: 'veth',
        stats: {
          rxBps: 1000,
          rxPps: 10,
          rxBytes: 10000,
          rxPackets: 100,
          txBps: 2000,
          txPps: 20,
          txBytes: 20000,
          txPackets: 200,
          statsIntervalSeconds: 1
        }
      })
      .onSecondCall().returns({
        state: 'up',
        mac: '00:11:22:33:44:66',
        mtu: 1500,
        type: 'veth'
      });

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: 'node1',
              yamlTargetNodeId: 'node2'
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {
            node1: {},
            node2: {}
          }
        }
      }
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result).to.have.length(1);
    expect(result[0].data.extraData.clabSourceStats).to.deep.equal({
      rxBps: 1000,
      rxPps: 10,
      rxBytes: 10000,
      rxPackets: 100,
      txBps: 2000,
      txPps: 20,
      txBytes: 20000,
      txPackets: 200,
      statsIntervalSeconds: 1
    });
    expect(result[0].data.extraData.clabTargetStats).to.be.undefined;
  });

  it('removes stats key when interface has no stats', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns({
      state: 'up',
      mac: '00:11:22:33:44:55',
      mtu: 1500,
      type: 'veth'
      // no stats
    });

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: 'node1',
              yamlTargetNodeId: 'node2',
              clabSourceStats: { rxBps: 999 } // Should be deleted
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {
            node1: {},
            node2: {}
          }
        }
      }
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result).to.have.length(1);
    expect(result[0].data.extraData.clabSourceStats).to.be.undefined;
  });
});

describe('LinkStateManager - mergeLinkStateClasses', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  const testCases = [
    {
      description: 'returns existing when stateClass is undefined',
      existing: 'some-class other-class',
      stateClass: undefined,
      expected: 'some-class other-class'
    },
    {
      description: 'returns existing when stateClass is empty string',
      existing: 'some-class',
      stateClass: '',
      expected: 'some-class'
    },
    {
      description: 'prepends new state class to existing classes',
      existing: 'some-class other-class',
      stateClass: 'link-up',
      expected: 'link-up some-class other-class'
    },
    {
      description: 'removes old link-up before adding new state',
      existing: 'link-up some-class',
      stateClass: 'link-down',
      expected: 'link-down some-class'
    },
    {
      description: 'removes old link-down before adding new state',
      existing: 'link-down some-class',
      stateClass: 'link-up',
      expected: 'link-up some-class'
    },
    {
      description: 'handles undefined existing classes',
      existing: undefined,
      stateClass: 'link-up',
      expected: 'link-up'
    },
    {
      description: 'handles empty string existing classes',
      existing: '',
      stateClass: 'link-down',
      expected: 'link-down'
    },
    {
      description: 'filters empty tokens and whitespace',
      existing: 'class1  link-up   class2  ',
      stateClass: 'link-down',
      expected: 'link-down class1 class2'
    },
    {
      description: 'handles multiple link state classes in existing',
      existing: 'link-up link-down class1',
      stateClass: 'link-up',
      expected: 'link-up class1'
    }
  ];

  testCases.forEach(({ description, existing, stateClass, expected }) => {
    it(description, () => {
      const adaptor = new TopoViewerAdaptorClab();
      const manager = new LinkStateManager(adaptor);
      const result = manager.mergeLinkStateClasses(existing, stateClass);
      expect(result).to.equal(expected);
    });
  });
});

describe('LinkStateManager - extractInterfaceStatsForEdge', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('extracts stats via edge updates when interface has all stats', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns({
      state: 'up',
      mac: '00:11:22:33:44:55',
      mtu: 1500,
      type: 'veth',
      stats: {
        rxBps: 1000,
        rxPps: 10,
        rxBytes: 10000,
        rxPackets: 100,
        txBps: 2000,
        txPps: 20,
        txBytes: 20000,
        txPackets: 200,
        statsIntervalSeconds: 1
      }
    });

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2'
            }
          }
        }
      ]
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result[0].data.extraData.clabSourceStats).to.deep.equal({
      rxBps: 1000,
      rxPps: 10,
      rxBytes: 10000,
      rxPackets: 100,
      txBps: 2000,
      txPps: 20,
      txBytes: 20000,
      txPackets: 200,
      statsIntervalSeconds: 1
    });
  });

  it('extracts only valid numeric stats', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns({
      state: 'up',
      mac: '00:11:22:33:44:55',
      mtu: 1500,
      type: 'veth',
      stats: {
        rxBps: 1000,
        rxPps: NaN,
        rxBytes: Infinity,
        rxPackets: 100,
        txBps: undefined,
        txPps: 20,
        txBytes: 20000,
        txPackets: null,
        statsIntervalSeconds: 1
      } as any
    });

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2'
            }
          }
        }
      ]
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    // Should only include valid finite numbers
    expect(result[0].data.extraData.clabSourceStats).to.deep.equal({
      rxBps: 1000,
      rxPackets: 100,
      txPps: 20,
      txBytes: 20000,
      statsIntervalSeconds: 1
    });
  });

  it('returns undefined when stats object is empty after filtering', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns({
      state: 'up',
      mac: '00:11:22:33:44:55',
      mtu: 1500,
      type: 'veth',
      stats: {
        rxBps: NaN,
        rxPps: Infinity,
        rxBytes: undefined
      } as any
    });

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2'
            }
          }
        }
      ]
    };

    const result = manager.buildEdgeUpdatesFromCache(cache, {});
    expect(result[0].data.extraData.clabSourceStats).to.be.undefined;
  });
});

describe('LinkStateManager - normalizeInterfaceName via edge updates', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('prefers clabSourcePort over sourceEndpoint', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    const stub = sinon.stub(treeUtils, 'findInterfaceNode');

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'fallback-eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'primary-eth0',
              clabTargetPort: '',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2'
            }
          }
        }
      ]
    };

    manager.buildEdgeUpdatesFromCache(cache, {});

    // Check that findInterfaceNode was called with the primary port name
    expect(stub.firstCall.args[2]).to.equal('primary-eth0');
    // Check that it falls back to sourceEndpoint for target
    expect(stub.secondCall.args[2]).to.equal('eth1');
  });

  it('uses fallback when primary is whitespace only', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    const stub = sinon.stub(treeUtils, 'findInterfaceNode');

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'fallback-eth0',
            targetEndpoint: 'fallback-eth1',
            extraData: {
              clabSourcePort: '   ',
              clabTargetPort: null,
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2'
            }
          }
        }
      ]
    };

    manager.buildEdgeUpdatesFromCache(cache, {});

    expect(stub.firstCall.args[2]).to.equal('fallback-eth0');
    expect(stub.secondCall.args[2]).to.equal('fallback-eth1');
  });

  it('returns empty string when both are non-string', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    const stub = sinon.stub(treeUtils, 'findInterfaceNode');

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: null,
            targetEndpoint: undefined,
            extraData: {
              clabSourcePort: null,
              clabTargetPort: undefined,
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2'
            }
          }
        }
      ]
    };

    manager.buildEdgeUpdatesFromCache(cache, {});

    expect(stub.firstCall.args[2]).to.equal('');
    expect(stub.secondCall.args[2]).to.equal('');
  });
});

describe('LinkStateManager - pickNodeId via edge updates', () => {
  let LinkStateManager: any;
  let TopoViewerAdaptorClab: any;

  before(() => {
    clearModuleCache();

    (Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    const linkStateManagerModule = require('../../../src/topoViewer/extension/services/LinkStateManager');
    LinkStateManager = linkStateManagerModule.LinkStateManager;
    const adaptorModule = require('../../../src/topoViewer/extension/services/TopologyAdapter');
    TopoViewerAdaptorClab = adaptorModule.TopoViewerAdaptorClab;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  afterEach(() => {
    sinon.restore();
  });

  it('prefers yamlSourceNodeId over source', () => {
    const adaptor = new TopoViewerAdaptorClab();
    sinon.stub(adaptor, 'computeEdgeClassFromStates').callsFake((_topology, src, tgt) => {
      // Verify the correct node IDs were passed
      expect(src).to.equal('yaml-node1');
      expect(tgt).to.equal('yaml-node2');
      return 'link-up';
    });

    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns(undefined);

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'fallback-node1',
            target: 'fallback-node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: 'yaml-node1',
              yamlTargetNodeId: 'yaml-node2'
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {
            'yaml-node1': {},
            'yaml-node2': {}
          }
        }
      }
    };

    manager.buildEdgeUpdatesFromCache(cache, {});
  });

  it('falls back to source/target when yaml IDs are empty', () => {
    const adaptor = new TopoViewerAdaptorClab();
    sinon.stub(adaptor, 'computeEdgeClassFromStates').callsFake((_topology, src, tgt) => {
      expect(src).to.equal('fallback-node1');
      expect(tgt).to.equal('fallback-node2');
      return 'link-up';
    });

    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns(undefined);

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: 'fallback-node1',
            target: 'fallback-node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: '',
              yamlTargetNodeId: '   '
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {
            'fallback-node1': {},
            'fallback-node2': {}
          }
        }
      }
    };

    manager.buildEdgeUpdatesFromCache(cache, {});
  });

  it('does not call computeEdgeClassFromStates when node IDs are missing', () => {
    const adaptor = new TopoViewerAdaptorClab();
    const spy = sinon.spy(adaptor, 'computeEdgeClassFromStates');

    const manager = new LinkStateManager(adaptor);
    manager.setCurrentLabName('test-lab');

    const treeUtils = require('../../../src/topoViewer/extension/services/TreeUtils');
    sinon.stub(treeUtils, 'findInterfaceNode').returns(undefined);

    const cache = {
      elements: [
        {
          group: 'edges',
          data: {
            id: 'edge1',
            source: '',
            target: '',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth1',
            extraData: {
              clabSourcePort: 'eth0',
              clabTargetPort: 'eth1',
              clabSourceLongName: 'node1',
              clabTargetLongName: 'node2',
              yamlSourceNodeId: '',
              yamlTargetNodeId: ''
            }
          },
          classes: ''
        }
      ],
      parsedTopology: {
        topology: {
          nodes: {}
        }
      }
    };

    manager.buildEdgeUpdatesFromCache(cache, {});
    expect(spy.called).to.be.false;
  });
});
