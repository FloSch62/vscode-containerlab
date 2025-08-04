// file: managerLayoutAlgo.ts
// Manager for handling layout algorithms

import cytoscape from 'cytoscape';

export class ManagerLayoutAlgo {
  private cy: cytoscape.Core;
  private currentLayout: string = 'preset';

  constructor(cy: cytoscape.Core) {
    this.cy = cy;
  }

  /**
   * Apply a layout algorithm to the graph
   */
  public applyLayout(layoutName: string, options?: any): void {
    this.currentLayout = layoutName;
    
    const layoutOptions = this.getLayoutOptions(layoutName, options);
    const layout = this.cy.layout(layoutOptions);
    
    layout.run();
  }

  /**
   * Get layout options based on layout name
   */
  private getLayoutOptions(layoutName: string, customOptions?: any): any {
    const baseOptions: Record<string, any> = {
      preset: {
        name: 'preset',
        fit: true,
        padding: 30
      },
      cola: {
        name: 'cola',
        animate: true,
        randomize: false,
        convergenceThreshold: 0.1,
        nodeSpacing: 50,
        edgeLength: 200,
        maxSimulationTime: 4000,
        fit: true,
        padding: 30
      },
      grid: {
        name: 'grid',
        fit: true,
        padding: 30,
        rows: undefined,
        cols: undefined,
        position: (node: any) => {
          return { row: node.data('row'), col: node.data('col') };
        }
      },
      circle: {
        name: 'circle',
        fit: true,
        padding: 30,
        radius: undefined,
        startAngle: 3 / 2 * Math.PI,
        sweep: undefined,
        clockwise: true,
        sort: undefined
      },
      concentric: {
        name: 'concentric',
        fit: true,
        padding: 30,
        startAngle: 3 / 2 * Math.PI,
        sweep: undefined,
        clockwise: true,
        equidistant: false,
        minNodeSpacing: 50,
        concentric: (node: any) => {
          return node.degree();
        },
        levelWidth: (nodes: any) => {
          return 2;
        }
      },
      breadthfirst: {
        name: 'breadthfirst',
        fit: true,
        directed: false,
        padding: 30,
        circle: false,
        spacingFactor: 1.75,
        boundingBox: undefined,
        avoidOverlap: true,
        maximal: false
      },
      cose: {
        name: 'cose',
        animate: true,
        animationDuration: 1000,
        animationEasing: undefined,
        fit: true,
        padding: 30,
        boundingBox: undefined,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        nodeOverlap: 10,
        idealEdgeLength: 100,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
      }
    };

    const options = baseOptions[layoutName] || baseOptions.preset;
    
    // Merge with custom options if provided
    if (customOptions) {
      return { ...options, ...customOptions };
    }
    
    return options;
  }

  /**
   * Get current layout name
   */
  public getCurrentLayout(): string {
    return this.currentLayout;
  }

  /**
   * Get list of available layouts
   */
  public getAvailableLayouts(): string[] {
    return [
      'preset',
      'cola',
      'grid',
      'circle',
      'concentric',
      'breadthfirst',
      'cose'
    ];
  }

  /**
   * Save current positions as preset
   */
  public saveAsPreset(): Record<string, { x: number; y: number }> {
    const positions: Record<string, { x: number; y: number }> = {};
    
    this.cy.nodes().forEach((node) => {
      const pos = node.position();
      positions[node.id()] = {
        x: Math.round(pos.x),
        y: Math.round(pos.y)
      };
    });
    
    return positions;
  }

  /**
   * Apply preset positions
   */
  public applyPresetPositions(positions: Record<string, { x: number; y: number }>): void {
    this.cy.nodes().forEach((node) => {
      const id = node.id();
      if (positions[id]) {
        node.position(positions[id]);
      }
    });
  }

  /**
   * Auto-arrange disconnected components
   */
  public arrangeComponents(): void {
    const components = this.cy.elements().components();
    
    if (components.length <= 1) {
      return; // Nothing to arrange
    }
    
    // Calculate bounding boxes for each component
    const boundingBoxes = components.map(component => {
      const bb = component.boundingBox();
      return {
        component,
        width: bb.w,
        height: bb.h,
        centerX: bb.x1 + bb.w / 2,
        centerY: bb.y1 + bb.h / 2
      };
    });
    
    // Sort by size (largest first)
    boundingBoxes.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    // Arrange in a grid
    const padding = 100;
    let currentX = 0;
    let currentY = 0;
    let rowHeight = 0;
    const maxWidth = Math.sqrt(boundingBoxes.reduce((sum, bb) => sum + bb.width * bb.height, 0)) * 1.5;
    
    boundingBoxes.forEach((bb, index) => {
      // Move to next row if needed
      if (currentX + bb.width > maxWidth && index > 0) {
        currentX = 0;
        currentY += rowHeight + padding;
        rowHeight = 0;
      }
      
      // Calculate offset
      const offsetX = currentX + bb.width / 2 - bb.centerX;
      const offsetY = currentY + bb.height / 2 - bb.centerY;
      
      // Move all nodes in component
      bb.component.nodes().forEach((node: cytoscape.NodeSingular) => {
        const pos = node.position();
        node.position({
          x: pos.x + offsetX,
          y: pos.y + offsetY
        });
      });
      
      // Update position for next component
      currentX += bb.width + padding;
      rowHeight = Math.max(rowHeight, bb.height);
    });
    
    // Fit to viewport
    this.cy.fit();
  }

  /**
   * Align selected nodes
   */
  public alignNodes(alignment: 'left' | 'right' | 'top' | 'bottom' | 'center-x' | 'center-y'): void {
    const selectedNodes = this.cy.$('node:selected');
    
    if (selectedNodes.length < 2) {
      return;
    }
    
    const positions: cytoscape.Position[] = [];
    selectedNodes.forEach(node => positions.push(node.position()));
    
    switch (alignment) {
      case 'left':
        const minX = Math.min(...positions.map(p => p.x));
        selectedNodes.forEach((node: cytoscape.NodeSingular) => { node.position('x', minX); });
        break;
        
      case 'right':
        const maxX = Math.max(...positions.map(p => p.x));
        selectedNodes.forEach((node: cytoscape.NodeSingular) => { node.position('x', maxX); });
        break;
        
      case 'top':
        const minY = Math.min(...positions.map(p => p.y));
        selectedNodes.forEach((node: cytoscape.NodeSingular) => { node.position('y', minY); });
        break;
        
      case 'bottom':
        const maxY = Math.max(...positions.map(p => p.y));
        selectedNodes.forEach((node: cytoscape.NodeSingular) => { node.position('y', maxY); });
        break;
        
      case 'center-x':
        const avgX = positions.reduce((sum, p) => sum + p.x, 0) / positions.length;
        selectedNodes.forEach((node: cytoscape.NodeSingular) => { node.position('x', avgX); });
        break;
        
      case 'center-y':
        const avgY = positions.reduce((sum, p) => sum + p.y, 0) / positions.length;
        selectedNodes.forEach((node: cytoscape.NodeSingular) => { node.position('y', avgY); });
        break;
    }
  }

  /**
   * Distribute selected nodes evenly
   */
  public distributeNodes(direction: 'horizontal' | 'vertical'): void {
    const selectedNodes = this.cy.$('node:selected');
    
    if (selectedNodes.length < 3) {
      return;
    }
    
    const sortedNodes = selectedNodes.sort((a: cytoscape.NodeSingular, b: cytoscape.NodeSingular) => {
      const posA = a.position();
      const posB = b.position();
      return direction === 'horizontal' ? posA.x - posB.x : posA.y - posB.y;
    });
    
    const firstPos = sortedNodes.first().position();
    const lastPos = sortedNodes.last().position();
    const spacing = direction === 'horizontal' 
      ? (lastPos.x - firstPos.x) / (sortedNodes.length - 1)
      : (lastPos.y - firstPos.y) / (sortedNodes.length - 1);
    
    sortedNodes.forEach((node, index) => {
      if (index === 0 || index === sortedNodes.length - 1) {
        return; // Keep first and last nodes in place
      }
      
      if (direction === 'horizontal') {
        node.position('x', firstPos.x + spacing * index);
      } else {
        node.position('y', firstPos.y + spacing * index);
      }
    });
  }
}