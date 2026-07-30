import { RoomWhiteboardElementType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  defaultPropsForType,
  whiteboardElementPatchSchema,
  whiteboardMutationSchema,
  whiteboardPropsSchema,
} from "./types";

/**
 * Regresi penting: skema `props` dipakai juga untuk *patch* parsial, dan
 * server menggabungkannya ke props yang sudah ada (`e.props || v.props`).
 * Kalau skema mengisi nilai default untuk field yang tidak dikirim, satu
 * perubahan gaya kecil akan ikut menimpa isian, teks, coretan, dan gambar
 * milik elemen. Test di bawah mengunci perilaku itu.
 */

describe("whiteboardPropsSchema", () => {
  it("tidak menambahkan field apa pun pada patch parsial", () => {
    const parsed = whiteboardPropsSchema.parse({ strokeWidth: 8 });
    expect(parsed).toEqual({ strokeWidth: 8 });
    expect(Object.keys(parsed)).toHaveLength(1);
  });

  it("tidak menyelipkan `fill` saat hanya mengubah tebal garis", () => {
    // Persis kasus yang membuat objek berubah jadi kuning/cokelat sendiri.
    const parsed = whiteboardPropsSchema.parse({ strokeWidth: 4 });
    expect(parsed.fill).toBeUndefined();
    expect(parsed.fillStyle).toBeUndefined();
  });

  it("tidak mengosongkan teks, coretan, atau gambar", () => {
    const parsed = whiteboardPropsSchema.parse({ opacity: 0.5 });
    expect(parsed.text).toBeUndefined();
    expect(parsed.points).toBeUndefined();
    expect(parsed.src).toBeUndefined();
  });

  it("mempertahankan `transparent` sebagai pilihan isi yang sah", () => {
    expect(whiteboardPropsSchema.parse({ fill: "transparent" })).toEqual({
      fill: "transparent",
    });
  });

  it("tetap menolak nilai yang tidak valid", () => {
    expect(whiteboardPropsSchema.safeParse({ fill: "burgundy" }).success).toBe(false);
    expect(whiteboardPropsSchema.safeParse({ strokeWidth: 999 }).success).toBe(false);
    expect(whiteboardPropsSchema.safeParse({ opacity: 3 }).success).toBe(false);
  });

  it("mengisi bagian dalam endpoint konektor yang memang dikirim", () => {
    const parsed = whiteboardPropsSchema.parse({
      end: { elementId: "abc" },
    });
    expect(parsed.end).toEqual({ elementId: "abc", side: "auto", x: 0, y: 0 });
    expect(parsed.start).toBeUndefined();
  });
});

describe("whiteboardElementPatchSchema", () => {
  it("hanya membawa field yang dikirim", () => {
    const parsed = whiteboardElementPatchSchema.parse({ id: "el-1", x: 12 });
    expect(parsed).toEqual({ id: "el-1", x: 12 });
  });

  it("membedakan frameId null (dilepas) dari tidak dikirim", () => {
    expect(
      whiteboardElementPatchSchema.parse({ id: "el-1", frameId: null }).frameId,
    ).toBeNull();
    expect(
      "frameId" in whiteboardElementPatchSchema.parse({ id: "el-1" }),
    ).toBe(false);
  });
});

describe("whiteboardMutationSchema", () => {
  it("melengkapi ketiga daftar walau hanya satu yang dikirim", () => {
    const parsed = whiteboardMutationSchema.parse({
      update: [{ id: "el-1", props: { strokeWidth: 2 } }],
    });
    expect(parsed.create).toEqual([]);
    expect(parsed.delete).toEqual([]);
    expect(parsed.update[0]!.props).toEqual({ strokeWidth: 2 });
  });

  it("melengkapi elemen baru dengan nilai awal yang wajar", () => {
    const parsed = whiteboardMutationSchema.parse({
      create: [{ id: "el-1", type: RoomWhiteboardElementType.RECTANGLE }],
    });
    const created = parsed.create[0]!;
    expect(created.x).toBe(0);
    expect(created.locked).toBe(false);
    expect(created.frameId).toBeNull();
  });
});

describe("defaultPropsForType", () => {
  it("menyediakan nilai awal per tipe (bukan skema yang mengisinya)", () => {
    expect(defaultPropsForType(RoomWhiteboardElementType.STICKY).fill).toBe("yellow");
    expect(defaultPropsForType(RoomWhiteboardElementType.RECTANGLE).fill).toBe("blue");
    expect(defaultPropsForType(RoomWhiteboardElementType.TEXT).fill).toBe("transparent");
    expect(defaultPropsForType(RoomWhiteboardElementType.ARROW).endArrowhead).toBe("arrow");
    expect(defaultPropsForType(RoomWhiteboardElementType.LINE).endArrowhead).toBe("none");
  });
});
