/**
 * useShakeAnimation - Simple boolean toggle for UI shake feedback.
 */
import { useCallback, useRef, useState } from "react";

export function useShakeAnimation(durationMs = 500): { isShaking: boolean; trigger: () => void } {
  const [isShaking, setIsShaking] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const trigger = useCallback(() => {
    setIsShaking(true);
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = window.setTimeout(() => {
      setIsShaking(false);
      timeoutRef.current = null;
    }, durationMs);
  }, [durationMs]);

  return { isShaking, trigger };
}
