/* eslint-env mocha */
/* global describe, it, beforeEach */
import { expect } from 'chai';
import {
  generateDummyId,
  generateAdapterNodeId,
  generateSpecialNodeId,
  generateRegularNodeId,
  getUniqueId
} from '../../../src/topoViewer/webview/ui/IdUtils';

// Constants for commonly used test values
const DUMMY = 'dummy';
const DUMMY1 = 'dummy1';
const DUMMY2 = 'dummy2';
const DUMMY3 = 'dummy3';
const DUMMY10 = 'dummy10';
const HOST_ETH0 = 'host:eth0';
const HOST_ETH1 = 'host:eth1';
const HOST_ETH2 = 'host:eth2';
const MGMT_NET_BR0 = 'mgmt-net:br0';
const MGMT_NET_BR1 = 'mgmt-net:br1';
const MACVLAN_ENS0 = 'macvlan:ens0';
const MACVLAN_ENS1 = 'macvlan:ens1';
const VXLAN_1921681 = 'vxlan:192.168.1.1';
const BRIDGE_BR0 = 'bridge:br0';
const BRIDGE_BR1 = 'bridge:br1';
const NODE1 = 'node1';
const NODE2 = 'node2';
const ROUTER1 = 'router1';
const ROUTER2 = 'router2';
const ROUTER10 = 'router10';
const SPINE = 'spine';
const SPINE1 = 'spine1';
const SPINE2 = 'spine2';
const GROUP_NAME = 'group';
const GROUP_COLON_1 = 'group:1';
const GROUP_COLON_2 = 'group:2';

/**
 * Helper function to create a Set from an array of IDs
 */
function setOf(...ids: string[]): Set<string> {
  return new Set(ids);
}

/**
 * Tests for IdUtils - generateDummyId basic functionality
 */
describe('IdUtils - generateDummyId basic', () => {
  it('should return dummy1 for empty usedIds', () => {
    const result = generateDummyId(DUMMY, new Set());
    expect(result).to.equal(DUMMY1);
  });

  it('should return dummy1 for input without number', () => {
    const result = generateDummyId(DUMMY, new Set());
    expect(result).to.equal(DUMMY1);
  });

  it('should return dummy1 for input with number', () => {
    const result = generateDummyId(DUMMY1, new Set());
    expect(result).to.equal(DUMMY1);
  });

  it('should increment when dummy1 exists', () => {
    const result = generateDummyId(DUMMY, setOf(DUMMY1));
    expect(result).to.equal(DUMMY2);
  });

  it('should skip to next available number', () => {
    const result = generateDummyId(DUMMY, setOf(DUMMY1, DUMMY2));
    expect(result).to.equal(DUMMY3);
  });
});

/**
 * Tests for IdUtils - generateDummyId with starting numbers
 */
describe('IdUtils - generateDummyId with starting numbers', () => {
  it('should use parsed number as starting point', () => {
    const result = generateDummyId(DUMMY10, new Set());
    expect(result).to.equal(DUMMY10);
  });

  it('should increment from parsed number if occupied', () => {
    const result = generateDummyId(DUMMY10, setOf(DUMMY10));
    expect(result).to.equal('dummy11');
  });

  it('should handle gaps in used ids', () => {
    const result = generateDummyId(DUMMY, setOf(DUMMY1, DUMMY3));
    expect(result).to.equal(DUMMY2);
  });
});

/**
 * Tests for IdUtils - generateAdapterNodeId basic
 */
describe('IdUtils - generateAdapterNodeId basic', () => {
  it('should return original if not used', () => {
    const result = generateAdapterNodeId(HOST_ETH0, new Set());
    expect(result).to.equal(HOST_ETH0);
  });

  it('should increment adapter number when original is used', () => {
    const result = generateAdapterNodeId(HOST_ETH0, setOf(HOST_ETH0));
    expect(result).to.equal(HOST_ETH1);
  });

  it('should skip to next available adapter number', () => {
    const result = generateAdapterNodeId(HOST_ETH0, setOf(HOST_ETH0, HOST_ETH1));
    expect(result).to.equal(HOST_ETH2);
  });
});

/**
 * Tests for IdUtils - generateAdapterNodeId with various prefixes
 */
describe('IdUtils - generateAdapterNodeId various prefixes', () => {
  it('should handle mgmt-net prefix', () => {
    const result = generateAdapterNodeId(MGMT_NET_BR0, setOf(MGMT_NET_BR0));
    expect(result).to.equal(MGMT_NET_BR1);
  });

  it('should handle bridge prefix', () => {
    const result = generateAdapterNodeId(BRIDGE_BR0, setOf(BRIDGE_BR0));
    expect(result).to.equal(BRIDGE_BR1);
  });

  it('should handle macvlan prefix', () => {
    const result = generateAdapterNodeId(MACVLAN_ENS0, setOf(MACVLAN_ENS0));
    expect(result).to.equal(MACVLAN_ENS1);
  });
});

/**
 * Tests for IdUtils - generateAdapterNodeId non-numeric adapter
 */
describe('IdUtils - generateAdapterNodeId non-numeric adapter', () => {
  it('should append counter for adapter without number', () => {
    const result = generateAdapterNodeId('host:mgmt', setOf('host:mgmt'));
    expect(result).to.equal('host:mgmt1');
  });

  it('should increment counter for non-numeric adapter', () => {
    const result = generateAdapterNodeId('host:mgmt', setOf('host:mgmt', 'host:mgmt1'));
    expect(result).to.equal('host:mgmt2');
  });

  it('should handle vxlan addresses', () => {
    const result = generateAdapterNodeId(VXLAN_1921681, new Set());
    expect(result).to.equal(VXLAN_1921681);
  });
});

/**
 * Tests for IdUtils - generateSpecialNodeId basic
 */
describe('IdUtils - generateSpecialNodeId basic', () => {
  it('should return original if not used', () => {
    const result = generateSpecialNodeId(DUMMY1, new Set());
    expect(result).to.equal(DUMMY1);
  });

  it('should increment trailing number if used', () => {
    const result = generateSpecialNodeId(DUMMY1, setOf(DUMMY1));
    expect(result).to.equal(DUMMY2);
  });

  it('should keep incrementing until free', () => {
    const result = generateSpecialNodeId(DUMMY1, setOf(DUMMY1, DUMMY2, DUMMY3));
    expect(result).to.equal('dummy4');
  });
});

/**
 * Tests for IdUtils - generateSpecialNodeId without trailing number
 */
describe('IdUtils - generateSpecialNodeId without trailing number', () => {
  it('should add 1 to base name without number', () => {
    const result = generateSpecialNodeId(DUMMY, setOf(DUMMY));
    expect(result).to.equal(DUMMY1);
  });

  it('should continue incrementing from 1', () => {
    const result = generateSpecialNodeId(DUMMY, setOf(DUMMY, DUMMY1));
    expect(result).to.equal(DUMMY2);
  });
});

/**
 * Tests for IdUtils - generateSpecialNodeId with complex names
 */
describe('IdUtils - generateSpecialNodeId complex names', () => {
  it('should handle multi-digit numbers', () => {
    const result = generateSpecialNodeId(DUMMY10, setOf(DUMMY10));
    expect(result).to.equal('dummy11');
  });

  it('should preserve special prefixes', () => {
    const result = generateSpecialNodeId('bridge1', setOf('bridge1'));
    expect(result).to.equal('bridge2');
  });
});

/**
 * Tests for IdUtils - generateRegularNodeId non-group mode
 */
describe('IdUtils - generateRegularNodeId non-group', () => {
  it('should return base1 for name without number', () => {
    const result = generateRegularNodeId(SPINE, new Set(), false);
    expect(result).to.equal(SPINE1);
  });

  it('should use parsed number if not colliding', () => {
    const result = generateRegularNodeId(SPINE1, new Set(), false);
    expect(result).to.equal(SPINE1);
  });

  it('should increment when colliding', () => {
    const result = generateRegularNodeId(SPINE1, setOf(SPINE1), false);
    expect(result).to.equal(SPINE2);
  });

  it('should find next available number', () => {
    const result = generateRegularNodeId(ROUTER1, setOf(ROUTER1, ROUTER2), false);
    expect(result).to.equal('router3');
  });
});

/**
 * Tests for IdUtils - generateRegularNodeId group mode
 */
describe('IdUtils - generateRegularNodeId group mode', () => {
  it('should return base:1 for group name', () => {
    const result = generateRegularNodeId(GROUP_NAME, new Set(), true);
    expect(result).to.equal(GROUP_COLON_1);
  });

  it('should increment group suffix when colliding', () => {
    const result = generateRegularNodeId(GROUP_NAME, setOf(GROUP_COLON_1), true);
    expect(result).to.equal(GROUP_COLON_2);
  });

  it('should skip to next available group suffix', () => {
    const result = generateRegularNodeId(GROUP_NAME, setOf(GROUP_COLON_1, GROUP_COLON_2), true);
    expect(result).to.equal('group:3');
  });
});

/**
 * Tests for IdUtils - generateRegularNodeId edge cases
 */
describe('IdUtils - generateRegularNodeId edge cases', () => {
  it('should handle large numbers', () => {
    const result = generateRegularNodeId(ROUTER10, new Set(), false);
    expect(result).to.equal(ROUTER10);
  });

  it('should handle numeric-only names', () => {
    const result = generateRegularNodeId('123', new Set(), false);
    // For numeric-only names, the whole name is treated as number with empty base
    expect(result).to.equal('123');
  });

  it('should handle empty string', () => {
    const result = generateRegularNodeId('', new Set(), false);
    expect(result).to.equal('1');
  });
});

/**
 * Tests for IdUtils - getUniqueId with dummy nodes
 */
describe('IdUtils - getUniqueId dummy nodes', () => {
  it('should delegate to generateDummyId for dummy prefix', () => {
    const result = getUniqueId(DUMMY, new Set(), false);
    expect(result).to.equal(DUMMY1);
  });

  it('should handle existing dummy nodes', () => {
    const result = getUniqueId(DUMMY1, setOf(DUMMY1), false);
    expect(result).to.equal(DUMMY2);
  });
});

/**
 * Tests for IdUtils - getUniqueId with adapter nodes
 */
describe('IdUtils - getUniqueId adapter nodes', () => {
  it('should delegate to generateAdapterNodeId for host prefix', () => {
    const result = getUniqueId(HOST_ETH0, new Set(), false);
    expect(result).to.equal(HOST_ETH0);
  });

  it('should delegate to generateAdapterNodeId for mgmt-net prefix', () => {
    const result = getUniqueId(MGMT_NET_BR0, new Set(), false);
    expect(result).to.equal(MGMT_NET_BR0);
  });

  it('should delegate to generateAdapterNodeId for macvlan prefix', () => {
    const result = getUniqueId(MACVLAN_ENS0, new Set(), false);
    expect(result).to.equal(MACVLAN_ENS0);
  });

  it('should delegate to generateAdapterNodeId for bridge prefix', () => {
    const result = getUniqueId(BRIDGE_BR0, new Set(), false);
    expect(result).to.equal(BRIDGE_BR0);
  });

  it('should delegate to generateAdapterNodeId for vxlan prefix', () => {
    const result = getUniqueId(VXLAN_1921681, new Set(), false);
    expect(result).to.equal(VXLAN_1921681);
  });
});

/**
 * Tests for IdUtils - getUniqueId with special nodes (no colon)
 */
describe('IdUtils - getUniqueId special nodes without colon', () => {
  it('should use generateSpecialNodeId for special prefix without colon', () => {
    const result = getUniqueId('bridge1', setOf('bridge1'), false);
    expect(result).to.equal('bridge2');
  });

  it('should handle ovs-bridge nodes', () => {
    const result = getUniqueId('ovs-bridge:br1', new Set(), false);
    expect(result).to.equal('ovs-bridge:br1');
  });
});

/**
 * Tests for IdUtils - getUniqueId with regular nodes
 */
describe('IdUtils - getUniqueId regular nodes', () => {
  it('should delegate to generateRegularNodeId for regular names', () => {
    const result = getUniqueId(NODE1, new Set(), false);
    expect(result).to.equal(NODE1);
  });

  it('should handle regular nodes without numbers', () => {
    const result = getUniqueId('node', new Set(), false);
    expect(result).to.equal(NODE1);
  });

  it('should increment regular nodes when colliding', () => {
    const result = getUniqueId(NODE1, setOf(NODE1), false);
    expect(result).to.equal(NODE2);
  });
});

/**
 * Tests for IdUtils - getUniqueId group mode
 */
describe('IdUtils - getUniqueId group mode', () => {
  it('should use group format for regular nodes in group mode', () => {
    const result = getUniqueId('mygroup', new Set(), true);
    expect(result).to.equal('mygroup:1');
  });

  it('should increment group suffix in group mode', () => {
    const result = getUniqueId('mygroup', setOf('mygroup:1'), true);
    expect(result).to.equal('mygroup:2');
  });

  it('should not affect special nodes in group mode', () => {
    const result = getUniqueId(DUMMY, new Set(), true);
    expect(result).to.equal(DUMMY1);
  });

  it('should not affect adapter nodes in group mode', () => {
    const result = getUniqueId(HOST_ETH0, new Set(), true);
    expect(result).to.equal(HOST_ETH0);
  });
});

/**
 * Tests for IdUtils - collision avoidance comprehensive
 */
describe('IdUtils - collision avoidance', () => {
  it('should avoid all existing IDs for regular nodes', () => {
    const usedIds = setOf('router1', 'router2', 'router3', 'router4', 'router5');
    const result = getUniqueId('router1', usedIds, false);
    expect(result).to.equal('router6');
    expect(usedIds.has(result)).to.be.false;
  });

  it('should avoid all existing IDs for dummy nodes', () => {
    const usedIds = setOf(DUMMY1, DUMMY2, DUMMY3, 'dummy4');
    const result = getUniqueId(DUMMY, usedIds, false);
    expect(result).to.equal('dummy5');
    expect(usedIds.has(result)).to.be.false;
  });

  it('should avoid all existing IDs for adapter nodes', () => {
    const usedIds = setOf(HOST_ETH0, HOST_ETH1, HOST_ETH2, 'host:eth3');
    const result = getUniqueId(HOST_ETH0, usedIds, false);
    expect(result).to.equal('host:eth4');
    expect(usedIds.has(result)).to.be.false;
  });

  it('should avoid all existing IDs for groups', () => {
    const usedIds = setOf(GROUP_COLON_1, GROUP_COLON_2, 'group:3');
    const result = getUniqueId(GROUP_NAME, usedIds, true);
    expect(result).to.equal('group:4');
    expect(usedIds.has(result)).to.be.false;
  });
});
