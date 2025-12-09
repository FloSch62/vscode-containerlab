/* eslint-env mocha */
/* eslint-disable sonarjs/no-duplicate-string */
/* global describe, it, after, __dirname */
/**
 * Unit tests for TreeUtils service functions.
 *
 * These tests cover the utility functions used to search through lab tree
 * structures for containers and interfaces. The functions support multiple
 * lookup methods (name, name_short, label for containers; name, alias, label
 * for interfaces) and optional lab name filtering.
 *
 * The suite stubs the `vscode` module so it can run in a plain Node
 * environment without the VS Code API available.
 */
import { expect } from 'chai';
import Module from 'module';
import path from 'path';

// The source files depend on the VS Code API. To run the tests without the
// actual editor environment we replace Node's module resolution logic and point
// any import of `vscode` to a lightweight stub.
const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function (request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

import { findContainerNode, findInterfaceNode } from '../../../src/topoViewer/extension/services/TreeUtils';
import { ClabLabTreeNode, ClabContainerTreeNode, ClabInterfaceTreeNode } from '../../../src/treeView/common';
import { TreeItemCollapsibleState } from '../../helpers/vscode-stub';

/**
 * Helper function to create a mock lab tree structure for testing.
 * Creates a realistic lab hierarchy with multiple labs, containers, and interfaces.
 */
function createMockLabs(): Record<string, ClabLabTreeNode> {
  // Create interfaces for first container
  const intf1_1 = new ClabInterfaceTreeNode(
    'eth1',
    TreeItemCollapsibleState.None,
    'clab-lab1-node1',
    'container-id-1',
    'eth1',
    'veth',
    'ge-0/0/0',
    '00:11:22:33:44:55',
    1500,
    1,
    'up',
    'interface',
  );

  const intf1_2 = new ClabInterfaceTreeNode(
    'eth2',
    TreeItemCollapsibleState.None,
    'clab-lab1-node1',
    'container-id-1',
    'eth2',
    'veth',
    'ge-0/0/1',
    '00:11:22:33:44:56',
    1500,
    2,
    'up',
    'interface',
  );

  // Create first container
  const container1 = new ClabContainerTreeNode(
    'Router1',
    TreeItemCollapsibleState.Collapsed,
    'clab-lab1-node1',
    'node1',
    'container-id-1',
    'running',
    'srl',
    'srlinux:latest',
    [intf1_1, intf1_2],
    { absolute: '/labs/lab1.clab.yml', relative: 'lab1.clab.yml' },
    '10.0.0.1/24',
    '2001:db8::1/64',
  );

  // Create interfaces for second container
  const intf2_1 = new ClabInterfaceTreeNode(
    'eth1',
    TreeItemCollapsibleState.None,
    'clab-lab1-node2',
    'container-id-2',
    'eth1',
    'veth',
    'xe-0/0/0',
    '00:11:22:33:44:57',
    1500,
    1,
    'up',
    'interface',
  );

  // Create second container
  const container2 = new ClabContainerTreeNode(
    'Switch1',
    TreeItemCollapsibleState.Collapsed,
    'clab-lab1-node2',
    'node2',
    'container-id-2',
    'running',
    'ceos',
    'ceos:latest',
    [intf2_1],
    { absolute: '/labs/lab1.clab.yml', relative: 'lab1.clab.yml' },
    '10.0.0.2/24',
  );

  // Create first lab
  const lab1 = new ClabLabTreeNode(
    'Lab1',
    TreeItemCollapsibleState.Collapsed,
    { absolute: '/labs/lab1.clab.yml', relative: 'lab1.clab.yml' },
    'lab1',
    'user1',
    [container1, container2],
    'runningLab',
  );

  // Create interfaces for third container (in lab2)
  const intf3_1 = new ClabInterfaceTreeNode(
    'eth0',
    TreeItemCollapsibleState.None,
    'clab-lab2-router1',
    'container-id-3',
    'eth0',
    'veth',
    'mgmt0',
    '00:11:22:33:44:58',
    1500,
    0,
    'up',
    'interface',
  );

  // Create third container (in lab2)
  const container3 = new ClabContainerTreeNode(
    'RouterX',
    TreeItemCollapsibleState.Collapsed,
    'clab-lab2-router1',
    'router1',
    'container-id-3',
    'running',
    'srl',
    'srlinux:latest',
    [intf3_1],
    { absolute: '/labs/lab2.clab.yml', relative: 'lab2.clab.yml' },
    '10.0.1.1/24',
  );

  // Create second lab
  const lab2 = new ClabLabTreeNode(
    'Lab2',
    TreeItemCollapsibleState.Collapsed,
    { absolute: '/labs/lab2.clab.yml', relative: 'lab2.clab.yml' },
    'lab2',
    'user1',
    [container3],
    'runningLab',
  );

  return {
    lab1: lab1,
    lab2: lab2,
  };
}

describe('findContainerNode - undefined labs', () => {
  after(() => {
    // Restore the original module resolver so subsequent tests use the
    // standard behaviour.
    (Module as any)._resolveFilename = originalResolve;
  });

  it('returns undefined when labs is undefined', () => {
    const result = findContainerNode(undefined, 'node1');
    expect(result).to.be.undefined;
  });

  it('returns undefined when labs is undefined with clabName', () => {
    const result = findContainerNode(undefined, 'node1', 'lab1');
    expect(result).to.be.undefined;
  });
});

describe('findContainerNode - find by name', () => {
  const mockLabs = createMockLabs();

  it('finds container by full name (clab-lab1-node1)', () => {
    const result = findContainerNode(mockLabs, 'clab-lab1-node1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('clab-lab1-node1');
    expect(result?.name_short).to.equal('node1');
  });

  it('finds container by full name from second lab', () => {
    const result = findContainerNode(mockLabs, 'clab-lab2-router1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('clab-lab2-router1');
    expect(result?.name_short).to.equal('router1');
  });

  it('finds container by full name (clab-lab1-node2)', () => {
    const result = findContainerNode(mockLabs, 'clab-lab1-node2');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('clab-lab1-node2');
  });
});

describe('findContainerNode - find by name_short', () => {
  const mockLabs = createMockLabs();

  it('finds container by name_short (node1)', () => {
    const result = findContainerNode(mockLabs, 'node1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('clab-lab1-node1');
    expect(result?.name_short).to.equal('node1');
  });

  it('finds container by name_short (node2)', () => {
    const result = findContainerNode(mockLabs, 'node2');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('clab-lab1-node2');
    expect(result?.name_short).to.equal('node2');
  });

  it('finds container by name_short (router1)', () => {
    const result = findContainerNode(mockLabs, 'router1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('clab-lab2-router1');
    expect(result?.name_short).to.equal('router1');
  });
});

describe('findContainerNode - find by label', () => {
  const mockLabs = createMockLabs();

  it('finds container by label (Router1)', () => {
    const result = findContainerNode(mockLabs, 'Router1');
    expect(result).to.not.be.undefined;
    expect(result?.label).to.equal('Router1');
    expect(result?.name).to.equal('clab-lab1-node1');
  });

  it('finds container by label (Switch1)', () => {
    const result = findContainerNode(mockLabs, 'Switch1');
    expect(result).to.not.be.undefined;
    expect(result?.label).to.equal('Switch1');
    expect(result?.name).to.equal('clab-lab1-node2');
  });

  it('finds container by label (RouterX)', () => {
    const result = findContainerNode(mockLabs, 'RouterX');
    expect(result).to.not.be.undefined;
    expect(result?.label).to.equal('RouterX');
    expect(result?.name).to.equal('clab-lab2-router1');
  });
});

describe('findContainerNode - with clabName filter', () => {
  const mockLabs = createMockLabs();

  it('finds container when clabName matches (lab1)', () => {
    const result = findContainerNode(mockLabs, 'node1', 'lab1');
    expect(result).to.not.be.undefined;
    expect(result?.name_short).to.equal('node1');
    expect(result?.labPath.absolute).to.include('lab1');
  });

  it('finds container when clabName matches (lab2)', () => {
    const result = findContainerNode(mockLabs, 'router1', 'lab2');
    expect(result).to.not.be.undefined;
    expect(result?.name_short).to.equal('router1');
    expect(result?.labPath.absolute).to.include('lab2');
  });

  it('does not find container when clabName does not match', () => {
    const result = findContainerNode(mockLabs, 'node1', 'lab2');
    expect(result).to.be.undefined;
  });

  it('does not find container from different lab with clabName filter', () => {
    const result = findContainerNode(mockLabs, 'router1', 'lab1');
    expect(result).to.be.undefined;
  });

  it('returns undefined for non-existent clabName', () => {
    const result = findContainerNode(mockLabs, 'node1', 'nonexistent');
    expect(result).to.be.undefined;
  });
});

describe('findContainerNode - not found', () => {
  const mockLabs = createMockLabs();

  it('returns undefined when container does not exist', () => {
    const result = findContainerNode(mockLabs, 'nonexistent');
    expect(result).to.be.undefined;
  });

  it('returns undefined for empty name', () => {
    const result = findContainerNode(mockLabs, '');
    expect(result).to.be.undefined;
  });

  it('returns undefined with empty labs object', () => {
    const result = findContainerNode({}, 'node1');
    expect(result).to.be.undefined;
  });
});

describe('findContainerNode - table-driven edge cases', () => {
  const mockLabs = createMockLabs();

  const testCases = [
    { name: 'clab-lab1-node1', expected: 'clab-lab1-node1', description: 'full name lookup' },
    { name: 'node1', expected: 'clab-lab1-node1', description: 'short name lookup' },
    { name: 'Router1', expected: 'clab-lab1-node1', description: 'label lookup' },
    { name: 'clab-lab1-node2', expected: 'clab-lab1-node2', description: 'second container full name' },
    { name: 'node2', expected: 'clab-lab1-node2', description: 'second container short name' },
    { name: 'Switch1', expected: 'clab-lab1-node2', description: 'second container label' },
  ];

  testCases.forEach(({ name, expected, description }) => {
    it(`finds container: ${description}`, () => {
      const result = findContainerNode(mockLabs, name);
      expect(result).to.not.be.undefined;
      expect(result?.name).to.equal(expected);
    });
  });
});

describe('findInterfaceNode - undefined container', () => {
  it('returns undefined when labs is undefined', () => {
    const result = findInterfaceNode(undefined, 'node1', 'eth1');
    expect(result).to.be.undefined;
  });

  it('returns undefined when container not found', () => {
    const mockLabs = createMockLabs();
    const result = findInterfaceNode(mockLabs, 'nonexistent', 'eth1');
    expect(result).to.be.undefined;
  });

  it('returns undefined when container not found with clabName', () => {
    const mockLabs = createMockLabs();
    const result = findInterfaceNode(mockLabs, 'node1', 'eth1', 'nonexistent');
    expect(result).to.be.undefined;
  });

  it('returns undefined when labs is empty object', () => {
    const result = findInterfaceNode({}, 'node1', 'eth1');
    expect(result).to.be.undefined;
  });
});

describe('findInterfaceNode - find by name', () => {
  const mockLabs = createMockLabs();

  it('finds interface by name (eth1) on first container', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth1');
    expect(result?.parentName).to.equal('clab-lab1-node1');
  });

  it('finds interface by name (eth2) on first container', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth2');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth2');
    expect(result?.parentName).to.equal('clab-lab1-node1');
  });

  it('finds interface by name (eth1) on second container', () => {
    const result = findInterfaceNode(mockLabs, 'node2', 'eth1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth1');
    expect(result?.parentName).to.equal('clab-lab1-node2');
  });

  it('finds interface by name (eth0) on third container', () => {
    const result = findInterfaceNode(mockLabs, 'router1', 'eth0');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth0');
    expect(result?.parentName).to.equal('clab-lab2-router1');
  });
});

describe('findInterfaceNode - find by alias', () => {
  const mockLabs = createMockLabs();

  it('finds interface by alias (ge-0/0/0)', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'ge-0/0/0');
    expect(result).to.not.be.undefined;
    expect(result?.alias).to.equal('ge-0/0/0');
    expect(result?.name).to.equal('eth1');
  });

  it('finds interface by alias (ge-0/0/1)', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'ge-0/0/1');
    expect(result).to.not.be.undefined;
    expect(result?.alias).to.equal('ge-0/0/1');
    expect(result?.name).to.equal('eth2');
  });

  it('finds interface by alias (xe-0/0/0)', () => {
    const result = findInterfaceNode(mockLabs, 'node2', 'xe-0/0/0');
    expect(result).to.not.be.undefined;
    expect(result?.alias).to.equal('xe-0/0/0');
    expect(result?.name).to.equal('eth1');
  });

  it('finds interface by alias (mgmt0)', () => {
    const result = findInterfaceNode(mockLabs, 'router1', 'mgmt0');
    expect(result).to.not.be.undefined;
    expect(result?.alias).to.equal('mgmt0');
    expect(result?.name).to.equal('eth0');
  });
});

describe('findInterfaceNode - find by label', () => {
  const mockLabs = createMockLabs();

  it('finds interface by label (eth1) matching name', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth1');
    expect(result).to.not.be.undefined;
    expect(result?.label).to.equal('eth1');
    expect(result?.name).to.equal('eth1');
  });

  it('finds interface by label (eth2) matching name', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth2');
    expect(result).to.not.be.undefined;
    expect(result?.label).to.equal('eth2');
    expect(result?.name).to.equal('eth2');
  });
});

describe('findInterfaceNode - with clabName filter', () => {
  const mockLabs = createMockLabs();

  it('finds interface when clabName matches (lab1)', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth1', 'lab1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth1');
  });

  it('finds interface when clabName matches (lab2)', () => {
    const result = findInterfaceNode(mockLabs, 'router1', 'eth0', 'lab2');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth0');
  });

  it('does not find interface when clabName does not match', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth1', 'lab2');
    expect(result).to.be.undefined;
  });

  it('does not find interface from different lab with clabName filter', () => {
    const result = findInterfaceNode(mockLabs, 'router1', 'eth0', 'lab1');
    expect(result).to.be.undefined;
  });
});

describe('findInterfaceNode - not found cases', () => {
  const mockLabs = createMockLabs();

  it('returns undefined when interface does not exist', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'nonexistent');
    expect(result).to.be.undefined;
  });

  it('returns undefined for wrong interface on correct container', () => {
    const result = findInterfaceNode(mockLabs, 'node1', 'eth99');
    expect(result).to.be.undefined;
  });

  it('returns undefined for empty interface name', () => {
    const result = findInterfaceNode(mockLabs, 'node1', '');
    expect(result).to.be.undefined;
  });

  it('returns undefined when container has no matching interface', () => {
    const result = findInterfaceNode(mockLabs, 'node2', 'eth2');
    expect(result).to.be.undefined;
  });
});

describe('findInterfaceNode - table-driven lookups', () => {
  const mockLabs = createMockLabs();

  const testCases = [
    { node: 'node1', intf: 'eth1', expected: 'eth1', description: 'eth1 by name' },
    { node: 'node1', intf: 'eth2', expected: 'eth2', description: 'eth2 by name' },
    { node: 'node1', intf: 'ge-0/0/0', expected: 'eth1', description: 'eth1 by alias' },
    { node: 'node1', intf: 'ge-0/0/1', expected: 'eth2', description: 'eth2 by alias' },
    { node: 'node2', intf: 'eth1', expected: 'eth1', description: 'node2 eth1 by name' },
    { node: 'node2', intf: 'xe-0/0/0', expected: 'eth1', description: 'node2 eth1 by alias' },
    { node: 'router1', intf: 'eth0', expected: 'eth0', description: 'router1 eth0 by name' },
    { node: 'router1', intf: 'mgmt0', expected: 'eth0', description: 'router1 eth0 by alias' },
  ];

  testCases.forEach(({ node, intf, expected, description }) => {
    it(`finds interface: ${description}`, () => {
      const result = findInterfaceNode(mockLabs, node, intf);
      expect(result).to.not.be.undefined;
      expect(result?.name).to.equal(expected);
    });
  });
});

describe('findInterfaceNode - using container full names', () => {
  const mockLabs = createMockLabs();

  it('finds interface using full container name', () => {
    const result = findInterfaceNode(mockLabs, 'clab-lab1-node1', 'eth1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth1');
  });

  it('finds interface using container label', () => {
    const result = findInterfaceNode(mockLabs, 'Router1', 'eth1');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth1');
  });

  it('finds interface by alias using container label', () => {
    const result = findInterfaceNode(mockLabs, 'Router1', 'ge-0/0/0');
    expect(result).to.not.be.undefined;
    expect(result?.name).to.equal('eth1');
    expect(result?.alias).to.equal('ge-0/0/0');
  });
});
