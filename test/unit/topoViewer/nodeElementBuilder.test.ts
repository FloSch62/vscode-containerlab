/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import {
  addGroupNodes,
  addNodeElements,
  buildParent,
  computeFullPrefix,
  isPresetLayout
} from '../../../src/topoViewer/extension/services/NodeElementBuilder';
import type { ClabTopology, CyElement } from '../../../src/topoViewer/shared/types/topoViewerType';
import type { ClabContainerTreeNode, ClabLabTreeNode } from '../../../src/treeView/common';

// Common constants
const CLAB_NAME = 'testlab';
const FULL_PREFIX = 'clab-testlab';

/**
 * Helpers to build minimal topology and tree data
 */
function createTopology(nodes: Record<string, any>): ClabTopology {
  return { name: CLAB_NAME, topology: { nodes } } as unknown as ClabTopology;
}

function createContainerData(): ClabContainerTreeNode {
  return {
    name: `${FULL_PREFIX}-node1`,
    name_short: 'node1',
    label: 'node1',
    cID: 'cid1',
    state: 'running',
    kind: 'linux',
    image: 'alpine',
    interfaces: [],
    labPath: { absolute: '/labs/test', relative: 'test' },
    IPv4Address: '10.0.0.1',
    IPv6Address: '2001::1'
  } as unknown as ClabContainerTreeNode;
}

function createClabTreeData(container: ClabContainerTreeNode): Record<string, ClabLabTreeNode> {
  return {
    [CLAB_NAME]: {
      name: CLAB_NAME,
      containers: [container]
    } as unknown as ClabLabTreeNode
  };
}

/**
 * Layout helper tests
 */
describe('NodeElementBuilder - layout helpers', () => {
  it('detects preset layout when all nodes have positions', () => {
    const parsed = createTopology({
      node1: {},
      node2: {}
    });
    const annotations = {
      nodeAnnotations: [
        { id: 'node1', position: { x: 1, y: 2 } },
        { id: 'node2', position: { x: 3, y: 4 } }
      ]
    };

    expect(isPresetLayout(parsed, annotations)).to.be.true;
  });

  it('computes full prefix from parsed prefix values', () => {
    const parsedDefault = { name: CLAB_NAME, prefix: undefined } as unknown as ClabTopology;
    const parsedEmpty = { name: CLAB_NAME, prefix: '   ' } as unknown as ClabTopology;
    const parsedCustom = { name: CLAB_NAME, prefix: 'edge' } as unknown as ClabTopology;

    expect(computeFullPrefix(parsedDefault, CLAB_NAME)).to.equal(`clab-${CLAB_NAME}`);
    expect(computeFullPrefix(parsedEmpty, CLAB_NAME)).to.equal('');
    expect(computeFullPrefix(parsedCustom, CLAB_NAME)).to.equal('edge-testlab');
  });

  it('builds parent ids from annotations and labels', () => {
    const nodeObj = { labels: { 'topoViewer-group': 'core', 'topoViewer-groupLevel': '2' } };
    const nodeAnn = { group: 'agg', level: '1' };

    expect(buildParent(nodeObj as any)).to.equal('core:2');
    expect(buildParent(nodeObj as any, nodeAnn)).to.equal('agg:1');
    expect(buildParent({ labels: {} } as any)).to.equal('');
  });
});

/**
 * Element building tests
 */
describe('NodeElementBuilder - element building', () => {
  it('adds nodes with container data and groups, then creates group nodes', () => {
    const parsed = createTopology({
      node1: { kind: 'linux', labels: { 'topoViewer-group': 'grp', 'topoViewer-groupLevel': '2' } },
      bridge1: { kind: 'bridge', labels: {} }
    });
    const annotations = {
      nodeAnnotations: [
        { id: 'node1', position: { x: 5, y: 10 }, groupLabelPos: 'top-left' }
      ]
    };
    const elements: CyElement[] = [];
    const parentMap = new Map<string, string | undefined>();
    const containerData = createContainerData();
    const clabTreeData = createClabTreeData(containerData);

    addNodeElements(parsed, { includeContainerData: true, clabTreeData, annotations }, FULL_PREFIX, CLAB_NAME, parentMap, elements);
    addGroupNodes(parentMap, elements);

    const node1 = elements.find(el => el.data.id === 'node1');
    const bridge = elements.find(el => el.data.id === 'bridge1');
    const groupNode = elements.find(el => el.data.id === 'grp:2');

    expect(elements).to.have.length(3);
    expect(node1?.data.parent).to.equal('grp:2');
    expect(node1?.data.extraData.state).to.equal('running');
    expect(node1?.data.topoViewerRole).to.equal('router');
    expect(node1?.position).to.deep.equal({ x: 5, y: 10 });

    expect(bridge?.data.topoViewerRole).to.equal('bridge');
    expect(bridge?.data.extraData.kind).to.equal('bridge');

    expect(groupNode?.data.topoViewerRole).to.equal('group');
    expect(groupNode?.classes).to.equal('top-left');
  });
});
