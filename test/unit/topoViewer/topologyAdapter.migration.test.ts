/* eslint-env mocha */
/* global describe, it, before, after, beforeEach, afterEach, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import Module from 'module';
import path from 'path';
import * as fs from 'fs';

// Module resolution override - must be done before importing modules
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

// Common test path constants to avoid duplication
const TEST_BASE_PATH = '/path/to/test';
const CLAB_EXT = '.clab.yml';

/**
 * Helper to create a unique test yaml file path
 */
function createTestPath(testName: string): string {
  return `${TEST_BASE_PATH}-${testName}${CLAB_EXT}`;
}

/**
 * Helper to create basic node YAML
 */
function createNodeYaml(labels: Record<string, string>): string {
  const labelsYaml = Object.entries(labels)
    .map(([key, value]) => `        ${key}: "${value}"`)
    .join('\n');
  return `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
${labelsYaml}
`;
}

/**
 * Tests for TopologyAdapter - Position Migration
 */
describe('TopologyAdapter migration - position labels', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('does not migrate when yamlFilePath is not provided', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    const yaml = createNodeYaml({ 'graph-posX': '100', 'graph-posY': '200' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml);
    expect(fsWriteFileStub.called).to.be.false;
  });

  it('migrates graph-posX and graph-posY to annotations', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-posX': '150', 'graph-posY': '250' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('pos'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.position).to.deep.equal({ x: 150, y: 250 });
    }
  });

  it('handles invalid position values gracefully', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-posX': 'not-a-number', 'graph-posY': 'invalid' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('invalid-pos'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.position).to.deep.equal({ x: 0, y: 0 });
    }
  });

  it('handles position with only posX (missing posY)', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-posX': '100' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('only-posX'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.position).to.be.undefined;
    }
  });
});

/**
 * Tests for TopologyAdapter - Icon Migration
 */
describe('TopologyAdapter migration - icon labels', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('migrates graph-icon to annotations', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-icon': 'server' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('icon'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.icon).to.equal('server');
    }
  });
});

/**
 * Tests for TopologyAdapter - Group Migration
 */
describe('TopologyAdapter migration - group labels', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('migrates graph-group and graph-level to annotations', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-group': 'spines', 'graph-level': '2' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('group'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.group).to.equal('spines');
      expect(nodeAnn.level).to.equal('2');
    }
  });

  it('migrates graph-groupLabelPos to annotations', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-groupLabelPos': 'top' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('grouplabel'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.groupLabelPos).to.equal('top');
    }
  });
});

/**
 * Tests for TopologyAdapter - Geo Coordinate Migration
 */
describe('TopologyAdapter migration - geo coordinate labels', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('migrates graph-geoCoordinateLat and graph-geoCoordinateLng to annotations', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-geoCoordinateLat': '51.5074', 'graph-geoCoordinateLng': '-0.1278' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('geo'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.geoCoordinates).to.deep.equal({ lat: 51.5074, lng: -0.1278 });
    }
  });

  it('handles invalid geo coordinate values gracefully', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-geoCoordinateLat': 'invalid', 'graph-geoCoordinateLng': 'also-invalid' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('invalid-geo'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.geoCoordinates).to.deep.equal({ lat: 0, lng: 0 });
    }
  });

  it('handles geo coordinates with only lat (missing lng)', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-geoCoordinateLat': '51.5' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('only-lat'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.geoCoordinates).to.be.undefined;
    }
  });
});

/**
 * Tests for TopologyAdapter - Existing Annotations Handling
 */
describe('TopologyAdapter migration - existing annotations', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsReadFileStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    fsReadFileStub = sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('skips migration if node already has annotation', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    const existingAnnotations = {
      freeTextAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: [{ id: 'node1', icon: 'existing-icon' }]
    };
    fsAccessStub.resolves();
    fsReadFileStub.resolves(JSON.stringify(existingAnnotations));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-icon': 'new-icon' });
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('skip-migration'));

    expect(fsWriteFileStub.called).to.be.false;
  });

  it('preserves existing annotations during migration', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    const existingAnnotations = {
      freeTextAnnotations: [{ id: 'text1', text: 'Hello', position: { x: 10, y: 20 } }],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };
    fsAccessStub.resolves();
    fsReadFileStub.resolves(JSON.stringify(existingAnnotations));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-icon': 'firewall' });
    await adaptor.clabYamlToCytoscapeElements(yaml, {}, createTestPath('preserve'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      expect(savedAnnotations.freeTextAnnotations).to.have.length(1);
      expect(savedAnnotations.freeTextAnnotations[0].text).to.equal('Hello');
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn?.icon).to.equal('firewall');
    }
  });
});

/**
 * Tests for TopologyAdapter - Multiple Nodes Migration
 */
describe('TopologyAdapter migration - multiple nodes', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('migrates multiple nodes with graph-* labels', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-icon: router
    node2:
      kind: linux
      labels:
        graph-icon: server
    node3:
      kind: linux
`;
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('multi-nodes'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      expect(savedAnnotations.nodeAnnotations).to.have.length(2);
      const node1Ann = savedAnnotations.nodeAnnotations.find((n: any) => n.id === 'node1');
      const node2Ann = savedAnnotations.nodeAnnotations.find((n: any) => n.id === 'node2');
      expect(node1Ann?.icon).to.equal('router');
      expect(node2Ann?.icon).to.equal('server');
    }
  });

  it('migrates all graph-* labels together', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        graph-posX: "100"
        graph-posY: "200"
        graph-icon: router
        graph-group: datacenter
        graph-level: "1"
        graph-groupLabelPos: bottom
        graph-geoCoordinateLat: "40.7128"
        graph-geoCoordinateLng: "-74.0060"
`;
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('all-labels'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.position).to.deep.equal({ x: 100, y: 200 });
      expect(nodeAnn.icon).to.equal('router');
      expect(nodeAnn.group).to.equal('datacenter');
      expect(nodeAnn.level).to.equal('1');
      expect(nodeAnn.groupLabelPos).to.equal('bottom');
      expect(nodeAnn.geoCoordinates).to.deep.equal({ lat: 40.7128, lng: -74.006 });
    }
  });
});

/**
 * Tests for TopologyAdapter - No Migration Cases
 */
describe('TopologyAdapter migration - no migration cases', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsReadFileStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    fsReadFileStub = sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('skips migration for nodes without graph-* labels', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
      labels:
        custom-label: value
`;
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('no-graph-labels'));
    expect(fsWriteFileStub.called).to.be.false;
  });

  it('does not save when no migration is needed', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    const existingAnnotations = {
      freeTextAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };
    fsAccessStub.resolves();
    fsReadFileStub.resolves(JSON.stringify(existingAnnotations));
    fsWriteFileStub.resolves();

    const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
    await adaptor.clabYamlToCytoscapeElements(yaml, {}, createTestPath('no-migration'));
    expect(fsWriteFileStub.called).to.be.false;
  });

  it('handles node without labels property', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = `
name: test
topology:
  nodes:
    node1:
      kind: linux
`;
    await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('no-labels'));
    expect(fsWriteFileStub.called).to.be.false;
  });

  it('handles topology without nodes', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = `
name: test
topology: {}
`;
    const elements = await adaptor.clabYamlToCytoscapeElementsEditor(yaml, createTestPath('empty-topo'));
    expect(elements).to.deep.equal([]);
    expect(fsWriteFileStub.called).to.be.false;
  });
});

/**
 * Tests for TopologyAdapter - clabYamlToCytoscapeElements method
 */
describe('TopologyAdapter migration - clabYamlToCytoscapeElements method', () => {
  let fsAccessStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;

  beforeEach(() => {
    fsAccessStub = sinon.stub(fs.promises, 'access');
    sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('migrates graph-* labels via clabYamlToCytoscapeElements', async () => {
    const adaptor = new TopoViewerAdaptorClab();
    fsAccessStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    const yaml = createNodeYaml({ 'graph-icon': 'switch' });
    await adaptor.clabYamlToCytoscapeElements(yaml, {}, createTestPath('elements-method'));

    expect(fsWriteFileStub.called).to.be.true;
    const savedContent = fsWriteFileStub.firstCall?.args[1];
    if (savedContent) {
      const savedAnnotations = JSON.parse(savedContent);
      const nodeAnn = savedAnnotations.nodeAnnotations?.find((n: any) => n.id === 'node1');
      expect(nodeAnn).to.exist;
      expect(nodeAnn.icon).to.equal('switch');
    }
  });
});
