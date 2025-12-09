/* eslint-env mocha */
import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import cytoscape from 'cytoscape';
import { GroupManager } from '../../../src/topoViewer/webview/features/groups/GroupManager';
import { GroupStyleManager } from '../../../src/topoViewer/webview/features/groups/GroupStyleManager';

// ensure window is available for global assignments
(globalThis as any).window = globalThis;

const TEST_GROUP_ID = 'test-group:1';

function createCy(elements: any[] = []) {
  return cytoscape({ headless: true, elements });
}

function createMessageSender() {
  return { sendMessageToVscodeEndpointPost: sinon.stub().resolves({}) } as any;
}

describe('GroupManager - constructor', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates instance with cy and groupStyleManager', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    expect(mgr).to.be.instanceOf(GroupManager);
  });

  it('accepts view mode', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'view');

    expect(mgr).to.be.instanceOf(GroupManager);
  });
});

describe('GroupManager - createNewParent', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates a new group node', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const groupId = mgr.createNewParent();

    expect(groupId).to.be.a('string');
    const group = cy.getElementById(groupId);
    expect(group.length).to.equal(1);
    expect(group.data('topoViewerRole')).to.equal('group');
  });

  it('creates group with sequential naming', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const firstId = mgr.createNewParent();
    const secondId = mgr.createNewParent();

    expect(firstId).to.not.equal(secondId);
    expect(cy.getElementById(firstId).length).to.equal(1);
    expect(cy.getElementById(secondId).length).to.equal(1);
  });

  it('creates group with empty-group class', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const groupId = mgr.createNewParent();

    const group = cy.getElementById(groupId);
    expect(group.hasClass('empty-group')).to.be.true;
  });
});

describe('GroupManager - orphaningNode', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('removes node from parent group', () => {
    const cy = createCy([
      { data: { id: 'group:1', topoViewerRole: 'group' } },
      { data: { id: 'node1', parent: 'group:1' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const node = cy.getElementById('node1');
    mgr.orphaningNode(node);

    expect(node.parent().length).to.equal(0);
  });

  it('does nothing when node has no parent', () => {
    const cy = createCy([
      { data: { id: 'node1' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const node = cy.getElementById('node1');
    expect(() => mgr.orphaningNode(node)).not.to.throw();
  });

  it('handles parent becoming empty after orphaning', () => {
    const cy = createCy([
      { data: { id: 'group:1', topoViewerRole: 'group' } },
      { data: { id: 'node1', parent: 'group:1' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const node = cy.getElementById('node1');
    mgr.orphaningNode(node);

    // Verify the node was orphaned
    expect(node.parent().length).to.equal(0);
    // The group should now have no children
    const group = cy.getElementById('group:1');
    expect(group.children().length).to.equal(0);
  });
});

describe('GroupManager - directGroupRemoval', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      getElementById: sinon.stub().returns(null)
    };
  });

  afterEach(() => {
    sinon.restore();
    delete (globalThis as any).document;
  });

  it('removes empty group', () => {
    const cy = createCy([
      { data: { id: TEST_GROUP_ID, topoViewerRole: 'group' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const result = mgr.directGroupRemoval(TEST_GROUP_ID);

    expect(result).to.be.true;
    expect(cy.getElementById(TEST_GROUP_ID).length).to.equal(0);
  });

  it('returns false when group not found', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const result = mgr.directGroupRemoval('nonexistent');

    expect(result).to.be.false;
  });

  it('orphans children before removal', () => {
    const cy = createCy([
      { data: { id: 'group:1', topoViewerRole: 'group' } },
      { data: { id: 'node1', parent: 'group:1' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    mgr.directGroupRemoval('group:1');

    const node = cy.getElementById('node1');
    expect(node.length).to.equal(1);
    expect(node.parent().length).to.equal(0);
  });
});

describe('GroupManager - nodeParentPropertiesUpdateClose', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      getElementById: sinon.stub().returns(null)
    };
  });

  afterEach(() => {
    sinon.restore();
    delete (globalThis as any).document;
  });

  it('returns false when panel element not found', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const result = mgr.nodeParentPropertiesUpdateClose();

    expect(result).to.be.false;
  });
});

describe('GroupManager - nodeParentRemoval', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      getElementById: sinon.stub().returns(null)
    };
  });

  afterEach(() => {
    sinon.restore();
    delete (globalThis as any).document;
  });

  it('returns false when panel element not found', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const result = mgr.nodeParentRemoval();

    expect(result).to.be.false;
  });
});

describe('GroupManager - showGroupEditor edge cases', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      getElementById: sinon.stub().returns(null)
    };
  });

  afterEach(() => {
    sinon.restore();
    delete (globalThis as any).document;
  });

  it('handles string id input', () => {
    const cy = createCy([
      { data: { id: TEST_GROUP_ID, topoViewerRole: 'group' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    expect(() => mgr.showGroupEditor(TEST_GROUP_ID)).not.to.throw();
  });

  it('handles node input', () => {
    const cy = createCy([
      { data: { id: TEST_GROUP_ID, topoViewerRole: 'group' } }
    ]);
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const node = cy.getElementById(TEST_GROUP_ID);
    expect(() => mgr.showGroupEditor(node)).not.to.throw();
  });

  it('does nothing for non-existent node', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    expect(() => mgr.showGroupEditor('nonexistent')).not.to.throw();
  });
});

describe('GroupManager - viewportButtonsAddGroup', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('creates a new group when called', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    const initialCount = cy.nodes('[topoViewerRole="group"]').length;
    mgr.viewportButtonsAddGroup();
    const finalCount = cy.nodes('[topoViewerRole="group"]').length;

    expect(finalCount).to.equal(initialCount + 1);
  });
});

describe('GroupManager - panelNodeEditorParentToggleDropdown', () => {
  beforeEach(() => {
    (globalThis as any).document = {
      getElementById: sinon.stub().returns(null)
    };
  });

  afterEach(() => {
    sinon.restore();
    delete (globalThis as any).document;
  });

  it('does nothing when dropdown element not found', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    expect(() => mgr.panelNodeEditorParentToggleDropdown()).not.to.throw();
  });
});

describe('GroupManager - initializeWheelSelection', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('does not throw when called', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    expect(() => mgr.initializeWheelSelection()).not.to.throw();
  });
});

describe('GroupManager - initializeGroupManagement', () => {
  afterEach(() => {
    sinon.restore();
  });

  it('does not throw when called', () => {
    const cy = createCy();
    const messageSender = createMessageSender();
    const styleManager = new GroupStyleManager(cy, messageSender);
    const mgr = new GroupManager(cy, styleManager, 'edit');

    expect(() => mgr.initializeGroupManagement()).not.to.throw();
  });
});
