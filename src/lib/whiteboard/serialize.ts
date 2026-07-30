import type { RoomWhiteboardElement } from "@prisma/client";
import {
  whiteboardPropsSchema,
  type WhiteboardElement,
  type WhiteboardElementType,
  type WhiteboardProps,
} from "./types";

/**
 * Konversi baris database <-> elemen kanvas.
 *
 * `props` disimpan sebagai JSON bebas di DB, jadi setiap pembacaan divalidasi
 * ulang lewat zod. Kalau ada data lama/rusak, elemen tetap dikembalikan
 * dengan props kosong daripada menggagalkan seluruh papan.
 */

export type SerializedElement = {
  id: string;
  type: WhiteboardElementType;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  props: WhiteboardProps;
  locked: boolean;
  frameId: string | null;
  rev: number;
  deleted: boolean;
  updatedById: string | null;
};

export function parseProps(raw: unknown): WhiteboardProps {
  if (!raw || typeof raw !== "object") return {};
  const result = whiteboardPropsSchema.safeParse(raw);
  return result.success ? result.data : {};
}

export function rowToElement(row: RoomWhiteboardElement): SerializedElement {
  return {
    id: row.id,
    type: row.type,
    zIndex: row.zIndex,
    x: row.x,
    y: row.y,
    width: row.width,
    height: row.height,
    rotation: row.rotation,
    props: parseProps(row.props),
    locked: row.locked,
    frameId: row.frameId,
    rev: row.rev,
    deleted: row.deletedAt !== null,
    updatedById: row.updatedById,
  };
}

/** Elemen yang sudah dihapus dikirim minimal — klien hanya perlu id-nya. */
export function rowToDelta(row: RoomWhiteboardElement): SerializedElement {
  if (row.deletedAt !== null) {
    return {
      id: row.id,
      type: row.type,
      zIndex: 0,
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      rotation: 0,
      props: {},
      locked: false,
      frameId: null,
      rev: row.rev,
      deleted: true,
      updatedById: row.updatedById,
    };
  }
  return rowToElement(row);
}

export function toClientElement(serialized: SerializedElement): WhiteboardElement {
  return { ...serialized };
}

/** Urutkan berdasarkan z-index, dengan id sebagai pemecah seri yang stabil. */
export function sortByZ<T extends { zIndex: number; id: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.zIndex === b.zIndex ? a.id.localeCompare(b.id) : a.zIndex - b.zIndex,
  );
}
