/* eslint-env mocha */
/* eslint-disable aggregate-complexity/aggregate-complexity */
/* global describe, it, after, afterEach, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import Module from 'module';
import path from 'path';

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request === 'vscode') {
    return path.join(__dirname, '..', '..', 'helpers', 'vscode-stub.js');
  }
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

import { TopoViewerAdaptorClab } from '../../../src/topoViewer/extension/services/TopologyAdapter';
import * as treeUtils from '../../../src/topoViewer/extension/services/TreeUtils';

describe('TopoViewerAdaptorClab expanded tests', () => {
  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('clabYamlToCytoscapeElementsEditor', () => {
    it('returns empty array for topology without nodes', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = 'name: empty\ntopology: {}\n';
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements).to.be.an('array');
      expect(elements.length).to.equal(0);
    });

    it('handles topology without links', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements).to.have.length.greaterThan(0);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node).to.exist;
      expect(node?.data?.extraData?.kind).to.equal('linux');
    });

    it('handles multiple node kinds', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    srl1:
      kind: nokia_srlinux
      type: ixr6
    ceos1:
      kind: ceos
    linux1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const srl = elements.find(el => el.data?.id === 'srl1');
      const ceos = elements.find(el => el.data?.id === 'ceos1');
      const linux = elements.find(el => el.data?.id === 'linux1');
      expect(srl?.data?.extraData?.kind).to.equal('nokia_srlinux');
      expect(srl?.data?.extraData?.type).to.equal('ixr6');
      expect(ceos?.data?.extraData?.kind).to.equal('ceos');
      expect(linux?.data?.extraData?.kind).to.equal('linux');
    });

    it('handles host endpoint links', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: host
      endpoint: node1:eth0
      host-interface: enp0s3
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      // Should have node, host cloud node, and edge
      const hostNode = elements.find(el => el.data?.id?.startsWith('host:'));
      expect(hostNode).to.exist;
      expect(hostNode?.data?.topoViewerRole).to.equal('cloud');
    });

    it('handles mgmt-net endpoint links', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: mgmt-net
      endpoint: node1:eth0
      host-interface: eth0
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const mgmtNode = elements.find(el => el.data?.id?.startsWith('mgmt-net:'));
      expect(mgmtNode).to.exist;
    });

    it('handles macvlan links', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: macvlan
      endpoint: node1:macvlan0
      host-interface: eth0
      mode: bridge
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const macvlanNode = elements.find(el => el.data?.id?.startsWith('macvlan:'));
      expect(macvlanNode).to.exist;
    });

    it('handles topology with defaults section', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  defaults:
    kind: linux
    image: debian:latest
  nodes:
    node1: {}
    node2: {}
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node1 = elements.find(el => el.data?.id === 'node1');
      expect(node1?.data?.extraData?.kind).to.equal('linux');
    });

    it('handles groups definition', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  groups:
    spine:
      nodes:
        - spine1
        - spine2
    leaf:
      nodes:
        - leaf1
  nodes:
    spine1:
      kind: nokia_srlinux
    spine2:
      kind: nokia_srlinux
    leaf1:
      kind: nokia_srlinux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });
  });

  describe('clabYamlToCytoscapeElements with container data', () => {
    it('includes mgmt IP addresses when tree data is provided', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      sinon.stub(treeUtils, 'findContainerNode').returns({
        IPv4Address: '172.20.20.2',
        IPv6Address: '2001:db8::2',
        state: 'running',
        interfaces: []
      } as any);

      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElements(yaml, {});
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node?.data?.extraData?.mgmtIpv4Address).to.equal('172.20.20.2');
      expect(node?.data?.extraData?.mgmtIpv6Address).to.equal('2001:db8::2');
    });

    it('handles missing container data gracefully', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      sinon.stub(treeUtils, 'findContainerNode').returns(undefined);

      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElements(yaml, {});
      const node = elements.find(el => el.data?.id === 'node1');
      // Should still create the node even without container data
      expect(node).to.exist;
    });
  });

  describe('computeEdgeClassFromStates', () => {
    it('returns empty string when both states are undefined', () => {
      const adaptor = new TopoViewerAdaptorClab();
      const topology = { nodes: { n1: {}, n2: {} } };
      // Omit optional parameters to test undefined state handling
      const result = adaptor.computeEdgeClassFromStates(topology, 'n1', 'n2');
      expect(result).to.equal('');
    });

    it('returns link-down when either state is down', () => {
      const adaptor = new TopoViewerAdaptorClab();
      const topology = { nodes: { n1: {}, n2: {} } };
      const result = adaptor.computeEdgeClassFromStates(topology, 'n1', 'n2', 'DOWN', 'up');
      expect(result).to.equal('link-down');
    });

    it('returns link-up when both states are up', () => {
      const adaptor = new TopoViewerAdaptorClab();
      const topology = { nodes: { n1: {}, n2: {} } };
      const result = adaptor.computeEdgeClassFromStates(topology, 'n1', 'n2', 'up', 'up');
      expect(result).to.equal('link-up');
    });
  });

  describe('currentIsPresetLayout property', () => {
    it('defaults to false', () => {
      const adaptor = new TopoViewerAdaptorClab();
      expect(adaptor.currentIsPresetLayout).to.be.false;
    });

    it('remains false when no position annotations exist', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
      // Without position annotations, preset layout should remain false
      await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      // The preset layout is only true when annotations have positions
      // Since we're not providing yamlFilePath, annotations won't be loaded
      expect(adaptor.currentIsPresetLayout).to.be.false;
    });
  });

  describe('vxlan links', () => {
    it('handles vxlan link type', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: vxlan
      endpoint: node1:vxlan0
      remote: 192.168.1.1
      vni: 1000
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const vxlanNode = elements.find(el => el.data?.id?.startsWith('vxlan:'));
      expect(vxlanNode).to.exist;
    });

    it('handles vxlan-stitch link type', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: vxlan-stitch
      endpoint: node1:vxlan0
      remote: 192.168.1.1
      vni: 2000
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });
  });

  describe('complex topologies', () => {
    it('handles leaf-spine topology', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: leaf-spine
topology:
  nodes:
    spine1:
      kind: nokia_srlinux
    spine2:
      kind: nokia_srlinux
    leaf1:
      kind: nokia_srlinux
    leaf2:
      kind: nokia_srlinux
  links:
    - endpoints: ["spine1:e1-1", "leaf1:e1-49"]
    - endpoints: ["spine1:e1-2", "leaf2:e1-49"]
    - endpoints: ["spine2:e1-1", "leaf1:e1-50"]
    - endpoints: ["spine2:e1-2", "leaf2:e1-50"]
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const nodes = elements.filter(el => el.group === 'nodes');
      const edges = elements.filter(el => el.group === 'edges');
      expect(nodes).to.have.length(4);
      expect(edges).to.have.length(4);
    });

    it('handles self-loops', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - endpoints: ["node1:eth0", "node1:eth1"]
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const edge = elements.find(el => el.group === 'edges');
      expect(edge?.data?.source).to.equal('node1');
      expect(edge?.data?.target).to.equal('node1');
    });
  });

  describe('special kinds', () => {
    it('handles vr-sros kind', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    sros1:
      kind: vr-sros
      type: sr-1
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'sros1');
      expect(node?.data?.extraData?.kind).to.equal('vr-sros');
    });

    it('handles sonic-vs kind', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    sonic1:
      kind: sonic-vs
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'sonic1');
      expect(node?.data?.extraData?.kind).to.equal('sonic-vs');
    });
  });

  describe('extended endpoint format', () => {
    it('handles endpoints with mac addresses', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
    node2:
      kind: linux
  links:
    - endpoints:
        - node: node1
          interface: eth0
          mac: 00:11:22:33:44:55
        - node: node2
          interface: eth0
          mac: 66:77:88:99:aa:bb
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const edge = elements.find(el => el.group === 'edges');
      expect(edge).to.exist;
    });
  });

  describe('label-based positioning migration', () => {
    it('detects nodes with graph-posX and graph-posY labels', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-posX: "100"
        graph-posY: "200"
`;
      // The migration logic should be triggered when loading annotations
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });

    it('detects nodes with graph-icon label', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-icon: router
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });

    it('detects nodes with graph-group label', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-group: spines
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });
  });

  describe('property initialization', () => {
    it('initializes with undefined currentClabTopo', () => {
      const adaptor = new TopoViewerAdaptorClab();
      expect(adaptor.currentClabTopo).to.be.undefined;
    });

    it('initializes with undefined currentClabDoc', () => {
      const adaptor = new TopoViewerAdaptorClab();
      expect(adaptor.currentClabDoc).to.be.undefined;
    });

    it('initializes with undefined currentClabName', () => {
      const adaptor = new TopoViewerAdaptorClab();
      expect(adaptor.currentClabName).to.be.undefined;
    });

    it('initializes with undefined currentClabPrefix', () => {
      const adaptor = new TopoViewerAdaptorClab();
      expect(adaptor.currentClabPrefix).to.be.undefined;
    });

    it('initializes with undefined allowedhostname', () => {
      const adaptor = new TopoViewerAdaptorClab();
      expect(adaptor.allowedhostname).to.be.undefined;
    });
  });

  describe('bridge kind handling', () => {
    it('handles bridge nodes correctly', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    br1:
      kind: bridge
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'br1');
      expect(node).to.exist;
      expect(node?.data?.topoViewerRole).to.equal('bridge');
    });

    it('handles ovs-bridge nodes correctly', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    ovs1:
      kind: ovs-bridge
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'ovs1');
      expect(node).to.exist;
      expect(node?.data?.topoViewerRole).to.equal('bridge');
    });
  });

  describe('ipvlan links', () => {
    it('handles ipvlan link type', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
  links:
    - type: ipvlan
      endpoint: node1:ipvlan0
      host-interface: eth0
      mode: l2
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });
  });

  describe('prefix handling', () => {
    it('handles custom prefix', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
prefix: myprefix
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node?.data?.extraData?.labdir).to.equal('myprefix-test/');
    });

    it('handles empty prefix', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
prefix: ""
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node?.data?.extraData?.labdir).to.equal('');
    });

    it('handles whitespace-only prefix', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
prefix: "   "
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node?.data?.extraData?.labdir).to.equal('');
    });

    it('uses default clab prefix when not specified', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node?.data?.extraData?.labdir).to.equal('clab-test/');
    });
  });

  describe('kinds defaults', () => {
    it('handles kind-specific defaults', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  kinds:
    linux:
      image: debian:latest
  nodes:
    node1:
      kind: linux
    node2:
      kind: linux
      image: ubuntu:latest
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node1 = elements.find(el => el.data?.id === 'node1');
      const node2 = elements.find(el => el.data?.id === 'node2');
      expect(node1?.data?.extraData?.image).to.equal('debian:latest');
      expect(node2?.data?.extraData?.image).to.equal('ubuntu:latest');
    });
  });

  describe('edge state handling', () => {
    it('returns link-down when source state is down', () => {
      const adaptor = new TopoViewerAdaptorClab();
      const topology = { nodes: { n1: {}, n2: {} } };
      const result = adaptor.computeEdgeClassFromStates(topology, 'n1', 'n2', 'down', 'up');
      expect(result).to.equal('link-down');
    });

    it('returns link-down when target state is down', () => {
      const adaptor = new TopoViewerAdaptorClab();
      const topology = { nodes: { n1: {}, n2: {} } };
      const result = adaptor.computeEdgeClassFromStates(topology, 'n1', 'n2', 'up', 'down');
      expect(result).to.equal('link-down');
    });

    it('returns link-down with uppercase DOWN state', () => {
      const adaptor = new TopoViewerAdaptorClab();
      const topology = { nodes: { n1: {}, n2: {} } };
      const result = adaptor.computeEdgeClassFromStates(topology, 'n1', 'n2', 'UP', 'DOWN');
      expect(result).to.equal('link-down');
    });
  });

  describe('topology without name', () => {
    it('handles topology without name', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
topology:
  nodes:
    node1:
      kind: linux
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
    });
  });

  describe('empty node object', () => {
    it('handles node with empty object value', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1: {}
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      expect(elements.length).to.be.greaterThan(0);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node).to.exist;
    });
  });

  describe('node labels sanitization', () => {
    it('removes graph-* labels from extraData', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-posX: "100"
        graph-posY: "200"
        custom-label: "value"
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'node1');
      expect(node?.data?.extraData?.labels).to.not.have.property('graph-posX');
      expect(node?.data?.extraData?.labels).to.not.have.property('graph-posY');
      expect(node?.data?.extraData?.labels).to.have.property('custom-label', 'value');
    });

    it('handles all graph-* labels for removal', async () => {
      const adaptor = new TopoViewerAdaptorClab();
      const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-posX: "100"
        graph-posY: "200"
        graph-icon: "router"
        graph-geoCoordinateLat: "51.5"
        graph-geoCoordinateLng: "-0.12"
        graph-groupLabelPos: "top"
        graph-group: "spines"
        graph-level: "1"
`;
      const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
      const node = elements.find(el => el.data?.id === 'node1');
      const labels = node?.data?.extraData?.labels;
      expect(labels).to.not.have.property('graph-posX');
      expect(labels).to.not.have.property('graph-posY');
      expect(labels).to.not.have.property('graph-icon');
      expect(labels).to.not.have.property('graph-geoCoordinateLat');
      expect(labels).to.not.have.property('graph-geoCoordinateLng');
      expect(labels).to.not.have.property('graph-groupLabelPos');
      expect(labels).to.not.have.property('graph-group');
      expect(labels).to.not.have.property('graph-level');
    });
  });
});
