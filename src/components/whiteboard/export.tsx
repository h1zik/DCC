"use client";

import { createRoot } from "react-dom/client";
import { flushSync } from "react-dom";
import { elementsBounds } from "@/lib/whiteboard/geometry";
import type { WhiteboardElement } from "@/lib/whiteboard/types";
import { WhiteboardElementNode } from "./whiteboard-element";

/**
 * Ekspor papan ke PNG, SVG, atau JSON.
 *
 * Alih-alih menulis ulang logika gambar, ekspor me-render elemen dengan
 * komponen yang sama persis dengan yang dipakai kanvas ke dalam SVG lepas di
 * luar layar, lalu menyerialisasinya. Dengan begitu hasil ekspor dijamin
 * identik dengan yang dilihat pengguna, dan tidak ada dua sumber kebenaran
 * yang bisa saling menyimpang.
 */

const EXPORT_PADDING = 48;
const PNG_SCALE = 2;

export async function exportBoard(options: {
  elements: WhiteboardElement[];
  /** Semua elemen papan — dibutuhkan konektor yang menempel ke objek lain. */
  allElements: WhiteboardElement[];
  format: "png" | "svg" | "json";
  dark: boolean;
  title: string;
}): Promise<void> {
  const { elements, allElements, format, dark, title } = options;
  if (elements.length === 0) throw new Error("Tidak ada objek untuk diekspor.");

  const fileBase = sanitizeFileName(title) || "papan";

  if (format === "json") {
    const payload = {
      title,
      exportedAt: new Date().toISOString(),
      elements: elements.map((el) => ({
        id: el.id,
        type: el.type,
        x: el.x,
        y: el.y,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        zIndex: el.zIndex,
        locked: el.locked,
        frameId: el.frameId,
        props: el.props,
      })),
    };
    downloadBlob(
      new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
      `${fileBase}.json`,
    );
    return;
  }

  const bounds = elementsBounds(elements);
  if (!bounds) throw new Error("Tidak ada objek untuk diekspor.");

  const viewBox = {
    x: bounds.x - EXPORT_PADDING,
    y: bounds.y - EXPORT_PADDING,
    width: bounds.width + EXPORT_PADDING * 2,
    height: bounds.height + EXPORT_PADDING * 2,
  };

  const svgString = await renderToSvgString({
    elements,
    allElements,
    dark,
    viewBox,
  });

  if (format === "svg") {
    downloadBlob(
      new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
      `${fileBase}.svg`,
    );
    return;
  }

  const blob = await svgToPng(svgString, viewBox.width, viewBox.height);
  downloadBlob(blob, `${fileBase}.png`);
}

/**
 * Render elemen ke string SVG lewat React, di kontainer terlepas dari DOM
 * yang terlihat.
 */
async function renderToSvgString(options: {
  elements: WhiteboardElement[];
  allElements: WhiteboardElement[];
  dark: boolean;
  viewBox: { x: number; y: number; width: number; height: number };
}): Promise<string> {
  const { elements, allElements, dark, viewBox } = options;

  const lookup = new Map(allElements.map((el) => [el.id, el]));
  const ctx = {
    dark,
    getElement: (id: string) => lookup.get(id),
    editingId: null,
  };

  const host = document.createElement("div");
  host.style.position = "fixed";
  host.style.left = "-100000px";
  host.style.top = "0";
  host.style.pointerEvents = "none";
  document.body.appendChild(host);

  const root = createRoot(host);
  try {
    flushSync(() => {
      root.render(
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width={viewBox.width}
          height={viewBox.height}
          viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
        >
          <rect
            x={viewBox.x}
            y={viewBox.y}
            width={viewBox.width}
            height={viewBox.height}
            fill={dark ? "#111113" : "#ffffff"}
          />
          {elements.map((element) => (
            <WhiteboardElementNode key={element.id} element={element} ctx={ctx} />
          ))}
        </svg>,
      );
    });

    const svg = host.querySelector("svg");
    if (!svg) throw new Error("Gagal menyiapkan hasil ekspor.");

    // Gambar eksternal tidak ikut termuat di SVG lepas — sematkan sebagai
    // data URL supaya hasil ekspor tetap utuh saat dibuka di mana pun.
    await inlineImages(svg);

    return new XMLSerializer().serializeToString(svg);
  } finally {
    root.unmount();
    host.remove();
  }
}

async function inlineImages(svg: SVGElement): Promise<void> {
  const images = [...svg.querySelectorAll("image")];
  await Promise.all(
    images.map(async (node) => {
      const href = node.getAttribute("href") ?? node.getAttribute("xlink:href");
      if (!href || href.startsWith("data:")) return;
      try {
        const res = await fetch(href);
        if (!res.ok) return;
        const blob = await res.blob();
        const dataUrl = await blobToDataUrl(blob);
        node.setAttribute("href", dataUrl);
        node.removeAttribute("xlink:href");
      } catch {
        // Gambar yang gagal dimuat cukup dilewati — sisanya tetap terekspor.
      }
    }),
  );
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Gagal membaca gambar."));
    reader.readAsDataURL(blob);
  });
}

async function svgToPng(
  svgString: string,
  width: number,
  height: number,
): Promise<Blob> {
  const url = URL.createObjectURL(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = await loadImage(url);
    const canvas = document.createElement("canvas");
    // Batasi agar papan sangat besar tidak melampaui batas ukuran canvas.
    const scale = Math.min(PNG_SCALE, 8192 / Math.max(width, height));
    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas tidak tersedia.");
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Gagal membuat PNG."));
      }, "image/png");
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Gagal merender papan."));
    image.src = src;
  });
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  // Beri jeda agar unduhan sempat dimulai sebelum URL dilepas.
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function sanitizeFileName(name: string): string {
  return name
    .trim()
    .replace(/[^\p{L}\p{N}\s._-]/gu, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
}

/**
 * Buat pratinjau kecil papan (data URL PNG) untuk kartu di daftar papan.
 */
export async function renderBoardThumbnail(options: {
  elements: WhiteboardElement[];
  dark: boolean;
  maxSize?: number;
}): Promise<string | null> {
  const { elements, dark, maxSize = 400 } = options;
  if (elements.length === 0) return null;

  const bounds = elementsBounds(elements);
  if (!bounds || bounds.width <= 0 || bounds.height <= 0) return null;

  const padding = 24;
  const viewBox = {
    x: bounds.x - padding,
    y: bounds.y - padding,
    width: bounds.width + padding * 2,
    height: bounds.height + padding * 2,
  };

  const svgString = await renderToSvgString({
    elements,
    allElements: elements,
    dark,
    viewBox,
  });

  const url = URL.createObjectURL(
    new Blob([svgString], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = await loadImage(url);
    const scale = Math.min(
      1,
      maxSize / Math.max(viewBox.width, viewBox.height),
    );
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(viewBox.width * scale));
    canvas.height = Math.max(1, Math.round(viewBox.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/webp", 0.7);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}
