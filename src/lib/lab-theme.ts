"use client";

import { useSyncExternalStore } from "react";

/**
 * Tema Dominatus Lab — mode terang/gelap KHUSUS Lab, terpisah dari tema DCC.
 *
 * Selama pengguna berada di rute Lab, tema global <html> diambil alih:
 * `data-theme="dominatus-lab"` + toggle `.dark` sesuai mode Lab. Atribut
 * penanda `data-lab-theme-active` dipasang agar kode tema DCC
 * (`applyAppThemeToDocument`) tahu untuk tidak menimpa takeover ini.
 * Saat keluar Lab, `LabThemeController` memulihkan tema DCC pengguna.
 */

export const LAB_THEME_STORAGE_KEY = "dominatus-lab-theme";
export const LAB_THEME_CHANGE_EVENT = "dominatus-lab-theme-change";
export const LAB_ACTIVE_ATTR = "data-lab-theme-active";
export const LAB_DATA_THEME = "dominatus-lab";

export type LabMode = "dark" | "light";

export function getLabMode(): LabMode {
  return localStorage.getItem(LAB_THEME_STORAGE_KEY) === "light"
    ? "light"
    : "dark";
}

export function setLabMode(mode: LabMode): void {
  localStorage.setItem(LAB_THEME_STORAGE_KEY, mode);
  window.dispatchEvent(new Event(LAB_THEME_CHANGE_EVENT));
}

function subscribeLabMode(callback: () => void) {
  window.addEventListener(LAB_THEME_CHANGE_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(LAB_THEME_CHANGE_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

/** Mode Lab reaktif; snapshot server selalu "dark" (bebas hydration mismatch). */
export function useLabMode(): LabMode {
  return useSyncExternalStore(subscribeLabMode, getLabMode, () => "dark");
}

export function isLabThemeActive(): boolean {
  return (
    typeof document !== "undefined" &&
    document.documentElement.hasAttribute(LAB_ACTIVE_ATTR)
  );
}

/**
 * Ambil alih tema global untuk Lab. Preset "custom" DCC menyuntik custom
 * property inline di <html> yang mengalahkan selector CSS Lab — semua var
 * inline dihapus (dipulihkan kembali oleh jalur restore saat keluar Lab).
 */
export function applyLabThemeToDocument(mode: LabMode): void {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.setAttribute(LAB_ACTIVE_ATTR, "");
  el.setAttribute("data-theme", LAB_DATA_THEME);
  el.classList.toggle("dark", mode === "dark");
  const inlineVars: string[] = [];
  for (let i = 0; i < el.style.length; i++) {
    const prop = el.style[i];
    if (prop.startsWith("--")) inlineVars.push(prop);
  }
  for (const prop of inlineVars) el.style.removeProperty(prop);
}
