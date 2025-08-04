// file: managerVscodeWebview.ts
// Manager for handling VS Code webview communication

import { VsCodeApi, MessageType } from '../core/common';

export class ManagerVscodeWebview {
  private vscode: VsCodeApi | null;
  private messageHandlers: Map<string, (data: any) => void> = new Map();
  private requestHandlers: Map<string, (id: string, data: any) => Promise<any>> = new Map();
  private pendingRequests: Map<string, { resolve: Function; reject: Function }> = new Map();
  private requestCounter: number = 0;

  constructor(vscode: VsCodeApi | null) {
    this.vscode = vscode;
    
    if (this.vscode) {
      // Set up message listener
      window.addEventListener('message', this.handleMessage.bind(this));
    }
  }

  /**
   * Send a message to the extension
   */
  public postMessage(message: any): void {
    if (!this.vscode) {
      console.warn('VS Code API not available');
      return;
    }
    
    this.vscode.postMessage(message);
  }

  /**
   * Send a request and wait for response
   */
  public async sendRequest(type: string, data?: any): Promise<any> {
    if (!this.vscode) {
      throw new Error('VS Code API not available');
    }
    
    const requestId = `req_${++this.requestCounter}`;
    
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject });
      
      this.vscode!.postMessage({
        type: 'POST',
        requestId,
        endpointName: type,
        payload: JSON.stringify(data || {})
      });
      
      // Timeout after 30 seconds
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Request ${type} timed out`));
        }
      }, 30000);
    });
  }

  /**
   * Register a message handler
   */
  public onMessage(type: string, handler: (data: any) => void): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Register a request handler
   */
  public onRequest(type: string, handler: (id: string, data: any) => Promise<any>): void {
    this.requestHandlers.set(type, handler);
  }

  /**
   * Handle incoming messages from extension
   */
  private handleMessage(event: MessageEvent): void {
    const message = event.data;
    
    if (!message || !message.type) {
      return;
    }
    
    // Handle response to our request
    if (message.type === 'POST_RESPONSE' && message.requestId) {
      const pending = this.pendingRequests.get(message.requestId);
      if (pending) {
        this.pendingRequests.delete(message.requestId);
        
        if (message.error) {
          pending.reject(new Error(message.error));
        } else {
          pending.resolve(message.result);
        }
      }
      return;
    }
    
    // Handle incoming request
    if (message.type === 'POST' && message.requestId) {
      const handler = this.requestHandlers.get(message.endpointName);
      if (handler) {
        handler(message.requestId, JSON.parse(message.payload || '{}'))
          .then(result => {
            this.postMessage({
              type: 'POST_RESPONSE',
              requestId: message.requestId,
              result
            });
          })
          .catch(error => {
            this.postMessage({
              type: 'POST_RESPONSE',
              requestId: message.requestId,
              error: error.message
            });
          });
      }
      return;
    }
    
    // Handle regular message
    const handler = this.messageHandlers.get(message.type);
    if (handler) {
      handler(message.data);
    }
  }

  /**
   * Get state from VS Code
   */
  public getState(): any {
    return this.vscode?.getState() || {};
  }

  /**
   * Set state in VS Code
   */
  public setState(state: any): void {
    this.vscode?.setState(state);
  }

  /**
   * Show VS Code message
   */
  public async showMessage(type: 'info' | 'warning' | 'error', message: string): Promise<void> {
    await this.sendRequest('clab-show-vscode-message', { type, message });
  }

  /**
   * Open external URL
   */
  public async openExternal(url: string): Promise<void> {
    await this.sendRequest('open-external', url);
  }

  /**
   * Node operations
   */
  public async connectSSH(nodeName: string): Promise<void> {
    await this.sendRequest('clab-node-connect-ssh', nodeName);
  }

  public async attachShell(nodeName: string): Promise<void> {
    await this.sendRequest('clab-node-attach-shell', nodeName);
  }

  public async viewLogs(nodeName: string): Promise<void> {
    await this.sendRequest('clab-node-view-logs', nodeName);
  }

  /**
   * Link operations
   */
  public async captureInterface(nodeName: string, interfaceName: string): Promise<void> {
    await this.sendRequest('clab-link-capture', { nodeName, interfaceName });
  }

  public async captureWithEdgeshark(nodeName: string, interfaceName: string): Promise<void> {
    await this.sendRequest('clab-link-capture-edgeshark-vnc', { nodeName, interfaceName });
  }

  public async getSubinterfaces(nodeName: string, interfaceName: string): Promise<any[]> {
    return await this.sendRequest('clab-link-subinterfaces', { nodeName, interfaceName });
  }

  public async getMacAddress(nodeName: string, interfaceName: string): Promise<string> {
    return await this.sendRequest('clab-link-mac-address', { nodeName, interfaceName });
  }

  /**
   * Topology operations
   */
  public async saveTopology(positions: any[]): Promise<void> {
    await this.sendRequest('topo-viewport-save', positions);
  }

  public async reloadViewport(): Promise<void> {
    await this.sendRequest('reload-viewport');
  }

  public async saveEnvironmentJson(data: any): Promise<void> {
    await this.sendRequest('save-environment-json-to-disk', data);
  }

  /**
   * Get hostname
   */
  public async getHostname(): Promise<string> {
    return await this.sendRequest('clab-host-get-hostname');
  }
}