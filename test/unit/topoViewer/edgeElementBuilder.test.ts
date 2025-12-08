/* eslint-env mocha */
/* global describe, it */
import { expect } from 'chai';
import {
  isSpecialNode,
  classFromState,
  edgeClassForSpecial,
  computeEdgeClass,
  computeEdgeClassFromStates,
  validateVethLink,
  validateSpecialLink,
  validateExtendedLink,
  extractEdgeInterfaceStats,
  createClabInfo,
  extractExtLinkProps,
  extractExtMacs,
  createExtInfo,
  buildEdgeClasses,
  buildEdgeExtraData,
  buildEdgeElement
} from '../../../src/topoViewer/extension/services/EdgeElementBuilder';
import type { ClabTopology, ClabNode } from '../../../src/topoViewer/shared/types/topoViewerType';

// Constants for commonly used test values
const NODE_ROUTER1 = 'router1';
const NODE_ROUTER2 = 'router2';
const INTERFACE_ETH0 = 'eth0';
const INTERFACE_ETH1 = 'eth1';
const STATE_UP = 'up';
const STATE_DOWN = 'down';
const CLASS_LINK_UP = 'link-up';
const CLASS_LINK_DOWN = 'link-down';
const KIND_BRIDGE = 'bridge';
const KIND_OVS_BRIDGE = 'ovs-bridge';
const SPECIAL_HOST_ETH0 = 'host:eth0';
const SPECIAL_MGMT_NET_BR0 = 'mgmt-net:br0';
const MACVLAN_ENP0S3 = 'macvlan:enp0s3';
const VXLAN_192_168_1_1 = 'vxlan:192.168.1.1';
const DUMMY1 = 'dummy1';
const CONTAINER_ROUTER1 = 'clab-test-router1';
const CONTAINER_ROUTER2 = 'clab-test-router2';
const MAC_ADDRESS_1 = '00:11:22:33:44:55';
const MAC_ADDRESS_2 = 'aa:bb:cc:dd:ee:ff';
const ERROR_INVALID_VETH = 'invalid-veth-endpoints';
const REMOTE_IP = '192.168.1.1';
const EDGE_ID_0 = 'Clab-Link0';
const HOST_INTERFACE_VETH = 'veth-host';

/**
 * Helper to create a basic topology object
 */
function createTopology(nodes: Record<string, ClabNode> = {}): NonNullable<ClabTopology['topology']> {
  return { nodes };
}

/**
 * Tests for EdgeElementBuilder - isSpecialNode function
 */
describe('EdgeElementBuilder - isSpecialNode', () => {
  it('should return true for bridge kind', () => {
    const nodeData: ClabNode = { kind: KIND_BRIDGE };
    expect(isSpecialNode(nodeData, NODE_ROUTER1)).to.be.true;
  });

  it('should return true for ovs-bridge kind', () => {
    const nodeData: ClabNode = { kind: KIND_OVS_BRIDGE };
    expect(isSpecialNode(nodeData, NODE_ROUTER1)).to.be.true;
  });

  it('should return true for host node name', () => {
    expect(isSpecialNode(undefined, 'host')).to.be.true;
  });

  it('should return true for mgmt-net node name', () => {
    expect(isSpecialNode(undefined, 'mgmt-net')).to.be.true;
  });

  it('should return true for macvlan prefixed nodes', () => {
    expect(isSpecialNode(undefined, MACVLAN_ENP0S3)).to.be.true;
  });

  it('should return true for vxlan prefixed nodes', () => {
    expect(isSpecialNode(undefined, VXLAN_192_168_1_1)).to.be.true;
  });

  it('should return true for vxlan-stitch prefixed nodes', () => {
    expect(isSpecialNode(undefined, 'vxlan-stitch:10.0.0.1')).to.be.true;
  });

  it('should return true for dummy nodes', () => {
    expect(isSpecialNode(undefined, DUMMY1)).to.be.true;
    expect(isSpecialNode(undefined, 'dummy')).to.be.true;
  });

  it('should return false for regular nodes', () => {
    const nodeData: ClabNode = { kind: 'linux' };
    expect(isSpecialNode(nodeData, NODE_ROUTER1)).to.be.false;
  });
});

/**
 * Tests for EdgeElementBuilder - classFromState function
 */
describe('EdgeElementBuilder - classFromState', () => {
  it('should return link-up for up state', () => {
    expect(classFromState({ state: STATE_UP })).to.equal(CLASS_LINK_UP);
  });

  it('should return link-down for down state', () => {
    expect(classFromState({ state: STATE_DOWN })).to.equal(CLASS_LINK_DOWN);
  });

  it('should return empty string for undefined state', () => {
    expect(classFromState({ state: undefined })).to.equal('');
  });

  it('should return empty string for undefined object', () => {
    expect(classFromState(undefined)).to.equal('');
  });

  it('should return empty string for null object', () => {
    expect(classFromState(null)).to.equal('');
  });
});

/**
 * Tests for EdgeElementBuilder - edgeClassForSpecial function
 */
describe('EdgeElementBuilder - edgeClassForSpecial', () => {
  it('should return target state when source is special', () => {
    const result = edgeClassForSpecial(true, false, undefined, { state: STATE_UP });
    expect(result).to.equal(CLASS_LINK_UP);
  });

  it('should return source state when target is special', () => {
    const result = edgeClassForSpecial(false, true, { state: STATE_DOWN }, undefined);
    expect(result).to.equal(CLASS_LINK_DOWN);
  });

  it('should return link-up when both are special', () => {
    const result = edgeClassForSpecial(true, true, undefined, undefined);
    expect(result).to.equal(CLASS_LINK_UP);
  });

  it('should return link-up when neither is special', () => {
    const result = edgeClassForSpecial(false, false, undefined, undefined);
    expect(result).to.equal(CLASS_LINK_UP);
  });
});

/**
 * Tests for EdgeElementBuilder - computeEdgeClass function
 */
describe('EdgeElementBuilder - computeEdgeClass', () => {
  it('should return link-up when both interfaces are up', () => {
    const topology = createTopology();
    const result = computeEdgeClass(
      NODE_ROUTER1, NODE_ROUTER2,
      { state: STATE_UP }, { state: STATE_UP },
      topology
    );
    expect(result).to.equal(CLASS_LINK_UP);
  });

  it('should return link-down when one interface is down', () => {
    const topology = createTopology();
    const result = computeEdgeClass(
      NODE_ROUTER1, NODE_ROUTER2,
      { state: STATE_UP }, { state: STATE_DOWN },
      topology
    );
    expect(result).to.equal(CLASS_LINK_DOWN);
  });

  it('should return empty string when state is missing', () => {
    const topology = createTopology();
    const result = computeEdgeClass(
      NODE_ROUTER1, NODE_ROUTER2,
      {}, {},
      topology
    );
    expect(result).to.equal('');
  });

  it('should use special node logic for bridge nodes', () => {
    const topology = createTopology({ [NODE_ROUTER1]: { kind: KIND_BRIDGE } });
    const result = computeEdgeClass(
      NODE_ROUTER1, NODE_ROUTER2,
      undefined, { state: STATE_UP },
      topology
    );
    expect(result).to.equal(CLASS_LINK_UP);
  });
});

/**
 * Tests for EdgeElementBuilder - computeEdgeClassFromStates function
 */
describe('EdgeElementBuilder - computeEdgeClassFromStates', () => {
  it('should return link-up when both states are up', () => {
    const topology = createTopology();
    const result = computeEdgeClassFromStates(
      topology, NODE_ROUTER1, NODE_ROUTER2,
      STATE_UP, STATE_UP
    );
    expect(result).to.equal(CLASS_LINK_UP);
  });

  it('should return link-down when one state is down', () => {
    const topology = createTopology();
    const result = computeEdgeClassFromStates(
      topology, NODE_ROUTER1, NODE_ROUTER2,
      STATE_UP, STATE_DOWN
    );
    expect(result).to.equal(CLASS_LINK_DOWN);
  });

  it('should return empty string when states are undefined', () => {
    const topology = createTopology();
    const undefinedState: string | undefined = undefined;
    const result = computeEdgeClassFromStates(
      topology, NODE_ROUTER1, NODE_ROUTER2,
      undefinedState, undefinedState
    );
    expect(result).to.equal('');
  });
});

/**
 * Tests for EdgeElementBuilder - validateVethLink function
 */
describe('EdgeElementBuilder - validateVethLink', () => {
  it('should return empty array for valid veth link', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [
        { node: NODE_ROUTER1, interface: INTERFACE_ETH0 },
        { node: NODE_ROUTER2, interface: INTERFACE_ETH1 }
      ]
    };
    expect(validateVethLink(linkObj)).to.deep.equal([]);
  });

  it('should return error for missing endpoints', () => {
    const linkObj = { type: 'veth', endpoints: [] };
    expect(validateVethLink(linkObj)).to.include(ERROR_INVALID_VETH);
  });

  it('should return error for only one endpoint', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [{ node: NODE_ROUTER1, interface: INTERFACE_ETH0 }]
    };
    expect(validateVethLink(linkObj)).to.include(ERROR_INVALID_VETH);
  });

  it('should return error for string endpoints', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [`${NODE_ROUTER1}:${INTERFACE_ETH0}`, `${NODE_ROUTER2}:${INTERFACE_ETH1}`]
    };
    expect(validateVethLink(linkObj)).to.include(ERROR_INVALID_VETH);
  });

  it('should return error for endpoint missing node', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [
        { interface: INTERFACE_ETH0 },
        { node: NODE_ROUTER2, interface: INTERFACE_ETH1 }
      ]
    };
    expect(validateVethLink(linkObj)).to.include(ERROR_INVALID_VETH);
  });
});

/**
 * Tests for EdgeElementBuilder - validateSpecialLink function
 */
describe('EdgeElementBuilder - validateSpecialLink', () => {
  it('should return empty array for valid host link', () => {
    const linkObj = {
      type: 'host',
      endpoint: { node: NODE_ROUTER1, interface: INTERFACE_ETH0 },
      'host-interface': HOST_INTERFACE_VETH
    };
    expect(validateSpecialLink('host', linkObj)).to.deep.equal([]);
  });

  it('should return error for missing endpoint', () => {
    const linkObj = {
      type: 'host',
      'host-interface': HOST_INTERFACE_VETH
    };
    expect(validateSpecialLink('host', linkObj)).to.include('invalid-endpoint');
  });

  it('should return error for missing host-interface', () => {
    const linkObj = {
      type: 'host',
      endpoint: { node: NODE_ROUTER1, interface: INTERFACE_ETH0 }
    };
    expect(validateSpecialLink('host', linkObj)).to.include('missing-host-interface');
  });

  it('should validate vxlan link with required fields', () => {
    const validVxlan = {
      type: 'vxlan',
      endpoint: { node: NODE_ROUTER1, interface: INTERFACE_ETH0 },
      remote: REMOTE_IP,
      vni: 100,
      'dst-port': 4789
    };
    expect(validateSpecialLink('vxlan', validVxlan)).to.deep.equal([]);
  });

  it('should return errors for vxlan link missing required fields', () => {
    const invalidVxlan = {
      type: 'vxlan',
      endpoint: { node: NODE_ROUTER1, interface: INTERFACE_ETH0 }
    };
    const errors = validateSpecialLink('vxlan', invalidVxlan);
    expect(errors).to.include('missing-remote');
    expect(errors).to.include('missing-vni');
    expect(errors).to.include('missing-dst-port');
  });
});

/**
 * Tests for EdgeElementBuilder - validateExtendedLink function
 */
describe('EdgeElementBuilder - validateExtendedLink', () => {
  it('should return empty array for link without type', () => {
    const linkObj = { endpoints: [`${NODE_ROUTER1}:${INTERFACE_ETH0}`] };
    expect(validateExtendedLink(linkObj)).to.deep.equal([]);
  });

  it('should validate veth links', () => {
    const linkObj = {
      type: 'veth',
      endpoints: [
        { node: NODE_ROUTER1, interface: INTERFACE_ETH0 },
        { node: NODE_ROUTER2, interface: INTERFACE_ETH1 }
      ]
    };
    expect(validateExtendedLink(linkObj)).to.deep.equal([]);
  });

  it('should validate single-endpoint links', () => {
    const linkObj = {
      type: 'host',
      endpoint: { node: NODE_ROUTER1, interface: INTERFACE_ETH0 },
      'host-interface': HOST_INTERFACE_VETH
    };
    expect(validateExtendedLink(linkObj)).to.deep.equal([]);
  });
});

/**
 * Tests for EdgeElementBuilder - extractEdgeInterfaceStats function
 */
describe('EdgeElementBuilder - extractEdgeInterfaceStats', () => {
  it('should extract stats from interface data', () => {
    const ifaceData = {
      rxBps: 1000,
      txBps: 2000,
      rxPackets: 100,
      txPackets: 200
    };
    const result = extractEdgeInterfaceStats(ifaceData);
    expect(result).to.deep.include({ rxBps: 1000, txBps: 2000 });
  });

  it('should extract stats from nested stats object', () => {
    const ifaceData = {
      stats: {
        rxBps: 1000,
        txBps: 2000
      }
    };
    const result = extractEdgeInterfaceStats(ifaceData);
    expect(result).to.deep.include({ rxBps: 1000, txBps: 2000 });
  });

  it('should return undefined for missing data', () => {
    expect(extractEdgeInterfaceStats(undefined)).to.be.undefined;
    expect(extractEdgeInterfaceStats(null)).to.be.undefined;
  });

  it('should filter out non-numeric values', () => {
    const ifaceData = {
      rxBps: 'invalid',
      txBps: 2000
    };
    const result = extractEdgeInterfaceStats(ifaceData);
    expect(result).to.not.have.property('rxBps');
    expect(result).to.have.property('txBps', 2000);
  });

  it('should return undefined for empty stats', () => {
    const ifaceData = { otherField: 'value' };
    expect(extractEdgeInterfaceStats(ifaceData)).to.be.undefined;
  });
});

/**
 * Tests for EdgeElementBuilder - createClabInfo function
 */
describe('EdgeElementBuilder - createClabInfo', () => {
  it('should create basic clab info', () => {
    const result = createClabInfo({
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1
    });

    expect(result.clabSourceLongName).to.equal(CONTAINER_ROUTER1);
    expect(result.clabTargetLongName).to.equal(CONTAINER_ROUTER2);
    expect(result.clabSourcePort).to.equal(INTERFACE_ETH0);
    expect(result.clabTargetPort).to.equal(INTERFACE_ETH1);
  });

  it('should include MAC addresses from interface data', () => {
    const result = createClabInfo({
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      sourceIfaceData: { mac: MAC_ADDRESS_1 },
      targetIfaceData: { mac: MAC_ADDRESS_2 }
    });

    expect(result.clabSourceMacAddress).to.equal(MAC_ADDRESS_1);
    expect(result.clabTargetMacAddress).to.equal(MAC_ADDRESS_2);
  });

  it('should include interface states', () => {
    const result = createClabInfo({
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      sourceIfaceData: { state: STATE_UP },
      targetIfaceData: { state: STATE_DOWN }
    });

    expect(result.clabSourceInterfaceState).to.equal(STATE_UP);
    expect(result.clabTargetInterfaceState).to.equal(STATE_DOWN);
  });

  it('should include stats when available', () => {
    const result = createClabInfo({
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      sourceIfaceData: { rxBps: 1000 },
      targetIfaceData: { txBps: 2000 }
    });

    expect(result.clabSourceStats).to.deep.include({ rxBps: 1000 });
    expect(result.clabTargetStats).to.deep.include({ txBps: 2000 });
  });
});

/**
 * Tests for EdgeElementBuilder - extractExtLinkProps function
 */
describe('EdgeElementBuilder - extractExtLinkProps', () => {
  it('should extract extended link properties', () => {
    const linkObj = {
      type: 'vxlan',
      mtu: 1500,
      remote: REMOTE_IP,
      vni: 100,
      'dst-port': 4789,
      'src-port': 0
    };
    const result = extractExtLinkProps(linkObj);

    expect(result.extType).to.equal('vxlan');
    expect(result.extMtu).to.equal(1500);
    expect(result.extRemote).to.equal(REMOTE_IP);
    expect(result.extVni).to.equal(100);
    expect(result.extDstPort).to.equal(4789);
    expect(result.extSrcPort).to.equal(0);
  });

  it('should handle missing properties', () => {
    const result = extractExtLinkProps({});
    expect(result.extType).to.equal('');
    expect(result.extMtu).to.equal('');
    expect(result.extRemote).to.equal('');
  });

  it('should handle null/undefined input', () => {
    const result = extractExtLinkProps(null);
    expect(result.extType).to.equal('');
  });

  it('should extract host-interface', () => {
    const linkObj = { type: 'host', 'host-interface': HOST_INTERFACE_VETH };
    const result = extractExtLinkProps(linkObj);
    expect(result.extHostInterface).to.equal(HOST_INTERFACE_VETH);
  });
});

/**
 * Tests for EdgeElementBuilder - extractExtMacs function
 */
describe('EdgeElementBuilder - extractExtMacs', () => {
  it('should extract MAC from object endpoints', () => {
    const endA = { node: NODE_ROUTER1, interface: INTERFACE_ETH0, mac: MAC_ADDRESS_1 };
    const endB = { node: NODE_ROUTER2, interface: INTERFACE_ETH1, mac: MAC_ADDRESS_2 };
    const result = extractExtMacs({}, endA, endB);

    expect(result.extSourceMac).to.equal(MAC_ADDRESS_1);
    expect(result.extTargetMac).to.equal(MAC_ADDRESS_2);
  });

  it('should handle string endpoints', () => {
    const result = extractExtMacs({}, `${NODE_ROUTER1}:${INTERFACE_ETH0}`, `${NODE_ROUTER2}:${INTERFACE_ETH1}`);
    expect(result.extSourceMac).to.equal('');
    expect(result.extTargetMac).to.equal('');
  });

  it('should extract extMac from single-endpoint link', () => {
    const linkObj = {
      type: 'host',
      endpoint: { node: NODE_ROUTER1, interface: INTERFACE_ETH0, mac: MAC_ADDRESS_1 }
    };
    const result = extractExtMacs(linkObj, '', '');
    expect(result.extMac).to.equal(MAC_ADDRESS_1);
  });
});

/**
 * Tests for EdgeElementBuilder - createExtInfo function
 */
describe('EdgeElementBuilder - createExtInfo', () => {
  it('should combine link props and MACs', () => {
    const linkObj = { type: 'veth', mtu: 1500 };
    const endA = { node: NODE_ROUTER1, interface: INTERFACE_ETH0, mac: MAC_ADDRESS_1 };
    const endB = { node: NODE_ROUTER2, interface: INTERFACE_ETH1, mac: MAC_ADDRESS_2 };

    const result = createExtInfo({ linkObj, endA, endB });

    expect(result.extType).to.equal('veth');
    expect(result.extMtu).to.equal(1500);
    expect(result.extSourceMac).to.equal(MAC_ADDRESS_1);
    expect(result.extTargetMac).to.equal(MAC_ADDRESS_2);
  });
});

/**
 * Tests for EdgeElementBuilder - buildEdgeClasses function
 */
describe('EdgeElementBuilder - buildEdgeClasses', () => {
  it('should add stub-link class for special nodes', () => {
    const specialNodes = new Map([[SPECIAL_HOST_ETH0, { type: 'host', label: 'Host' }]]);
    const result = buildEdgeClasses(CLASS_LINK_UP, specialNodes, SPECIAL_HOST_ETH0, NODE_ROUTER1);
    expect(result).to.include('stub-link');
    expect(result).to.include(CLASS_LINK_UP);
  });

  it('should not add stub-link class for regular nodes', () => {
    const specialNodes = new Map();
    const result = buildEdgeClasses(CLASS_LINK_UP, specialNodes, NODE_ROUTER1, NODE_ROUTER2);
    expect(result).to.not.include('stub-link');
  });

  it('should add stub-link when target is special', () => {
    const specialNodes = new Map([[SPECIAL_MGMT_NET_BR0, { type: 'mgmt-net', label: 'Mgmt' }]]);
    const result = buildEdgeClasses('', specialNodes, NODE_ROUTER1, SPECIAL_MGMT_NET_BR0);
    expect(result).to.include('stub-link');
  });
});

/**
 * Tests for EdgeElementBuilder - buildEdgeExtraData function
 */
describe('EdgeElementBuilder - buildEdgeExtraData', () => {
  it('should build extra data with short yaml format', () => {
    const result = buildEdgeExtraData({
      linkObj: {},
      endA: `${NODE_ROUTER1}:${INTERFACE_ETH0}`,
      endB: `${NODE_ROUTER2}:${INTERFACE_ETH1}`,
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      sourceIfaceData: {},
      targetIfaceData: {},
      extValidationErrors: [],
      sourceNodeId: NODE_ROUTER1,
      targetNodeId: NODE_ROUTER2
    });

    expect(result.yamlFormat).to.equal('short');
    expect(result.yamlSourceNodeId).to.equal(NODE_ROUTER1);
    expect(result.yamlTargetNodeId).to.equal(NODE_ROUTER2);
  });

  it('should build extra data with extended yaml format', () => {
    const result = buildEdgeExtraData({
      linkObj: { type: 'veth' },
      endA: `${NODE_ROUTER1}:${INTERFACE_ETH0}`,
      endB: `${NODE_ROUTER2}:${INTERFACE_ETH1}`,
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      sourceIfaceData: {},
      targetIfaceData: {},
      extValidationErrors: [],
      sourceNodeId: NODE_ROUTER1,
      targetNodeId: NODE_ROUTER2
    });

    expect(result.yamlFormat).to.equal('extended');
  });

  it('should include validation errors when present', () => {
    const result = buildEdgeExtraData({
      linkObj: { type: 'veth' },
      endA: `${NODE_ROUTER1}:${INTERFACE_ETH0}`,
      endB: `${NODE_ROUTER2}:${INTERFACE_ETH1}`,
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      sourceIfaceData: {},
      targetIfaceData: {},
      extValidationErrors: ['error1', 'error2'],
      sourceNodeId: NODE_ROUTER1,
      targetNodeId: NODE_ROUTER2
    });

    expect(result.extValidationErrors).to.deep.equal(['error1', 'error2']);
  });
});

/**
 * Tests for EdgeElementBuilder - buildEdgeElement function
 */
describe('EdgeElementBuilder - buildEdgeElement', () => {
  it('should build edge element with correct structure', () => {
    const specialNodes = new Map();
    const result = buildEdgeElement({
      linkObj: {},
      endA: `${NODE_ROUTER1}:${INTERFACE_ETH0}`,
      endB: `${NODE_ROUTER2}:${INTERFACE_ETH1}`,
      sourceNode: NODE_ROUTER1,
      targetNode: NODE_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      actualSourceNode: NODE_ROUTER1,
      actualTargetNode: NODE_ROUTER2,
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIfaceData: {},
      targetIfaceData: {},
      edgeId: EDGE_ID_0,
      edgeClass: CLASS_LINK_UP,
      specialNodes
    });

    expect(result.group).to.equal('edges');
    expect(result.data.id).to.equal(EDGE_ID_0);
    expect(result.data.source).to.equal(NODE_ROUTER1);
    expect(result.data.target).to.equal(NODE_ROUTER2);
    expect(result.data.sourceEndpoint).to.equal(INTERFACE_ETH0);
    expect(result.data.targetEndpoint).to.equal(INTERFACE_ETH1);
    expect(result.data.topoViewerRole).to.equal('link');
  });

  it('should omit endpoint for special nodes', () => {
    const specialNodes = new Map([[SPECIAL_HOST_ETH0, { type: 'host', label: 'Host' }]]);
    const result = buildEdgeElement({
      linkObj: {},
      endA: `${NODE_ROUTER1}:${INTERFACE_ETH0}`,
      endB: SPECIAL_HOST_ETH0,
      sourceNode: 'host',
      targetNode: NODE_ROUTER1,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH0,
      actualSourceNode: SPECIAL_HOST_ETH0,
      actualTargetNode: NODE_ROUTER1,
      sourceContainerName: SPECIAL_HOST_ETH0,
      targetContainerName: CONTAINER_ROUTER1,
      sourceIfaceData: {},
      targetIfaceData: {},
      edgeId: EDGE_ID_0,
      edgeClass: '',
      specialNodes
    });

    expect(result.data.sourceEndpoint).to.equal('');
  });

  it('should set correct edge properties', () => {
    const specialNodes = new Map();
    const result = buildEdgeElement({
      linkObj: {},
      endA: `${NODE_ROUTER1}:${INTERFACE_ETH0}`,
      endB: `${NODE_ROUTER2}:${INTERFACE_ETH1}`,
      sourceNode: NODE_ROUTER1,
      targetNode: NODE_ROUTER2,
      sourceIface: INTERFACE_ETH0,
      targetIface: INTERFACE_ETH1,
      actualSourceNode: NODE_ROUTER1,
      actualTargetNode: NODE_ROUTER2,
      sourceContainerName: CONTAINER_ROUTER1,
      targetContainerName: CONTAINER_ROUTER2,
      sourceIfaceData: {},
      targetIfaceData: {},
      edgeId: EDGE_ID_0,
      edgeClass: CLASS_LINK_UP,
      specialNodes
    });

    expect(result.selectable).to.be.true;
    expect(result.grabbable).to.be.true;
    expect(result.removed).to.be.false;
    expect(result.selected).to.be.false;
    expect(result.locked).to.be.false;
    expect(result.grabbed).to.be.false;
  });
});
