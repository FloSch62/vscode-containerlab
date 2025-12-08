/* eslint-env mocha */
/* global describe, it, beforeEach, afterEach */
import { expect } from 'chai';
import * as sinon from 'sinon';
import * as fs from 'fs';
import { AnnotationsManager } from '../../../src/topoViewer/extension/services/AnnotationsFile';
import type {
  TopologyAnnotations,
  FreeTextAnnotation,
  FreeShapeAnnotation,
  GroupStyleAnnotation,
  CloudNodeAnnotation,
  NodeAnnotation
} from '../../../src/topoViewer/shared/types/topoViewerGraph';

// Constants for commonly used test values
const TEST_YAML_PATH = '/path/to/test.clab.yml';
const CUSTOM_YAML_PATH = '/path/to/my-lab.clab.yml';
const CUSTOM_ANNOTATIONS_PATH = '/path/to/my-lab.clab.yml.annotations.json';

/**
 * Helper to create empty annotations
 */
function createEmptyAnnotations(): TopologyAnnotations {
  return {
    freeTextAnnotations: [],
    freeShapeAnnotations: [],
    groupStyleAnnotations: [],
    cloudNodeAnnotations: [],
    nodeAnnotations: []
  };
}

/**
 * Helper to create sample text annotation
 */
function createTextAnnotation(id: string, text: string, x: number, y: number): FreeTextAnnotation {
  return { id, text, position: { x, y } };
}

/**
 * Tests for AnnotationsManager - Load Annotations
 */
describe('AnnotationsManager - Load Annotations', () => {
  let manager: AnnotationsManager;
  let fsAccessStub: sinon.SinonStub;
  let fsReadFileStub: sinon.SinonStub;

  beforeEach(() => {
    manager = new AnnotationsManager();
    fsAccessStub = sinon.stub(fs.promises, 'access');
    fsReadFileStub = sinon.stub(fs.promises, 'readFile');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should load annotations from existing file', async () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [createTextAnnotation('text1', 'Hello', 100, 200)],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    fsAccessStub.resolves();
    fsReadFileStub.resolves(JSON.stringify(annotations));

    const result = await manager.loadAnnotations(TEST_YAML_PATH);

    expect(result).to.deep.equal(annotations);
    expect(fsAccessStub.calledOnce).to.be.true;
    expect(fsReadFileStub.calledOnce).to.be.true;
  });

  it('should return empty annotations when file does not exist', async () => {
    fsAccessStub.rejects(new Error('ENOENT'));

    const result = await manager.loadAnnotations(TEST_YAML_PATH);

    expect(result.freeTextAnnotations).to.deep.equal([]);
    expect(result.freeShapeAnnotations).to.deep.equal([]);
    expect(result.groupStyleAnnotations).to.deep.equal([]);
    expect(result.cloudNodeAnnotations).to.deep.equal([]);
    expect(result.nodeAnnotations).to.deep.equal([]);
  });

  it('should use cache for repeated calls within TTL', async () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [createTextAnnotation('text1', 'Hello', 100, 200)],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    fsAccessStub.resolves();
    fsReadFileStub.resolves(JSON.stringify(annotations));

    const result1 = await manager.loadAnnotations(TEST_YAML_PATH);
    const result2 = await manager.loadAnnotations(TEST_YAML_PATH);

    expect(result1).to.deep.equal(result2);
    expect(fsReadFileStub.calledOnce).to.be.true;
  });

  it('should handle JSON parse errors gracefully', async () => {
    fsAccessStub.resolves();
    fsReadFileStub.resolves('invalid json {');

    const result = await manager.loadAnnotations(TEST_YAML_PATH);

    expect(result.freeTextAnnotations).to.deep.equal([]);
  });

  it('should construct correct annotations file path', async () => {
    fsAccessStub.rejects(new Error('ENOENT'));

    await manager.loadAnnotations(CUSTOM_YAML_PATH);

    expect(fsAccessStub.firstCall.args[0]).to.equal(CUSTOM_ANNOTATIONS_PATH);
  });
});

/**
 * Tests for AnnotationsManager - Save Annotations
 */
describe('AnnotationsManager - Save Annotations', () => {
  let manager: AnnotationsManager;
  let fsReadFileStub: sinon.SinonStub;
  let fsWriteFileStub: sinon.SinonStub;
  let fsUnlinkStub: sinon.SinonStub;

  beforeEach(() => {
    manager = new AnnotationsManager();
    fsReadFileStub = sinon.stub(fs.promises, 'readFile');
    fsWriteFileStub = sinon.stub(fs.promises, 'writeFile');
    fsUnlinkStub = sinon.stub(fs.promises, 'unlink');
  });

  afterEach(() => {
    sinon.restore();
  });

  it('should save annotations to file', async () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [createTextAnnotation('text1', 'Hello', 100, 200)],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    fsReadFileStub.rejects(new Error('ENOENT'));
    fsWriteFileStub.resolves();

    await manager.saveAnnotations(TEST_YAML_PATH, annotations);

    expect(fsWriteFileStub.calledOnce).to.be.true;
    const writtenContent = JSON.parse(fsWriteFileStub.firstCall.args[1]);
    expect(writtenContent).to.deep.equal(annotations);
  });

  it('should skip write when content unchanged', async () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [createTextAnnotation('text1', 'Hello', 100, 200)],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    fsReadFileStub.resolves(JSON.stringify(annotations, null, 2));

    await manager.saveAnnotations(TEST_YAML_PATH, annotations);

    expect(fsWriteFileStub.called).to.be.false;
  });

  it('should delete file when annotations are empty', async () => {
    const emptyAnnotations = createEmptyAnnotations();
    fsUnlinkStub.resolves();

    await manager.saveAnnotations(TEST_YAML_PATH, emptyAnnotations);

    expect(fsUnlinkStub.calledOnce).to.be.true;
    expect(fsWriteFileStub.called).to.be.false;
  });

  it('should handle delete errors gracefully when file does not exist', async () => {
    const emptyAnnotations = createEmptyAnnotations();
    fsUnlinkStub.rejects(new Error('ENOENT'));

    // Should not throw and unlink should have been attempted
    await manager.saveAnnotations(TEST_YAML_PATH, emptyAnnotations);
    expect(fsUnlinkStub.calledOnce).to.be.true;
  });
});

/**
 * Tests for AnnotationsManager - FreeText Annotations
 */
describe('AnnotationsManager - FreeText Annotations', () => {
  let manager: AnnotationsManager;

  beforeEach(() => {
    manager = new AnnotationsManager();
  });

  it('should add new text annotation', () => {
    const annotations = createEmptyAnnotations();
    const newAnnotation = createTextAnnotation('text1', 'Hello', 100, 200);

    const result = manager.addOrUpdateFreeTextAnnotation(annotations, newAnnotation);

    expect(result.freeTextAnnotations!).to.have.lengthOf(1);
    expect(result.freeTextAnnotations![0]).to.deep.equal(newAnnotation);
  });

  it('should update existing text annotation', () => {
    const existingAnnotation = createTextAnnotation('text1', 'Hello', 100, 200);
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [existingAnnotation],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };
    const updatedAnnotation = createTextAnnotation('text1', 'Updated', 150, 250);

    const result = manager.addOrUpdateFreeTextAnnotation(annotations, updatedAnnotation);

    expect(result.freeTextAnnotations!).to.have.lengthOf(1);
    expect(result.freeTextAnnotations![0].text).to.equal('Updated');
    expect(result.freeTextAnnotations![0].position.x).to.equal(150);
  });

  it('should initialize array if undefined', () => {
    const annotations = {
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    } as TopologyAnnotations;
    const newAnnotation = createTextAnnotation('text1', 'Hello', 100, 200);

    const result = manager.addOrUpdateFreeTextAnnotation(annotations, newAnnotation);

    expect(result.freeTextAnnotations!).to.have.lengthOf(1);
  });

  it('should remove text annotation by ID', () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [
        createTextAnnotation('text1', 'Hello', 100, 200),
        createTextAnnotation('text2', 'World', 300, 400)
      ],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    const result = manager.removeFreeTextAnnotation(annotations, 'text1');

    expect(result.freeTextAnnotations!).to.have.lengthOf(1);
    expect(result.freeTextAnnotations![0].id).to.equal('text2');
  });

  it('should handle removing non-existent annotation', () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [createTextAnnotation('text1', 'Hello', 100, 200)],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    const result = manager.removeFreeTextAnnotation(annotations, 'nonexistent');

    expect(result.freeTextAnnotations!).to.have.lengthOf(1);
  });

  it('should handle undefined freeTextAnnotations when removing', () => {
    const annotations = {
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    } as TopologyAnnotations;

    const result = manager.removeFreeTextAnnotation(annotations, 'text1');

    expect(result.freeTextAnnotations).to.be.undefined;
  });
});

/**
 * Tests for AnnotationsManager - FreeShape Annotations
 */
describe('AnnotationsManager - FreeShape Annotations', () => {
  let manager: AnnotationsManager;

  beforeEach(() => {
    manager = new AnnotationsManager();
  });

  it('should add new shape annotation', () => {
    const annotations = createEmptyAnnotations();
    const newShape: FreeShapeAnnotation = {
      id: 'shape1',
      shapeType: 'rectangle',
      position: { x: 100, y: 200 },
      width: 50,
      height: 50
    };

    const result = manager.addOrUpdateFreeShapeAnnotation(annotations, newShape);

    expect(result.freeShapeAnnotations!).to.have.lengthOf(1);
    expect(result.freeShapeAnnotations![0]).to.deep.equal(newShape);
  });

  it('should update existing shape annotation', () => {
    const existingShape: FreeShapeAnnotation = {
      id: 'shape1',
      shapeType: 'rectangle',
      position: { x: 100, y: 200 },
      width: 50,
      height: 50
    };
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [existingShape],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };
    const updatedShape: FreeShapeAnnotation = {
      id: 'shape1',
      shapeType: 'circle',
      position: { x: 150, y: 250 },
      width: 100,
      height: 100
    };

    const result = manager.addOrUpdateFreeShapeAnnotation(annotations, updatedShape);

    expect(result.freeShapeAnnotations!).to.have.lengthOf(1);
    expect(result.freeShapeAnnotations![0].shapeType).to.equal('circle');
  });

  it('should remove shape annotation by ID', () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [
        { id: 'shape1', shapeType: 'rectangle', position: { x: 100, y: 200 }, width: 50, height: 50 },
        { id: 'shape2', shapeType: 'circle', position: { x: 300, y: 400 }, width: 30, height: 30 }
      ],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    const result = manager.removeFreeShapeAnnotation(annotations, 'shape1');

    expect(result.freeShapeAnnotations!).to.have.lengthOf(1);
    expect(result.freeShapeAnnotations![0].id).to.equal('shape2');
  });
});

/**
 * Tests for AnnotationsManager - Group Styles
 */
describe('AnnotationsManager - Group Styles', () => {
  let manager: AnnotationsManager;

  beforeEach(() => {
    manager = new AnnotationsManager();
  });

  it('should add new group style', () => {
    const annotations = createEmptyAnnotations();
    const newStyle: GroupStyleAnnotation = {
      id: 'group1',
      backgroundColor: '#ff0000',
      borderColor: '#000000'
    };

    const result = manager.addOrUpdateGroupStyle(annotations, newStyle);

    expect(result.groupStyleAnnotations!).to.have.lengthOf(1);
    expect(result.groupStyleAnnotations![0]).to.deep.equal(newStyle);
  });

  it('should update existing group style', () => {
    const existingStyle: GroupStyleAnnotation = {
      id: 'group1',
      backgroundColor: '#ff0000',
      borderColor: '#000000'
    };
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [existingStyle],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };
    const updatedStyle: GroupStyleAnnotation = {
      id: 'group1',
      backgroundColor: '#00ff00',
      borderColor: '#ffffff'
    };

    const result = manager.addOrUpdateGroupStyle(annotations, updatedStyle);

    expect(result.groupStyleAnnotations!).to.have.lengthOf(1);
    expect(result.groupStyleAnnotations![0].backgroundColor).to.equal('#00ff00');
  });

  it('should remove group style by ID', () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [
        { id: 'group1', backgroundColor: '#ff0000' },
        { id: 'group2', backgroundColor: '#00ff00' }
      ],
      cloudNodeAnnotations: [],
      nodeAnnotations: []
    };

    const result = manager.removeGroupStyle(annotations, 'group1');

    expect(result.groupStyleAnnotations!).to.have.lengthOf(1);
    expect(result.groupStyleAnnotations![0].id).to.equal('group2');
  });
});

/**
 * Tests for AnnotationsManager - Cloud Nodes
 */
describe('AnnotationsManager - Cloud Nodes', () => {
  let manager: AnnotationsManager;

  beforeEach(() => {
    manager = new AnnotationsManager();
  });

  it('should add new cloud node', () => {
    const annotations = createEmptyAnnotations();
    const newCloudNode: CloudNodeAnnotation = {
      id: 'cloud1',
      type: 'host',
      label: 'Internet',
      position: { x: 500, y: 100 }
    };

    const result = manager.addOrUpdateCloudNode(annotations, newCloudNode);

    expect(result.cloudNodeAnnotations!).to.have.lengthOf(1);
    expect(result.cloudNodeAnnotations![0]).to.deep.equal(newCloudNode);
  });

  it('should update existing cloud node', () => {
    const existingCloudNode: CloudNodeAnnotation = {
      id: 'cloud1',
      type: 'host',
      label: 'Internet',
      position: { x: 500, y: 100 }
    };
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [existingCloudNode],
      nodeAnnotations: []
    };
    const updatedCloudNode: CloudNodeAnnotation = {
      id: 'cloud1',
      type: 'mgmt-net',
      label: 'AWS Cloud',
      position: { x: 600, y: 150 }
    };

    const result = manager.addOrUpdateCloudNode(annotations, updatedCloudNode);

    expect(result.cloudNodeAnnotations!).to.have.lengthOf(1);
    expect(result.cloudNodeAnnotations![0].label).to.equal('AWS Cloud');
  });

  it('should remove cloud node by ID', () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [
        { id: 'cloud1', type: 'host', label: 'Internet', position: { x: 500, y: 100 } },
        { id: 'cloud2', type: 'mgmt-net', label: 'Azure', position: { x: 700, y: 100 } }
      ],
      nodeAnnotations: []
    };

    const result = manager.removeCloudNode(annotations, 'cloud1');

    expect(result.cloudNodeAnnotations!).to.have.lengthOf(1);
    expect(result.cloudNodeAnnotations![0].id).to.equal('cloud2');
  });
});

/**
 * Tests for AnnotationsManager - Node Annotations
 */
describe('AnnotationsManager - Node Annotations', () => {
  let manager: AnnotationsManager;

  beforeEach(() => {
    manager = new AnnotationsManager();
  });

  it('should add new node annotation', () => {
    const annotations = createEmptyAnnotations();
    const newNode: NodeAnnotation = {
      id: 'node1',
      position: { x: 200, y: 300 }
    };

    const result = manager.addOrUpdateNode(annotations, newNode);

    expect(result.nodeAnnotations!).to.have.lengthOf(1);
    expect(result.nodeAnnotations![0]).to.deep.equal(newNode);
  });

  it('should update existing node annotation', () => {
    const existingNode: NodeAnnotation = {
      id: 'node1',
      position: { x: 200, y: 300 }
    };
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: [existingNode]
    };
    const updatedNode: NodeAnnotation = {
      id: 'node1',
      position: { x: 400, y: 500 }
    };

    const result = manager.addOrUpdateNode(annotations, updatedNode);

    expect(result.nodeAnnotations!).to.have.lengthOf(1);
    expect(result.nodeAnnotations![0].position!.x).to.equal(400);
    expect(result.nodeAnnotations![0].position!.y).to.equal(500);
  });

  it('should remove node annotation by ID', () => {
    const annotations: TopologyAnnotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: [],
      nodeAnnotations: [
        { id: 'node1', position: { x: 200, y: 300 } },
        { id: 'node2', position: { x: 400, y: 500 } }
      ]
    };

    const result = manager.removeNode(annotations, 'node1');

    expect(result.nodeAnnotations!).to.have.lengthOf(1);
    expect(result.nodeAnnotations![0].id).to.equal('node2');
  });

  it('should handle undefined nodeAnnotations when removing', () => {
    const annotations = {
      freeTextAnnotations: [],
      freeShapeAnnotations: [],
      groupStyleAnnotations: [],
      cloudNodeAnnotations: []
    } as TopologyAnnotations;

    const result = manager.removeNode(annotations, 'node1');

    expect(result.nodeAnnotations).to.be.undefined;
  });
});
