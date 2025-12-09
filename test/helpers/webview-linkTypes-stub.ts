/**
 * Minimal stub for LinkTypes utilities used by SaveManager.
 */

export function isSpecialEndpoint(id: string): boolean {
  return typeof id === 'string' && id.startsWith('sp-');
}
