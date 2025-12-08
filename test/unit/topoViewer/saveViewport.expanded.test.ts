/* eslint-env mocha */
/* eslint-disable sonarjs/no-duplicate-string, aggregate-complexity/aggregate-complexity */
/* global describe, it, after, afterEach, __dirname */
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Module from 'module';
import YAML from 'yaml';

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

import { saveViewport } from '../../../src/topoViewer/extension/services/SaveViewport';
import { annotationsManager } from '../../../src/topoViewer/extension/services/AnnotationsFile';
import { TopoViewerAdaptorClab } from '../../../src/topoViewer/extension/services/TopologyAdapter';

describe('saveViewport expanded tests', () => {
  after(() => {
    (Module as any)._resolveFilename = originalResolve;
  });

  afterEach(() => {
    sinon.restore();
  });

  describe('view mode', () => {
    it('saves only annotations in view mode', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-view-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      const saveStub = sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'node1',
            name: 'node1',
            topoViewerRole: 'pe',
            extraData: { kind: 'linux' }
          },
          position: { x: 100, y: 200 },
          parent: ''
        }
      ]);

      await saveViewport({ mode: 'view', yamlFilePath: yamlPath, payload });

      // YAML file should remain unchanged
      const readYaml = fs.readFileSync(yamlPath, 'utf8');
      expect(readYaml).to.equal(yamlContent);

      // Annotations should be saved
      expect(saveStub.calledOnce).to.be.true;

      fs.rmSync(tmpDir, { recursive: true, force: true });
    });
  });

  describe('edit mode node handling', () => {
    it('creates new node when not in YAML', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-newnode-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    existing: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'existing',
            name: 'existing',
            topoViewerRole: 'pe',
            extraData: { kind: 'linux' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: {
            id: 'newnode',
            name: 'newnode',
            topoViewerRole: 'pe',
            extraData: { kind: 'nokia_srlinux', image: 'ghcr.io/nokia/srlinux' }
          },
          position: { x: 100, y: 100 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.newnode).to.exist;
        expect(parsed?.topology?.nodes?.newnode?.kind).to.equal('nokia_srlinux');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('removes node when deleted from payload', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-rmnode-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1: {}\n    node2: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      // Only include node1 in payload - node2 should be removed
      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'node1',
            name: 'node1',
            topoViewerRole: 'pe',
            extraData: { kind: 'linux' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.node1).to.exist;
        expect(parsed?.topology?.nodes?.node2).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('renames node when name differs from id', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-rename-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    oldname:\n      kind: linux\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'oldname',
            name: 'newname',
            topoViewerRole: 'pe',
            extraData: { kind: 'linux' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.newname).to.exist;
        expect(parsed?.topology?.nodes?.oldname).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('edit mode link handling', () => {
    it('creates veth link from payload edge', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-link-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1: {}\n    node2: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'node2', name: 'node2', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 100, y: 0 },
          parent: ''
        },
        {
          group: 'edges',
          data: {
            id: 'node1:eth0-node2:eth0',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth0',
            extraData: {}
          }
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.links).to.have.length(1);
        expect(parsed?.topology?.links?.[0]?.endpoints).to.include('node1:eth0');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('removes obsolete links', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-rmlink-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = `name: test
topology:
  nodes:
    node1: {}
    node2: {}
  links:
    - endpoints: ["node1:eth0", "node2:eth0"]
    - endpoints: ["node1:eth1", "node2:eth1"]
`;
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      // Only include first link, remove second
      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'node2', name: 'node2', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 100, y: 0 },
          parent: ''
        },
        {
          group: 'edges',
          data: {
            id: 'node1:eth0-node2:eth0',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth0',
            extraData: {}
          }
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.links).to.have.length(1);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('error handling', () => {
    it('throws error when adaptor has no currentClabDoc in edit mode', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-nodoc-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      fs.writeFileSync(yamlPath, 'name: test\ntopology:\n  nodes: {}\n');

      const adaptor = new TopoViewerAdaptorClab();
      // Don't set currentClabDoc

      const payload = JSON.stringify([]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('No parsed Document found');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('throws error when YAML nodes is not a map', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-notmap-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes: []\n'; // nodes is an array, not a map
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      const payload = JSON.stringify([]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        expect.fail('Should have thrown an error');
      } catch (err: any) {
        expect(err.message).to.include('YAML topology nodes is not a map');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('node properties', () => {
    it('updates group property', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-group-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1:\n      kind: linux\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'node1',
            name: 'node1',
            topoViewerRole: 'pe',
            extraData: { kind: 'linux', group: 'spine' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.node1?.group).to.equal('spine');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('updates mgmt-ipv4 property', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-mgmt-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1:\n      kind: linux\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'node1',
            name: 'node1',
            topoViewerRole: 'pe',
            extraData: { kind: 'linux', 'mgmt-ipv4': '172.20.0.10' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.node1?.['mgmt-ipv4']).to.equal('172.20.0.10');
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('special nodes filtering', () => {
    it('skips freeText nodes', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-freetext-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: {} },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'freetext-1', name: 'Label', topoViewerRole: 'freeText', extraData: {} },
          position: { x: 50, y: 50 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        // freeText node should not be added to YAML
        expect(parsed?.topology?.nodes?.['freetext-1']).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('skips group nodes', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-groupnode-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: {} },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'grp:spine', name: 'spine', topoViewerRole: 'group', extraData: {} },
          position: { x: 50, y: 50 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        // group node should not be added to YAML
        expect(parsed?.topology?.nodes?.['grp:spine']).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('skips freeShape nodes', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-shape-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: {} },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'shape-1', name: 'Rectangle', topoViewerRole: 'freeShape', extraData: {} },
          position: { x: 50, y: 50 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.['shape-1']).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('existing link updates', () => {
    it('updates existing veth link without changes (preserves format)', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-nochg-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = `name: test
topology:
  nodes:
    node1: {}
    node2: {}
  links:
    - endpoints: ["node1:eth0", "node2:eth0"]
`;
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'node2', name: 'node2', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 100, y: 0 },
          parent: ''
        },
        {
          group: 'edges',
          data: {
            id: 'node1:eth0-node2:eth0',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth0',
            extraData: {}
          }
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.links).to.have.length(1);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('updates existing link with mtu change', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-mtu-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = `name: test
topology:
  nodes:
    node1: {}
    node2: {}
  links:
    - endpoints: ["node1:eth0", "node2:eth0"]
`;
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'node2', name: 'node2', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 100, y: 0 },
          parent: ''
        },
        {
          group: 'edges',
          data: {
            id: 'node1:eth0-node2:eth0',
            source: 'node1',
            target: 'node2',
            sourceEndpoint: 'eth0',
            targetEndpoint: 'eth0',
            extraData: { extMtu: 9000 }
          }
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.links).to.have.length(1);
        expect(parsed?.topology?.links?.[0]?.mtu).to.equal(9000);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('bridge alias nodes', () => {
    it('handles bridge alias nodes with extYamlNodeId', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-alias-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = `name: test
topology:
  nodes:
    br1:
      kind: bridge
    node1:
      kind: linux
`;
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'br1:eth0',
            name: 'br1:eth0',
            topoViewerRole: 'bridge',
            extraData: { kind: 'bridge', extYamlNodeId: 'br1' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 100, y: 0 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        // br1 should still exist
        expect(parsed?.topology?.nodes?.br1).to.exist;
        // br1:eth0 should NOT be a separate node
        expect(parsed?.topology?.nodes?.['br1:eth0']).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it('handles bridge rename through alias node', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-brrename-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = `name: test
topology:
  nodes:
    br1:
      kind: bridge
`;
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      // Rename br1 to new-bridge via alias
      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: {
            id: 'br1:eth0',
            name: 'br1:eth0',
            topoViewerRole: 'bridge',
            extraData: { kind: 'bridge', extYamlNodeId: 'new-bridge' }
          },
          position: { x: 0, y: 0 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        const updatedYaml = fs.readFileSync(yamlPath, 'utf8');
        const parsed = YAML.parse(updatedYaml) as any;
        expect(parsed?.topology?.nodes?.['new-bridge']).to.exist;
        expect(parsed?.topology?.nodes?.br1).to.be.undefined;
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });

  describe('cloud nodes', () => {
    it('handles cloud node annotations', async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'saveViewport-cloud-'));
      const yamlPath = path.join(tmpDir, 'test.clab.yaml');
      const yamlContent = 'name: test\ntopology:\n  nodes:\n    node1: {}\n';
      fs.writeFileSync(yamlPath, yamlContent);

      const adaptor = new TopoViewerAdaptorClab();
      adaptor.currentClabDoc = YAML.parseDocument(yamlContent, { keepCstNodes: true } as any) as YAML.Document.Parsed;
      adaptor.currentClabTopo = YAML.parse(yamlContent) as any;

      sinon.stub(annotationsManager, 'loadAnnotations').resolves({
        freeTextAnnotations: [],
        groupStyleAnnotations: [],
        cloudNodeAnnotations: [],
        nodeAnnotations: []
      });
      const saveStub = sinon.stub(annotationsManager, 'saveAnnotations').resolves();

      const payload = JSON.stringify([
        {
          group: 'nodes',
          data: { id: 'node1', name: 'node1', topoViewerRole: 'pe', extraData: { kind: 'linux' } },
          position: { x: 0, y: 0 },
          parent: ''
        },
        {
          group: 'nodes',
          data: {
            id: 'cloud1',
            name: 'cloud1',
            topoViewerRole: 'cloud',
            extraData: { kind: 'bridge' }
          },
          position: { x: 200, y: 200 },
          parent: ''
        }
      ]);

      try {
        await saveViewport({
          mode: 'edit',
          yamlFilePath: yamlPath,
          payload,
          adaptor,
          setInternalUpdate: () => {}
        });
        // Cloud node annotations should be saved
        expect(saveStub.called).to.be.true;
        const savedAnnotations = saveStub.firstCall?.args[1];
        expect(savedAnnotations?.cloudNodeAnnotations).to.exist;
        expect(savedAnnotations?.cloudNodeAnnotations).to.have.length(1);
        if (savedAnnotations?.cloudNodeAnnotations) {
          expect(savedAnnotations.cloudNodeAnnotations[0]?.id).to.equal('cloud1');
        }
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });
  });
});
