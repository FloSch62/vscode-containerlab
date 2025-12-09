/* eslint-env mocha */
import { describe, it, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import cytoscape from 'cytoscape';
import { FreeTextManager } from '../../../src/topoViewer/webview/features/annotations/FreeTextManager';
import type { FreeTextAnnotation } from '../../../src/topoViewer/shared/types/topoViewerGraph';

// ensure window is available
(globalThis as any).window = globalThis;

const TEST_ANNOTATION_ID = 'freeText_test';
const ROLE_FREE_TEXT = 'freeText';

function createCy(elements: any[] = []) {
  return cytoscape({ headless: true, elements });
}

function createMessageSender() {
  return { sendMessageToVscodeEndpointPost: sinon.stub().resolves({}) } as any;
}

function createBasicAnnotation(id: string = TEST_ANNOTATION_ID): FreeTextAnnotation {
  return {
    id,
    text: 'Test annotation',
    position: { x: 100, y: 100 },
    fontSize: 14,
    fontColor: '#FFFFFF',
    backgroundColor: 'transparent'
  };
}

describe('FreeTextManager - constructor', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates instance with cy and messageSender', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(mgr).to.be.instanceOf(FreeTextManager);
  });
});

describe('FreeTextManager - getAnnotations', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('returns empty array initially', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotations = mgr.getAnnotations();

    expect(annotations).to.be.an('array');
    expect(annotations).to.have.length(0);
  });

  it('returns added annotations', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    const annotations = mgr.getAnnotations();
    expect(annotations).to.have.length(1);
    expect(annotations[0].id).to.equal(TEST_ANNOTATION_ID);
  });
});

describe('FreeTextManager - addFreeTextAnnotation', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('adds annotation to the manager', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    expect(mgr.getAnnotations()).to.have.length(1);
  });

  it('creates a cytoscape node for the annotation', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    const node = cy.getElementById(TEST_ANNOTATION_ID);
    expect(node.length).to.equal(1);
    expect(node.data('topoViewerRole')).to.equal(ROLE_FREE_TEXT);
  });

  it('sets node position from annotation', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    annotation.position = { x: 200, y: 300 };
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    const node = cy.getElementById(TEST_ANNOTATION_ID);
    const pos = node.position();
    expect(pos.x).to.equal(200);
    expect(pos.y).to.equal(300);
  });

  it('handles annotation with all font properties', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation: FreeTextAnnotation = {
      id: TEST_ANNOTATION_ID,
      text: 'Styled text',
      position: { x: 100, y: 100 },
      fontSize: 18,
      fontColor: '#FF0000',
      backgroundColor: '#333333',
      fontWeight: 'bold',
      fontStyle: 'italic',
      textDecoration: 'underline',
      fontFamily: 'Arial'
    };
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    const annotations = mgr.getAnnotations();
    expect(annotations[0].fontWeight).to.equal('bold');
    expect(annotations[0].fontStyle).to.equal('italic');
  });
});

describe('FreeTextManager - removeFreeTextAnnotation', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('removes annotation by id', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });
    expect(mgr.getAnnotations()).to.have.length(1);

    mgr.removeFreeTextAnnotation(TEST_ANNOTATION_ID);
    expect(mgr.getAnnotations()).to.have.length(0);
  });

  it('removes corresponding cytoscape node', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    mgr.removeFreeTextAnnotation(TEST_ANNOTATION_ID);

    const node = cy.getElementById(TEST_ANNOTATION_ID);
    expect(node.length).to.equal(0);
  });

  it('handles non-existent annotation gracefully', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(() => mgr.removeFreeTextAnnotation('nonexistent')).not.to.throw();
  });
});

describe('FreeTextManager - clearAnnotations', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('removes all annotations', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation('ann1'), { skipSave: true });
    mgr.addFreeTextAnnotation(createBasicAnnotation('ann2'), { skipSave: true });
    expect(mgr.getAnnotations()).to.have.length(2);

    mgr.clearAnnotations(false);
    expect(mgr.getAnnotations()).to.have.length(0);
  });

  it('removes all cytoscape nodes', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation('ann1'), { skipSave: true });
    mgr.addFreeTextAnnotation(createBasicAnnotation('ann2'), { skipSave: true });

    mgr.clearAnnotations(false);

    expect(cy.nodes(`[topoViewerRole="${ROLE_FREE_TEXT}"]`).length).to.equal(0);
  });
});

describe('FreeTextManager - syncAnnotationPositions populated', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('syncs positions when annotations exist', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const annotation = createBasicAnnotation();
    mgr.addFreeTextAnnotation(annotation, { skipSave: true });

    expect(() => mgr.syncAnnotationPositions()).not.to.throw();
  });
});

describe('FreeTextManager - syncAnnotationPositions empty', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('handles empty annotation list during sync', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(() => mgr.syncAnnotationPositions()).not.to.throw();
  });
});

describe('FreeTextManager - restoreAnnotationPositions', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('restores positions from annotation data', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation(), { skipSave: true });

    expect(() => mgr.restoreAnnotationPositions()).not.to.throw();
  });
});

describe('FreeTextManager - setGroupStyleManager', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('accepts group style manager', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    const mockGroupStyleManager = {} as any;

    expect(() => mgr.setGroupStyleManager(mockGroupStyleManager)).not.to.throw();
  });
});

describe('FreeTextManager - enableAddTextMode', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('enables add text mode without error', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(() => mgr.enableAddTextMode()).not.to.throw();
  });
});

describe('FreeTextManager - disableAddTextMode', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('disables add text mode without error', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.enableAddTextMode();
    expect(() => mgr.disableAddTextMode()).not.to.throw();
  });
});

describe('FreeTextManager - reapplyAllFreeTextStyles empty', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('handles empty annotation list', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(() => mgr.reapplyAllFreeTextStyles()).not.to.throw();
  });
});

describe('FreeTextManager - reapplyAllFreeTextStyles populated', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('handles populated annotation list', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation(), { skipSave: true });

    expect(() => mgr.reapplyAllFreeTextStyles()).not.to.throw();
  });
});

describe('FreeTextManager - deleteSelectedFreeText', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('does nothing when no freeText nodes selected', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation(), { skipSave: true });

    mgr.deleteSelectedFreeText();

    expect(mgr.getAnnotations()).to.have.length(1);
  });

  it('removes selected freeText annotation', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation(), { skipSave: true });
    cy.getElementById(TEST_ANNOTATION_ID).select();

    mgr.deleteSelectedFreeText();

    expect(mgr.getAnnotations()).to.have.length(0);
  });
});

describe('FreeTextManager - queueSaveAnnotations', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('queues save operation without error', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(() => mgr.queueSaveAnnotations()).not.to.throw();
  });
});

describe('FreeTextManager - syncSavedStateBaseline', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('syncs saved state baseline without error', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    expect(() => mgr.syncSavedStateBaseline()).not.to.throw();
  });
});

describe('FreeTextManager - multiple annotations', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('handles multiple annotations correctly', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation('ann1'), { skipSave: true });
    mgr.addFreeTextAnnotation(createBasicAnnotation('ann2'), { skipSave: true });
    mgr.addFreeTextAnnotation(createBasicAnnotation('ann3'), { skipSave: true });

    expect(mgr.getAnnotations()).to.have.length(3);
    expect(cy.nodes(`[topoViewerRole="${ROLE_FREE_TEXT}"]`).length).to.equal(3);
  });

  it('removes only specified annotation', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const mgr = new FreeTextManager(cy, messageSender);

    mgr.addFreeTextAnnotation(createBasicAnnotation('ann1'), { skipSave: true });
    mgr.addFreeTextAnnotation(createBasicAnnotation('ann2'), { skipSave: true });
    mgr.addFreeTextAnnotation(createBasicAnnotation('ann3'), { skipSave: true });

    mgr.removeFreeTextAnnotation('ann2');

    const annotations = mgr.getAnnotations();
    expect(annotations).to.have.length(2);
    expect(annotations.find(a => a.id === 'ann1')).to.exist;
    expect(annotations.find(a => a.id === 'ann2')).to.be.undefined;
    expect(annotations.find(a => a.id === 'ann3')).to.exist;
  });
});
