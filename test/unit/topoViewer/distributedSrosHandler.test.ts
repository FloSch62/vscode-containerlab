/* eslint-env mocha */
/* global describe, it */
import { expect } from 'chai';
import {
  buildDistributedCandidateNames,
  collectDistributedSrosContainers,
  containerBelongsToDistributedNode,
  extractSrosComponentInfo,
  findDistributedSrosContainer,
  findDistributedSrosInterface,
  findInterfaceByCandidateNames,
  getCandidateInterfaceNames,
  isDistributedSrosNode,
  mapSrosInterfaceName,
  matchInterfaceInContainer,
  scanAllDistributedContainers,
  srosSlotPriority,
  treeItemLabelToString
} from '../../../src/topoViewer/extension/services/DistributedSrosHandler';
import type { ClabContainerTreeNode, ClabInterfaceTreeNode, ClabLabTreeNode } from '../../../src/treeView/common';

// Common fixtures
const BASE_NODE = 'sros1';
const FULL_PREFIX = 'clab-test';
const CLAB_NAME = 'testlab';

function createInterface(name: string, alias: string): ClabInterfaceTreeNode {
  return {
    label: alias,
    name,
    alias,
    parentName: `${FULL_PREFIX}-${BASE_NODE}-a`,
    cID: 'cid',
    type: 'veth',
    mac: '',
    mtu: 1500,
    ifIndex: 1,
    state: 'up'
  } as unknown as ClabInterfaceTreeNode;
}

function createContainer(name: string, label?: string, iface?: ClabInterfaceTreeNode): ClabContainerTreeNode {
  return {
    label: label ?? name,
    name,
    name_short: name,
    cID: 'cid',
    state: 'running',
    kind: 'nokia_srsim',
    image: 'image',
    interfaces: iface ? [iface] : [],
    labPath: { absolute: '/labs/test', relative: 'test' }
  } as unknown as ClabContainerTreeNode;
}

function createClabTree(containers: ClabContainerTreeNode[]): Record<string, ClabLabTreeNode> {
  return {
    [CLAB_NAME]: {
      name: CLAB_NAME,
      containers
    } as unknown as ClabLabTreeNode
  };
}

describe('DistributedSrosHandler - identification & mapping', () => {
  it('detects distributed nodes with components', () => {
    expect(isDistributedSrosNode(undefined as any)).to.be.false;
    expect(isDistributedSrosNode({ kind: 'nokia_srsim', components: [] } as any)).to.be.false;
    expect(isDistributedSrosNode({ kind: 'nokia_srsim', components: [{}] } as any)).to.be.true;
  });

  it('maps SROS interface names to container format', () => {
    expect(mapSrosInterfaceName('1/2/1')).to.equal('e1-2-1');
    expect(mapSrosInterfaceName('1/x1/2/1')).to.equal('e1-x1-2-1');
    expect(mapSrosInterfaceName('1/x1/2/c3/5')).to.equal('e1-x1-2-c3-5');
    expect(mapSrosInterfaceName('')).to.be.undefined;
    expect(mapSrosInterfaceName('eth0')).to.equal('eth0');
  });

  it('collects candidate interface names', () => {
    expect(getCandidateInterfaceNames('1/2/1')).to.include('1/2/1');
    expect(getCandidateInterfaceNames('1/2/1')).to.include('e1-2-1');
  });

  it('orders slots with priority', () => {
    expect(srosSlotPriority('a')).to.equal(0);
    expect(srosSlotPriority('b')).to.equal(1);
    expect(srosSlotPriority('c')).to.equal(2);
  });

  it('converts tree item labels to string', () => {
    expect(treeItemLabelToString('label')).to.equal('label');
    expect(treeItemLabelToString({ label: 'fromLabel' })).to.equal('fromLabel');
    expect(treeItemLabelToString(undefined)).to.equal('');
  });
});

describe('DistributedSrosHandler - interface matching', () => {
  it('matches interfaces using candidate name variants', () => {
    const iface = createInterface('e1-x1-2-1', 'xe-1/2/1');
    const container = createContainer(`${FULL_PREFIX}-${BASE_NODE}-a`, undefined, iface);

    expect(matchInterfaceInContainer(container, '1/x1/2/1')).to.equal(iface);
  });

  it('checks container membership in distributed node', () => {
    const container = createContainer(`${FULL_PREFIX}-${BASE_NODE}-a`);
    expect(containerBelongsToDistributedNode(container, BASE_NODE, FULL_PREFIX)).to.be.true;
    expect(containerBelongsToDistributedNode(container, 'other', FULL_PREFIX)).to.be.false;
  });

  it('builds candidate distributed container names', () => {
    const names = buildDistributedCandidateNames(BASE_NODE, FULL_PREFIX, [{ slot: 'A' }, { slot: 'b' }]);
    expect(names).to.include(`${FULL_PREFIX}-${BASE_NODE}-a`);
    expect(names).to.include(`${BASE_NODE}-b`);
  });

  it('finds interfaces via candidate container names and scan fallback', () => {
    const iface = createInterface('e1-2-1', 'xe-1/2/1');
    const containerA = createContainer(`${FULL_PREFIX}-${BASE_NODE}-a`, undefined, iface);
    const containerB = createContainer(`${FULL_PREFIX}-${BASE_NODE}-b`);
    const clabTree = createClabTree([containerA, containerB]);
    const candidateNames = [`${FULL_PREFIX}-${BASE_NODE}-b`, `${FULL_PREFIX}-${BASE_NODE}-a`];

    const direct = findInterfaceByCandidateNames({
      candidateNames,
      ifaceName: '1/2/1',
      clabTreeData: clabTree,
      clabName: CLAB_NAME
    });
    expect(direct?.containerName).to.equal(containerA.name);

    const scanned = scanAllDistributedContainers({
      baseNodeName: BASE_NODE,
      ifaceName: '1/2/1',
      fullPrefix: FULL_PREFIX,
      clabTreeData: clabTree,
      clabName: CLAB_NAME
    });
    expect(scanned?.containerName).to.equal(containerA.name);
  });

  it('finds distributed SROS interface across components', () => {
    const iface = createInterface('e1-x1-2-1', 'xe-1/2/1');
    const containerA = createContainer(`${BASE_NODE}-a`, undefined, iface);
    const clabTree = createClabTree([containerA]);

    const found = findDistributedSrosInterface({
      baseNodeName: BASE_NODE,
      ifaceName: '1/x1/2/1',
      fullPrefix: '',
      clabName: CLAB_NAME,
      clabTreeData: clabTree,
      components: [{ slot: 'A' }]
    });

    expect(found?.containerName).to.equal(containerA.name);
    expect(found?.ifaceData).to.equal(iface);
  });
});

describe('DistributedSrosHandler - container resolution', () => {
  it('extracts component info from container names', () => {
    const container = createContainer(`${FULL_PREFIX}-${BASE_NODE}-a`);
    expect(extractSrosComponentInfo(container)).to.deep.equal({ base: `${FULL_PREFIX}-${BASE_NODE}`, slot: 'a' });
    expect(extractSrosComponentInfo(createContainer('invalid'))).to.be.undefined;
  });

  it('collects distributed containers and picks earliest slot', () => {
    const contA = createContainer(`${FULL_PREFIX}-${BASE_NODE}-a`);
    const contB = createContainer(`${FULL_PREFIX}-${BASE_NODE}-b`);
    const clabTree = createClabTree([contB, contA]);
    const candidateSet = new Set<string>([`${FULL_PREFIX}-${BASE_NODE}`]);

    const collected = collectDistributedSrosContainers(clabTree[CLAB_NAME], candidateSet, BASE_NODE, FULL_PREFIX);
    expect(collected.map(c => c.slot)).to.include.members(['a', 'b']);
  });

  it('finds distributed container with slot priority ordering', () => {
    const contA = createContainer(`${FULL_PREFIX}-${BASE_NODE}-b`);
    const contB = createContainer(`${FULL_PREFIX}-${BASE_NODE}-a`);
    const clabTree = createClabTree([contA, contB]);

    const found = findDistributedSrosContainer({
      baseNodeName: BASE_NODE,
      fullPrefix: FULL_PREFIX,
      clabTreeData: clabTree,
      clabName: CLAB_NAME,
      components: [{ slot: 'A' }, { slot: 'B' }]
    });

    expect(found).to.equal(contB);
  });
});
