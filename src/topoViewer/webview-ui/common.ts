import cytoscape from 'cytoscape';
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

// -----------------------------------------------------------
// Global State Variables
// -----------------------------------------------------------
export let isPanel01Cy = false;
export let nodeClicked = false;
export let edgeClicked = false;
export let cy: cytoscape.Core;
export let globalSelectedNode: cytoscape.NodeSingular | null;
export let globalSelectedEdge: cytoscape.EdgeSingular | null;
export let globalLinkEndpointVisibility = true;
export let globalNodeContainerStatusVisibility = false;
export let globalShellUrl = "/js/cloudshell";
export let deploymentType: string;
export let globalLabName: string;
export let globalPrefixName: string;
export let multiLayerViewPortState = false;

// Cytoscape-Leaflet variables
export let globalIsGeoMapInitialized = false;
export let globalCytoscapeLeafletMap: any;
export let globalCytoscapeLeafletLeaf: any;

// The determined whether preset layout is enabled automatically during initialization
export let globalIsPresetLayout: boolean;

// Detect if running inside VS Code webview
export let isVscodeDeployment = Boolean((window as any).isVscodeDeployment);
export let vsCode: any;
if (isVscodeDeployment) {
  // VS Code webview API for communication with the extension
  vsCode = (window as any).acquireVsCodeApi();
}

// JSON file URL for environment data
export let jsonFileUrlDataCytoMarshall: string;

// Double-click tracking variables
export let globalDblclickLastClick = { time: 0, id: null as string | null };
export let globalDblClickThreshold = 300; // Threshold in milliseconds

// var globalAllowedhostname = 'nsp-clab1.nice.nokia.net'
export let globalAllowedhostname: string;

// Socket.io instance
export let socket: Socket;

// Dynamic styles cache
export const dynamicCytoStyles = new Map<string, any>();

// Monitor configs (will be defined elsewhere)
export let monitorConfigs: any[];

// Toggle for onChange style binding
export let globalToggleOnChangeCytoStyle = true;

// -----------------------------------------------------------
// Expose a Promise to load environment variables
// -----------------------------------------------------------
/**
 * envLoadPromise:
 * A globally accessible promise that completes after environment variables
 * have been fetched and assigned to globalLabName, globalAllowedhostname, etc.
 */
export const envLoadPromise = initEnv();



/**
 * initEnv()
 * Initializes environment variables by fetching deployment settings.
 * aarafat-tag: this need to be reworked, so that via initiEnv the environement will be only loaded once.
 */
export async function initEnv(): Promise<void> {
  try {
    let environments = await getEnvironments();
    if (!environments) {
      console.error("No environments data found. initEnv aborted.");
      return;
    }

    // Assign to global variables
    globalLabName = environments["clab-name"];
    globalPrefixName = environments["clab-prefix"];
    deploymentType = environments["deployment-type"];
    globalIsPresetLayout = environments["topoviewer-layout-preset"] === "true";
    globalAllowedhostname = environments["clab-allowed-hostname"];

    // Optional: Log them once they're fetched:
    console.info("Lab-Name:", globalLabName);
    console.info("DeploymentType:", deploymentType);
    console.info("globalIsPresetLayout:", globalIsPresetLayout);
    console.info("globalAllowedhostname:", globalAllowedhostname);

  } catch (err) {
    console.error("Error during initEnv:", err);
    throw err; // Re-throw so the promise rejects if something fails
  }
}

// -----------------------------------------------------------
// Helper Functions
// -----------------------------------------------------------

/**
 * Fetches environment configuration JSON and updates its topology data
 * with the current live Cytoscape graph. Persists the updated JSON to disk
 * using VS Code's postMessage API.
 *
 * @returns {Promise<object|null>} Updated environment object or null on failure.
 */
export async function getEnvironments(): Promise<any> {
  try {
    let environments;

    if (isVscodeDeployment) {
      const response = await fetch((window as any).jsonFileUrlDataEnvironment);
      if (!response.ok) {
        throw new Error(`Failed to fetch environment JSON: ${response.statusText}`);
      }

      environments = await response.json();

      if (typeof cy !== 'undefined' && typeof cy.elements === 'function') {
        const liveCyData = cy.elements().jsons();
        environments.EnvCyTopoJsonBytes = liveCyData;

        console.log("Updated environments with live Cytoscape data:", environments)
        console.debug("Replaced EnvCyTopoJsonBytes with live Cytoscape data.");

        if (typeof vsCode !== 'undefined' && typeof vsCode.postMessage === 'function') {
          vsCode.postMessage({
            type: "POST",
            requestId: `save-${Date.now()}`,
            endpointName: "save-environment-json-to-disk",
            payload: JSON.stringify(environments)
          });
          console.log("[VS Code] saveEnvJsonToDisk message sent to extension host.");
        } else {
          console.warn("VS Code postMessage API not available — skipping save.");
        }
      } else {
        console.warn("Cytoscape instance is not available. EnvCyTopoJsonBytes not updated.");
      }
    } else {
      environments = await sendRequestToEndpointGetV2("/get-environments");
    }

    if (
      environments &&
      typeof environments === "object" &&
      Object.keys(environments).length > 0
    ) {
      console.debug("Final environments object:", environments);
      return environments;
    } else {
      console.warn("Fetched environment object is empty or invalid.");
      return null;
    }
  } catch (error) {
    console.error("Error while fetching environments:", error);
    return null;
  }
}


/**
 * Helper function to send a GET request to an endpoint.
 */
export async function sendRequestToEndpointGetV2(endpointName: string): Promise<any> {
  try {
    const response = await fetch(endpointName, {
      method: "GET",
      headers: { "Content-Type": "application/json" }
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error in sendRequestToEndpointGetV2:", error);
    throw error;
  }
}

/**
 * Calls a Go backend function with provided parameters.
 */
export async function callGoFunction(goFunctionName: string, arg01: any, arg02: any, arg03: any): Promise<any> {
  console.log(`callGoFunction Called with ${goFunctionName}`);
  console.log(`Parameter01: ${arg01}`);
  console.log(`Parameter02: ${arg02}`);

  const data = { param1: arg01, param2: arg02, param3: arg03 };
  try {
    const response = await fetch(goFunctionName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error in callGoFunction:", error);
    throw error;
  }
}

/**
 * Posts a request to the Python backend to execute a command list.
 */
export async function postPythonAction(event: any, commandList: any[]): Promise<any> {
  try {
    showLoadingSpinnerGlobal();
    const response = await sendRequestToEndpointPost("/python-action", commandList);
    if (response && typeof response === 'object' && Object.keys(response).length > 0) {
      console.log("Python action response:", response);
      return response;
    } else {
      console.log("Empty or invalid JSON response from Python action");
      return null;
    }
  } catch (error) {
    console.error("Error in postPythonAction:", error);
    return null;
  } finally {
    hideLoadingSpinnerGlobal();
  }
}

/**
 * Sends a POST request to the specified endpoint.
 */
export async function sendRequestToEndpointPost(endpointName: string, argsList: any[] = []): Promise<any> {
  console.log(`sendRequestToEndpointPost Called with ${endpointName}`, argsList);

  const data: any = {};
  argsList.forEach((arg, index) => {
    data[`param${index + 1}`] = arg;
  });

  try {
    const response = await fetch(endpointName, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data)
    });

    if (!response.ok) {
      throw new Error(`Network response was not ok: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error("Error in sendRequestToEndpointPost:", error);
    throw error;
  }
}

/**
 * Finds a Cytoscape element by its ID.
 */
export function findCytoElementById(jsonArray: any[], id: string): any {
  return jsonArray.find((obj: any) => obj.data.id === id) || null;
}

/**
 * Finds a Cytoscape element by its name.
 */
export function findCytoElementByName(jsonArray: any[], name: string): any {
  return jsonArray.find((obj: any) => obj.data.name === name) || null;
}

/**
 * Finds a Cytoscape element by its long name.
 */
export function findCytoElementByLongname(jsonArray: any[], longname: string): any {
  return jsonArray.find((obj: any) => obj.data?.extraData?.longname === longname) || null;
}

/**
 * Detects user's preferred color scheme and applies the theme.
 */
export function detectColorScheme(): string {
  const darkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  applyTheme(darkMode ? 'dark' : 'light');
  return darkMode ? 'dark' : 'light';
}

/**
 * Applies a theme to the root element.
 */
export function applyTheme(theme: string): void {
  const rootElement = document.getElementById('root');
  if (rootElement) {
    rootElement.setAttribute('data-theme', theme);
    console.log("Applied Theme:", theme);
  } else {
    console.warn("'root' element not found, cannot apply theme:", theme);
  }
}

/**
 * Displays a global loading spinner.
 */
export function showLoadingSpinnerGlobal(): void {
  const spinner = document.getElementById('loading-spinner-global');
  if (spinner) {
    spinner.style.display = 'block';
  } else {
    console.warn("'loading-spinner-global' element not found, cannot show spinner.");
  }
}

/**
 * Hides the global loading spinner.
 */
export function hideLoadingSpinnerGlobal(): void {
  const spinner = document.getElementById('loading-spinner-global');
  if (spinner) {
    spinner.style.display = 'none';
  } else {
    console.warn("'loading-spinner-global' element not found, cannot hide spinner.");
  }
}

// Initialize socket.io connection
export function initializeSocket(): void {
  // Initiate socket port as number, to be used in socket creation
  const globalSocketAssignedPort = (window as any).socketAssignedPort;
  globalAllowedhostname = (window as any).allowedHostname;
  console.log(`window.allowedHostname: ${(window as any).allowedHostname}`);
  console.log('allowedHostname', globalAllowedhostname);

  // aarafat-tag: vscode socket.io
  const socketIoServerAddress = `${globalAllowedhostname}:${globalSocketAssignedPort}`;
  console.log(`socketIoServerAddress: ${socketIoServerAddress}`);
  console.log('socketIoServerAddress:', socketIoServerAddress);

  socket = io(`http://${socketIoServerAddress}`);
}

// // -----------------------------------------------------------------------------------------------------------------------------------------------------------------
// // SOCKET BINDING CONTROL // aarafat-tag: this is the main function to bind the socket // entry point for managerOnChangeEvent.js, managerSocketDataEnrichment.js
// // -----------------------------------------------------------------------------------------------------------------------------------------------------------------
/**
 * updateSocketBinding()
 *
 * Unbinds any previous listener for "clab-tree-provider-data" and, if the global toggle is enabled,
 * binds an inline listener that processes the lab data using the generic state monitor engine.
 */
export function updateSocketBinding(): void {
  // Unbind previous "clab-tree-provider-data" listeners.
  socket.off('clab-tree-provider-data');

  if (globalToggleOnChangeCytoStyle) {
    socket.on('clab-tree-provider-data', (labData: any) => {
      console.log("Received clab-tree-provider-data - globalToggleOnChangeCytoStyl:", labData);
      // These functions will be imported from their respective modules
      // stateMonitorEngine(labData, monitorConfigs);
      // socketDataEncrichmentLink(labData);
      // socketDataEncrichmentNode(labData);

    });
    console.log("Socket 'clab-tree-provider-data' event bound.");
  } else {
    console.log("Socket 'clab-tree-provider-data' event unbound.");
  }
}


// -----------------------------------------------------------------------------
//             type: 'clab-tree-provider-data-native-vscode-postMessage'
// -----------------------------------------------------------------------------
/**
 * updateMessageStreamBinding()
 *
 * Updates the postMessage event listener for "clab-tree-provider-data" messages.
 * Uses a persistent event handler stored as a property on the function.
 */
export function updateMessageStreamBinding(): void {
  // Create the event handler once and store it as a property if it doesn't exist.
  if (!(updateMessageStreamBinding as any).handler) {
    (updateMessageStreamBinding as any).handler = function (event: MessageEvent) {
      try {
        const message = event.data;
        if (message && message.type === 'clab-tree-provider-data-native-vscode-message-stream') {
          const labData = message.data;
          console.log("[PostMessage] Received 'clab-tree-provider-data-native-vscode-message-stream':", labData);
          // Process the lab data only if the global toggle is enabled.
          if (globalToggleOnChangeCytoStyle) {
            // These functions will be imported from their respective modules
            // stateMonitorEngine(labData, monitorConfigs);
            // socketDataEncrichmentLink(labData);
            // socketDataEncrichmentNode(labData);
          }
        }
      } catch (error) {
        console.error("Error processing postMessage event:", error);
      }
    };
  }

  // Always remove the previously bound listener to avoid duplicates.
  window.removeEventListener('message', (updateMessageStreamBinding as any).handler);

  // If enabled, add the event listener.
  if (globalToggleOnChangeCytoStyle) {
    window.addEventListener('message', (updateMessageStreamBinding as any).handler);
    console.log("[PostMessage] 'clab-tree-provider-data' event listener bound.");
  } else {
    console.log("[PostMessage] 'clab-tree-provider-data' event listener unbound.");
  }
}



// -----------------------------------------------------------------------------
// STYLE HELPER FUNCTIONS
// -----------------------------------------------------------------------------

/**
 * Updates the dynamic style for an edge and caches the update.
 *
 * @param {string} edgeId - The unique ID of the edge.
 * @param {string} styleProp - The style property to update (e.g. "text-background-color").
 * @param {string|number} value - The new value for the style property.
 */
export function updateEdgeDynamicStyle(edgeId: string, styleProp: string, value: any): void {
  const edge = cy.$(`#${edgeId}`);
  if (edge.length > 0) {
    edge.style(styleProp, value);
    const cacheKey = `edge:${edgeId}:${styleProp}`;
    dynamicCytoStyles.set(cacheKey, value);
  }
}

/**
 * Updates the dynamic style for a node and caches the update.
 *
 * @param {string} nodeId - The unique ID of the node.
 * @param {string} styleProp - The style property to update (e.g. "background-color").
 * @param {string|number} value - The new value for the style property.
 */
export function updateNodeDynamicStyle(nodeId: string, styleProp: string, value: any): void {
  const node = cy.$(`#${nodeId}`);
  if (node.length > 0) {
    node.style(styleProp, value);
    const cacheKey = `node:${nodeId}:${styleProp}`;
    dynamicCytoStyles.set(cacheKey, value);
  }
}

/**
 * Iterates over the dynamic style cache and re-applies the stored styles.
 */
export function restoreDynamicStyles(): void {
  dynamicCytoStyles.forEach((value, key) => {
    const parts = key.split(":"); // e.g. ["edge", "Clab-Link0", "text-background-color"]
    if (parts.length !== 3) return;
    const [type, id, styleProp] = parts;
    if (type === "edge") {
      const edge = cy.$(`#${id}`);
      if (edge.length > 0) {
        edge.style(styleProp, value);
      }
    } else if (type === "node") {
      const node = cy.$(`#${id}`);
      if (node.length > 0) {
        node.style(styleProp, value);
      }
    }
  });
}

// Export function to set cy instance
export function setCy(cytoscapeInstance: cytoscape.Core): void {
  cy = cytoscapeInstance;
}

// Export function to set global selected node
export function setGlobalSelectedNode(node: cytoscape.NodeSingular | null): void {
  globalSelectedNode = node;
}

// Export function to set global selected edge
export function setGlobalSelectedEdge(edge: cytoscape.EdgeSingular | null): void {
  globalSelectedEdge = edge;
}