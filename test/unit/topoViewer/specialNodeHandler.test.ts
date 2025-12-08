/* eslint-env mocha */
/* global describe, it */
import { expect } from 'chai';
import {
  addCloudNodes,
  collectSpecialNodes,
  type SpecialNodeInfo
} from '../../../src/topoViewer/extension/services/SpecialNodeHandler';
import { DummyContext } from '../../../src/topoViewer/extension/services/LinkParser';
import type { ClabTopology, CyElement } from '../../../src/topoViewer/shared/types/topoViewerType';

// Common test constants
const HOST_INTERFACE = 'eno1';
const MGMT_INTERFACE = 'br-mgmt';
const MACVLAN_INTERFACE = 'enp0s3';
const VXLAN_REMOTE = '192.0.2.1';
const VXLAN_VNI = 100;
const BRIDGE_NODE = 'bridgeA';
const OVS_NODE = 'ovs1';
const DUMMY_TARGET = 'leaf2:eth4';

/**
 * Creates a dummy link parsing context
 */
function createDummyContext(): DummyContext {
  return { dummyCounter: 0, dummyLinkMap: new Map() };
}

/**
 * Helper to build a topology object with links and optional nodes
 */
function buildTopology(links: any[], nodes?: Record<string, any>): ClabTopology {
  return {
    name: 'test',
    topology: { nodes: nodes ?? {}, links }
  } as unknown as ClabTopology;
}

/**
 * Tests for collecting special nodes and props
 */
describe('SpecialNodeHandler - collectSpecialNodes', () => {
  it('collects special endpoints and merges properties', () => {
    const links = [
      { type: 'host', endpoint: 'node1:eth0', 'host-interface': HOST_INTERFACE },
      { type: 'mgmt-net', endpoint: { node: 'node2', interface: 'eth1' }, 'host-interface': MGMT_INTERFACE },
      {
        type: 'macvlan',
        endpoint: { node: 'node3', interface: 'eth2', mac: '00:aa:bb:cc:dd:ee' },
        'host-interface': MACVLAN_INTERFACE,
        mode: 'bridge'
      },
      {
        type: 'vxlan',
        endpoint: { node: 'node4', interface: 'eth3' },
        remote: VXLAN_REMOTE,
        vni: VXLAN_VNI,
        'dst-port': 4789
      },
      { type: 'dummy', endpoint: DUMMY_TARGET },
      { type: 'veth', endpoints: ['node6:eth0', 'node7:eth1'] }
    ];
    const topology = buildTopology(links, {
      [BRIDGE_NODE]: { kind: 'bridge' },
      [OVS_NODE]: { kind: 'ovs-bridge' },
      regular: { kind: 'linux' }
    });

    const { specialNodes, specialNodeProps } = collectSpecialNodes(topology, createDummyContext());

    expect([...specialNodes.keys()]).to.include.members([
      `host:${HOST_INTERFACE}`,
      `mgmt-net:${MGMT_INTERFACE}`,
      `macvlan:${MACVLAN_INTERFACE}`,
      `vxlan:${VXLAN_REMOTE}/${VXLAN_VNI}/4789/`,
      'dummy1',
      BRIDGE_NODE,
      OVS_NODE
    ]);
    expect(specialNodes.get(`macvlan:${MACVLAN_INTERFACE}`)?.type).to.equal('macvlan');
    expect(specialNodes.get(BRIDGE_NODE)?.type).to.equal('bridge');

    expect(specialNodeProps.get(`macvlan:${MACVLAN_INTERFACE}`)).to.deep.include({
      extType: 'macvlan',
      extHostInterface: MACVLAN_INTERFACE,
      extMode: 'bridge',
      extMac: '00:aa:bb:cc:dd:ee'
    });
    expect(specialNodeProps.get(`vxlan:${VXLAN_REMOTE}/${VXLAN_VNI}/4789/`)).to.deep.include({
      extType: 'vxlan',
      extRemote: VXLAN_REMOTE,
      extVni: VXLAN_VNI,
      extDstPort: 4789
    });
    expect(specialNodeProps.get(`host:${HOST_INTERFACE}`)).to.deep.include({
      extType: 'host',
      extHostInterface: HOST_INTERFACE
    });
  });
});

/**
 * Tests for creating cloud node elements
 */
describe('SpecialNodeHandler - cloud node creation', () => {
  it('creates cloud nodes with annotation placement and extra props', () => {
    const specialNodes: Map<string, SpecialNodeInfo> = new Map([
      [`host:${HOST_INTERFACE}`, { type: 'host', label: 'Host' }],
      [`macvlan:${MACVLAN_INTERFACE}`, { type: 'macvlan', label: 'Macvlan' }],
      [BRIDGE_NODE, { type: 'bridge', label: 'Bridge Node' }]
    ]);
    const specialNodeProps = new Map<string, any>([
      [`host:${HOST_INTERFACE}`, { extType: 'host', extHostInterface: HOST_INTERFACE }],
      [`macvlan:${MACVLAN_INTERFACE}`, { extType: 'macvlan', extMode: 'bridge' }]
    ]);
    const annotations = {
      cloudNodeAnnotations: [
        {
          id: `host:${HOST_INTERFACE}`,
          position: { x: 50, y: 75 },
          group: 'core',
          level: '2',
          label: 'Host Cloud'
        },
        {
          id: `macvlan:${MACVLAN_INTERFACE}`,
          position: { x: 10, y: 20 }
        }
      ]
    };
    const elements: CyElement[] = [];

    addCloudNodes(specialNodes, specialNodeProps, { annotations }, elements, new Set([BRIDGE_NODE]));

    expect(elements).to.have.length(2);
    const hostNode = elements.find(el => el.data.id === `host:${HOST_INTERFACE}`);
    const macvlanNode = elements.find(el => el.data.id === `macvlan:${MACVLAN_INTERFACE}`);

    expect(hostNode?.data.parent).to.equal('core:2');
    expect(hostNode?.position).to.deep.equal({ x: 50, y: 75 });
    expect(hostNode?.data.name).to.equal('Host Cloud');
    expect(hostNode?.data.extraData.extHostInterface).to.equal(HOST_INTERFACE);

    expect(macvlanNode?.data.parent).to.be.undefined;
    expect(macvlanNode?.position).to.deep.equal({ x: 10, y: 20 });
    expect(macvlanNode?.data.extraData.extMode).to.equal('bridge');
  });
});
