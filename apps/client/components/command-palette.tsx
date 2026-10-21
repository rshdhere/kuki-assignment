"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import { Icon, type IconName } from "@/components/icon";
import { adaniFacts, documents } from "@/lib/data";
import { nav } from "@/lib/nav";

interface Command {
  id: string;
  group: "Screens" | "Documents" | "Facts";
  label: string;
  hint?: string;
  icon: IconName;
  href: string;
}

const commands: Command[] = [
  ...nav.map((item) => ({
    id: `screen:${item.href}`,
    group: "Screens" as const,
    label: item.label,
    icon: item.icon,
    href: item.href,
  })),
  ...documents.map((doc) => ({
    id: `doc:${doc.file}`,
    group: "Documents" as const,
    label: doc.file,
    hint: doc.type ?? "Unclassified",
    icon: "doc" as const,
    // Only the Adani bill has a facts screen so far.
    href: doc.file.startsWith("Adani") ? "/facts" : "/",
  })),
  ...adaniFacts.map((fact) => ({
    id: `fact:${fact.field}`,
    group: "Facts" as const,
    label: fact.field,
    hint: fact.value,
    icon: "table" as const,
    href: "/facts",
  })),
];

const noopSubscribe = () => () => {};

const matches = (command: Command, query: string) => {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return `${command.label} ${command.hint ?? ""} ${command.group}`
    .toLowerCase()
    .includes(q);
};

/**
 * Sidebar search button plus a ⌘K / Ctrl+K palette for jumping to screens,
 * documents and facts.
 */
export function CommandPalette() {
  const router = useRouter();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const mounted = useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
  const shortcut = useSyncExternalStore(
    noopSubscribe,
    () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"),
    () => "⌘K",
  );

  const results = useMemo(
    () => commands.filter((command) => matches(command, query)),
    [query],
  );

  const show = () => {
    setQuery("");
    setActive(0);
    setOpen(true);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        if (open) setOpen(false);
        else show();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  }, [open, mounted]);

  const optionId = (index: number) => `${listId}-option-${index}`;

  useEffect(() => {
    document
      .getElementById(optionId(active))
      ?.scrollIntoView({ block: "nearest" });
  });

  const run = (command: Command) => {
    setOpen(false);
    router.push(command.href);
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (results.length ? (i + 1) % results.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) =>
        results.length ? (i - 1 + results.length) % results.length : 0,
      );
    } else if (event.key === "Enter") {
      event.preventDefault();
      const command = results[active];
      if (command) run(command);
    }
  };

  const activeCommand = results[active];

  const dialog = (
    <dialog
      ref={dialogRef}
      className="cmdk"
      aria-label="Search"
      onClose={() => setOpen(false)}
      onClick={(event) => {
        // Clicks on the backdrop land on the dialog element itself.
        if (event.target === event.currentTarget) setOpen(false);
      }}
    >
      <div className="cmdk-input">
        <Icon name="search" size={16} />
        <input
          type="text"
          role="combobox"
          aria-label="Search screens, documents and facts"
          aria-expanded="true"
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={activeCommand ? optionId(active) : undefined}
          placeholder="Search screens, documents and facts…"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onInputKeyDown}
        />
        <kbd className="kbd">Esc</kbd>
      </div>

      <ul id={listId} role="listbox" aria-label="Results" className="cmdk-list">
        {results.length === 0 && (
          <li className="cmdk-empty" role="presentation">
            No results for &ldquo;{query}&rdquo;
          </li>
        )}
        {results.map((command, index) => {
          const showGroup = results[index - 1]?.group !== command.group;
          return (
            <li key={command.id} role="presentation">
              {showGroup && (
                <div className="cmdk-group" aria-hidden="true">
                  {command.group}
                </div>
              )}
              <div
                id={optionId(index)}
                role="option"
                aria-selected={index === active}
                className="cmdk-item"
                onMouseMove={() => setActive(index)}
                onClick={() => run(command)}
              >
                <Icon name={command.icon} size={15} />
                <span className="cmdk-label">{command.label}</span>
                {command.hint && (
                  <span className="cmdk-hint">{command.hint}</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <div className="cmdk-foot" aria-hidden="true">
        <span>
          <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd> to move
        </span>
        <span>
          <kbd className="kbd">↵</kbd> to open
        </span>
      </div>
    </dialog>
  );

  return (
    <>
      <button
        type="button"
        className="search"
        aria-haspopup="dialog"
        aria-keyshortcuts="Meta+K Control+K"
        onClick={show}
      >
        <Icon name="search" size={15} />
        <span>Search</span>
        <kbd className="kbd">{shortcut}</kbd>
      </button>
      {/* Portaled out of the sidebar so it doesn't inherit its dark theme. */}
      {mounted && createPortal(dialog, document.body)}
    </>
  );
}
