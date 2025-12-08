/**
 * Stub for NodeUtils used in webview SaveManager tests.
 * Records invocations without mutating inputs.
 */

export const updateNodePositionCalls: Array<{ node: any; nodeJson: any; isGeo: boolean }> = [];
export const handleGeoDataCalls: Array<{
  node: any;
  nodeJson: any;
  isGeo: boolean;
  layoutMgr?: any;
}> = [];

export function updateNodePosition(node: any, nodeJson: any, isGeo: boolean): void {
  updateNodePositionCalls.push({ node, nodeJson, isGeo });
}

export function handleGeoData(
  node: any,
  nodeJson: any,
  isGeo: boolean,
  layoutMgr?: any
): void {
  handleGeoDataCalls.push({ node, nodeJson, isGeo, layoutMgr });
}

export function resetNodeUtilsStub(): void {
  updateNodePositionCalls.length = 0;
  handleGeoDataCalls.length = 0;
}
