// file: managerReloadTopo.ts

import cytoscape from 'cytoscape';
import { fetchAndLoadData } from './managerCytoscapeFetchAndLoad';
import { ManagerVscodeWebview } from './managerVscodeWebview';

/**
 * Handles reloading the topology data from the backend.
 */
export class ManagerReloadTopo {
  private cy: cytoscape.Core;
  private vscode: any;

  constructor(cy: cytoscape.Core, vscode: any) {
    this.cy = cy;
    this.vscode = vscode;
  }

  public async viewportButtonsReloadTopo(
    cy: cytoscape.Core,
    delayMs = 1000
  ): Promise<void> {
    try {
      const response = await new ManagerVscodeWebview(this.vscode).sendMessageToVscodeEndpointPost(
        'topo-editor-reload-viewport',
        'Empty Payload'
      );
      console.log('############### response from backend:', response);
      await this.sleep(delayMs);
      fetchAndLoadData(cy, new ManagerVscodeWebview(this.vscode));
    } catch (err) {
      console.error('############### Backend call failed:', err);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}