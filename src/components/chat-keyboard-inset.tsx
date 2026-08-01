"use client";

import { useEffect } from "react";

/** Ambang minimum agar bar URL / pinch-zoom tidak salah dikira keyboard. */
const KEYBOARD_MIN_INSET = 80;

/**
 * Publikasikan tinggi keyboard virtual sebagai `--chat-keyboard-inset` di
 * `<html>`.
 *
 * Di ponsel, membuka keyboard hanya mengecilkan *visual viewport*; layout
 * viewport — dan karenanya `100svh` — tidak ikut menyusut. Shell chat setinggi
 * `100svh` jadi tetap sepanjang layar penuh dan composer yang menempel di
 * dasarnya berakhir di balik keyboard. `DashboardShell` memakai nilai ini untuk
 * memangkas tinggi shell sehingga composer selalu berhenti tepat di atas
 * keyboard.
 *
 * Dipasang hanya di layout chat supaya sisa aplikasi tidak terpengaruh.
 */
export function ChatKeyboardInset() {
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const root = document.documentElement;

    const apply = () => {
      const hidden = window.innerHeight - vv.height - vv.offsetTop;
      const inset = hidden > KEYBOARD_MIN_INSET ? Math.round(hidden) : 0;
      root.style.setProperty("--chat-keyboard-inset", `${inset}px`);
      /** iOS ikut menggeser halaman saat keyboard muncul — kembalikan ke atas. */
      if (inset > 0 && window.scrollY !== 0) window.scrollTo(0, 0);
    };

    apply();
    vv.addEventListener("resize", apply);
    vv.addEventListener("scroll", apply);
    return () => {
      vv.removeEventListener("resize", apply);
      vv.removeEventListener("scroll", apply);
      root.style.removeProperty("--chat-keyboard-inset");
    };
  }, []);

  return null;
}
