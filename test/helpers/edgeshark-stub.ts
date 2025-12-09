// Stub for edgeshark command module

let installResult = true;
export const installCalls: string[] = [];

export async function installEdgeshark(): Promise<void> {
  installCalls.push('install');
  if (!installResult) {
    throw new Error('Failed to install edgeshark');
  }
}

export function setInstallResult(result: boolean): void {
  installResult = result;
}

export function resetEdgesharkStub(): void {
  installResult = true;
  installCalls.length = 0;
}
