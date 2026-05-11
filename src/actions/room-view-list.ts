"use server";

import { revalidatePath } from "next/cache";
import { Prisma, RoomListColumnType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomHubManager, assertRoomMember } from "@/lib/room-access";

async function ensureListViewRoom(viewId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "LIST") throw new Error("View bukan tipe List.");
  return v.roomId;
}

function slugifyKey(label: string): string {
  return (
    label
      .normalize("NFKD")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 30) || `kolom_${Math.random().toString(36).slice(2, 6)}`
  );
}

const upsertColumnSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  label: z.string().trim().min(1).max(80),
  type: z.nativeEnum(RoomListColumnType),
  options: z.array(z.string().trim().max(60)).optional().default([]),
});

export async function upsertRoomListColumn(
  input: z.infer<typeof upsertColumnSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = upsertColumnSchema.parse(input);
  const roomId = await ensureListViewRoom(data.viewId);
  await assertRoomHubManager(roomId, session.user.id);

  const cleanedOptions = (data.options ?? [])
    .map((o) => o.trim())
    .filter(Boolean)
    .slice(0, 20);

  if (data.id) {
    await prisma.roomListColumn.update({
      where: { id: data.id },
      data: {
        label: data.label,
        type: data.type,
        options: cleanedOptions,
      },
    });
  } else {
    let key = slugifyKey(data.label);
    const existing = await prisma.roomListColumn.findMany({
      where: { viewId: data.viewId },
      select: { key: true },
    });
    const taken = new Set(existing.map((c) => c.key));
    if (taken.has(key)) {
      let i = 2;
      while (taken.has(`${key}_${i}`)) i += 1;
      key = `${key}_${i}`;
    }
    const max = await prisma.roomListColumn.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    await prisma.roomListColumn.create({
      data: {
        viewId: data.viewId,
        key,
        label: data.label,
        type: data.type,
        options: cleanedOptions,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

export async function deleteRoomListColumn(columnId: string) {
  const session = await requireTasksRoomHubSession();
  const col = await prisma.roomListColumn.findUniqueOrThrow({
    where: { id: columnId },
    select: { viewId: true, key: true },
  });
  const roomId = await ensureListViewRoom(col.viewId);
  await assertRoomHubManager(roomId, session.user.id);

  await prisma.$transaction(async (tx) => {
    await tx.roomListColumn.delete({ where: { id: columnId } });
    const rows = await tx.roomListRow.findMany({
      where: { viewId: col.viewId },
      select: { id: true, data: true },
    });
    for (const r of rows) {
      const obj =
        r.data && typeof r.data === "object" && !Array.isArray(r.data)
          ? { ...(r.data as Record<string, unknown>) }
          : {};
      if (col.key in obj) {
        delete obj[col.key];
        await tx.roomListRow.update({
          where: { id: r.id },
          data: { data: obj as Prisma.InputJsonValue },
        });
      }
    }
  });
  revalidatePath(`/room/${roomId}/view/${col.viewId}`);
}

const upsertRowSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  data: z.record(z.string(), z.unknown()).default({}),
});

export async function upsertRoomListRow(input: z.infer<typeof upsertRowSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertRowSchema.parse(input);
  const roomId = await ensureListViewRoom(data.viewId);
  await assertRoomMember(roomId, session.user.id);

  const columns = await prisma.roomListColumn.findMany({
    where: { viewId: data.viewId },
    select: { key: true },
  });
  const allowed = new Set(columns.map((c) => c.key));
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data.data ?? {})) {
    if (allowed.has(k)) sanitized[k] = v ?? null;
  }

  const jsonData = sanitized as Prisma.InputJsonValue;
  if (data.id) {
    await prisma.roomListRow.update({
      where: { id: data.id },
      data: { data: jsonData },
    });
  } else {
    const max = await prisma.roomListRow.aggregate({
      where: { viewId: data.viewId },
      _max: { sortOrder: true },
    });
    await prisma.roomListRow.create({
      data: {
        viewId: data.viewId,
        data: jsonData,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
      },
    });
  }
  revalidatePath(`/room/${roomId}/view/${data.viewId}`);
}

export async function deleteRoomListRow(rowId: string) {
  const session = await requireTasksRoomHubSession();
  const r = await prisma.roomListRow.findUniqueOrThrow({
    where: { id: rowId },
    select: { viewId: true },
  });
  const roomId = await ensureListViewRoom(r.viewId);
  await assertRoomMember(roomId, session.user.id);
  await prisma.roomListRow.delete({ where: { id: rowId } });
  revalidatePath(`/room/${roomId}/view/${r.viewId}`);
}

/**
 * Tambah baris kosong baru dengan cepat — dipakai untuk pengalaman
 * seperti spreadsheet: klik "+" lalu langsung edit sel.
 */
export async function addEmptyRoomListRow(viewId: string) {
  const session = await requireTasksRoomHubSession();
  const roomId = await ensureListViewRoom(viewId);
  await assertRoomMember(roomId, session.user.id);
  const max = await prisma.roomListRow.aggregate({
    where: { viewId },
    _max: { sortOrder: true },
  });
  const created = await prisma.roomListRow.create({
    data: {
      viewId,
      data: {},
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  revalidatePath(`/room/${roomId}/view/${viewId}`);
  return { id: created.id };
}

const cellSchema = z.object({
  rowId: z.string().min(1),
  key: z.string().min(1).max(40),
  /**
   * Nilai sel: string, number, boolean, atau null (kosong). Tipe lain ditolak.
   */
  value: z.union([z.string(), z.number(), z.boolean(), z.null()]),
});

/**
 * Update satu sel saja (tidak mengirim seluruh data baris). Lebih hemat
 * payload & menghindari kondisi balapan saat dua orang mengedit baris yang
 * sama di sel berbeda.
 */
export async function updateRoomListCell(input: z.infer<typeof cellSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = cellSchema.parse(input);
  const row = await prisma.roomListRow.findUniqueOrThrow({
    where: { id: data.rowId },
    select: { viewId: true, data: true },
  });
  const roomId = await ensureListViewRoom(row.viewId);
  await assertRoomMember(roomId, session.user.id);

  const column = await prisma.roomListColumn.findUnique({
    where: { viewId_key: { viewId: row.viewId, key: data.key } },
    select: { type: true, options: true },
  });
  if (!column) throw new Error("Kolom tidak ditemukan untuk view ini.");

  let nextValue: unknown = data.value;
  if (data.value === null || data.value === "") {
    nextValue = null;
  } else if (column.type === "NUMBER") {
    const n =
      typeof data.value === "number" ? data.value : Number(data.value);
    nextValue = Number.isFinite(n) ? n : null;
  } else if (column.type === "CHECKBOX") {
    nextValue = Boolean(data.value);
  } else if (column.type === "SELECT") {
    const v = String(data.value);
    nextValue = column.options.includes(v) ? v : null;
  } else {
    nextValue = String(data.value);
  }

  const obj =
    row.data && typeof row.data === "object" && !Array.isArray(row.data)
      ? { ...(row.data as Record<string, unknown>) }
      : {};
  if (nextValue === null) delete obj[data.key];
  else obj[data.key] = nextValue;

  await prisma.roomListRow.update({
    where: { id: data.rowId },
    data: { data: obj as Prisma.InputJsonValue },
  });
  revalidatePath(`/room/${roomId}/view/${row.viewId}`);
}

/**
 * Tambah kolom cepat (default tipe TEXT, label otomatis). Pengguna dapat
 * mengubah label & tipe lewat dropdown header kemudian.
 */
export async function addQuickRoomListColumn(input: {
  viewId: string;
  label?: string;
  type?: RoomListColumnType;
}) {
  const session = await requireTasksRoomHubSession();
  const roomId = await ensureListViewRoom(input.viewId);
  await assertRoomHubManager(roomId, session.user.id);

  const count = await prisma.roomListColumn.count({
    where: { viewId: input.viewId },
  });
  const label = (input.label ?? `Kolom ${count + 1}`).trim().slice(0, 80);
  let key = slugifyKey(label);
  const existing = await prisma.roomListColumn.findMany({
    where: { viewId: input.viewId },
    select: { key: true },
  });
  const taken = new Set(existing.map((c) => c.key));
  if (taken.has(key)) {
    let i = 2;
    while (taken.has(`${key}_${i}`)) i += 1;
    key = `${key}_${i}`;
  }
  const max = await prisma.roomListColumn.aggregate({
    where: { viewId: input.viewId },
    _max: { sortOrder: true },
  });
  const created = await prisma.roomListColumn.create({
    data: {
      viewId: input.viewId,
      key,
      label,
      type: input.type ?? RoomListColumnType.TEXT,
      options: [],
      sortOrder: (max._max.sortOrder ?? -1) + 1,
    },
    select: { id: true },
  });
  revalidatePath(`/room/${roomId}/view/${input.viewId}`);
  return { id: created.id };
}
