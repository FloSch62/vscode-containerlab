// file: managerGroupManager.ts
// Manager for handling node groups

import cytoscape from 'cytoscape';

export class ManagerGroupManager {
  private cy: cytoscape.Core;
  private groupCounter: number = 0;

  constructor(cy: cytoscape.Core) {
    this.cy = cy;
    this.initializeGroupCounter();
  }

  /**
   * Initialize group counter based on existing groups
   */
  private initializeGroupCounter(): void {
    if (!this.cy) return;
    
    const groupIds = this.cy.nodes(':parent').map(n => n.id());
    const numbers = groupIds
      .map(id => {
        const match = id.match(/(\d+)$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(n => !isNaN(n));
    
    this.groupCounter = numbers.length > 0 ? Math.max(...numbers) : 0;
  }

  /**
   * Create a new group from selected nodes
   */
  public createGroupFromSelected(groupName?: string): cytoscape.NodeSingular | null {
    if (!this.cy) return null;
    
    const selectedNodes = this.cy.$('node:selected');
    if (selectedNodes.length === 0) return null;
    
    const groupId = groupName || `group${++this.groupCounter}`;
    
    // Calculate bounding box for group
    const bb = selectedNodes.boundingBox();
    
    // Create group node
    const group = this.cy.add({
      group: 'nodes',
      data: {
        id: groupId,
        name: groupId
      },
      position: {
        x: bb.x1 + bb.w / 2,
        y: bb.y1 + bb.h / 2
      }
    });
    
    // Move selected nodes into group
    selectedNodes.move({ parent: groupId });
    
    // Trigger modified event
    this.cy.trigger('modified');
    
    return group;
  }

  /**
   * Ungroup nodes from their parent
   */
  public ungroupSelected(): void {
    if (!this.cy) return;
    
    const selectedNodes = this.cy.$('node:selected');
    
    selectedNodes.forEach(node => {
      if (node.parent().length > 0) {
        node.move({ parent: null });
      }
    });
    
    // Remove empty groups
    this.removeEmptyGroups();
    
    // Trigger modified event
    this.cy.trigger('modified');
  }

  /**
   * Remove empty group nodes
   */
  public removeEmptyGroups(): void {
    if (!this.cy) return;
    
    const groups = this.cy.nodes(':parent');
    
    groups.forEach(group => {
      if (group.children().length === 0) {
        group.remove();
      }
    });
  }

  /**
   * Expand all groups
   */
  public expandAllGroups(): void {
    if (!this.cy) return;
    
    const groups = this.cy.nodes(':parent');
    groups.style('display', 'element');
    
    const children = this.cy.nodes(':child');
    children.style('display', 'element');
  }

  /**
   * Collapse all groups
   */
  public collapseAllGroups(): void {
    if (!this.cy) return;
    
    const children = this.cy.nodes(':child');
    children.style('display', 'none');
  }

  /**
   * Toggle group expansion
   */
  public toggleGroup(groupId: string): void {
    if (!this.cy) return;
    
    const group = this.cy.getElementById(groupId);
    if (group.length === 0) return;
    
    const children = group.children();
    const isVisible = children.style('display') === 'element';
    
    children.style('display', isVisible ? 'none' : 'element');
  }

  /**
   * Get group hierarchy
   */
  public getGroupHierarchy(): any {
    if (!this.cy) return {};
    
    const hierarchy: any = {};
    
    this.cy.nodes(':parent').forEach(group => {
      hierarchy[group.id()] = {
        name: group.data('name') || group.id(),
        children: group.children().map(child => child.id()),
        level: group.data('level') || 1
      };
    });
    
    return hierarchy;
  }

  /**
   * Set group label position
   */
  public setGroupLabelPosition(groupId: string, position: string): void {
    if (!this.cy) return;
    
    const group = this.cy.getElementById(groupId);
    if (group.length === 0) return;
    
    group.data('groupLabelPos', position);
    
    // Update style
    const validPositions = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];
    if (validPositions.includes(position)) {
      const [vAlign, hAlign] = position.split('-');
      group.style({
        'text-valign': vAlign,
        'text-halign': hAlign === 'center' ? 'center' : hAlign
      });
    }
  }

  /**
   * Auto-arrange nodes within groups
   */
  public arrangeNodesInGroups(): void {
    if (!this.cy) return;
    
    const groups = this.cy.nodes(':parent');
    
    groups.forEach(group => {
      const children = group.children();
      if (children.length === 0) return;
      
      // Apply grid layout within group
      const cols = Math.ceil(Math.sqrt(children.length));
      const groupBB = group.boundingBox();
      const padding = 50;
      const spacing = 100;
      
      children.forEach((child, index) => {
        const row = Math.floor(index / cols);
        const col = index % cols;
        
        child.position({
          x: groupBB.x1 + padding + col * spacing,
          y: groupBB.y1 + padding + row * spacing
        });
      });
    });
    
    // Trigger modified event
    this.cy.trigger('modified');
  }
}