/**
 * Mock implementation of AsyncUtils for testing
 * The sleep function resolves immediately instead of waiting
 */

export async function sleep(_ms: number): Promise<void> {
  // Resolve immediately in tests
  return Promise.resolve();
}

export function debounce<T extends (...args: any[]) => any>(
  fn: T,
  _delay: number
): (...args: Parameters<T>) => void {
  // In tests, execute immediately without debounce
  return (...args: Parameters<T>) => {
    fn(...args);
  };
}
