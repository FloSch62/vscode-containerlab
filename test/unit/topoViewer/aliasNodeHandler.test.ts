/* eslint-env mocha */
/* global describe, it, afterEach */
import { expect } from 'chai';
import sinon from 'sinon';
import {
  CLASS_ALIASED_BASE_BRIDGE,
  addAliasNodesFromAnnotations,
  addClass,
  applyAliasMappingsToEdges,
  asTrimmedString,
  buildAliasMap,
  buildNodeAnnotationIndex,
  collectAliasEntriesNew,
  collectAliasGroups,
  collectStillReferencedBaseBridges,
  createAliasElement,
  deriveAliasPlacement,
  hideBaseBridgeNodesWithAliases,
  isBridgeKind,
  listAliasEntriesFromNodeAnnotations,
  normalizeAliasList,
  toParent,
  toPosition
} from '../../../src/topoViewer/extension/services/AliasNodeHandler';
import type { ClabTopology, CyElement } from '../../../src/topoViewer/shared/types/topoViewerType';
import { log } from '../../../src/topoViewer/webview/platform/logging/logger';

const BRIDGE_KIND = 'bridge';
const BASE_ID = 'bridge1';
const ALIAS_ID = 'alias-1';
const IFACE = 'eth1';

afterEach(() => {
  sinon.restore();
});

describe('AliasNodeHandler - utility helpers', () => {
  it('detects bridge kinds and trims values', () => {
    expect(isBridgeKind(BRIDGE_KIND)).to.be.true;
    expect(isBridgeKind('router')).to.be.false;
    expect(asTrimmedString('  test ')).to.equal('test');
    expect(asTrimmedString(123)).to.equal('');
  });

  it('builds annotation index and extracts position/parent', () => {
    const anns = { nodeAnnotations: [{ id: ALIAS_ID, position: { x: 5, y: 10 }, group: 'g', level: '1' }] };
    const index = buildNodeAnnotationIndex(anns);

    expect(index.get(ALIAS_ID)).to.exist;
    expect(toPosition(index.get(ALIAS_ID))).to.deep.equal({ x: 5, y: 10 });
    expect(toParent(index.get(ALIAS_ID))).to.equal('g:1');
    expect(toPosition(undefined)).to.deep.equal({ x: 0, y: 0 });
    expect(toParent(undefined)).to.equal(undefined);
  });
});

describe('AliasNodeHandler - alias list and placement', () => {
  it('collects alias entries and builds alias map', () => {
    const annotations = {
      nodeAnnotations: [
        { id: ALIAS_ID, yamlNodeId: BASE_ID, yamlInterface: IFACE },
        { id: BASE_ID, yamlNodeId: BASE_ID, yamlInterface: IFACE }, // ignored
        { id: 'missing', yamlNodeId: '', yamlInterface: '' } // ignored
      ]
    };

    const entries = collectAliasEntriesNew(annotations);
    expect(entries).to.have.length(1);
    expect(listAliasEntriesFromNodeAnnotations(annotations)).to.deep.equal(entries);
    expect(normalizeAliasList(annotations)).to.deep.equal(entries);

    const map = buildAliasMap(entries);
    expect(map.get(`${BASE_ID}|${IFACE}`)).to.equal(ALIAS_ID);
  });

  it('derives placement using alias and base annotations', () => {
    const aliasAnn = { position: { x: 1, y: 2 }, group: 'g', level: '2' };
    const baseAnn = { position: { x: 3, y: 4 }, group: 'b', level: '1' };

    expect(deriveAliasPlacement(aliasAnn, baseAnn)).to.deep.equal({ position: { x: 1, y: 2 }, parent: 'g:2' });
    expect(deriveAliasPlacement(undefined, baseAnn)).to.deep.equal({ position: { x: 3, y: 4 }, parent: 'b:1' });
    expect(deriveAliasPlacement(undefined, undefined)).to.deep.equal({ position: { x: 0, y: 0 } });
  });
});

describe('AliasNodeHandler - alias element creation', () => {
  it('creates alias element with placement and display label', () => {
    const parsed: ClabTopology = {
      name: 'lab',
      topology: { nodes: { [BASE_ID]: { kind: BRIDGE_KIND } } }
    } as unknown as ClabTopology;
    const annotations = {
      nodeAnnotations: [
        { id: BASE_ID, position: { x: 2, y: 4 }, group: 'core', level: '1' },
        {
          id: ALIAS_ID,
          yamlNodeId: BASE_ID,
          yamlInterface: IFACE,
          label: 'Alias Bridge',
          position: { x: 5, y: 6 },
          group: 'core',
          level: '1'
        }
      ]
    };
    const elements: CyElement[] = [];

    addAliasNodesFromAnnotations(parsed, annotations, elements);

    expect(elements).to.have.length(1);
    const el = elements[0];
    expect(el.data.id).to.equal(ALIAS_ID);
    expect(el.data.parent).to.equal('core:1');
    expect(el.position).to.deep.equal({ x: 5, y: 6 });
    expect(el.data.extraData.extYamlNodeId).to.equal(BASE_ID);
    expect(el.data.name).to.equal('Alias Bridge');
  });

  it('skips non-bridge references when creating alias element', () => {
    const nodeMap = { router1: { kind: 'router' } };
    const nodeAnnById = new Map<string, any>([[ALIAS_ID, { position: { x: 1, y: 2 } }]]);
    const element = createAliasElement(nodeMap, ALIAS_ID, 'router1', nodeAnnById);
    expect(element).to.equal(null);
  });
});

describe('AliasNodeHandler - edge rewiring and hiding', () => {
  it('applies alias mappings to edges', () => {
    const elements: CyElement[] = [
      { group: 'edges', data: { source: BASE_ID, target: 'node2', sourceEndpoint: IFACE, targetEndpoint: 'eth2' } } as any,
      { group: 'edges', data: { source: 'node3', target: BASE_ID, sourceEndpoint: 'eth3', targetEndpoint: IFACE } } as any
    ];

    applyAliasMappingsToEdges(
      { nodeAnnotations: [{ id: ALIAS_ID, yamlNodeId: BASE_ID, yamlInterface: IFACE }] },
      elements
    );

    expect(elements[0].data.source).to.equal(ALIAS_ID);
    expect(elements[1].data.target).to.equal(ALIAS_ID);
  });

  it('hides base bridge nodes when unmapped and keeps referenced bases visible', () => {
    const aliasNode: CyElement = {
      group: 'nodes',
      data: { id: ALIAS_ID, extraData: { extYamlNodeId: BASE_ID, kind: BRIDGE_KIND } }
    } as any;
    const baseNode: CyElement = {
      group: 'nodes',
      data: { id: BASE_ID, extraData: { kind: BRIDGE_KIND } },
      classes: ''
    } as any;
    const edgeToBase: CyElement = { group: 'edges', data: { source: BASE_ID, sourceEndpoint: IFACE } } as any;
    const edgeToAlias: CyElement = { group: 'edges', data: { source: ALIAS_ID, sourceEndpoint: IFACE } } as any;
    const logged = new Set<string>();
    const infoStub = sinon.stub(log, 'info');

    hideBaseBridgeNodesWithAliases(undefined, [aliasNode, baseNode, edgeToAlias], logged);
    expect(baseNode.classes).to.include(CLASS_ALIASED_BASE_BRIDGE);

    hideBaseBridgeNodesWithAliases(undefined, [aliasNode, baseNode, edgeToBase], logged);
    expect(infoStub.calledOnce).to.be.true;
  });

  it('collects alias groups and referenced bases', () => {
    const aliasNode: CyElement = {
      group: 'nodes',
      data: { id: ALIAS_ID, extraData: { extYamlNodeId: BASE_ID, kind: BRIDGE_KIND } }
    } as any;
    const baseNode: CyElement = { group: 'nodes', data: { id: BASE_ID, extraData: { kind: BRIDGE_KIND } } } as any;
    const elements = [aliasNode, baseNode];
    const groups = collectAliasGroups(elements);
    expect(groups.get(BASE_ID)).to.deep.equal([ALIAS_ID]);

    const edges = [{ group: 'edges', data: { source: BASE_ID } } as any];
    const still = collectStillReferencedBaseBridges(edges, groups);
    expect(still.has(BASE_ID)).to.be.true;
  });

  it('adds classes without duplication', () => {
    const node: any = { classes: 'existing' };
    addClass(node, 'new');
    addClass(node, 'existing');
    expect(node.classes).to.include('existing');
    expect(node.classes).to.include('new');
  });
});
