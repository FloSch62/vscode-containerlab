/**
 * TopoViewer stub for testing graph.ts commands.
 */

export class TopoViewer {
  public currentPanel: any = null;
  public lastYamlFilePath: string = '';
  public currentLabName: string = '';
  public deploymentState: string = 'unknown';
  public isViewMode: boolean = false;

  constructor(_context: any) {
    // No-op
  }

  async createWebviewPanel(
    _context: any,
    _uri: any,
    labName: string,
    isViewMode: boolean
  ): Promise<void> {
    this.currentLabName = labName;
    this.isViewMode = isViewMode;
  }

  async updatePanelHtml(_panel: any): Promise<void> {
    // No-op
  }
}

// For default export compatibility
export default TopoViewer;
