"use client";

import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";
const STORAGE_KEY = "content-os.theme";
const THEME_CHANGE_EVENT = "content-os-theme-change";

function applyTheme(theme: Theme) {
  document.documentElement.setAttribute("data-theme", theme);
}

function getThemeSnapshot(): Theme {
  return localStorage.getItem(STORAGE_KEY) === "light" ? "light" : "dark";
}

function subscribeToTheme(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(THEME_CHANGE_EVENT, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onStoreChange);
  };
}

function setTheme(next: Theme) {
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
  window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribeToTheme, getThemeSnapshot, () => "dark");

  function toggle() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  return { theme, toggle };
}
