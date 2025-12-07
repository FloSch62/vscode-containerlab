// Stub for deployPopular module
export let deployPopularLabCalled = false;

export async function deployPopularLab(): Promise<void> {
  deployPopularLabCalled = true;
}

export function resetDeployPopularStub(): void {
  deployPopularLabCalled = false;
}
