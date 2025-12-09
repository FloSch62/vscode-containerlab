/* eslint-env mocha */
/* global describe, it, before, after, afterEach, __dirname */
import { expect } from 'chai';
import path from 'path';
import Module from 'module';

const originalResolve = (Module as any)._resolveFilename;
(Module as any)._resolveFilename = function(request: string, parent: any, isMain: boolean, options: any) {
  if (request.endsWith('logging/logger')) {
    return path.join(__dirname, '..', '..', 'helpers', 'extensionLogger-stub.js');
  }
  return originalResolve.call(this, request, parent, isMain, options);
};

import {
  applyIdOverrideToEdgeData,
  autoFixDuplicateBridgeInterfaces,
  buildNodeIdOverrideMap
} from '../../../src/topoViewer/extension/services/BridgeInterfaceFixer';
import { getLogEntriesByLevel, resetLoggerStub } from '../../helpers/extensionLogger-stub';

const KIND_BRIDGE = 'bridge';

/**
 * Helpers to create node and edge payload items
 */
function createBridgeNode(id: string, extraData: Record<string, unknown> = {}): any {
  return {
    group: 'nodes',
    data: {
      id,
      extraData: {
        kind: KIND_BRIDGE,
        ...extraData
      }
    }
  };
}

function createEdge(
  source: string,
  target: string,
  sourceEndpoint: string,
  targetEndpoint: string
): any {
  return {
    group: 'edges',
    data: {
      source,
      target,
      sourceEndpoint,
      targetEndpoint
    }
  };
}

/**
 * Mapping helper tests
 */
describe('BridgeInterfaceFixer - mapping helpers', () => {
  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  afterEach(() => {
    resetLoggerStub();
  });

  it('buildNodeIdOverrideMap collects yaml id overrides', () => {
    const payload = [
      createBridgeNode('alias-1', { extYamlNodeId: 'br-1' }),
      createBridgeNode('bridge-2'),
      { group: 'edges', data: {} }
    ];

    const map = buildNodeIdOverrideMap(payload);

    expect(map.get('alias-1')).to.equal('br-1');
    expect(map.has('bridge-2')).to.be.false;
  });

  it('applyIdOverrideToEdgeData rewrites ids when mapping exists', () => {
    const idOverride = new Map<string, string>([['alias-1', 'br-1']]);
    const data = { source: 'alias-1', target: 'node-b', sourceEndpoint: 'eth1', targetEndpoint: 'eth0' };

    const updated = applyIdOverrideToEdgeData(data, idOverride);

    expect(updated).to.deep.equal({
      source: 'br-1',
      target: 'node-b',
      sourceEndpoint: 'eth1',
      targetEndpoint: 'eth0'
    });
    expect(updated).to.not.equal(data);
  });
});

/**
 * Auto-fix behavior tests
 */
describe('BridgeInterfaceFixer - autoFixDuplicateBridgeInterfaces', () => {
  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  afterEach(() => {
    resetLoggerStub();
  });

  it('keeps payload unchanged when bridge interfaces are unique', () => {
    const payload = [
      createBridgeNode('br-1'),
      createEdge('br-1', 'node-a', 'eth1', 'eth0'),
      createEdge('node-b', 'br-1', 'eth2', 'eth3')
    ];

    autoFixDuplicateBridgeInterfaces(payload);

    expect(payload[1].data.sourceEndpoint).to.equal('eth1');
    expect(payload[2].data.targetEndpoint).to.equal('eth3');
    expect(getLogEntriesByLevel('warn')).to.have.length(0);
  });

  it('reassigns duplicate bridge interfaces including alias nodes', () => {
    const payload = [
      createBridgeNode('br-base'),
      createBridgeNode('br-alias', { extYamlNodeId: 'br-base' }),
      createEdge('br-alias', 'node-a', 'eth1', 'eth0'),
      createEdge('br-alias', 'node-b', 'eth1', 'eth0'),
      createEdge('node-c', 'br-alias', 'eth9', 'eth2')
    ];

    autoFixDuplicateBridgeInterfaces(payload);

    const firstEdge = payload[2].data;
    const secondEdge = payload[3].data;

    expect(firstEdge.sourceEndpoint).to.equal('eth1');
    expect(secondEdge.sourceEndpoint).to.not.equal('eth1');
    expect(secondEdge.sourceEndpoint).to.not.equal('eth2');
    expect(secondEdge.sourceEndpoint).to.match(/^eth\d+$/);
  });
});
