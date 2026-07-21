"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Gibt `value` höchstens alle `intervalMs` Millisekunden aktualisiert zurück.
 * Schnelle Folgeänderungen werden zusammengefasst; der letzte Wert gewinnt.
 */
export function useThrottledValue<T>(value: T, intervalMs: number): T {
  const [throttled, setThrottled] = useState(value);
  const latestRef = useRef(value);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    latestRef.current = value;
    if (timerRef.current !== null) {
      return;
    }
    if (Object.is(throttled, value)) {
      return;
    }
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setThrottled(latestRef.current);
    }, intervalMs);
  }, [value, throttled, intervalMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return throttled;
}
