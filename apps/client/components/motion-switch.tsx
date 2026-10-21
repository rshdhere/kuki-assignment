"use client";

import { useEffect, useSyncExternalStore } from "react";

const STORAGE_KEY = "kuki:motion-paused";
const EVENT = "kuki:motion";

// The paused state lives on <html class="paused">, so CSS can stop every loop.
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const getSnapshot = () =>
  document.documentElement.classList.contains("paused");
const getServerSnapshot = () => false;

function setPaused(paused: boolean) {
  document.documentElement.classList.toggle("paused", paused);
  try {
    localStorage.setItem(STORAGE_KEY, paused ? "1" : "0");
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

/**
 * Pauses every looping animation (spinners, countdowns, live pulses, stripes).
 * Loops longer than 5 s need a pause control (WCAG 2.2.2). The OS
 * reduced-motion setting is handled separately in globals.css.
 */
export function MotionSwitch() {
  const paused = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setPaused(true);
    } catch {
      // Ignore: default to running.
    }
  }, []);

  return (
    <div className="pref">
      <span id="motion-label">Pause animations</span>
      <button
        type="button"
        role="switch"
        className="switch"
        aria-labelledby="motion-label"
        aria-checked={paused}
        onClick={() => setPaused(!paused)}
      />
    </div>
  );
}
