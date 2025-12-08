/* eslint-env mocha */
/* global describe, it, beforeEach */
import { expect } from 'chai';
import {
  splitEndpoint,
  normalizeSingleTypeToSpecialId,
  normalizeLinkToTwoEndpoints,
  resolveActualNode,
  buildContainerName,
  shouldOmitEndpoint,
  extractEndpointMac,
  STR_HOST,
  STR_MGMT_NET,
  PREFIX_MACVLAN,
  PREFIX_VXLAN,
  PREFIX_VXLAN_STITCH,
  PREFIX_DUMMY,
  TYPES,
  SINGLE_ENDPOINT_TYPES,
  type DummyContext
} from '../../../src/topoViewer/extension/services/LinkParser';

// Constants for commonly used test values
const NODE_SPINE_01 = 'Spine-01';
const NODE_ROUTER1 = 'router1';
const INTERFACE_E1_1 = 'e1-1';
const INTERFACE_ETH0 = 'eth0';
const INTERFACE_ETH1 = 'eth1';
const MACVLAN_ENP0S3 = 'macvlan:enp0s3';
const VXLAN_192_168_1_1 = 'vxlan:192.168.1.1';
const TYPE_VXLAN_STITCH = 'vxlan-stitch';
const VXLAN_STITCH_10_0_0_1 = `${TYPE_VXLAN_STITCH}:10.0.0.1/100`;
const HOST_ETH0 = 'host:eth0';
const MGMT_NET_BR0 = 'mgmt-net:br0';
const CLAB_MYLAB_PREFIX = 'clab-mylab';

/**
 * Helper to create a fresh DummyContext
 */
function createDummyContext(): DummyContext {
  return { dummyCounter: 0, dummyLinkMap: new Map() };
}

/**
 * Tests for LinkParser - splitEndpoint function
 */
describe('LinkParser - splitEndpoint', () => {
  it('should parse "node:interface" format correctly', () => {
    const result = splitEndpoint(`${NODE_SPINE_01}:${INTERFACE_E1_1}`);
    expect(result).to.deep.equal({ node: NODE_SPINE_01, iface: INTERFACE_E1_1 });
  });

  it('should handle node-only strings', () => {
    const result = splitEndpoint(NODE_SPINE_01);
    expect(result).to.deep.equal({ node: NODE_SPINE_01, iface: '' });
  });

  it('should handle object endpoint format with interface', () => {
    const result = splitEndpoint({ node: NODE_ROUTER1, interface: INTERFACE_ETH0 });
    expect(result).to.deep.equal({ node: NODE_ROUTER1, iface: INTERFACE_ETH0 });
  });

  it('should handle object endpoint format without interface', () => {
    const result = splitEndpoint({ node: NODE_ROUTER1 });
    expect(result).to.deep.equal({ node: NODE_ROUTER1, iface: '' });
  });

  it('should handle macvlan prefix as a whole node name', () => {
    const result = splitEndpoint(MACVLAN_ENP0S3);
    expect(result.node).to.equal(MACVLAN_ENP0S3);
  });

  it('should handle vxlan prefix as a whole node name', () => {
    const result = splitEndpoint(VXLAN_192_168_1_1);
    expect(result.node).to.equal(VXLAN_192_168_1_1);
  });

  it('should handle empty string', () => {
    const result = splitEndpoint('');
    expect(result).to.deep.equal({ node: '', iface: '' });
  });

  it('should handle endpoint with multiple colons', () => {
    const result = splitEndpoint('node:interface:extra');
    expect(result.node).to.equal('node:interface:extra');
    expect(result.iface).to.equal('');
  });
});

/**
 * Tests for LinkParser - normalizeSingleTypeToSpecialId function
 */
describe('LinkParser - normalizeSingleTypeToSpecialId', () => {
  let ctx: DummyContext;

  beforeEach(() => {
    ctx = createDummyContext();
  });

  it('should build host ID with host-interface', () => {
    const linkObj = { type: 'host', 'host-interface': INTERFACE_ETH0 };
    const result = normalizeSingleTypeToSpecialId('host', linkObj, ctx);
    expect(result).to.equal(HOST_ETH0);
  });

  it('should build host ID with empty interface', () => {
    const linkObj = { type: 'host' };
    const result = normalizeSingleTypeToSpecialId('host', linkObj, ctx);
    expect(result).to.equal('host:');
  });

  it('should build mgmt-net ID', () => {
    const linkObj = { type: 'mgmt-net', 'host-interface': 'br-mgmt' };
    const result = normalizeSingleTypeToSpecialId('mgmt-net', linkObj, ctx);
    expect(result).to.equal('mgmt-net:br-mgmt');
  });

  it('should build macvlan ID', () => {
    const linkObj = { type: 'macvlan', 'host-interface': 'enp0s3' };
    const result = normalizeSingleTypeToSpecialId('macvlan', linkObj, ctx);
    expect(result).to.equal(MACVLAN_ENP0S3);
  });

  it('should build vxlan ID with all fields', () => {
    const linkObj = {
      type: 'vxlan',
      remote: '192.168.1.1',
      vni: 100,
      'dst-port': 4789,
      'src-port': 0
    };
    const result = normalizeSingleTypeToSpecialId('vxlan', linkObj, ctx);
    expect(result).to.equal('vxlan:192.168.1.1/100/4789/0');
  });

  it('should build vxlan ID with missing fields', () => {
    const linkObj = { type: 'vxlan' };
    const result = normalizeSingleTypeToSpecialId('vxlan', linkObj, ctx);
    expect(result).to.equal('vxlan:///');
  });

  it('should build vxlan-stitch ID', () => {
    const linkObj = {
      type: TYPE_VXLAN_STITCH,
      remote: '10.0.0.1',
      vni: 200
    };
    const result = normalizeSingleTypeToSpecialId(TYPE_VXLAN_STITCH, linkObj, ctx);
    expect(result).to.equal(`${TYPE_VXLAN_STITCH}:10.0.0.1/200//`);
  });

  it('should build dummy ID with counter', () => {
    const linkObj1 = { type: 'dummy' };
    const linkObj2 = { type: 'dummy' };

    const result1 = normalizeSingleTypeToSpecialId('dummy', linkObj1, ctx);
    expect(result1).to.equal('dummy1');
    expect(ctx.dummyCounter).to.equal(1);

    const result2 = normalizeSingleTypeToSpecialId('dummy', linkObj2, ctx);
    expect(result2).to.equal('dummy2');
    expect(ctx.dummyCounter).to.equal(2);
  });

  it('should cache dummy IDs in the map', () => {
    const linkObj = { type: 'dummy' };

    const result1 = normalizeSingleTypeToSpecialId('dummy', linkObj, ctx);
    const result2 = normalizeSingleTypeToSpecialId('dummy', linkObj, ctx);

    expect(result1).to.equal(result2);
    expect(ctx.dummyCounter).to.equal(1);
  });

  it('should return empty string for unknown type', () => {
    const result = normalizeSingleTypeToSpecialId('unknown', {}, ctx);
    expect(result).to.equal('');
  });
});

/**
 * Tests for LinkParser - normalizeLinkToTwoEndpoints function
 */
describe('LinkParser - normalizeLinkToTwoEndpoints', () => {
  let ctx: DummyContext;

  beforeEach(() => {
    ctx = createDummyContext();
  });

  it('should normalize veth links with two endpoints', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [`node1:${INTERFACE_ETH0}`, `node2:${INTERFACE_ETH1}`]
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.deep.equal({
      endA: `node1:${INTERFACE_ETH0}`,
      endB: `node2:${INTERFACE_ETH1}`,
      type: 'veth'
    });
  });

  it('should return null for veth links with missing endpoints', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [`node1:${INTERFACE_ETH0}`]
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.be.null;
  });

  it('should normalize single-endpoint host links', () => {
    const linkObj = {
      type: 'host',
      endpoint: `node1:${INTERFACE_ETH0}`,
      'host-interface': 'veth-host'
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.not.be.null;
    expect(result!.endA).to.equal(`node1:${INTERFACE_ETH0}`);
    expect(result!.endB).to.equal('host:veth-host');
    expect(result!.type).to.equal('host');
  });

  it('should normalize single-endpoint mgmt-net links', () => {
    const linkObj = {
      type: 'mgmt-net',
      endpoint: 'node1:mgmt0',
      'host-interface': 'br-mgmt'
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.not.be.null;
    expect(result!.endA).to.equal('node1:mgmt0');
    expect(result!.endB).to.equal('mgmt-net:br-mgmt');
  });

  it('should normalize dummy links', () => {
    const linkObj = {
      type: 'dummy',
      endpoint: 'node1:dummy0'
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.not.be.null;
    expect(result!.endA).to.equal('node1:dummy0');
    expect(result!.endB).to.equal('dummy1');
  });

  it('should return null for single-endpoint link without endpoint', () => {
    const linkObj = {
      type: 'host',
      'host-interface': 'veth-host'
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.be.null;
  });

  it('should handle links with no explicit type', () => {
    const linkObj = {
      endpoints: [`node1:${INTERFACE_ETH0}`, `node2:${INTERFACE_ETH1}`]
    };
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.deep.equal({
      endA: `node1:${INTERFACE_ETH0}`,
      endB: `node2:${INTERFACE_ETH1}`,
      type: undefined
    });
  });

  it('should return null for links with missing endpoints array', () => {
    const linkObj = {};
    const result = normalizeLinkToTwoEndpoints(linkObj, ctx);
    expect(result).to.be.null;
  });
});

/**
 * Tests for LinkParser - resolveActualNode function
 */
describe('LinkParser - resolveActualNode', () => {
  it('should resolve host endpoints', () => {
    const result = resolveActualNode('host', INTERFACE_ETH0);
    expect(result).to.equal(HOST_ETH0);
  });

  it('should resolve mgmt-net endpoints', () => {
    const result = resolveActualNode('mgmt-net', 'br0');
    expect(result).to.equal(MGMT_NET_BR0);
  });

  it('should preserve macvlan prefixed nodes', () => {
    const result = resolveActualNode(MACVLAN_ENP0S3, INTERFACE_ETH0);
    expect(result).to.equal(MACVLAN_ENP0S3);
  });

  it('should preserve vxlan-stitch prefixed nodes', () => {
    const result = resolveActualNode(VXLAN_STITCH_10_0_0_1, INTERFACE_ETH0);
    expect(result).to.equal(VXLAN_STITCH_10_0_0_1);
  });

  it('should preserve vxlan prefixed nodes', () => {
    const result = resolveActualNode(VXLAN_192_168_1_1, INTERFACE_ETH0);
    expect(result).to.equal(VXLAN_192_168_1_1);
  });

  it('should preserve dummy nodes', () => {
    const result = resolveActualNode('dummy1', INTERFACE_ETH0);
    expect(result).to.equal('dummy1');
  });

  it('should return regular nodes as-is', () => {
    const result = resolveActualNode(NODE_ROUTER1, INTERFACE_ETH0);
    expect(result).to.equal(NODE_ROUTER1);
  });
});

/**
 * Tests for LinkParser - buildContainerName function
 */
describe('LinkParser - buildContainerName', () => {
  it('should build container name with prefix', () => {
    const result = buildContainerName(NODE_ROUTER1, NODE_ROUTER1, CLAB_MYLAB_PREFIX);
    expect(result).to.equal(`${CLAB_MYLAB_PREFIX}-${NODE_ROUTER1}`);
  });

  it('should return node name without prefix', () => {
    const result = buildContainerName(NODE_ROUTER1, NODE_ROUTER1, '');
    expect(result).to.equal(NODE_ROUTER1);
  });

  it('should return actual node for host type', () => {
    const result = buildContainerName('host', HOST_ETH0, CLAB_MYLAB_PREFIX);
    expect(result).to.equal(HOST_ETH0);
  });

  it('should return actual node for mgmt-net type', () => {
    const result = buildContainerName('mgmt-net', MGMT_NET_BR0, CLAB_MYLAB_PREFIX);
    expect(result).to.equal(MGMT_NET_BR0);
  });

  it('should return actual node for macvlan type', () => {
    const result = buildContainerName(MACVLAN_ENP0S3, MACVLAN_ENP0S3, CLAB_MYLAB_PREFIX);
    expect(result).to.equal(MACVLAN_ENP0S3);
  });

  it('should return actual node for vxlan type', () => {
    const result = buildContainerName(VXLAN_192_168_1_1, VXLAN_192_168_1_1, CLAB_MYLAB_PREFIX);
    expect(result).to.equal(VXLAN_192_168_1_1);
  });

  it('should return actual node for dummy type', () => {
    const result = buildContainerName('dummy1', 'dummy1', CLAB_MYLAB_PREFIX);
    expect(result).to.equal('dummy1');
  });
});

/**
 * Tests for LinkParser - shouldOmitEndpoint function
 */
describe('LinkParser - shouldOmitEndpoint', () => {
  it('should return true for host', () => {
    expect(shouldOmitEndpoint('host')).to.be.true;
  });

  it('should return true for mgmt-net', () => {
    expect(shouldOmitEndpoint('mgmt-net')).to.be.true;
  });

  it('should return true for macvlan prefixed nodes', () => {
    expect(shouldOmitEndpoint(MACVLAN_ENP0S3)).to.be.true;
  });

  it('should return true for dummy nodes', () => {
    expect(shouldOmitEndpoint('dummy1')).to.be.true;
    expect(shouldOmitEndpoint('dummy')).to.be.true;
  });

  it('should return false for regular nodes', () => {
    expect(shouldOmitEndpoint(NODE_ROUTER1)).to.be.false;
    expect(shouldOmitEndpoint('spine-01')).to.be.false;
  });

  it('should return false for vxlan nodes', () => {
    expect(shouldOmitEndpoint(VXLAN_192_168_1_1)).to.be.false;
  });
});

/**
 * Tests for LinkParser - extractEndpointMac function
 */
describe('LinkParser - extractEndpointMac', () => {
  const TEST_MAC = '00:11:22:33:44:55';

  it('should extract MAC from object endpoint', () => {
    const endpoint = { node: NODE_ROUTER1, interface: INTERFACE_ETH0, mac: TEST_MAC };
    const result = extractEndpointMac(endpoint);
    expect(result).to.equal(TEST_MAC);
  });

  it('should return empty string for object without mac', () => {
    const endpoint = { node: NODE_ROUTER1, interface: INTERFACE_ETH0 };
    const result = extractEndpointMac(endpoint);
    expect(result).to.equal('');
  });

  it('should return empty string for string endpoint', () => {
    const result = extractEndpointMac(`${NODE_ROUTER1}:${INTERFACE_ETH0}`);
    expect(result).to.equal('');
  });

  it('should return empty string for null', () => {
    const result = extractEndpointMac(null);
    expect(result).to.equal('');
  });

  it('should return empty string for undefined', () => {
    const result = extractEndpointMac(undefined);
    expect(result).to.equal('');
  });
});

/**
 * Tests for LinkParser - Constants
 */
describe('LinkParser - Constants', () => {
  it('should export STR_HOST constant', () => {
    expect(STR_HOST).to.equal('host');
  });

  it('should export STR_MGMT_NET constant', () => {
    expect(STR_MGMT_NET).to.equal('mgmt-net');
  });

  it('should export PREFIX_MACVLAN constant', () => {
    expect(PREFIX_MACVLAN).to.equal('macvlan:');
  });

  it('should export PREFIX_VXLAN constant', () => {
    expect(PREFIX_VXLAN).to.equal('vxlan:');
  });

  it('should export PREFIX_VXLAN_STITCH constant', () => {
    expect(PREFIX_VXLAN_STITCH).to.equal(`${TYPE_VXLAN_STITCH}:`);
  });

  it('should export PREFIX_DUMMY constant', () => {
    expect(PREFIX_DUMMY).to.equal('dummy');
  });
});

/**
 * Tests for LinkParser - TYPES object
 */
describe('LinkParser - TYPES object', () => {
  it('should have HOST type value', () => {
    expect(TYPES.HOST).to.equal('host');
  });

  it('should have MGMT_NET type value', () => {
    expect(TYPES.MGMT_NET).to.equal('mgmt-net');
  });

  it('should have MACVLAN type value', () => {
    expect(TYPES.MACVLAN).to.equal('macvlan');
  });

  it('should have VXLAN type value', () => {
    expect(TYPES.VXLAN).to.equal('vxlan');
  });

  it('should have VXLAN_STITCH type value', () => {
    expect(TYPES.VXLAN_STITCH).to.equal(TYPE_VXLAN_STITCH);
  });

  it('should have BRIDGE type value', () => {
    expect(TYPES.BRIDGE).to.equal('bridge');
  });

  it('should have OVS_BRIDGE type value', () => {
    expect(TYPES.OVS_BRIDGE).to.equal('ovs-bridge');
  });

  it('should have DUMMY type value', () => {
    expect(TYPES.DUMMY).to.equal('dummy');
  });
});

/**
 * Tests for LinkParser - SINGLE_ENDPOINT_TYPES array
 */
describe('LinkParser - SINGLE_ENDPOINT_TYPES array', () => {
  it('should be an array', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.be.an('array');
  });

  it('should include host type', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.include('host');
  });

  it('should include mgmt-net type', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.include('mgmt-net');
  });

  it('should include macvlan type', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.include('macvlan');
  });

  it('should include dummy type', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.include('dummy');
  });

  it('should include vxlan type', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.include('vxlan');
  });

  it('should include vxlan-stitch type', () => {
    expect(SINGLE_ENDPOINT_TYPES).to.include(TYPE_VXLAN_STITCH);
  });
});
