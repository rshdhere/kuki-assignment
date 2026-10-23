"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";

export interface SelectOption {
  value: string;
  label: string;
  hint?: string;
}

/**
 * A listbox picker styled like the rest of the dashboard. Keyboard: arrows,
 * Home/End, type to jump, Enter or Space to pick, Escape to close.
 */
export function Select({
  label,
  options,
  value,
  onChange,
  width = 320,
}: {
  label: string;
  options: SelectOption[];
  value: string | null;
  onChange: (value: string) => void;
  width?: number;
}) {
  const id = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const [open, setOpen] = useState(false);
  const selected = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  const [active, setActive] = useState(selected);
  const current = options.find((o) => o.value === value);

  const show = () => {
    setActive(selected);
    setOpen(true);
  };
  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };
  const pick = (i: number) => {
    const o = options[i];
    if (o && o.value !== value) onChange(o.value);
    close();
  };

  useEffect(() => {
    if (!open) return;
    list.current?.focus();
    const onDown = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView({ block: "nearest" });
  }, [open, active, id]);

  const onListKey = (e: React.KeyboardEvent) => {
    const last = options.length - 1;
    const moves: Record<string, number> = {
      ArrowDown: Math.min(last, active + 1),
      ArrowUp: Math.max(0, active - 1),
      Home: 0,
      End: last,
      PageDown: Math.min(last, active + 5),
      PageUp: Math.max(0, active - 5),
    };
    if (e.key in moves) {
      e.preventDefault();
      setActive(moves[e.key]!);
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      pick(active);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      close(false);
    } else if (e.key.length === 1) {
      // Type-ahead: jump to the first option starting with what was typed.
      const now = e.timeStamp;
      const t = typed.current;
      t.text = (now - t.at > 600 ? "" : t.text) + e.key.toLowerCase();
      t.at = now;
      const hit = options.findIndex((o) =>
        o.label.toLowerCase().startsWith(t.text),
      );
      if (hit >= 0) setActive(hit);
    }
  };

  return (
    <div
      ref={root}
      className="select"
      style={{ width, maxWidth: "100%" }}
      data-open={open || undefined}
    >
      <button
        ref={button}
        type="button"
        className="select-btn"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-label={`${label}: ${current?.label ?? "none"}`}
        onClick={() => (open ? close() : show())}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            show();
          }
        }}
      >
        <span className="select-value">{current?.label ?? "Choose…"}</span>
        <Icon name="chevron-down" size={16} className="select-chev" />
      </button>
      {open && (
        <ul
          ref={list}
          id={`${id}-list`}
          className="select-list"
          role="listbox"
          tabIndex={-1}
          aria-label={label}
          aria-activedescendant={`${id}-${active}`}
          onKeyDown={onListKey}
        >
          {options.map((o, i) => (
            <li
              key={o.value}
              id={`${id}-${i}`}
              role="option"
              aria-selected={o.value === value}
              data-active={i === active || undefined}
              onPointerMove={() => setActive(i)}
              onClick={() => pick(i)}
            >
              <span className="select-opt">
                <span>{o.label}</span>
                {o.hint && <small>{o.hint}</small>}
              </span>
              {o.value === value && <Icon name="check" size={15} />}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
