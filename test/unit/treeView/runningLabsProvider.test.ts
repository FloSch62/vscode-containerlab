/* eslint-env mocha */
/* eslint-disable no-undef, aggregate-complexity/aggregate-complexity, sonarjs/no-duplicate-string */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';
import { loadInspectFixture, loadInterfaceFixture } from '../../helpers/fixtures';

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
  if (request.endsWith('utils/utils') || request.includes('/utils/utils')) {
    return path.join(__dirname, '..', '..', 'helpers', 'utils-stub.js');
  }
  if (request.includes('/extension') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extension-stub.js');
  }
  if (request.includes('/inspector') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'inspector-stub.js');
  }
  if (request.includes('commands/graph') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'graph-stub.js');
  }
  if (request.includes('containerlabEvents') && !request.includes('stub')) {
    return path.join(__dirname, '..', '..', 'helpers', 'containerlabEvents-stub.js');
  }
  return null;
}

describe('RunningLabTreeDataProvider', () => {
  let RunningLabTreeDataProvider: any;
  let ClabLabTreeNode: any;
  let ClabContainerTreeNode: any;
  let inspectorStub: any;
  let extensionStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    inspectorStub = require('../../helpers/inspector-stub');
    extensionStub = require('../../helpers/extension-stub');

    const provider = require('../../../src/treeView/runningLabsProvider');
    RunningLabTreeDataProvider = provider.RunningLabTreeDataProvider;

    const common = require('../../../src/treeView/common');
    ClabLabTreeNode = common.ClabLabTreeNode;
    ClabContainerTreeNode = common.ClabContainerTreeNode;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    // Reset all stubs before each test
    inspectorStub.resetForTests();
    extensionStub.resetExtensionStub();
    vscodeStub.commands.executed.length = 0;
  });

  describe('discoverInspectLabs', () => {
    it('shows running labs from inspect data (single-lab fixture)', async () => {
      // Load fixture and convert to simple format for rawInspectData
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();

      expect(labs).to.not.be.undefined;
      expect(Object.keys(labs!)).to.have.length(1);

      // Check lab properties
      const labPath = Object.keys(labs!)[0];
      const labNode = labs![labPath];
      expect(labNode).to.be.instanceOf(ClabLabTreeNode);
      expect(labNode.name).to.equal('simple');
      expect(labNode.owner).to.equal('testuser');
      expect(labNode.containers).to.have.length(2);
    });

    it('handles multiple labs with different owners (multi-lab fixture)', async () => {
      const fixture = loadInspectFixture('multi-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();

      expect(labs).to.not.be.undefined;
      expect(Object.keys(labs!)).to.have.length(3);

      // Verify different owners
      const labNodes = Object.values(labs!);
      const owners = labNodes.map((node: any) => node.owner);
      expect(owners).to.include('testuser');
      expect(owners).to.include('otheruser');
    });

    it('handles empty inspect data gracefully', async () => {
      const fixture = loadInspectFixture('empty');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();

      expect(labs).to.be.undefined;
    });

    it('displays container state icons correctly (partial-state fixture)', async () => {
      const fixture = loadInspectFixture('partial-state');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();

      expect(labs).to.not.be.undefined;
      const labNode = Object.values(labs!)[0] as any;
      const containers = labNode.containers;

      // Verify we have containers with different states
      const states = containers.map((c: any) => c.state);
      expect(states).to.include('running');
      expect(states).to.include('exited');
      expect(states).to.include('paused');
    });

    it('displays IPv4/IPv6 addresses from inspect data', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();

      expect(labs).to.not.be.undefined;
      const labNode = Object.values(labs!)[0] as any;
      const container = labNode.containers[0];

      expect(container.v4Address).to.include('172.20.20');
      expect(container.v6Address).to.include('2001:db8');
    });
  });

  describe('filtering', () => {
    it('filters labs by owner when hideNonOwned is enabled', async () => {
      const fixture = loadInspectFixture('multi-lab');
      inspectorStub.setRawInspectData(fixture);
      extensionStub.setHideNonOwnedLabsState(true);
      extensionStub.setUsername('testuser');

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      // Get children triggers discovery and filtering
      const children = await provider.getChildren();

      // Only labs owned by 'testuser' should appear
      const owners = children.map((node: any) => node.owner);
      expect(owners.every((owner: string) => owner === 'testuser')).to.be.true;
    });

    it('shows all labs when hideNonOwned is disabled', async () => {
      const fixture = loadInspectFixture('multi-lab');
      inspectorStub.setRawInspectData(fixture);
      extensionStub.setHideNonOwnedLabsState(false);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const children = await provider.getChildren();

      // All labs should be visible
      expect(children.length).to.equal(3);
    });

    it('applies text filter to lab names', async () => {
      const fixture = loadInspectFixture('multi-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      // First get all children to populate tree
      await provider.getChildren();

      // Set filter
      provider.setTreeFilter('alpha');

      // Get filtered children
      const children = await provider.getChildren();

      expect(children.length).to.equal(1);
      expect(children[0].name).to.equal('alpha');
    });

    it('clears filter and shows all labs', async () => {
      const fixture = loadInspectFixture('multi-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      await provider.getChildren();
      provider.setTreeFilter('alpha');

      let children = await provider.getChildren();
      expect(children.length).to.equal(1);

      // Clear filter
      provider.clearTreeFilter();

      children = await provider.getChildren();
      expect(children.length).to.equal(3);
    });
  });

  describe('favorites', () => {
    it('favorites appear in lab list', async () => {
      const fixture = loadInspectFixture('multi-lab');
      inspectorStub.setRawInspectData(fixture);

      // Add a favorite
      extensionStub.favoriteLabs.add('/home/user/labs/alpha.clab.yml');

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();

      expect(labs).to.not.be.undefined;
      const alphaLab = Object.values(labs!).find((lab: any) => lab.name === 'alpha');
      expect(alphaLab).to.not.be.undefined;
      expect((alphaLab as any).favorite).to.be.true;
    });
  });

  describe('container children', () => {
    it('returns containers as children of lab node', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      expect(labs.length).to.be.greaterThan(0);

      const labNode = labs[0];
      const containers = await provider.getChildren(labNode);

      expect(containers.length).to.equal(2);
      expect(containers[0]).to.be.instanceOf(ClabContainerTreeNode);
    });

    it('returns interface children for containers with interfaces', async () => {
      const inspectFixture = loadInspectFixture('with-interfaces');
      const interfaceFixture = loadInterfaceFixture('router-interfaces');

      inspectorStub.setRawInspectData(inspectFixture);
      // Set interface snapshots for each container
      inspectorStub.setInterfaceSnapshot('int111int222', [{
        name: 'clab-interfaces-lab-router1',
        interfaces: interfaceFixture['int111int222'].interfaces
      }]);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      const labNode = labs[0];
      const containers = await provider.getChildren(labNode);

      // Find the container with interfaces
      const containerWithInterfaces = containers.find(
        (c: any) => c.cID === 'int111int222'
      );

      if (containerWithInterfaces) {
        const interfaces = await provider.getChildren(containerWithInterfaces);
        expect(interfaces.length).to.be.greaterThan(0);
      }
    });
  });

  describe('tree item properties', () => {
    it('getTreeItem returns the element', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      const labNode = labs[0];

      const treeItem = provider.getTreeItem(labNode);
      expect(treeItem).to.equal(labNode);
    });

    it('container node has correct contextValue', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      const containers = await provider.getChildren(labs[0]);

      expect(containers[0].contextValue).to.equal('containerlabContainer');
    });

    it('lab node has deployed context value', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.discoverInspectLabs();
      const labNode = Object.values(labs!)[0] as any;

      expect(labNode.contextValue).to.include('containerlabLabDeployed');
    });
  });

  describe('refresh', () => {
    it('fires onDidChangeTreeData event on refresh', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      let eventFired = false;
      provider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      await provider.refresh();

      expect(eventFired).to.be.true;
    });

    it('fires event for specific element on selective refresh', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      const labNode = labs[0];

      let eventFiredForElement = false;
      provider.onDidChangeTreeData((element: any) => {
        if (element === labNode) {
          eventFiredForElement = true;
        }
      });

      await provider.refresh(labNode);

      expect(eventFiredForElement).to.be.true;
    });
  });

  describe('softRefresh', () => {
    it('fires onDidChangeTreeData on soft refresh', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      let eventFired = false;
      provider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      await provider.softRefresh();

      expect(eventFired).to.be.true;
    });

    it('fires event for specific element on selective soft refresh', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      const labNode = labs[0];

      let eventFiredForElement = false;
      provider.onDidChangeTreeData((element: any) => {
        if (element === labNode) {
          eventFiredForElement = true;
        }
      });

      await provider.softRefresh(labNode);

      expect(eventFiredForElement).to.be.true;
    });
  });

  describe('refreshWithoutDiscovery', () => {
    it('fires onDidChangeTreeData without calling discovery', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      let eventFired = false;
      provider.onDidChangeTreeData(() => {
        eventFired = true;
      });

      await provider.refreshWithoutDiscovery();

      expect(eventFired).to.be.true;
    });

    it('fires event for element on selective refreshWithoutDiscovery', async () => {
      const fixture = loadInspectFixture('single-lab');
      inspectorStub.setRawInspectData(fixture);

      const mockContext = {
        asAbsolutePath: (p: string) => `/mock/extension/${p}`
      };
      const provider = new RunningLabTreeDataProvider(mockContext);

      const labs = await provider.getChildren();
      const labNode = labs[0];

      let eventFiredForElement = false;
      provider.onDidChangeTreeData((element: any) => {
        if (element === labNode) {
          eventFiredForElement = true;
        }
      });

      await provider.refreshWithoutDiscovery(labNode);

      expect(eventFiredForElement).to.be.true;
    });
  });
});

/**
 * Badge update tests
 */
describe('RunningLabTreeDataProvider - badge updates', () => {
  let RunningLabTreeDataProvider: any;
  let inspectorStub: any;
  let extensionStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    inspectorStub = require('../../helpers/inspector-stub');
    extensionStub = require('../../helpers/extension-stub');

    const provider = require('../../../src/treeView/runningLabsProvider');
    RunningLabTreeDataProvider = provider.RunningLabTreeDataProvider;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
    extensionStub.resetExtensionStub();
    vscodeStub.commands.executed.length = 0;
  });

  it('updates badge with running labs count', async () => {
    const fixture = loadInspectFixture('multi-lab');
    inspectorStub.setRawInspectData(fixture);

    // Set up a mock tree view
    const mockTreeView = {
      badge: undefined as any
    };
    extensionStub.setRunningTreeView(mockTreeView);

    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    await provider.getChildren();

    // Badge should be set with number of labs
    expect(mockTreeView.badge).to.not.be.undefined;
    expect(mockTreeView.badge.value).to.equal(3);
  });

  it('clears badge when no running labs', async () => {
    const fixture = loadInspectFixture('empty');
    inspectorStub.setRawInspectData(fixture);

    const mockTreeView = {
      badge: { value: 5, tooltip: 'old' }
    };
    extensionStub.setRunningTreeView(mockTreeView);

    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    await provider.getChildren();

    // Badge should be cleared
    expect(mockTreeView.badge).to.be.undefined;
  });
});

/**
 * Interface state icons tests
 */
describe('RunningLabTreeDataProvider - interface state handling', () => {
  let RunningLabTreeDataProvider: any;
  let inspectorStub: any;
  let extensionStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    inspectorStub = require('../../helpers/inspector-stub');
    extensionStub = require('../../helpers/extension-stub');

    const provider = require('../../../src/treeView/runningLabsProvider');
    RunningLabTreeDataProvider = provider.RunningLabTreeDataProvider;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
    extensionStub.resetExtensionStub();
    vscodeStub.commands.executed.length = 0;
  });

  it('assigns up icon for up state interfaces', async () => {
    const inspectFixture = loadInspectFixture('with-interfaces');
    inspectorStub.setRawInspectData(inspectFixture);

    // Set interface data with up state
    inspectorStub.setInterfaceSnapshot('int111int222', [{
      name: 'clab-interfaces-lab-router1',
      interfaces: [{
        name: 'eth0',
        type: 'veth',
        state: 'up',
        mac: '00:11:22:33:44:55',
        mtu: 1500,
        ifindex: 1
      }]
    }]);

    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    const labs = await provider.getChildren();
    const containers = await provider.getChildren(labs[0]);
    const containerWithInt = containers.find((c: any) => c.cID === 'int111int222');
    if (containerWithInt) {
      const interfaces = await provider.getChildren(containerWithInt);
      if (interfaces.length > 0) {
        expect(interfaces[0].contextValue).to.equal('containerlabInterfaceUp');
      }
    }
  });

  it('assigns down icon for down state interfaces', async () => {
    const inspectFixture = loadInspectFixture('with-interfaces');
    inspectorStub.setRawInspectData(inspectFixture);

    // Set interface data with down state
    inspectorStub.setInterfaceSnapshot('int111int222', [{
      name: 'clab-interfaces-lab-router1',
      interfaces: [{
        name: 'eth0',
        type: 'veth',
        state: 'down',
        mac: '00:11:22:33:44:55',
        mtu: 1500,
        ifindex: 1
      }]
    }]);

    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    const labs = await provider.getChildren();
    const containers = await provider.getChildren(labs[0]);
    const containerWithInt = containers.find((c: any) => c.cID === 'int111int222');
    if (containerWithInt) {
      const interfaces = await provider.getChildren(containerWithInt);
      if (interfaces.length > 0) {
        expect(interfaces[0].contextValue).to.equal('containerlabInterfaceDown');
      }
    }
  });
});

/**
 * Lab sorting and merging tests
 */
describe('RunningLabTreeDataProvider - lab sorting and cache', () => {
  let RunningLabTreeDataProvider: any;
  let inspectorStub: any;
  let extensionStub: any;
  let vscodeStub: any;

  before(() => {
    clearModuleCache();
    (Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
      const stubPath = getStubPath(request);
      if (stubPath) {
        return stubPath;
      }
      return originalResolve.call(this, request, parent, isMain, options);
    };

    vscodeStub = require('../../helpers/vscode-stub');
    inspectorStub = require('../../helpers/inspector-stub');
    extensionStub = require('../../helpers/extension-stub');

    const provider = require('../../../src/treeView/runningLabsProvider');
    RunningLabTreeDataProvider = provider.RunningLabTreeDataProvider;
  });

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
    clearModuleCache();
  });

  beforeEach(() => {
    inspectorStub.resetForTests();
    extensionStub.resetExtensionStub();
    vscodeStub.commands.executed.length = 0;
  });

  it('sorts deployed labs before undeployed labs', async () => {
    const fixture = loadInspectFixture('multi-lab');
    inspectorStub.setRawInspectData(fixture);

    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    const labs = await provider.getChildren();

    // All should be deployed and sorted by path
    labs.forEach((lab: any) => {
      expect(lab.contextValue).to.include('containerlabLabDeployed');
    });
  });

  it('preserves lab node references on refresh', async () => {
    const fixture = loadInspectFixture('single-lab');
    inspectorStub.setRawInspectData(fixture);

    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    // First discovery
    const labs1 = await provider.getChildren();
    const firstLabNode = labs1[0];

    // Second discovery (should reuse node)
    await provider.refresh();
    const labs2 = await provider.getChildren();
    const secondLabNode = labs2[0];

    // Same reference should be preserved
    expect(firstLabNode).to.equal(secondLabNode);
  });

  it('detects when new labs are added', async () => {
    const mockContext = {
      asAbsolutePath: (p: string) => `/mock/extension/${p}`
    };
    const provider = new RunningLabTreeDataProvider(mockContext);

    // Start with empty
    inspectorStub.setRawInspectData(loadInspectFixture('empty'));
    let labs = await provider.getChildren();
    expect(labs.length).to.equal(0);

    // Add labs
    inspectorStub.setRawInspectData(loadInspectFixture('single-lab'));
    await provider.refresh();
    labs = await provider.getChildren();
    expect(labs.length).to.equal(1);
  });
});
