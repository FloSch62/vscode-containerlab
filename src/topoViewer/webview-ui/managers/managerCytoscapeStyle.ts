// file: managerCytoscapeStyle.ts
// Manager for handling Cytoscape styles for both view and edit modes

import cytoscape from 'cytoscape';

export class ManagerCytoscapeStyle {
  private cy: cytoscape.Core;
  private isEditMode: boolean = false;

  constructor(cy: cytoscape.Core) {
    this.cy = cy;
    this.isEditMode = false;
  }

  /**
   * Apply the appropriate style based on mode
   */
  public applyStyle(): void {
    const style = this.isEditMode ? this.getEditModeStyle() : this.getViewModeStyle();
    this.cy.style(style);
  }

  /**
   * Get base style that applies to both modes
   */
  private getBaseStyle(): any[] {
    return [
      {
        selector: 'node',
        style: {
          'label': 'data(name)',
          'text-valign': 'bottom',
          'text-halign': 'center',
          'background-color': '#666',
          'color': '#fff',
          'text-outline-width': 2,
          'text-outline-color': '#666',
          'font-size': 14,
          'width': 60,
          'height': 60,
          'shape': 'ellipse'
        }
      },
      {
        selector: 'node[topoViewerRole="router"]',
        style: {
          'background-image': 'url(../images/svg-router.svg)',
          'background-fit': 'cover',
          'background-color': 'transparent',
          'border-width': 0
        }
      },
      {
        selector: 'node[topoViewerRole="switch"]',
        style: {
          'background-image': 'url(../images/svg-switch.svg)',
          'background-fit': 'cover',
          'background-color': 'transparent',
          'border-width': 0
        }
      },
      {
        selector: 'node[topoViewerRole="host"]',
        style: {
          'background-image': 'url(../images/svg-host.svg)',
          'background-fit': 'cover',
          'background-color': 'transparent',
          'border-width': 0
        }
      },
      {
        selector: 'edge',
        style: {
          'width': 3,
          'line-color': '#ccc',
          'target-arrow-color': '#ccc',
          'curve-style': 'bezier',
          'label': 'data(label)',
          'font-size': 12,
          'text-background-color': 'white',
          'text-background-opacity': 0.8,
          'text-background-padding': 2
        }
      },
      {
        selector: '.selected',
        style: {
          'background-color': '#61bffc',
          'line-color': '#61bffc',
          'target-arrow-color': '#61bffc',
          'transition-property': 'background-color, line-color, target-arrow-color',
          'transition-duration': '0.2s'
        }
      },
      {
        selector: '.highlighted',
        style: {
          'background-color': '#ff9900',
          'line-color': '#ff9900',
          'target-arrow-color': '#ff9900',
          'transition-property': 'background-color, line-color, target-arrow-color',
          'transition-duration': '0.2s'
        }
      },
      {
        selector: ':parent',
        style: {
          'background-opacity': 0.1,
          'border-width': 2,
          'border-style': 'dashed',
          'border-color': '#999',
          'label': 'data(id)',
          'text-valign': 'top',
          'text-halign': 'center',
          'font-size': 16,
          'font-weight': 'bold'
        }
      }
    ];
  }

  /**
   * Get view mode specific styles
   */
  private getViewModeStyle(): any[] {
    const baseStyle = this.getBaseStyle();
    
    // Add view mode specific styles
    const viewModeStyles: any[] = [
      {
        selector: 'node[?containerDockerExtraAttribute][containerDockerExtraAttribute.state = "running"]',
        style: {
          'border-width': 3,
          'border-color': '#4caf50',
          'border-style': 'solid'
        }
      },
      {
        selector: 'node[?containerDockerExtraAttribute][containerDockerExtraAttribute.state = "stopped"]',
        style: {
          'border-width': 3,
          'border-color': '#f44336',
          'border-style': 'solid',
          'opacity': 0.5
        }
      },
      {
        selector: 'edge.endpoint-visible',
        style: {
          'source-label': 'data(sourceEndpoint)',
          'target-label': 'data(targetEndpoint)',
          'source-text-offset': 50,
          'target-text-offset': 50,
          'font-size': 10,
          'color': '#666'
        }
      }
    ];

    return [...baseStyle, ...viewModeStyles];
  }

  /**
   * Get edit mode specific styles
   */
  private getEditModeStyle(): any[] {
    const baseStyle = this.getBaseStyle();
    
    // Add edit mode specific styles
    const editModeStyles: any[] = [
      {
        selector: 'node:grabbed',
        style: {
          'border-width': 3,
          'border-color': '#61bffc',
          'border-style': 'solid'
        }
      },
      {
        selector: '.eh-handle',
        style: {
          'background-color': 'red',
          'width': 12,
          'height': 12,
          'shape': 'ellipse',
          'overlay-opacity': 0,
          'border-width': 12,
          'border-opacity': 0
        }
      },
      {
        selector: '.eh-hover',
        style: {
          'background-color': 'red'
        }
      },
      {
        selector: '.eh-source',
        style: {
          'border-width': 2,
          'border-color': 'red'
        }
      },
      {
        selector: '.eh-target',
        style: {
          'border-width': 2,
          'border-color': 'red'
        }
      },
      {
        selector: '.eh-preview, .eh-ghost-edge',
        style: {
          'background-color': 'red',
          'line-color': 'red',
          'target-arrow-color': 'red',
          'source-arrow-color': 'red'
        }
      },
      {
        selector: '.editable',
        style: {
          'cursor': 'move'
        }
      }
    ];

    return [...baseStyle, ...editModeStyles];
  }

  /**
   * Toggle endpoint visibility
   */
  public toggleEndpointVisibility(visible: boolean): void {
    if (visible) {
      this.cy.edges().addClass('endpoint-visible');
    } else {
      this.cy.edges().removeClass('endpoint-visible');
    }
  }

  /**
   * Toggle container status visibility
   */
  public toggleContainerStatusVisibility(visible: boolean): void {
    // This is handled through the style selectors based on node data
    // Just trigger a style update
    this.cy.style().update();
  }

  /**
   * Update mode
   */
  public setMode(editMode: boolean): void {
    this.isEditMode = editMode;
    this.applyStyle();
  }
}