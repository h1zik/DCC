"use server";

import { NotificationType } from "@prisma/client";
import { z } from "zod";
import {
  serializeAttachmentCommentAnchor,
  type AttachmentCommentAnchor,
} from "@/lib/attachment-comment-anchor";
import { prisma } from "@/lib/prisma";
import { requireTasksRoomHubSession } from "@/lib/auth-helpers";
import { revalidateTasksAndRoomHub } from "@/lib/revalidate-workspace";
import { assertRoomMember, isRoomHubManagerRole } from "@/lib/room-access";

const anchorSchema = z.discriminatedUnion("kind", [
  z
    .object({
      kind: z.literal("text"),
      selectedText: z.string().min(1).max(8000),
      startOffset: z.number().int().min(0),
      endOffset: z.number().int().min(1),
      page: z.number().int().min(1).optional(),
    })
    .refine((a) => a.endOffset > a.startOffset, {
      message: "Rentang teks tidak valid.",
    }),
  z.object({
    kind: z.literal("region"),
    page: z.number().int().min(1).optional(),
    rect: z.object({
      x: z.number().min(0).max(1),
      y: z.number().min(0).max(1),
      w: z.number().min(0.01).max(1),
      h: z.number().min(0.01).max(1),
    }),
    selectedText: z.string().max(500).optional(),
  }),
]);

const addSchema = z.object({
  documentId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  assigneeId: z.string().min(1).optional().nullable(),
  anchor: anchorSchema.optional().nullable(),
});

const resolveSchema = z.object({
  commentId: z.string().min(1),
});

async function documentContextOrThrow(documentId: string) {
  const row = await prisma.roomDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: {
      id: true,
      roomId: true,
      fileName: true,
      title: true,
      room: { select: { name: true } },
    },
  });
  return row;
}

async function validateAssignee(roomId: string, assigneeId: string) {
  const member = await prisma.roomMember.findFirst({
    where: { roomId, userId: assigneeId },
    select: { userId: true },
  });
  if (!member) {
    throw new Error("PIC komentar harus anggota ruangan ini.");
  }
}

export async function loadRoomDocumentDetail(documentId: string) {
  const session = await requireTasksRoomHubSession();
  const ctx = await documentContextOrThrow(documentId);
  await assertRoomMember(ctx.roomId, session.user.id);

  const document = await prisma.roomDocument.findUniqueOrThrow({
    where: { id: documentId },
    select: {
      id: true,
      roomId: true,
      fileName: true,
      title: true,
      mimeType: true,
      size: true,
      publicPath: true,
      tags: true,
      createdAt: true,
      uploadedBy: { select: { id: true, name: true, email: true } },
      comments: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          body: true,
          selectedText: true,
          anchorPage: true,
          anchorJson: true,
          resolvedAt: true,
          createdAt: true,
          author: { select: { id: true, name: true, email: true } },
          assignee: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  const members = await prisma.roomMember.findMany({
    where: { roomId: ctx.roomId },
    select: {
      user: { select: { id: true, name: true, email: true } },
    },
    orderBy: { user: { name: "asc" } },
  });

  return {
    document,
    users: members.map((m) => m.user),
  };
}

export async function addRoomDocumentComment(
  input: z.infer<typeof addSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = addSchema.parse(input);
  const ctx = await documentContextOrThrow(data.documentId);
  await assertRoomMember(ctx.roomId, session.user.id);

  if (data.assigneeId) {
    await validateAssignee(ctx.roomId, data.assigneeId);
  }

  const anchor = data.anchor as AttachmentCommentAnchor | null | undefined;
  const anchorJson = serializeAttachmentCommentAnchor(anchor ?? null);
  const selectedText =
    anchor?.kind === "text"
      ? anchor.selectedText
      : anchor?.kind === "region"
        ? (anchor.selectedText ?? null)
        : null;
  const anchorPage = anchor?.page ?? null;

  const comment = await prisma.roomDocumentComment.create({
    data: {
      documentId: data.documentId,
      authorId: session.user.id,
      assigneeId: data.assigneeId ?? undefined,
      body: data.body,
      selectedText: selectedText ?? undefined,
      anchorPage: anchorPage ?? undefined,
      anchorJson: anchorJson ?? undefined,
    },
    select: {
      id: true,
      body: true,
      selectedText: true,
      anchorPage: true,
      anchorJson: true,
      resolvedAt: true,
      createdAt: true,
      author: { select: { id: true, name: true, email: true } },
      assignee: { select: { id: true, name: true, email: true } },
    },
  });

  if (data.assigneeId && data.assigneeId !== session.user.id) {
    const authorLabel =
      session.user.name?.trim() || session.user.email || "Rekan";
    const docLabel = ctx.title?.trim() || ctx.fileName;
    await prisma.notification.create({
      data: {
        userId: data.assigneeId,
        type: NotificationType.ROOM_DOCUMENT_COMMENT_ASSIGNED,
        message: `${authorLabel} menugaskan Anda pada komentar dokumen «${docLabel}» (${ctx.room.name})`,
      },
    });
  }

  revalidateTasksAndRoomHub();
  return comment;
}

export async function resolveRoomDocumentComment(
  input: z.infer<typeof resolveSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const { commentId } = resolveSchema.parse(input);

  const comment = await prisma.roomDocumentComment.findUniqueOrThrow({
    where: { id: commentId },
    select: {
      id: true,
      assigneeId: true,
      authorId: true,
      resolvedAt: true,
      document: { select: { roomId: true } },
    },
  });

  const member = await assertRoomMember(
    comment.document.roomId,
    session.user.id,
  );
  const canModerate = isRoomHubManagerRole(member.role);
  const isAssignee = comment.assigneeId === session.user.id;
  const isAuthor = comment.authorId === session.user.id;

  if (!isAssignee && !isAuthor && !canModerate) {
    throw new Error("Anda tidak dapat menandai komentar ini selesai.");
  }

  await prisma.roomDocumentComment.update({
    where: { id: commentId },
    data: { resolvedAt: comment.resolvedAt ? null : new Date() },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteRoomDocumentComment(commentId: string) {
  const session = await requireTasksRoomHubSession();
  const comment = await prisma.roomDocumentComment.findUniqueOrThrow({
    where: { id: commentId },
    select: {
      authorId: true,
      document: { select: { roomId: true } },
    },
  });

  const member = await assertRoomMember(
    comment.document.roomId,
    session.user.id,
  );
  const canModerate = isRoomHubManagerRole(member.role);
  if (comment.authorId !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat menghapus komentar ini.");
  }

  await prisma.roomDocumentComment.delete({ where: { id: commentId } });
  revalidateTasksAndRoomHub();
}
