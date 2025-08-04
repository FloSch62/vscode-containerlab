// file: managerSocketDataEnrichment.ts
// Manager for enriching topology data with real-time container status

import cytoscape from 'cytoscape';

export class ManagerSocketDataEnrichment {
  private cy: cytoscape.Core;
  private updateInterval: number | null = null;
  private useSocket: boolean = false;
  private socketPort: number = 0;

  constructor(cy: cytoscape.Core) {
    this.cy = cy;
    
    // Check if socket configuration is available
    this.useSocket = (window as any).useSocket || false;
    this.socketPort = (window as any).socketPort || 0;
  }

  /**
   * Start data enrichment
   */
  public start(): void {
    if (this.useSocket && this.socketPort > 0) {
      this.startSocketConnection();
    } else {
      this.startMessageListener();
    }
  }

  /**
   * Stop data enrichment
   */
  public stop(): void {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }
  }

  /**
   * Start socket connection for real-time updates
   */
  private startSocketConnection(): void {
    // TODO: Implement socket.io connection
    console.log('Socket connection not yet implemented');
    
    // Fallback to message listener
    this.startMessageListener();
  }

  /**
   * Start listening for VS Code messages
   */
  private startMessageListener(): void {
    // Listen for container status updates
    window.addEventListener('message', this.handleMessage.bind(this));
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data;
    
    if (message.type === 'clab-tree-provider-data-native-vscode-message-stream') {
      this.updateContainerData(message.data);
    }
  }

  /**
   * Update container data in cytoscape
   */
  private updateContainerData(labData: any): void {
    if (!labData) return;
    
    Object.entries(labData).forEach(([labName, lab]: [string, any]) => {
      if (lab.containers) {
        Object.entries(lab.containers).forEach(([containerName, container]: [string, any]) => {
          this.updateNodeData(containerName, container);
        });
      }
    });
  }

  /**
   * Update individual node data
   */
  private updateNodeData(nodeName: string, containerData: any): void {
    // Find node by various naming patterns
    const possibleIds = [
      nodeName,
      nodeName.replace(/^clab-[^-]+-/, ''), // Remove clab prefix
      nodeName.split('-').slice(2).join('-') // Remove clab-labname- prefix
    ];
    
    let node: cytoscape.NodeSingular | null = null;
    for (const id of possibleIds) {
      const found = this.cy.getElementById(id);
      if (found.length > 0) {
        node = found;
        break;
      }
    }
    
    if (!node) return;
    
    // Update container status
    const currentData = node.data();
    node.data({
      ...currentData,
      containerDockerExtraAttribute: {
        state: containerData.state || 'unknown',
        status: containerData.status || ''
      },
      extraData: {
        ...currentData.extraData,
        state: containerData.state || 'unknown',
        mgmtIpv4Address: containerData.IPv4Address || currentData.extraData?.mgmtIpv4Address || '',
        mgmtIpv6Address: containerData.IPv6Address || currentData.extraData?.mgmtIpv6Address || ''
      }
    });
    
    // Update visual style based on state
    if (containerData.state === 'running') {
      node.addClass('running');
      node.removeClass('stopped');
    } else if (containerData.state === 'stopped' || containerData.state === 'exited') {
      node.addClass('stopped');
      node.removeClass('running');
    }
  }

  /**
   * Enrich edges with interface data
   */
  private enrichEdgeData(interfaceData: any[]): void {
    if (!interfaceData || !Array.isArray(interfaceData)) return;
    
    interfaceData.forEach(intf => {
      if (intf.peerNode && intf.peerInterface) {
        // Find edge that connects these interfaces
        const edges = this.cy.edges().filter(edge => {
          const data = edge.data();
          return (
            (data.source === intf.nodeName && data.target === intf.peerNode) ||
            (data.source === intf.peerNode && data.target === intf.nodeName)
          );
        });
        
        edges.forEach(edge => {
          // Update interface status
          const edgeData = edge.data();
          if (edgeData.source === intf.nodeName) {
            edge.data('sourceInterfaceState', intf.state);
          } else {
            edge.data('targetInterfaceState', intf.state);
          }
          
          // Update visual style based on interface state
          if (intf.state === 'up') {
            edge.addClass('link-up');
            edge.removeClass('link-down');
          } else {
            edge.addClass('link-down');
            edge.removeClass('link-up');
          }
        });
      }
    });
  }

  /**
   * Get container status summary
   */
  public getStatusSummary(): { total: number; running: number; stopped: number } {
    const nodes = this.cy.nodes();
    let running = 0;
    let stopped = 0;
    
    nodes.forEach(node => {
      const state = node.data('containerDockerExtraAttribute')?.state;
      if (state === 'running') {
        running++;
      } else if (state === 'stopped' || state === 'exited') {
        stopped++;
      }
    });
    
    return {
      total: nodes.length,
      running,
      stopped
    };
  }
}