/* eslint-env mocha */
/* global describe, it, beforeEach */

import { expect } from 'chai';

// Direct import since these are pure utility functions
import {
  isRegularNode,
  setNodePosition,
  addGeo,
  addGroupInfo,
  assignAnnotationColor,
  assignAnnotationCornerRadius,
  applyNodeIconColor,
  addVal,
  firstInterface,
  collectAliasInterfacesByAliasId,
  decorateAliasAnnotation,
  isBridgeAliasNode,
  isBridgeKindNode,
  computeStableAnnotationId,
  collectAliasBaseSet,
  shouldIncludeNodeAnnotation,
  createNodeAnnotation,
  createCloudNodeAnnotation,
  buildNodeIndex,
  mergeNodeAnnotationLists,
} from '../../../src/topoViewer/extension/services/NodeAnnotationUtils';

// Constants to avoid duplicate strings
const ROLE_GROUP = 'group';
const ROLE_CLOUD = 'cloud';
const ROLE_FREE_TEXT = 'freeText';
const ROLE_FREE_SHAPE = 'freeShape';
const ROLE_BRIDGE = 'bridge';
const KIND_BRIDGE = 'bridge';
const KIND_OVS_BRIDGE = 'ovs-bridge';
const NODE_ID_1 = 'node1';
const NODE_ID_2 = 'node2';
const INTERFACE_ETH1 = 'eth1';
const INTERFACE_ETH2 = 'eth2';

describe('NodeAnnotationUtils - isRegularNode', () => {
  it('returns true for regular node', () => {
    const el = { group: 'nodes', data: { id: NODE_ID_1, topoViewerRole: 'node' } };
    expect(isRegularNode(el)).to.be.true;
  });

  it('returns false for group node', () => {
    const el = { group: 'nodes', data: { id: NODE_ID_1, topoViewerRole: ROLE_GROUP } };
    expect(isRegularNode(el)).to.be.false;
  });

  it('returns false for cloud node', () => {
    const el = { group: 'nodes', data: { id: NODE_ID_1, topoViewerRole: ROLE_CLOUD } };
    expect(isRegularNode(el)).to.be.false;
  });

  it('returns false for freeText node', () => {
    const el = { group: 'nodes', data: { id: NODE_ID_1, topoViewerRole: ROLE_FREE_TEXT } };
    expect(isRegularNode(el)).to.be.false;
  });

  it('returns false for freeShape node', () => {
    const el = { group: 'nodes', data: { id: NODE_ID_1, topoViewerRole: ROLE_FREE_SHAPE } };
    expect(isRegularNode(el)).to.be.false;
  });

  it('returns false for edges', () => {
    const el = { group: 'edges', data: { id: 'edge1' } };
    expect(isRegularNode(el)).to.be.false;
  });

  it('returns false for special endpoint', () => {
    const el = { group: 'nodes', data: { id: 'host:eth0', topoViewerRole: 'node' } };
    expect(isRegularNode(el)).to.be.false;
  });
});

describe('NodeAnnotationUtils - setNodePosition', () => {
  it('sets position from node when not geo active', () => {
    const nodeAnn: any = {};
    const node = { position: { x: 100.5, y: 200.7 }, data: {} };
    setNodePosition(nodeAnn, node);
    expect(nodeAnn.position).to.deep.equal({ x: 101, y: 201 });
  });

  it('uses previous position when geo layout is active', () => {
    const nodeAnn: any = {};
    const node = { position: { x: 300, y: 400 }, data: { geoLayoutActive: true } };
    const prev = { id: 'test', icon: 'test', position: { x: 50, y: 60 } };
    setNodePosition(nodeAnn, node, prev);
    expect(nodeAnn.position).to.deep.equal({ x: 50, y: 60 });
  });

  it('handles missing position gracefully', () => {
    const nodeAnn: any = {};
    const node = { data: {} };
    setNodePosition(nodeAnn, node);
    expect(nodeAnn.position).to.deep.equal({ x: 0, y: 0 });
  });

  it('does not set position when geo active and no prev', () => {
    const nodeAnn: any = {};
    const node = { position: { x: 100, y: 200 }, data: { geoLayoutActive: true } };
    setNodePosition(nodeAnn, node);
    expect(nodeAnn.position).to.be.undefined;
  });
});

describe('NodeAnnotationUtils - addGeo', () => {
  it('adds geo coordinates when valid', () => {
    const nodeAnn: any = {};
    const node = { data: { lat: '51.5074', lng: '-0.1278' } };
    addGeo(nodeAnn, node);
    expect(nodeAnn.geoCoordinates).to.deep.equal({ lat: 51.5074, lng: -0.1278 });
  });

  it('ignores invalid lat', () => {
    const nodeAnn: any = {};
    const node = { data: { lat: 'invalid', lng: '-0.1278' } };
    addGeo(nodeAnn, node);
    expect(nodeAnn.geoCoordinates).to.be.undefined;
  });

  it('ignores missing coordinates', () => {
    const nodeAnn: any = {};
    const node = { data: {} };
    addGeo(nodeAnn, node);
    expect(nodeAnn.geoCoordinates).to.be.undefined;
  });
});

describe('NodeAnnotationUtils - addGroupInfo', () => {
  it('parses group and level from parent string', () => {
    const nodeAnn: any = {};
    addGroupInfo(nodeAnn, 'myGroup:level1');
    expect(nodeAnn.group).to.equal('myGroup');
    expect(nodeAnn.level).to.equal('level1');
  });

  it('ignores invalid parent format', () => {
    const nodeAnn: any = {};
    addGroupInfo(nodeAnn, 'invalid-format');
    expect(nodeAnn.group).to.be.undefined;
    expect(nodeAnn.level).to.be.undefined;
  });

  it('handles null parent', () => {
    const nodeAnn: any = {};
    addGroupInfo(nodeAnn, null);
    expect(nodeAnn.group).to.be.undefined;
  });
});

describe('NodeAnnotationUtils - assignAnnotationColor', () => {
  it('assigns valid icon color', () => {
    const nodeAnn: any = {};
    const node = { data: { iconColor: '#ff0000' } };
    assignAnnotationColor(nodeAnn, node);
    expect(nodeAnn.iconColor).to.equal('#ff0000');
  });

  it('trims whitespace from color', () => {
    const nodeAnn: any = {};
    const node = { data: { iconColor: '  #00ff00  ' } };
    assignAnnotationColor(nodeAnn, node);
    expect(nodeAnn.iconColor).to.equal('#00ff00');
  });

  it('removes iconColor property when empty', () => {
    const nodeAnn: any = { iconColor: 'old' };
    const node = { data: { iconColor: '' } };
    assignAnnotationColor(nodeAnn, node);
    expect(nodeAnn.iconColor).to.be.undefined;
  });

  it('handles missing iconColor', () => {
    const nodeAnn: any = {};
    const node = { data: {} };
    assignAnnotationColor(nodeAnn, node);
    expect(nodeAnn.iconColor).to.be.undefined;
  });
});

describe('NodeAnnotationUtils - assignAnnotationCornerRadius', () => {
  it('assigns valid corner radius', () => {
    const nodeAnn: any = {};
    const node = { data: { iconCornerRadius: 10 } };
    assignAnnotationCornerRadius(nodeAnn, node);
    expect(nodeAnn.iconCornerRadius).to.equal(10);
  });

  it('removes radius when zero or negative', () => {
    const nodeAnn: any = { iconCornerRadius: 5 };
    const node = { data: { iconCornerRadius: 0 } };
    assignAnnotationCornerRadius(nodeAnn, node);
    expect(nodeAnn.iconCornerRadius).to.be.undefined;
  });

  it('handles NaN radius', () => {
    const nodeAnn: any = { iconCornerRadius: 5 };
    const node = { data: { iconCornerRadius: NaN } };
    assignAnnotationCornerRadius(nodeAnn, node);
    expect(nodeAnn.iconCornerRadius).to.be.undefined;
  });

  it('handles missing radius', () => {
    const nodeAnn: any = {};
    const node = { data: {} };
    assignAnnotationCornerRadius(nodeAnn, node);
    expect(nodeAnn.iconCornerRadius).to.be.undefined;
  });
});

describe('NodeAnnotationUtils - applyNodeIconColor', () => {
  it('applies both color and radius', () => {
    const nodeAnn: any = {};
    const node = { data: { iconColor: 'blue', iconCornerRadius: 15 } };
    applyNodeIconColor(nodeAnn, node);
    expect(nodeAnn.iconColor).to.equal('blue');
    expect(nodeAnn.iconCornerRadius).to.equal(15);
  });
});

describe('NodeAnnotationUtils - addVal and firstInterface', () => {
  let map: Map<string, Set<string>>;

  beforeEach(() => {
    map = new Map();
  });

  it('adds value to new key', () => {
    addVal(map, 'key1', 'val1');
    expect(map.get('key1')?.has('val1')).to.be.true;
  });

  it('adds multiple values to same key', () => {
    addVal(map, 'key1', 'val1');
    addVal(map, 'key1', 'val2');
    expect(map.get('key1')?.size).to.equal(2);
  });

  it('firstInterface returns empty for undefined set', () => {
    expect(firstInterface(undefined)).to.equal('');
  });

  it('firstInterface returns empty for empty set', () => {
    expect(firstInterface(new Set())).to.equal('');
  });

  it('firstInterface returns alphabetically first', () => {
    const set = new Set(['eth2', 'eth1', 'eth10']);
    expect(firstInterface(set)).to.equal('eth1');
  });
});

describe('NodeAnnotationUtils - collectAliasInterfacesByAliasId', () => {
  it('collects interfaces from edges', () => {
    const payload = [
      { group: 'edges', data: { source: NODE_ID_1, target: NODE_ID_2, sourceEndpoint: INTERFACE_ETH1, targetEndpoint: INTERFACE_ETH2 } }
    ];
    const result = collectAliasInterfacesByAliasId(payload);
    expect(result.get(NODE_ID_1)?.has(INTERFACE_ETH1)).to.be.true;
    expect(result.get(NODE_ID_2)?.has(INTERFACE_ETH2)).to.be.true;
  });

  it('ignores non-edge elements', () => {
    const payload = [
      { group: 'nodes', data: { id: NODE_ID_1 } }
    ];
    const result = collectAliasInterfacesByAliasId(payload);
    expect(result.size).to.equal(0);
  });
});

describe('NodeAnnotationUtils - decorateAliasAnnotation', () => {
  it('decorates annotation with yaml info', () => {
    const nodeAnn: any = {};
    const node = { data: { id: 'visual1', name: 'Display Name', extraData: { extYamlNodeId: 'yamlNode' } } };
    const aliasMap = new Map([['visual1', new Set([INTERFACE_ETH1])]]);

    const result = decorateAliasAnnotation(nodeAnn, node, aliasMap);

    expect(result).to.equal('yamlNode:eth1');
    expect(nodeAnn.yamlNodeId).to.equal('yamlNode');
    expect(nodeAnn.yamlInterface).to.equal(INTERFACE_ETH1);
    expect(nodeAnn.label).to.equal('Display Name');
    expect(nodeAnn.id).to.equal('yamlNode:eth1');
  });

  it('returns undefined when yamlNodeId missing', () => {
    const nodeAnn: any = {};
    const node = { data: { id: 'visual1', extraData: {} } };
    const result = decorateAliasAnnotation(nodeAnn, node, new Map());
    expect(result).to.be.undefined;
  });

  it('returns undefined when interface missing', () => {
    const nodeAnn: any = {};
    const node = { data: { id: 'visual1', extraData: { extYamlNodeId: 'yamlNode' } } };
    const result = decorateAliasAnnotation(nodeAnn, node, new Map());
    expect(result).to.be.undefined;
  });
});

describe('NodeAnnotationUtils - isBridgeAliasNode', () => {
  it('returns true for bridge alias node', () => {
    const node = {
      data: {
        id: 'visual1',
        topoViewerRole: ROLE_BRIDGE,
        extraData: { extYamlNodeId: 'base1', kind: KIND_BRIDGE }
      }
    };
    expect(isBridgeAliasNode(node)).to.be.true;
  });

  it('returns false when extYamlNodeId matches id', () => {
    const node = {
      data: {
        id: NODE_ID_1,
        topoViewerRole: ROLE_BRIDGE,
        extraData: { extYamlNodeId: NODE_ID_1, kind: KIND_BRIDGE }
      }
    };
    expect(isBridgeAliasNode(node)).to.be.false;
  });

  it('returns false for non-bridge role', () => {
    const node = {
      data: { id: 'visual1', topoViewerRole: 'node', extraData: { extYamlNodeId: 'base1', kind: KIND_BRIDGE } }
    };
    expect(isBridgeAliasNode(node)).to.be.false;
  });

  it('returns false for null node', () => {
    expect(isBridgeAliasNode(null)).to.be.false;
  });
});

describe('NodeAnnotationUtils - isBridgeKindNode', () => {
  it('returns true for bridge kind', () => {
    const node = { data: { extraData: { kind: KIND_BRIDGE } } };
    expect(isBridgeKindNode(node)).to.be.true;
  });

  it('returns true for ovs-bridge kind', () => {
    const node = { data: { extraData: { kind: KIND_OVS_BRIDGE } } };
    expect(isBridgeKindNode(node)).to.be.true;
  });

  it('returns false for other kinds', () => {
    const node = { data: { extraData: { kind: 'linux' } } };
    expect(isBridgeKindNode(node)).to.be.false;
  });
});

describe('NodeAnnotationUtils - computeStableAnnotationId', () => {
  it('returns nodeId for non-alias nodes', () => {
    const nodeById = new Map([[NODE_ID_1, { data: { id: NODE_ID_1, topoViewerRole: 'node' } }]]);
    const result = computeStableAnnotationId(NODE_ID_1, nodeById, new Map());
    expect(result).to.equal(NODE_ID_1);
  });

  it('returns composite id for alias nodes', () => {
    const nodeById = new Map([[
      'visual1',
      { data: { id: 'visual1', topoViewerRole: ROLE_BRIDGE, extraData: { extYamlNodeId: 'base1', kind: KIND_BRIDGE } } }
    ]]);
    const aliasMap = new Map([['visual1', new Set([INTERFACE_ETH1])]]);
    const result = computeStableAnnotationId('visual1', nodeById, aliasMap);
    expect(result).to.equal('base1:eth1');
  });

  it('returns nodeId when node not found', () => {
    const result = computeStableAnnotationId('unknown', new Map(), new Map());
    expect(result).to.equal('unknown');
  });
});

describe('NodeAnnotationUtils - collectAliasBaseSet', () => {
  it('collects yaml ids from alias nodes', () => {
    const payload = [
      {
        group: 'nodes',
        data: { id: 'visual1', topoViewerRole: ROLE_BRIDGE, extraData: { extYamlNodeId: 'base1', kind: KIND_BRIDGE } }
      }
    ];
    const result = collectAliasBaseSet(payload);
    expect(result.has('base1')).to.be.true;
  });

  it('ignores non-alias nodes', () => {
    const payload = [
      { group: 'nodes', data: { id: NODE_ID_1, topoViewerRole: 'node' } }
    ];
    const result = collectAliasBaseSet(payload);
    expect(result.size).to.equal(0);
  });
});

describe('NodeAnnotationUtils - shouldIncludeNodeAnnotation', () => {
  it('includes alias nodes', () => {
    const node = {
      group: 'nodes',
      data: { id: 'visual1', topoViewerRole: ROLE_BRIDGE, extraData: { extYamlNodeId: 'base1', kind: KIND_BRIDGE } }
    };
    expect(shouldIncludeNodeAnnotation(node, new Set())).to.be.true;
  });

  it('excludes base bridge with alias', () => {
    const node = {
      group: 'nodes',
      data: { id: 'base1', topoViewerRole: 'node', extraData: { kind: KIND_BRIDGE } }
    };
    expect(shouldIncludeNodeAnnotation(node, new Set(['base1']))).to.be.false;
  });

  it('includes base bridge without alias', () => {
    const node = {
      group: 'nodes',
      data: { id: 'base1', topoViewerRole: 'node', extraData: { kind: KIND_BRIDGE } }
    };
    expect(shouldIncludeNodeAnnotation(node, new Set())).to.be.true;
  });
});

describe('NodeAnnotationUtils - createNodeAnnotation', () => {
  it('creates basic annotation', () => {
    const node = {
      data: { id: NODE_ID_1, name: 'node1', topoViewerRole: 'linux' },
      position: { x: 100, y: 200 }
    };
    const result = createNodeAnnotation(node, new Map(), new Map(), new Map());
    expect(result.id).to.equal(NODE_ID_1);
    expect(result.icon).to.equal('linux');
    expect(result.position).to.deep.equal({ x: 100, y: 200 });
  });

  it('applies icon color', () => {
    const node = {
      data: { id: NODE_ID_1, name: 'node1', topoViewerRole: 'linux', iconColor: 'red' },
      position: { x: 0, y: 0 }
    };
    const result = createNodeAnnotation(node, new Map(), new Map(), new Map());
    expect(result.iconColor).to.equal('red');
  });

  it('includes group info from parent', () => {
    const node = {
      data: { id: NODE_ID_1, name: 'node1', topoViewerRole: 'linux' },
      parent: 'myGroup:level1',
      position: { x: 0, y: 0 }
    };
    const result = createNodeAnnotation(node, new Map(), new Map(), new Map());
    expect(result.group).to.equal('myGroup');
    expect(result.level).to.equal('level1');
  });
});

describe('NodeAnnotationUtils - createCloudNodeAnnotation', () => {
  it('creates cloud annotation with host type', () => {
    const cloudNode = {
      data: { id: 'cloud1', name: 'My Host', extraData: { kind: 'host' } },
      position: { x: 50, y: 75 }
    };
    const result = createCloudNodeAnnotation(cloudNode);
    expect(result.id).to.equal('My Host');
    expect(result.type).to.equal('host');
    expect(result.label).to.equal('My Host');
    expect(result.position).to.deep.equal({ x: 50, y: 75 });
  });

  it('uses id for vxlan type', () => {
    const cloudNode = {
      data: { id: 'vxlan-100-10.0.0.1', name: 'VXLAN Tunnel', extraData: { kind: 'vxlan' } },
      position: { x: 0, y: 0 }
    };
    const result = createCloudNodeAnnotation(cloudNode);
    expect(result.id).to.equal('vxlan-100-10.0.0.1');
    expect(result.label).to.equal('VXLAN Tunnel');
  });

  it('includes group info from parent', () => {
    const cloudNode = {
      data: { id: 'cloud1', extraData: {} },
      parent: 'cloudGroup:layer1',
      position: { x: 0, y: 0 }
    };
    const result = createCloudNodeAnnotation(cloudNode);
    expect(result.group).to.equal('cloudGroup');
    expect(result.level).to.equal('layer1');
  });
});

describe('NodeAnnotationUtils - buildNodeIndex', () => {
  it('builds index from nodes', () => {
    const payload = [
      { group: 'nodes', data: { id: NODE_ID_1 } },
      { group: 'nodes', data: { id: NODE_ID_2 } },
      { group: 'edges', data: { id: 'edge1' } }
    ];
    const result = buildNodeIndex(payload);
    expect(result.size).to.equal(2);
    expect(result.has(NODE_ID_1)).to.be.true;
    expect(result.has(NODE_ID_2)).to.be.true;
  });
});

describe('NodeAnnotationUtils - mergeNodeAnnotationLists', () => {
  it('primary takes precedence', () => {
    const primary = [{ id: NODE_ID_1, icon: 'linux', position: { x: 100, y: 200 } }];
    const secondary = [{ id: NODE_ID_1, icon: 'router', position: { x: 50, y: 75 } }];
    const result = mergeNodeAnnotationLists(primary, secondary);
    expect(result).to.have.length(1);
    expect(result[0].icon).to.equal('linux');
    expect(result[0].position).to.deep.equal({ x: 100, y: 200 });
  });

  it('merges missing properties from secondary', () => {
    const primary = [{ id: NODE_ID_1, icon: 'linux' } as any];
    const secondary = [{ id: NODE_ID_1, icon: 'router', iconColor: 'blue', position: { x: 50, y: 75 } }];
    const result = mergeNodeAnnotationLists(primary, secondary);
    expect(result[0].iconColor).to.equal('blue');
    expect(result[0].position).to.deep.equal({ x: 50, y: 75 });
  });

  it('includes unique items from both lists', () => {
    const primary = [{ id: NODE_ID_1, icon: 'linux' }];
    const secondary = [{ id: NODE_ID_2, icon: 'router' }];
    const result = mergeNodeAnnotationLists(primary, secondary);
    expect(result).to.have.length(2);
  });
});
