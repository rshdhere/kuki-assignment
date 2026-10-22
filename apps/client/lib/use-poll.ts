"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Loads `fn` on mount, whenever `key` changes, and every `intervalMs`
 * (0 = never). Keeps the last good data while a refresh fails, so a server
 * blip doesn't blank the page.
 */
export function usePoll<T>(
  fn: () => Promise<T>,
  intervalMs = 0,
  key: string | null = null,
) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fnRef = useRef(fn);
  // Declared before the loading effect, so it always sees the latest `fn`.
  useEffect(() => {
    fnRef.current = fn;
  });

  const refresh = useCallback(async () => {
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    void refresh();
    if (!intervalMs) return;
    const timer = setInterval(() => void refresh(), intervalMs);
    return () => clearInterval(timer);
  }, [refresh, intervalMs, key]);

  return { data, error, refresh, loading: data === null && error === null };
}
