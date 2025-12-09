/* eslint-env mocha */
/* global describe, it */
import { expect } from 'chai';

// Import the module under test
import {
  STR_HOST,
  STR_MGMT_NET,
  PREFIX_MACVLAN,
  PREFIX_VXLAN,
  PREFIX_VXLAN_STITCH,
  PREFIX_DUMMY,
  PREFIX_BRIDGE,
  PREFIX_OVS_BRIDGE,
  TYPE_DUMMY,
  SINGLE_ENDPOINT_TYPES,
  VX_TYPES,
  HOSTY_TYPES,
  isSpecialEndpointId,
  isSpecialEndpoint,
  isSpecialNodeOrBridge,
  splitEndpointLike
} from '../../../src/topoViewer/shared/utilities/LinkTypes';

// Constants for test values
const NODE_HOST_ETH0 = 'host:eth0';
const NODE_MGMT_NET_ETH0 = 'mgmt-net:eth0';
const NODE_MACVLAN_ETH0 = 'macvlan:eth0';
const NODE_BRIDGE_ETH0 = 'bridge:br0';
const NODE_OVS_BRIDGE = 'ovs-bridge:br0';
const NODE_VXLAN = 'vxlan:100';
const NODE_VXLAN_STITCH = 'vxlan-stitch:100';
const NODE_DUMMY = 'dummy';
const NODE_ROUTER1 = 'router1';
const NODE_ROUTER1_ETH0 = 'router1:eth0';

/**
 * Tests for exported constants
 */
describe('LinkTypes - Constants', () => {
  it('should export STR_HOST as "host"', () => {
    expect(STR_HOST).to.equal('host');
  });

  it('should export STR_MGMT_NET as "mgmt-net"', () => {
    expect(STR_MGMT_NET).to.equal('mgmt-net');
  });

  it('should export PREFIX_MACVLAN as "macvlan:"', () => {
    expect(PREFIX_MACVLAN).to.equal('macvlan:');
  });

  it('should export PREFIX_VXLAN as "vxlan:"', () => {
    expect(PREFIX_VXLAN).to.equal('vxlan:');
  });

  it('should export PREFIX_VXLAN_STITCH as "vxlan-stitch:"', () => {
    expect(PREFIX_VXLAN_STITCH).to.equal('vxlan-stitch:');
  });

  it('should export PREFIX_DUMMY as "dummy"', () => {
    expect(PREFIX_DUMMY).to.equal('dummy');
  });

  it('should export PREFIX_BRIDGE as "bridge:"', () => {
    expect(PREFIX_BRIDGE).to.equal('bridge:');
  });

  it('should export PREFIX_OVS_BRIDGE as "ovs-bridge:"', () => {
    expect(PREFIX_OVS_BRIDGE).to.equal('ovs-bridge:');
  });

  it('should export TYPE_DUMMY as "dummy"', () => {
    expect(TYPE_DUMMY).to.equal('dummy');
  });
});

/**
 * Tests for Sets
 */
describe('LinkTypes - SINGLE_ENDPOINT_TYPES Set', () => {
  it('should contain "host"', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('host')).to.be.true;
  });

  it('should contain "mgmt-net"', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('mgmt-net')).to.be.true;
  });

  it('should contain "macvlan"', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('macvlan')).to.be.true;
  });

  it('should contain "dummy"', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('dummy')).to.be.true;
  });

  it('should contain "vxlan"', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('vxlan')).to.be.true;
  });

  it('should contain "vxlan-stitch"', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('vxlan-stitch')).to.be.true;
  });

  it('should not contain unknown types', () => {
    expect(SINGLE_ENDPOINT_TYPES.has('router')).to.be.false;
    expect(SINGLE_ENDPOINT_TYPES.has('bridge')).to.be.false;
  });
});

describe('LinkTypes - VX_TYPES Set', () => {
  it('should contain "vxlan"', () => {
    expect(VX_TYPES.has('vxlan')).to.be.true;
  });

  it('should contain "vxlan-stitch"', () => {
    expect(VX_TYPES.has('vxlan-stitch')).to.be.true;
  });

  it('should not contain non-vxlan types', () => {
    expect(VX_TYPES.has('host')).to.be.false;
    expect(VX_TYPES.has('macvlan')).to.be.false;
  });
});

describe('LinkTypes - HOSTY_TYPES Set', () => {
  it('should contain "host"', () => {
    expect(HOSTY_TYPES.has('host')).to.be.true;
  });

  it('should contain "mgmt-net"', () => {
    expect(HOSTY_TYPES.has('mgmt-net')).to.be.true;
  });

  it('should contain "macvlan"', () => {
    expect(HOSTY_TYPES.has('macvlan')).to.be.true;
  });

  it('should not contain non-hosty types', () => {
    expect(HOSTY_TYPES.has('vxlan')).to.be.false;
    expect(HOSTY_TYPES.has('dummy')).to.be.false;
  });
});

/**
 * Tests for isSpecialEndpointId function
 */
describe('LinkTypes - isSpecialEndpointId', () => {
  it('should return true for host: prefix', () => {
    expect(isSpecialEndpointId(NODE_HOST_ETH0)).to.be.true;
  });

  it('should return true for mgmt-net: prefix', () => {
    expect(isSpecialEndpointId(NODE_MGMT_NET_ETH0)).to.be.true;
  });

  it('should return true for macvlan: prefix', () => {
    expect(isSpecialEndpointId(NODE_MACVLAN_ETH0)).to.be.true;
  });

  it('should return true for vxlan: prefix', () => {
    expect(isSpecialEndpointId(NODE_VXLAN)).to.be.true;
  });

  it('should return true for vxlan-stitch: prefix', () => {
    expect(isSpecialEndpointId(NODE_VXLAN_STITCH)).to.be.true;
  });

  it('should return true for dummy prefix', () => {
    expect(isSpecialEndpointId(NODE_DUMMY)).to.be.true;
    expect(isSpecialEndpointId('dummy:dummy0')).to.be.true;
  });

  it('should return true for bridge: prefix', () => {
    expect(isSpecialEndpointId(NODE_BRIDGE_ETH0)).to.be.true;
  });

  it('should return true for ovs-bridge: prefix', () => {
    expect(isSpecialEndpointId(NODE_OVS_BRIDGE)).to.be.true;
  });

  it('should return false for regular node ID', () => {
    expect(isSpecialEndpointId(NODE_ROUTER1)).to.be.false;
    expect(isSpecialEndpointId(NODE_ROUTER1_ETH0)).to.be.false;
  });

  it('should return false for empty string', () => {
    expect(isSpecialEndpointId('')).to.be.false;
  });

  it('should handle node IDs with similar names', () => {
    expect(isSpecialEndpointId('hostRouter')).to.be.false;
    expect(isSpecialEndpointId('myhost')).to.be.false;
  });
});

/**
 * Tests for isSpecialEndpoint alias
 */
describe('LinkTypes - isSpecialEndpoint (alias)', () => {
  it('should be identical to isSpecialEndpointId', () => {
    expect(isSpecialEndpoint).to.equal(isSpecialEndpointId);
  });

  it('should behave the same as isSpecialEndpointId', () => {
    expect(isSpecialEndpoint(NODE_HOST_ETH0)).to.equal(isSpecialEndpointId(NODE_HOST_ETH0));
    expect(isSpecialEndpoint(NODE_ROUTER1)).to.equal(isSpecialEndpointId(NODE_ROUTER1));
  });
});

/**
 * Tests for isSpecialNodeOrBridge function
 */
describe('LinkTypes - isSpecialNodeOrBridge without cy', () => {
  it('should return true for special endpoints', () => {
    expect(isSpecialNodeOrBridge(NODE_HOST_ETH0)).to.be.true;
    expect(isSpecialNodeOrBridge(NODE_MGMT_NET_ETH0)).to.be.true;
    expect(isSpecialNodeOrBridge(NODE_BRIDGE_ETH0)).to.be.true;
  });

  it('should return false for regular nodes without cy', () => {
    expect(isSpecialNodeOrBridge(NODE_ROUTER1)).to.be.false;
  });
});

// Helper to create mock cytoscape for bridge tests
function createBridgeMockCy(nodeId: string, kind: string) {
  return {
    getElementById: (id: string) => {
      if (id === nodeId) {
        return { length: 1, data: () => ({ kind }) };
      }
      return { length: 0 };
    }
  };
}

describe('LinkTypes - isSpecialNodeOrBridge cy bridge check', () => {
  it('should check node data for bridge kind', () => {
    const mockCy = createBridgeMockCy('bridgeNode', 'bridge');
    expect(isSpecialNodeOrBridge('bridgeNode', mockCy)).to.be.true;
  });

  it('should check node data for ovs-bridge kind', () => {
    const mockCy = createBridgeMockCy('ovsBridgeNode', 'ovs-bridge');
    expect(isSpecialNodeOrBridge('ovsBridgeNode', mockCy)).to.be.true;
  });

  it('should return false for non-bridge nodes', () => {
    const mockCy = createBridgeMockCy(NODE_ROUTER1, 'router');
    expect(isSpecialNodeOrBridge(NODE_ROUTER1, mockCy)).to.be.false;
  });
});

describe('LinkTypes - isSpecialNodeOrBridge cy edge cases', () => {
  it('should return false if node not found in cy', () => {
    const mockCy = { getElementById: () => ({ length: 0 }) };
    expect(isSpecialNodeOrBridge('unknownNode', mockCy)).to.be.false;
  });

  it('should handle node with no extraData', () => {
    const mockCy = {
      getElementById: (id: string) => {
        if (id === 'nodeWithoutExtra') {
          return { length: 1, data: () => ({}) };
        }
        return { length: 0 };
      }
    };
    expect(isSpecialNodeOrBridge('nodeWithoutExtra', mockCy)).to.be.false;
  });
});

/**
 * Tests for splitEndpointLike function
 */
describe('LinkTypes - splitEndpointLike with string input', () => {
  it('should split standard node:interface format', () => {
    const result = splitEndpointLike(NODE_ROUTER1_ETH0);
    expect(result.node).to.equal('router1');
    expect(result.iface).to.equal('eth0');
  });

  it('should handle macvlan prefix as single node', () => {
    const result = splitEndpointLike(NODE_MACVLAN_ETH0);
    expect(result.node).to.equal(NODE_MACVLAN_ETH0);
    expect(result.iface).to.equal('');
  });

  it('should handle dummy prefix as single node', () => {
    const result = splitEndpointLike(NODE_DUMMY);
    expect(result.node).to.equal(NODE_DUMMY);
    expect(result.iface).to.equal('');
  });

  it('should handle vxlan prefix as single node', () => {
    const result = splitEndpointLike(NODE_VXLAN);
    expect(result.node).to.equal(NODE_VXLAN);
    expect(result.iface).to.equal('');
  });

  it('should handle vxlan-stitch prefix as single node', () => {
    const result = splitEndpointLike(NODE_VXLAN_STITCH);
    expect(result.node).to.equal(NODE_VXLAN_STITCH);
    expect(result.iface).to.equal('');
  });

  it('should handle node name without interface', () => {
    const result = splitEndpointLike(NODE_ROUTER1);
    expect(result.node).to.equal(NODE_ROUTER1);
    expect(result.iface).to.equal('');
  });

  it('should handle empty string', () => {
    const result = splitEndpointLike('');
    expect(result.node).to.equal('');
    expect(result.iface).to.equal('');
  });

  it('should handle string with multiple colons as single endpoint', () => {
    // If more than 2 parts, treated as single endpoint with no interface
    const result = splitEndpointLike('node:eth0:extra');
    expect(result.node).to.equal('node:eth0:extra');
    expect(result.iface).to.equal('');
  });
});

describe('LinkTypes - splitEndpointLike with object input', () => {
  it('should extract node and interface from object', () => {
    const result = splitEndpointLike({ node: 'router1', interface: 'eth0' });
    expect(result.node).to.equal('router1');
    expect(result.iface).to.equal('eth0');
  });

  it('should handle object without interface', () => {
    const result = splitEndpointLike({ node: 'router1' });
    expect(result.node).to.equal('router1');
    expect(result.iface).to.equal('');
  });

  it('should handle object with undefined interface', () => {
    const result = splitEndpointLike({ node: 'router1', interface: undefined });
    expect(result.node).to.equal('router1');
    expect(result.iface).to.equal('');
  });
});

describe('LinkTypes - splitEndpointLike edge cases', () => {
  it('should return empty node and iface for null-like input', () => {
    const result = splitEndpointLike(null as any);
    expect(result.node).to.equal('');
    expect(result.iface).to.equal('');
  });

  it('should return empty node and iface for undefined-like input', () => {
    const result = splitEndpointLike(undefined as any);
    expect(result.node).to.equal('');
    expect(result.iface).to.equal('');
  });
});
