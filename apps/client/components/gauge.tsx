"use client";

import { useEffect, useState } from "react";

const SWEEP_MS = 650; // the sweep lights the ring…
const SETTLE_MS = 900; // …and the number keeps counting a moment longer.

const easeInOut = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
const easeOut = (t: number) => 1 - (1 - t) ** 3;

/** Milliseconds since mount, ticking each frame until `total`; jumps to the end for reduced motion. */
function useElapsed(total: number, key: string) {
  const [ms, setMs] = useState(0);
  useEffect(() => {
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let frame = 0;
    let start = 0;
    const tick = (now: number) => {
      start ||= now;
      const t = still ? total : Math.min(total, now - start);
      setMs(t);
      if (t < total) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [total, key]);
  return ms;
}

/**
 * A ring of segments read like a dial: on load a sweep lights each segment
 * around the whole scale while the centre number counts up to `value`.
 */
export function Gauge({
  segments,
  value,
  center,
  decimals = 0,
  top,
  bottom,
  mark,
  size = 180,
  label,
}: {
  /** One colour per segment, in order around the ring from 12 o'clock. */
  segments: string[];
  /** The reading the centre number counts up to (may be fractional). */
  value: number;
  /** Text after the counted number, e.g. "/12". */
  center: string;
  decimals?: number;
  top?: string;
  bottom?: string;
  /** A second, fixed tick, e.g. the previous score. */
  mark?: number;
  size?: number;
  label: string;
}) {
  const n = segments.length;
  const ms = useElapsed(SWEEP_MS + SETTLE_MS, `${segments.join()}|${value}`);
  const lit = easeInOut(Math.min(1, ms / SWEEP_MS)) * n;
  const shown = value * easeOut(ms / (SWEEP_MS + SETTLE_MS));

  const r = 100;
  const c = 2 * Math.PI * r;
  const seg = c / n;
  const gap = n > 24 ? 2 : 4;
  const at = (units: number) => {
    const a = (units / n) * 2 * Math.PI - Math.PI / 2;
    return { x: 130 + r * Math.cos(a), y: 130 + r * Math.sin(a) };
  };
  const tick = mark === undefined ? null : ([at(mark), mark] as const);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 260 260"
      role="img"
      aria-label={label}
      style={{ flex: "none", overflow: "visible" }}
    >
      <g transform="rotate(-90 130 130)">
        {segments.map((color, i) => {
          const fill = Math.min(1, Math.max(0, lit - i));
          return (
            <g key={i}>
              <circle
                cx="130"
                cy="130"
                r={r}
                fill="none"
                stroke="rgba(255,255,255,.12)"
                strokeWidth="20"
                strokeDasharray={`${seg - gap} ${c - seg + gap}`}
                strokeDashoffset={-i * seg}
              />
              {fill > 0 && (
                <circle
                  cx="130"
                  cy="130"
                  r={r}
                  fill="none"
                  stroke={color}
                  strokeWidth="20"
                  strokeDasharray={`${(seg - gap) * fill} ${c}`}
                  strokeDashoffset={-i * seg}
                />
              )}
            </g>
          );
        })}
      </g>
      {tick && (
        <line
          x1={130 + (tick[0].x - 130) * 0.78}
          y1={130 + (tick[0].y - 130) * 0.78}
          x2={130 + (tick[0].x - 130) * 1.22}
          y2={130 + (tick[0].y - 130) * 1.22}
          stroke="#c9cacb"
          strokeWidth="3"
          strokeLinecap="round"
        />
      )}
      <text
        x="130"
        y="146"
        textAnchor="middle"
        fill="#fff"
        fontSize="44"
        fontWeight="600"
        fontFamily="var(--font)"
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {shown.toFixed(decimals)}
        <tspan fontSize="24" fill="#c9cacb">
          {center}
        </tspan>
      </text>
      {top && (
        <text
          x="130"
          y="-4"
          textAnchor="middle"
          fill="#c9cacb"
          fontSize="13"
          fontFamily="var(--mono)"
        >
          {top}
        </text>
      )}
      {bottom && (
        <text
          x="130"
          y="274"
          textAnchor="middle"
          fill="#c9cacb"
          fontSize="13"
          fontFamily="var(--mono)"
        >
          {bottom}
        </text>
      )}
    </svg>
  );
}
