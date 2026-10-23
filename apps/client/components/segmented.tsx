"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface Option<T> {
  value: T;
  label: string;
}

/** Pill buttons with one choice pressed; a white thumb slides to the choice. */
export function Segmented<T extends string | null>({
  label,
  options,
  value,
  onChange,
  numeric = false,
}: {
  label: string;
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  numeric?: boolean;
}) {
  const group = useRef<HTMLDivElement>(null);
  const [thumb, setThumb] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  // Transitions switch on after the first measure, so the thumb doesn't slide in on load.
  const [ready, setReady] = useState(false);
  const index = options.findIndex((o) => o.value === value);

  // Measure the pressed button; re-measure when the group wraps or resizes.
  useLayoutEffect(() => {
    const el = group.current;
    if (!el) return;
    const measure = () => {
      const btn = el.children[index + 1] as HTMLElement | undefined;
      setThumb(
        btn
          ? {
              x: btn.offsetLeft,
              y: btn.offsetTop,
              w: btn.offsetWidth,
              h: btn.offsetHeight,
            }
          : null,
      );
    };
    measure();
    const frame = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      ro.disconnect();
    };
  }, [index, options.length]);

  return (
    <div
      ref={group}
      className="seg seg-slide"
      data-ready={ready || undefined}
      role="group"
      aria-label={label}
    >
      <span
        className="seg-thumb"
        aria-hidden="true"
        style={
          thumb
            ? {
                transform: `translate(${thumb.x}px, ${thumb.y}px)`,
                width: thumb.w,
                height: thumb.h,
              }
            : { opacity: 0 }
        }
      />
      {options.map((o) => (
        <button
          key={o.label}
          type="button"
          className={numeric ? "num" : undefined}
          aria-pressed={o.value === value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
