import { RoomWhiteboardElementType } from "@prisma/client";
import type { WhiteboardElementType } from "./types";

/**
 * Daftar alat kanvas beserta pintasan papan tiknya.
 *
 * Pintasan mengikuti kebiasaan Figma/Miro (V pilih, H tangan, R persegi,
 * O elips, T teks, P pena) supaya pengguna yang sudah terbiasa langsung bisa
 * memakainya tanpa belajar ulang.
 */

export const WHITEBOARD_TOOLS = [
  "select",
  "hand",
  "sticky",
  "rectangle",
  "ellipse",
  "diamond",
  "triangle",
  "arrow",
  "line",
  "connector",
  "draw",
  "highlighter",
  "eraser",
  "text",
  "frame",
  "image",
  "laser",
] as const;

export type WhiteboardTool = (typeof WHITEBOARD_TOOLS)[number];

export type ToolMeta = {
  tool: WhiteboardTool;
  label: string;
  /** Tombol pintasan (huruf tunggal, tanpa modifier). */
  shortcut: string | null;
  /** Tipe elemen yang dibuat alat ini (null untuk alat non-pembuat). */
  creates: WhiteboardElementType | null;
  cursor: string;
};

export const TOOL_META: Record<WhiteboardTool, ToolMeta> = {
  select: {
    tool: "select",
    label: "Pilih",
    shortcut: "v",
    creates: null,
    cursor: "default",
  },
  hand: {
    tool: "hand",
    label: "Geser kanvas",
    shortcut: "h",
    creates: null,
    cursor: "grab",
  },
  sticky: {
    tool: "sticky",
    label: "Sticky note",
    shortcut: "n",
    creates: RoomWhiteboardElementType.STICKY,
    cursor: "crosshair",
  },
  rectangle: {
    tool: "rectangle",
    label: "Persegi",
    shortcut: "r",
    creates: RoomWhiteboardElementType.RECTANGLE,
    cursor: "crosshair",
  },
  ellipse: {
    tool: "ellipse",
    label: "Elips",
    shortcut: "o",
    creates: RoomWhiteboardElementType.ELLIPSE,
    cursor: "crosshair",
  },
  diamond: {
    tool: "diamond",
    label: "Diamond",
    shortcut: "d",
    creates: RoomWhiteboardElementType.DIAMOND,
    cursor: "crosshair",
  },
  triangle: {
    tool: "triangle",
    label: "Segitiga",
    shortcut: null,
    creates: RoomWhiteboardElementType.TRIANGLE,
    cursor: "crosshair",
  },
  arrow: {
    tool: "arrow",
    label: "Panah",
    shortcut: "a",
    creates: RoomWhiteboardElementType.ARROW,
    cursor: "crosshair",
  },
  line: {
    tool: "line",
    label: "Garis",
    shortcut: "l",
    creates: RoomWhiteboardElementType.LINE,
    cursor: "crosshair",
  },
  connector: {
    tool: "connector",
    label: "Konektor",
    shortcut: "c",
    creates: RoomWhiteboardElementType.CONNECTOR,
    cursor: "crosshair",
  },
  draw: {
    tool: "draw",
    label: "Pena",
    shortcut: "p",
    creates: RoomWhiteboardElementType.DRAW,
    cursor: "crosshair",
  },
  highlighter: {
    tool: "highlighter",
    label: "Stabilo",
    shortcut: "s",
    creates: RoomWhiteboardElementType.DRAW,
    cursor: "crosshair",
  },
  eraser: {
    tool: "eraser",
    label: "Penghapus",
    shortcut: "e",
    creates: null,
    cursor: "crosshair",
  },
  text: {
    tool: "text",
    label: "Teks",
    shortcut: "t",
    creates: RoomWhiteboardElementType.TEXT,
    cursor: "text",
  },
  frame: {
    tool: "frame",
    label: "Frame",
    shortcut: "f",
    creates: RoomWhiteboardElementType.FRAME,
    cursor: "crosshair",
  },
  image: {
    tool: "image",
    label: "Gambar",
    shortcut: null,
    creates: RoomWhiteboardElementType.IMAGE,
    cursor: "crosshair",
  },
  laser: {
    tool: "laser",
    label: "Laser pointer",
    shortcut: "k",
    creates: null,
    cursor: "crosshair",
  },
};

/** Alat yang menggambar dengan cara ditarik dari satu titik ke titik lain. */
export const DRAG_CREATE_TOOLS = new Set<WhiteboardTool>([
  "rectangle",
  "ellipse",
  "diamond",
  "triangle",
  "arrow",
  "line",
  "connector",
  "frame",
  "sticky",
  "text",
]);

export function toolByShortcut(key: string): WhiteboardTool | null {
  const lower = key.toLowerCase();
  for (const meta of Object.values(TOOL_META)) {
    if (meta.shortcut === lower) return meta.tool;
  }
  return null;
}
