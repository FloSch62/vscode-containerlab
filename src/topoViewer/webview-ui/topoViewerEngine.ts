// file: topoViewerEngine.ts
// Unified TopoViewer/Editor Engine that intelligently switches between view and edit modes

import cytoscape from 'cytoscape';
import edgehandles from 'cytoscape-edgehandles';
import cola from 'cytoscape-cola';
import gridGuide from 'cytoscape-grid-guide';
import leaflet from 'cytoscape-leaf';
import cxtmenu from 'cytoscape-cxtmenu';

// Register cytoscape extensions
cytoscape.use(edgehandles);
cytoscape.use(cola);
cytoscape.use(gridGuide);
cytoscape.use(cxtmenu);
cytoscape.use(leaflet);

/**
 * Interface representing node data.
 */
export interface NodeData {
  id: string;
  editor?: string;
  weight?: string;
  name?: string;
  parent?: string;
  topoViewerRole?: string;
  sourceEndpoint?: string;
  targetEndpoint?: string;
  containerDockerExtraAttribute?: {
    state?: string;
    status?: string;
  };
  extraData?: {
    kind?: string;
    image?: string;
    type?: string;
    longname?: string;
    mgmtIpv4Address?: string;
    [key: string]: any;
  };
}

/**
 * Interface representing edge data.
 */
export interface EdgeData {
  id: string;
  source: string;
  target: string;
  sourceEndpoint?: string;
  targetEndpoint?: string;
  editor?: string;
}

/**
 * Environment configuration interface
 */
export interface EnvironmentConfig {
  'clab-name': string;
  'clab-prefix': string;
  'deployment-type': string;
  'topoviewer-layout-preset': string;
  'clab-allowed-hostname': string;
  'clab-deployed': boolean;
  [key: string]: any;
}

/**
 * Unified TopoViewerEngine class that handles both viewing and editing functionality
 * Automatically switches between modes based on lab deployment status
 */
export class TopoViewerEngine {
  private cy: cytoscape.Core;
  private edgeHandler: any;
  private isEditMode: boolean = false;
  private isLabDeployed: boolean = false;
  private environment: EnvironmentConfig | null = null;
  
  // VSCode API for communication
  private vscode: any;
  
  // Manager instances (will be initialized as needed)
  private managers: Map<string, any> = new Map();
  
  // Global state
  private globalState = {
    selectedNode: null as cytoscape.NodeSingular | null,
    selectedEdge: null as cytoscape.EdgeSingular | null,
    linkEndpointVisibility: true,
    nodeContainerStatusVisibility: false,
    isPresetLayout: false,
    labName: '',
    prefixName: '',
    multiLayerViewPortState: false,
    isGeoMapInitialized: false
  };

  constructor() {
    // Initialize VS Code API if available
    if (typeof (window as any).acquireVsCodeApi !== 'undefined') {
      this.vscode = (window as any).acquireVsCodeApi();
    }
    
    // Initialize Cytoscape instance
    this.cy = cytoscape({
      container: null, // Will be set later
      style: [], // Will be loaded from manager
      elements: [], // Will be loaded from data
      layout: { name: 'preset' }
    });
  }

  /**
   * Initialize the engine with container and environment
   */
  public async initialize(container: HTMLElement): Promise<void> {
    // Set cytoscape container
    this.cy.mount(container);
    
    // Load environment configuration
    await this.loadEnvironment();
    
    // Determine mode based on lab deployment status
    this.determineMode();
    
    // Initialize appropriate managers based on mode
    await this.initializeManagers();
    
    // Set up event handlers
    this.setupEventHandlers();
    
    // Load initial data
    await this.loadTopologyData();
  }

  /**
   * Load environment configuration
   */
  private async loadEnvironment(): Promise<void> {
    try {
      // In VS Code context, request environment from extension
      if (this.vscode) {
        this.vscode.postMessage({ type: 'getEnvironment' });
        
        // Wait for response
        this.environment = await this.waitForEnvironmentResponse();
      } else {
        // Fallback for development/testing
        this.environment = await this.fetchEnvironmentFromServer();
      }
      
      // Update global state from environment
      if (this.environment) {
        this.globalState.labName = this.environment['clab-name'] || '';
        this.globalState.prefixName = this.environment['clab-prefix'] || '';
        this.globalState.isPresetLayout = this.environment['topoviewer-layout-preset'] === 'true';
        this.isLabDeployed = this.environment['clab-deployed'] || false;
      }
    } catch (error) {
      console.error('Failed to load environment:', error);
    }
  }

  /**
   * Wait for environment response from VS Code
   */
  private waitForEnvironmentResponse(): Promise<EnvironmentConfig> {
    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'environment') {
          window.removeEventListener('message', messageHandler);
          resolve(message.data);
        }
      };
      window.addEventListener('message', messageHandler);
    });
  }

  /**
   * Fetch environment from server (fallback)
   */
  private async fetchEnvironmentFromServer(): Promise<EnvironmentConfig> {
    const response = await fetch('/environment.json');
    return response.json();
  }

  /**
   * Determine whether to run in view or edit mode
   */
  private determineMode(): void {
    // Edit mode is enabled when:
    // 1. Lab is NOT deployed (so we can edit freely)
    // 2. OR explicit edit mode is requested via environment
    this.isEditMode = !this.isLabDeployed || this.environment?.['force-edit-mode'] === true;
    
    console.info(`TopoViewer running in ${this.isEditMode ? 'EDIT' : 'VIEW'} mode`);
    console.info(`Lab deployed: ${this.isLabDeployed}`);
  }

  /**
   * Initialize managers based on current mode
   */
  private async initializeManagers(): Promise<void> {
    // Common managers for both modes
    const { ManagerCytoscapeStyle } = await import('./managers/managerCytoscapeStyle');
    const { ManagerLayoutAlgo } = await import('./managers/managerLayoutAlgo');
    const { ManagerVscodeWebview } = await import('./managers/managerVscodeWebview');
    
    this.managers.set('style', new ManagerCytoscapeStyle(this.cy));
    this.managers.set('layout', new ManagerLayoutAlgo(this.cy));
    this.managers.set('vscode', new ManagerVscodeWebview(this.vscode));
    
    // Edit mode specific managers
    if (this.isEditMode) {
      const { ManagerSaveTopo } = await import('./managers/managerSaveTopo');
      const { ManagerAddContainerlabNode } = await import('./managers/managerAddContainerlabNode');
      const { ManagerGroupManager } = await import('./managers/managerGroupManager');
      const { ManagerReloadTopo } = await import('./managers/managerReloadTopo');
      
      this.managers.set('save', new ManagerSaveTopo(this.cy, this.vscode));
      this.managers.set('addNode', new ManagerAddContainerlabNode(this.cy));
      this.managers.set('group', new ManagerGroupManager(this.cy));
      this.managers.set('reload', new ManagerReloadTopo(this.cy, this.vscode));
      
      // Initialize edge handler for edit mode
      this.initializeEdgeHandler();
    }
    
    // View mode specific managers
    if (!this.isEditMode && this.isLabDeployed) {
      const { ManagerSocketDataEnrichment } = await import('./managers/managerSocketDataEnrichment');
      this.managers.set('socket', new ManagerSocketDataEnrichment(this.cy));
    }
  }

  /**
   * Initialize edge handler for edit mode
   */
  private initializeEdgeHandler(): void {
    if (!this.isEditMode) return;
    
    this.edgeHandler = (this.cy as any).edgehandles({
      // preview: true, // This property doesn't exist in EdgeHandlesOptions
      hoverDelay: 150,
      // handleNodes: 'node',
      snap: false,
      snapThreshold: 50,
      snapFrequency: 15,
      noEdgeEventsInDraw: true,
      disableBrowserGestures: true
    } as any);
  }

  /**
   * Set up event handlers
   */
  private setupEventHandlers(): void {
    // Node selection
    this.cy.on('tap', 'node', (event) => {
      this.globalState.selectedNode = event.target;
      this.globalState.selectedEdge = null;
      this.handleNodeSelection(event.target);
    });
    
    // Edge selection
    this.cy.on('tap', 'edge', (event) => {
      this.globalState.selectedEdge = event.target;
      this.globalState.selectedNode = null;
      this.handleEdgeSelection(event.target);
    });
    
    // Background tap (deselect)
    this.cy.on('tap', (event) => {
      if (event.target === this.cy) {
        this.globalState.selectedNode = null;
        this.globalState.selectedEdge = null;
        this.handleDeselection();
      }
    });
    
    // Edit mode specific events
    if (this.isEditMode) {
      this.setupEditModeEvents();
    }
    
    // View mode specific events  
    if (!this.isEditMode) {
      this.setupViewModeEvents();
    }
  }

  /**
   * Set up edit mode specific events
   */
  private setupEditModeEvents(): void {
    // Right-click context menu for adding nodes
    this.cy.on('cxttap', (event) => {
      if (event.target === this.cy) {
        const addNodeManager = this.managers.get('addNode');
        if (addNodeManager) {
          addNodeManager.showAddNodeMenu(event.position);
        }
      }
    });
    
    // Node position changes
    this.cy.on('dragfree', 'node', () => {
      this.markAsModified();
    });
  }

  /**
   * Set up view mode specific events
   */
  private setupViewModeEvents(): void {
    // Double-click to open node UI
    let lastTapTime = 0;
    this.cy.on('tap', 'node', (event) => {
      const currentTime = Date.now();
      if (currentTime - lastTapTime < 300) {
        this.openNodeUI(event.target);
      }
      lastTapTime = currentTime;
    });
  }

  /**
   * Load topology data
   */
  private async loadTopologyData(): Promise<void> {
    try {
      // Request topology data from VS Code extension
      if (this.vscode) {
        this.vscode.postMessage({ type: 'getTopologyData' });
        const data = await this.waitForTopologyData();
        this.cy.json({ elements: data });
      } else {
        // Fallback for development
        const response = await fetch('/topology.json');
        const data = await response.json();
        this.cy.json({ elements: data });
      }
      
      // Apply layout
      const layoutManager = this.managers.get('layout');
      if (layoutManager) {
        layoutManager.applyLayout(this.globalState.isPresetLayout ? 'preset' : 'cola');
      }
    } catch (error) {
      console.error('Failed to load topology data:', error);
    }
  }

  /**
   * Wait for topology data from VS Code
   */
  private waitForTopologyData(): Promise<any> {
    return new Promise((resolve) => {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'topologyData') {
          window.removeEventListener('message', messageHandler);
          resolve(message.data);
        }
      };
      window.addEventListener('message', messageHandler);
    });
  }

  /**
   * Handle node selection
   */
  private handleNodeSelection(node: cytoscape.NodeSingular): void {
    // Update UI to show node is selected
    node.addClass('selected');
    
    // Show node details panel
    const vscodeManager = this.managers.get('vscode');
    if (vscodeManager) {
      vscodeManager.postMessage({
        type: 'nodeSelected',
        data: node.data()
      });
    }
  }

  /**
   * Handle edge selection
   */
  private handleEdgeSelection(edge: cytoscape.EdgeSingular): void {
    // Update UI to show edge is selected
    edge.addClass('selected');
    
    // Show edge details panel
    const vscodeManager = this.managers.get('vscode');
    if (vscodeManager) {
      vscodeManager.postMessage({
        type: 'edgeSelected',
        data: edge.data()
      });
    }
  }

  /**
   * Handle deselection
   */
  private handleDeselection(): void {
    // Remove selection classes
    this.cy.$('.selected').removeClass('selected');
    
    // Hide details panel
    const vscodeManager = this.managers.get('vscode');
    if (vscodeManager) {
      vscodeManager.postMessage({ type: 'deselected' });
    }
  }

  /**
   * Open node UI (for view mode)
   */
  private openNodeUI(node: cytoscape.NodeSingular): void {
    const nodeData = node.data();
    const vscodeManager = this.managers.get('vscode');
    
    if (vscodeManager) {
      vscodeManager.postMessage({
        type: 'openNodeUI',
        data: {
          nodeId: nodeData.id,
          kind: nodeData.extraData?.kind,
          mgmtIp: nodeData.extraData?.mgmtIpv4Address
        }
      });
    }
  }

  /**
   * Mark topology as modified (for edit mode)
   */
  private markAsModified(): void {
    if (!this.isEditMode) return;
    
    const vscodeManager = this.managers.get('vscode');
    if (vscodeManager) {
      vscodeManager.postMessage({ type: 'topologyModified' });
    }
  }

  /**
   * Save topology (for edit mode)
   */
  public async saveTopology(): Promise<void> {
    if (!this.isEditMode) return;
    
    const saveManager = this.managers.get('save');
    if (saveManager) {
      await saveManager.save();
    }
  }

  /**
   * Toggle between view and edit modes
   */
  public toggleMode(): void {
    this.isEditMode = !this.isEditMode;
    this.reinitialize();
  }

  /**
   * Reinitialize after mode change
   */
  private async reinitialize(): Promise<void> {
    // Clear existing managers
    this.managers.clear();
    
    // Reinitialize with new mode
    await this.initializeManagers();
    this.setupEventHandlers();
  }

  /**
   * Get current mode
   */
  public getMode(): 'view' | 'edit' {
    return this.isEditMode ? 'edit' : 'view';
  }

  /**
   * Get cytoscape instance (for managers)
   */
  public getCy(): cytoscape.Core {
    return this.cy;
  }

  /**
   * Get global state
   */
  public getGlobalState(): typeof this.globalState {
    return this.globalState;
  }

  /**
   * Get a specific manager
   */
  public getManager(name: string): any {
    return this.managers.get(name);
  }

  /**
   * Reload topology
   */
  public async reload(): Promise<void> {
    const reloadManager = this.managers.get('reload');
    if (reloadManager) {
      await reloadManager.reload();
    } else {
      // Fallback to reinitializing
      await this.loadTopologyData();
    }
  }
}

// Export singleton instance
export const topoViewerEngine = new TopoViewerEngine();