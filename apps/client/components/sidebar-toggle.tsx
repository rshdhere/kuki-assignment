"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Icon } from "@/components/icon";

const STORAGE_KEY = "kuki:sidebar-collapsed";
const EVENT = "kuki:sidebar";
const CLASS = "sidebar-collapsed";

// The collapsed state lives on <html class="sidebar-collapsed">, so CSS can hide the sidebar.
const subscribe = (onChange: () => void) => {
  window.addEventListener(EVENT, onChange);
  return () => window.removeEventListener(EVENT, onChange);
};
const getSnapshot = () => document.documentElement.classList.contains(CLASS);
const getServerSnapshot = () => false;

function setCollapsed(collapsed: boolean) {
  document.documentElement.classList.toggle(CLASS, collapsed);
  try {
    localStorage.setItem(STORAGE_KEY, collapsed ? "1" : "0");
  } catch {
    // Storage can be unavailable (private mode); the choice just won't persist.
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Shows or hides the sidebar. Also bound to ⌘B / Ctrl+B. */
export function SidebarToggle() {
  const collapsed = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === "1") setCollapsed(true);
    } catch {
      // Ignore: default to expanded.
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "b" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setCollapsed(!getSnapshot());
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <button
      type="button"
      className="icon-btn"
      aria-label="Toggle sidebar"
      aria-controls="sidebar"
      aria-expanded={!collapsed}
      aria-keyshortcuts="Meta+B Control+B"
      title={collapsed ? "Show sidebar" : "Hide sidebar"}
      onClick={() => setCollapsed(!collapsed)}
    >
      <Icon name="panel" />
    </button>
  );
}
