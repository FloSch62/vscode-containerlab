/* eslint-env mocha */
/* global describe, it */
import { expect } from 'chai';
import {
  endpointIsSpecial,
  splitEndpointCanonical,
  linkTypeFromSpecial,
  selectNonSpecial,
  canonicalKeyToString,
  canonicalFromPair,
  canonicalFromPayloadEdge,
  type CanonicalEndpoint,
  type CanonicalLinkKey
} from '../../../src/topoViewer/extension/services/CanonicalLinkUtils';

// Constants for commonly used test values
const NODE_ROUTER1 = 'router1';
const NODE_ROUTER2 = 'router2';
const NODE_SPINE1 = 'spine1';
const NODE_LEAF1 = 'leaf1';
const INTERFACE_ETH0 = 'eth0';
const INTERFACE_ETH1 = 'eth1';
const INTERFACE_E1_1 = 'e1-1';
const INTERFACE_E1_2 = 'e1-2';
const HOST_NODE = 'host';
const MGMT_NET_NODE = 'mgmt-net';
const MACVLAN_ENP0S3 = 'macvlan:enp0s3';
const VXLAN_192_168_1_1 = 'vxlan:192.168.1.1';
const VXLAN_STITCH_10_0_0_1 = 'vxlan-stitch:10.0.0.1';
const DUMMY1 = 'dummy1';

/**
 * Helper to create endpoint objects
 */
function createEndpoint(node: string, iface: string): CanonicalEndpoint {
  return { node, iface };
}

/**
 * Tests for CanonicalLinkUtils - endpointIsSpecial function
 */
describe('CanonicalLinkUtils - endpointIsSpecial', () => {
  it('should return true for host endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(HOST_NODE, INTERFACE_ETH0))).to.be.true;
  });

  it('should return true for mgmt-net endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(MGMT_NET_NODE, 'br0'))).to.be.true;
  });

  it('should return true for macvlan endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(MACVLAN_ENP0S3, ''))).to.be.true;
  });

  it('should return true for vxlan endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(VXLAN_192_168_1_1, ''))).to.be.true;
  });

  it('should return true for vxlan-stitch endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(VXLAN_STITCH_10_0_0_1, ''))).to.be.true;
  });

  it('should return true for dummy endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(DUMMY1, ''))).to.be.true;
  });

  it('should return false for regular node endpoint', () => {
    expect(endpointIsSpecial(createEndpoint(NODE_ROUTER1, INTERFACE_ETH0))).to.be.false;
  });

  it('should handle string endpoint format', () => {
    expect(endpointIsSpecial(`${HOST_NODE}:${INTERFACE_ETH0}`)).to.be.true;
    expect(endpointIsSpecial(`${NODE_ROUTER1}:${INTERFACE_ETH0}`)).to.be.false;
  });
});

/**
 * Tests for CanonicalLinkUtils - splitEndpointCanonical function
 */
describe('CanonicalLinkUtils - splitEndpointCanonical', () => {
  it('should split string endpoint with node and interface', () => {
    const result = splitEndpointCanonical(`${NODE_ROUTER1}:${INTERFACE_ETH0}`);
    expect(result).to.deep.equal(createEndpoint(NODE_ROUTER1, INTERFACE_ETH0));
  });

  it('should handle node-only string', () => {
    const result = splitEndpointCanonical(NODE_ROUTER1);
    expect(result).to.deep.equal(createEndpoint(NODE_ROUTER1, ''));
  });

  it('should handle object endpoint with interface', () => {
    const result = splitEndpointCanonical({ node: NODE_ROUTER1, interface: INTERFACE_ETH0 });
    expect(result).to.deep.equal(createEndpoint(NODE_ROUTER1, INTERFACE_ETH0));
  });

  it('should handle object endpoint without interface', () => {
    const result = splitEndpointCanonical({ node: NODE_ROUTER1 });
    expect(result).to.deep.equal(createEndpoint(NODE_ROUTER1, ''));
  });

  it('should preserve special endpoint prefixes', () => {
    const result = splitEndpointCanonical(MACVLAN_ENP0S3);
    expect(result.node).to.equal(MACVLAN_ENP0S3);
  });
});

/**
 * Tests for CanonicalLinkUtils - linkTypeFromSpecial function
 */
describe('CanonicalLinkUtils - linkTypeFromSpecial', () => {
  it('should return host type for host node', () => {
    expect(linkTypeFromSpecial(createEndpoint(HOST_NODE, INTERFACE_ETH0))).to.equal('host');
  });

  it('should return mgmt-net type for mgmt-net node', () => {
    expect(linkTypeFromSpecial(createEndpoint(MGMT_NET_NODE, 'br0'))).to.equal('mgmt-net');
  });

  it('should return macvlan type for macvlan prefixed node', () => {
    expect(linkTypeFromSpecial(createEndpoint(MACVLAN_ENP0S3, ''))).to.equal('macvlan');
  });

  it('should return vxlan-stitch type for vxlan-stitch prefixed node', () => {
    expect(linkTypeFromSpecial(createEndpoint(VXLAN_STITCH_10_0_0_1, ''))).to.equal('vxlan-stitch');
  });

  it('should return vxlan type for vxlan prefixed node', () => {
    expect(linkTypeFromSpecial(createEndpoint(VXLAN_192_168_1_1, ''))).to.equal('vxlan');
  });

  it('should return dummy type for dummy prefixed node', () => {
    expect(linkTypeFromSpecial(createEndpoint(DUMMY1, ''))).to.equal('dummy');
  });

  it('should return unknown type for unrecognized node', () => {
    expect(linkTypeFromSpecial(createEndpoint(NODE_ROUTER1, INTERFACE_ETH0))).to.equal('unknown');
  });
});

/**
 * Tests for CanonicalLinkUtils - selectNonSpecial function
 */
describe('CanonicalLinkUtils - selectNonSpecial', () => {
  it('should return non-special endpoint when first is special', () => {
    const special = createEndpoint(HOST_NODE, INTERFACE_ETH0);
    const regular = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    expect(selectNonSpecial(special, regular)).to.deep.equal(regular);
  });

  it('should return first endpoint when second is special', () => {
    const regular = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const special = createEndpoint(HOST_NODE, INTERFACE_ETH0);
    expect(selectNonSpecial(regular, special)).to.deep.equal(regular);
  });

  it('should return first endpoint when both are regular', () => {
    const ep1 = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const ep2 = createEndpoint(NODE_ROUTER2, INTERFACE_ETH1);
    expect(selectNonSpecial(ep1, ep2)).to.deep.equal(ep1);
  });

  it('should return first endpoint when only one provided', () => {
    const ep = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const noSecondEp: CanonicalEndpoint | undefined = undefined;
    expect(selectNonSpecial(ep, noSecondEp)).to.deep.equal(ep);
  });

  it('should return first endpoint when both are special', () => {
    const ep1 = createEndpoint(HOST_NODE, INTERFACE_ETH0);
    const ep2 = createEndpoint(MGMT_NET_NODE, 'br0');
    expect(selectNonSpecial(ep1, ep2)).to.deep.equal(ep1);
  });
});

/**
 * Tests for CanonicalLinkUtils - canonicalKeyToString function
 */
describe('CanonicalLinkUtils - canonicalKeyToString', () => {
  it('should create sorted string for veth link', () => {
    const key: CanonicalLinkKey = {
      type: 'veth',
      a: createEndpoint(NODE_ROUTER2, INTERFACE_ETH1),
      b: createEndpoint(NODE_ROUTER1, INTERFACE_ETH0)
    };
    const result = canonicalKeyToString(key);
    expect(result).to.equal(`veth|${NODE_ROUTER1}:${INTERFACE_ETH0}|${NODE_ROUTER2}:${INTERFACE_ETH1}`);
  });

  it('should maintain consistent ordering for veth links', () => {
    const key1: CanonicalLinkKey = {
      type: 'veth',
      a: createEndpoint(NODE_SPINE1, INTERFACE_E1_1),
      b: createEndpoint(NODE_LEAF1, INTERFACE_E1_2)
    };
    const key2: CanonicalLinkKey = {
      type: 'veth',
      a: createEndpoint(NODE_LEAF1, INTERFACE_E1_2),
      b: createEndpoint(NODE_SPINE1, INTERFACE_E1_1)
    };
    expect(canonicalKeyToString(key1)).to.equal(canonicalKeyToString(key2));
  });

  it('should create string for host link', () => {
    const key: CanonicalLinkKey = {
      type: 'host',
      a: createEndpoint(NODE_ROUTER1, INTERFACE_ETH0)
    };
    expect(canonicalKeyToString(key)).to.equal(`host|${NODE_ROUTER1}:${INTERFACE_ETH0}`);
  });

  it('should create string for mgmt-net link', () => {
    const key: CanonicalLinkKey = {
      type: 'mgmt-net',
      a: createEndpoint(NODE_ROUTER1, 'mgmt0')
    };
    expect(canonicalKeyToString(key)).to.equal(`mgmt-net|${NODE_ROUTER1}:mgmt0`);
  });

  it('should create string for macvlan link', () => {
    const key: CanonicalLinkKey = {
      type: 'macvlan',
      a: createEndpoint(NODE_ROUTER1, INTERFACE_ETH0)
    };
    expect(canonicalKeyToString(key)).to.equal(`macvlan|${NODE_ROUTER1}:${INTERFACE_ETH0}`);
  });

  it('should create string for dummy link', () => {
    const key: CanonicalLinkKey = {
      type: 'dummy',
      a: createEndpoint(NODE_ROUTER1, 'dummy0')
    };
    expect(canonicalKeyToString(key)).to.equal(`dummy|${NODE_ROUTER1}:dummy0`);
  });

  it('should create string for vxlan link', () => {
    const key: CanonicalLinkKey = {
      type: 'vxlan',
      a: createEndpoint(NODE_ROUTER1, INTERFACE_ETH0)
    };
    expect(canonicalKeyToString(key)).to.equal(`vxlan|${NODE_ROUTER1}:${INTERFACE_ETH0}`);
  });

  it('should create string for vxlan-stitch link', () => {
    const key: CanonicalLinkKey = {
      type: 'vxlan-stitch',
      a: createEndpoint(NODE_ROUTER1, INTERFACE_ETH0)
    };
    expect(canonicalKeyToString(key)).to.equal(`vxlan-stitch|${NODE_ROUTER1}:${INTERFACE_ETH0}`);
  });
});

/**
 * Tests for CanonicalLinkUtils - canonicalFromPair function
 */
describe('CanonicalLinkUtils - canonicalFromPair', () => {
  it('should create veth link for two regular endpoints', () => {
    const a = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const b = createEndpoint(NODE_ROUTER2, INTERFACE_ETH1);
    const result = canonicalFromPair(a, b);
    expect(result.type).to.equal('veth');
    expect(result.a).to.deep.equal(a);
    expect(result.b).to.deep.equal(b);
  });

  it('should create host link when one endpoint is host', () => {
    const host = createEndpoint(HOST_NODE, INTERFACE_ETH0);
    const regular = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const result = canonicalFromPair(host, regular);
    expect(result.type).to.equal('host');
    expect(result.a).to.deep.equal(regular);
    expect(result.b).to.be.undefined;
  });

  it('should create mgmt-net link when one endpoint is mgmt-net', () => {
    const regular = createEndpoint(NODE_ROUTER1, 'mgmt0');
    const mgmtNet = createEndpoint(MGMT_NET_NODE, 'br0');
    const result = canonicalFromPair(regular, mgmtNet);
    expect(result.type).to.equal('mgmt-net');
    expect(result.a).to.deep.equal(regular);
  });

  it('should create macvlan link when one endpoint is macvlan', () => {
    const regular = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const macvlan = createEndpoint(MACVLAN_ENP0S3, '');
    const result = canonicalFromPair(regular, macvlan);
    expect(result.type).to.equal('macvlan');
    expect(result.a).to.deep.equal(regular);
  });

  it('should create dummy link when one endpoint is dummy', () => {
    const regular = createEndpoint(NODE_ROUTER1, 'dummy0');
    const dummy = createEndpoint(DUMMY1, '');
    const result = canonicalFromPair(regular, dummy);
    expect(result.type).to.equal('dummy');
    expect(result.a).to.deep.equal(regular);
  });

  it('should create vxlan link when one endpoint is vxlan', () => {
    const regular = createEndpoint(NODE_ROUTER1, INTERFACE_ETH0);
    const vxlan = createEndpoint(VXLAN_192_168_1_1, '');
    const result = canonicalFromPair(regular, vxlan);
    expect(result.type).to.equal('vxlan');
    expect(result.a).to.deep.equal(regular);
  });

  it('should create veth link when both endpoints are special', () => {
    const host = createEndpoint(HOST_NODE, INTERFACE_ETH0);
    const mgmtNet = createEndpoint(MGMT_NET_NODE, 'br0');
    const result = canonicalFromPair(host, mgmtNet);
    expect(result.type).to.equal('veth');
  });
});

/**
 * Tests for CanonicalLinkUtils - canonicalFromPayloadEdge function
 */
describe('CanonicalLinkUtils - canonicalFromPayloadEdge', () => {
  it('should create veth link from payload edge', () => {
    const data = {
      source: NODE_ROUTER1,
      target: NODE_ROUTER2,
      sourceEndpoint: INTERFACE_ETH0,
      targetEndpoint: INTERFACE_ETH1
    };
    const result = canonicalFromPayloadEdge(data);
    expect(result).to.not.be.null;
    expect(result!.type).to.equal('veth');
    expect(result!.a).to.deep.equal(createEndpoint(NODE_ROUTER1, INTERFACE_ETH0));
    expect(result!.b).to.deep.equal(createEndpoint(NODE_ROUTER2, INTERFACE_ETH1));
  });

  it('should handle payload edge without endpoint info', () => {
    const data = {
      source: NODE_ROUTER1,
      target: NODE_ROUTER2
    };
    const result = canonicalFromPayloadEdge(data);
    expect(result).to.not.be.null;
    expect(result!.type).to.equal('veth');
  });

  it('should detect special endpoints in payload', () => {
    const data = {
      source: NODE_ROUTER1,
      target: `${HOST_NODE}:veth-host`,
      sourceEndpoint: INTERFACE_ETH0
    };
    const result = canonicalFromPayloadEdge(data);
    expect(result).to.not.be.null;
    expect(result!.type).to.equal('host');
  });
});
