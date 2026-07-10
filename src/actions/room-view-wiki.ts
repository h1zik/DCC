"use server";

import { randomUUID } from "node:crypto";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NotificationType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { assertRoomMember } from "@/lib/room-access";
import { getUploadPublicDir } from "@/lib/upload-storage";
import { normalizeWikiTags, WIKI_TAG_LIMITS } from "@/lib/wiki-organization";
import { isWikiLockAvailable, uniqueWikiMentionIds } from "@/lib/wiki-collaboration";

async function ensureWikiMember(viewId: string, userId: string) {
  const v = await prisma.roomView.findUniqueOrThrow({
    where: { id: viewId },
    select: { roomId: true, type: true },
  });
  if (v.type !== "WIKI") throw new Error("View bukan tipe Wiki.");
  await assertRoomMember(v.roomId, userId);
  return v.roomId;
}

const upsertSchema = z.object({
  id: z.string().optional(),
  viewId: z.string().min(1),
  title: z.string().trim().min(1).max(160),
  content: z.string().max(50_000).optional().default(""),
  baseRevision: z.number().int().min(0).optional(),
  parentId: z.string().nullable().optional(),
  tags: z.array(z.string().max(WIKI_TAG_LIMITS.maxLength)).max(WIKI_TAG_LIMITS.maxTags).optional(),
});

const VERSION_CHECKPOINT_MS = 60_000;

type SaveConflict = {
  conflict: true;
  id: string;
  revision: number;
  title: string;
  content: string;
  updatedAt: string;
};

function assertWikiLockAvailable(
  lock: { editLockedById: string | null; editLockExpiresAt: Date | null },
  userId: string,
) {
  if (!isWikiLockAvailable(lock, userId)) {
    throw new Error("Halaman sedang diedit pengguna lain. Tunggu lock berakhir.");
  }
}

export async function upsertRoomWikiPage(input: z.infer<typeof upsertSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = upsertSchema.parse(input);
  const roomId = await ensureWikiMember(data.viewId, session.user.id);

  if (data.id) {
    const current = await prisma.roomWikiPage.findFirst({
      where: { id: data.id, viewId: data.viewId },
      select: {
        id: true,
        title: true,
        content: true,
        revision: true,
        updatedAt: true,
        editLockedById: true,
        editLockExpiresAt: true,
      },
    });
    if (!current) throw new Error("Halaman Wiki tidak ditemukan pada view ini.");
    assertWikiLockAvailable(current, session.user.id);
    if (data.baseRevision != null && data.baseRevision !== current.revision) {
      return {
        conflict: true,
        id: current.id,
        revision: current.revision,
        title: current.title,
        content: current.content,
        updatedAt: current.updatedAt.toISOString(),
      } satisfies SaveConflict;
    }
    if (current.title === data.title && current.content === data.content) {
      return {
        conflict: false as const,
        id: current.id,
        revision: current.revision,
        updatedAt: current.updatedAt.toISOString(),
      };
    }

    const latestVersion = await prisma.roomWikiPageVersion.findFirst({
      where: { pageId: current.id },
      orderBy: { createdAt: "desc" },
      select: { createdAt: true },
    });
    const nextRevision = current.revision + 1;
    const shouldCheckpoint =
      !latestVersion || Date.now() - latestVersion.createdAt.getTime() >= VERSION_CHECKPOINT_MS;

    const updated = await prisma.$transaction(async (tx) => {
      const guarded = await tx.roomWikiPage.updateMany({
        where: { id: current.id, viewId: data.viewId, revision: current.revision },
        data: {
          title: data.title,
          content: data.content,
          revision: nextRevision,
          updatedById: session.user.id,
        },
      });
      if (guarded.count !== 1) return null;
      if (shouldCheckpoint) {
        await tx.roomWikiPageVersion.create({
          data: {
            pageId: current.id,
            revision: nextRevision,
            title: data.title,
            content: data.content,
            createdById: session.user.id,
          },
        });
      }
      return tx.roomWikiPage.findUniqueOrThrow({
        where: { id: current.id },
        select: { revision: true, updatedAt: true },
      });
    });

    if (!updated) {
      const latest = await prisma.roomWikiPage.findUniqueOrThrow({
        where: { id: current.id },
        select: { id: true, revision: true, title: true, content: true, updatedAt: true },
      });
      return {
        conflict: true,
        id: latest.id,
        revision: latest.revision,
        title: latest.title,
        content: latest.content,
        updatedAt: latest.updatedAt.toISOString(),
      } satisfies SaveConflict;
    }
    revalidatePath(`/room/${roomId}/view/${data.viewId}`);
    return {
      conflict: false as const,
      id: current.id,
      revision: updated.revision,
      updatedAt: updated.updatedAt.toISOString(),
    };
  } else {
    const parentId = data.parentId ?? null;
    if (parentId) {
      const parent = await prisma.roomWikiPage.findFirst({
        where: { id: parentId, viewId: data.viewId },
        select: { id: true },
      });
      if (!parent) throw new Error("Halaman induk tidak valid.");
    }
    const max = await prisma.roomWikiPage.aggregate({
      where: { viewId: data.viewId, parentId },
      _max: { sortOrder: true },
    });
    const created = await prisma.roomWikiPage.create({
      data: {
        viewId: data.viewId,
        parentId,
        title: data.title,
        content: data.content ?? "",
        tags: normalizeWikiTags(data.tags ?? []),
        updatedById: session.user.id,
        sortOrder: (max._max.sortOrder ?? -1) + 1,
        versions: {
          create: {
            revision: 0,
            title: data.title,
            content: data.content,
            createdById: session.user.id,
            reason: "initial",
          },
        },
      },
      select: { id: true, revision: true, updatedAt: true },
    });
    revalidatePath(`/room/${roomId}/view/${data.viewId}`);
    return {
      conflict: false as const,
      id: created.id,
      revision: created.revision,
      updatedAt: created.updatedAt.toISOString(),
    };
  }
}

const organizationSchema = z.object({
  pageId: z.string().min(1),
  parentId: z.string().min(1).nullable().optional(),
  tags: z.array(z.string().max(WIKI_TAG_LIMITS.maxLength)).max(WIKI_TAG_LIMITS.maxTags).optional(),
});

export async function updateRoomWikiPageOrganization(
  input: z.infer<typeof organizationSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = organizationSchema.parse(input);
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: data.pageId },
    select: {
      viewId: true,
      parentId: true,
      editLockedById: true,
      editLockExpiresAt: true,
    },
  });
  const roomId = await ensureWikiMember(page.viewId, session.user.id);
  assertWikiLockAvailable(page, session.user.id);

  if (data.parentId !== undefined) {
    if (data.parentId === data.pageId) throw new Error("Halaman tidak dapat menjadi induknya sendiri.");
    let cursor = data.parentId;
    let depth = 0;
    while (cursor) {
      if (cursor === data.pageId) throw new Error("Pemindahan ini akan membuat siklus halaman.");
      const parent = await prisma.roomWikiPage.findFirst({
        where: { id: cursor, viewId: page.viewId },
        select: { parentId: true },
      });
      if (!parent) throw new Error("Halaman induk tidak valid.");
      cursor = parent.parentId;
      depth += 1;
      if (depth > 20) throw new Error("Kedalaman halaman maksimal 20 tingkat.");
    }
  }

  await prisma.roomWikiPage.update({
    where: { id: data.pageId },
    data: {
      ...(data.parentId !== undefined ? { parentId: data.parentId } : {}),
      ...(data.tags !== undefined ? { tags: normalizeWikiTags(data.tags) } : {}),
    },
  });
  revalidatePath(`/room/${roomId}/view/${page.viewId}`);
}

export async function listRoomWikiPageVersions(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  await ensureWikiMember(page.viewId, session.user.id);
  const versions = await prisma.roomWikiPageVersion.findMany({
    where: { pageId },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      revision: true,
      title: true,
      content: true,
      reason: true,
      createdAt: true,
      createdBy: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return versions.map((version) => ({
    ...version,
    createdAt: version.createdAt.toISOString(),
  }));
}

export async function restoreRoomWikiPageVersion(pageId: string, versionId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: {
      viewId: true,
      revision: true,
      editLockedById: true,
      editLockExpiresAt: true,
    },
  });
  const roomId = await ensureWikiMember(page.viewId, session.user.id);
  assertWikiLockAvailable(page, session.user.id);
  const version = await prisma.roomWikiPageVersion.findFirst({
    where: { id: versionId, pageId },
    select: { title: true, content: true },
  });
  if (!version) throw new Error("Versi Wiki tidak ditemukan.");
  const nextRevision = page.revision + 1;
  const updated = await prisma.$transaction(async (tx) => {
    const row = await tx.roomWikiPage.update({
      where: { id: pageId },
      data: {
        title: version.title,
        content: version.content,
        revision: nextRevision,
        updatedById: session.user.id,
      },
      select: { updatedAt: true },
    });
    await tx.roomWikiPageVersion.create({
      data: {
        pageId,
        revision: nextRevision,
        title: version.title,
        content: version.content,
        createdById: session.user.id,
        reason: "restore",
      },
    });
    return row;
  });
  revalidatePath(`/room/${roomId}/view/${page.viewId}`);
  return { revision: nextRevision, updatedAt: updated.updatedAt.toISOString() };
}

export async function deleteRoomWikiPage(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const p = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  const roomId = await ensureWikiMember(p.viewId, session.user.id);
  await prisma.roomWikiPage.delete({ where: { id: pageId } });
  revalidatePath(`/room/${roomId}/view/${p.viewId}`);
}

const WIKI_ATTACHMENT_MAX_BYTES = 25 * 1024 * 1024;
const WIKI_ATTACHMENT_ALLOWED_MIME = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "application/zip",
  "application/json",
  "application/msword",
  "application/vnd.ms-",
  "application/vnd.openxmlformats-officedocument",
  "text/plain",
  "text/csv",
  "audio/",
  "video/",
];

function isAllowedWikiAttachmentMime(mimeType: string): boolean {
  const mime = mimeType.toLowerCase();
  return WIKI_ATTACHMENT_ALLOWED_MIME.some((allowed) => mime.startsWith(allowed));
}

function safeWikiAttachmentName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export async function uploadRoomWikiAttachment(pageId: string, formData: FormData) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  const roomId = await ensureWikiMember(page.viewId, session.user.id);
  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Pilih file terlebih dahulu.");
  if (file.size <= 0) throw new Error("File kosong tidak dapat diunggah.");
  if (file.size > WIKI_ATTACHMENT_MAX_BYTES) {
    throw new Error("Ukuran lampiran Wiki maksimal 25 MB.");
  }
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedWikiAttachmentMime(mimeType)) {
    throw new Error("Tipe file tidak didukung atau berisiko dijalankan di browser.");
  }

  const storedName = `${randomUUID()}-${safeWikiAttachmentName(file.name)}`;
  const directory = path.join(getUploadPublicDir(), "wiki", pageId);
  const absolutePath = path.join(directory, storedName);
  const publicPath = `/uploads/wiki/${pageId}/${storedName}`;
  await mkdir(directory, { recursive: true });
  await writeFile(absolutePath, Buffer.from(await file.arrayBuffer()));

  try {
    await prisma.roomWikiAttachment.create({
      data: {
        pageId,
        uploadedById: session.user.id,
        fileName: file.name.slice(0, 240),
        mimeType,
        size: file.size,
        publicPath,
      },
    });
  } catch (error) {
    await unlink(absolutePath).catch(() => undefined);
    throw error;
  }

  revalidatePath(`/room/${roomId}/view/${page.viewId}`);
  return { url: publicPath, name: file.name, mimeType, size: file.size };
}

const WIKI_LOCK_TTL_MS = 90_000;
const WIKI_PRESENCE_TTL_MS = 120_000;

async function readRoomWikiCollaborationState(pageId: string, viewerUserId: string) {
  const now = new Date();
  const activeSince = new Date(now.getTime() - WIKI_PRESENCE_TTL_MS);
  const [page, presences] = await Promise.all([
    prisma.roomWikiPage.findUniqueOrThrow({
      where: { id: pageId },
      select: {
        editLockedById: true,
        editLockExpiresAt: true,
        editLockedBy: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
    prisma.roomWikiPresence.findMany({
      where: { pageId, lastSeenAt: { gte: activeSince } },
      orderBy: { lastSeenAt: "desc" },
      select: {
        lastSeenAt: true,
        user: { select: { id: true, name: true, email: true, image: true } },
      },
    }),
  ]);
  const lockActive = Boolean(
    page.editLockedById &&
      page.editLockExpiresAt &&
      page.editLockExpiresAt.getTime() > now.getTime(),
  );
  return {
    canEdit: !lockActive || page.editLockedById === viewerUserId,
    lock: lockActive && page.editLockedBy ? {
      user: page.editLockedBy,
      expiresAt: page.editLockExpiresAt!.toISOString(),
    } : null,
    presences: presences.map((presence) => ({
      user: presence.user,
      lastSeenAt: presence.lastSeenAt.toISOString(),
    })),
  };
}

export async function heartbeatRoomWikiPage(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  await ensureWikiMember(page.viewId, session.user.id);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + WIKI_LOCK_TTL_MS);
  await prisma.$transaction([
    prisma.roomWikiPage.updateMany({
      where: {
        id: pageId,
        OR: [
          { editLockedById: null },
          { editLockedById: session.user.id },
          { editLockExpiresAt: null },
          { editLockExpiresAt: { lt: now } },
        ],
      },
      data: { editLockedById: session.user.id, editLockExpiresAt: expiresAt },
    }),
    prisma.roomWikiPresence.upsert({
      where: { pageId_userId: { pageId, userId: session.user.id } },
      create: { pageId, userId: session.user.id, lastSeenAt: now },
      update: { lastSeenAt: now },
    }),
  ]);
  return readRoomWikiCollaborationState(pageId, session.user.id);
}

export async function releaseRoomWikiPage(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUnique({
    where: { id: pageId },
    select: { viewId: true },
  });
  if (!page) return;
  await ensureWikiMember(page.viewId, session.user.id);
  await prisma.$transaction([
    prisma.roomWikiPage.updateMany({
      where: { id: pageId, editLockedById: session.user.id },
      data: { editLockedById: null, editLockExpiresAt: null },
    }),
    prisma.roomWikiPresence.deleteMany({ where: { pageId, userId: session.user.id } }),
  ]);
}

const wikiCommentSchema = z.object({
  pageId: z.string().min(1),
  body: z.string().trim().min(1).max(2_000),
  mentionedUserIds: z.array(z.string()).max(10).default([]),
});

export async function listRoomWikiComments(pageId: string) {
  const session = await requireTasksRoomHubSession();
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: pageId },
    select: { viewId: true },
  });
  await ensureWikiMember(page.viewId, session.user.id);
  const comments = await prisma.roomWikiComment.findMany({
    where: { pageId },
    orderBy: [{ resolvedAt: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      authorId: true,
      body: true,
      mentionedUserIds: true,
      resolvedAt: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true, image: true } },
    },
  });
  return comments.map((comment) => ({
    ...comment,
    resolvedAt: comment.resolvedAt?.toISOString() ?? null,
    createdAt: comment.createdAt.toISOString(),
  }));
}

export async function addRoomWikiComment(input: z.input<typeof wikiCommentSchema>) {
  const session = await requireTasksRoomHubSession();
  const data = wikiCommentSchema.parse(input);
  const page = await prisma.roomWikiPage.findUniqueOrThrow({
    where: { id: data.pageId },
    select: { viewId: true, title: true, view: { select: { roomId: true } } },
  });
  await ensureWikiMember(page.viewId, session.user.id);
  const requestedMentions = uniqueWikiMentionIds(data.mentionedUserIds, session.user.id);
  const validMentions = requestedMentions.length > 0
    ? await prisma.roomMember.findMany({
        where: { roomId: page.view.roomId, userId: { in: requestedMentions } },
        select: { userId: true },
      })
    : [];
  const mentionedUserIds = validMentions.map((member) => member.userId);

  await prisma.$transaction(async (tx) => {
    await tx.roomWikiComment.create({
      data: {
        pageId: data.pageId,
        authorId: session.user.id,
        body: data.body,
        mentionedUserIds,
      },
    });
    if (mentionedUserIds.length > 0) {
      await tx.notification.createMany({
        data: mentionedUserIds.map((userId) => ({
          userId,
          type: NotificationType.WIKI_MENTION,
          message: `Anda disebut dalam komentar Wiki “${page.title}”.`,
        })),
      });
    }
  });
}

export async function resolveRoomWikiComment(commentId: string, resolved: boolean) {
  const session = await requireTasksRoomHubSession();
  const comment = await prisma.roomWikiComment.findUniqueOrThrow({
    where: { id: commentId },
    select: { page: { select: { viewId: true } } },
  });
  await ensureWikiMember(comment.page.viewId, session.user.id);
  await prisma.roomWikiComment.update({
    where: { id: commentId },
    data: { resolvedAt: resolved ? new Date() : null },
  });
}

export async function deleteRoomWikiComment(commentId: string) {
  const session = await requireTasksRoomHubSession();
  const comment = await prisma.roomWikiComment.findUniqueOrThrow({
    where: { id: commentId },
    select: { authorId: true, page: { select: { viewId: true } } },
  });
  await ensureWikiMember(comment.page.viewId, session.user.id);
  if (comment.authorId !== session.user.id) {
    throw new Error("Hanya penulis komentar yang dapat menghapus komentar ini.");
  }
  await prisma.roomWikiComment.delete({ where: { id: commentId } });
}
