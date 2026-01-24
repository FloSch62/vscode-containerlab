/**
 * Performance utilities for throttling and debouncing
 */

/**
 * Creates a throttled function that only invokes the provided function at most once
 * per specified time period. Uses requestAnimationFrame for smooth updates.
 */
export function throttle<Args extends unknown[]>(
  func: (...args: Args) => void,
  limit: number
): (...args: Args) => void {
  let inThrottle = false;
  let lastArgs: Args | null = null;

  const throttled = (...args: Args) => {
    lastArgs = args;
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        // Call with last args if there were updates during throttle period
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
      }, limit);
    }
  };

  return throttled;
}

/**
 * Creates a throttled function using requestAnimationFrame.
 * Ensures updates are synchronized with the browser's render cycle.
 */
export function rafThrottle<Args extends unknown[]>(
  func: (...args: Args) => void
): ((...args: Args) => void) & { cancel: () => void } {
  let rafId: number | null = null;
  let lastArgs: Args | null = null;

  const throttled = (...args: Args) => {
    lastArgs = args;
    if (rafId === null) {
      rafId = window.requestAnimationFrame(() => {
        if (lastArgs) {
          func(...lastArgs);
          lastArgs = null;
        }
        rafId = null;
      });
    }
  };

  throttled.cancel = () => {
    if (rafId !== null) {
      window.cancelAnimationFrame(rafId);
      rafId = null;
    }
  };

  return throttled;
}
