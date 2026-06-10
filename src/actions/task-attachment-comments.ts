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
import {
  assertRoomMemberHasTaskPhase,
  getTaskRoomContext,
  isRoomHubManagerRole,
} from "@/lib/room-access";

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
  attachmentId: z.string().min(1),
  body: z.string().trim().min(1).max(4000),
  assigneeId: z.string().min(1).optional().nullable(),
  anchor: anchorSchema.optional().nullable(),
});

const resolveSchema = z.object({
  commentId: z.string().min(1),
});

async function attachmentContextOrThrow(attachmentId: string) {
  const row = await prisma.taskAttachment.findUniqueOrThrow({
    where: { id: attachmentId },
    select: {
      id: true,
      taskId: true,
      fileName: true,
      task: {
        select: {
          title: true,
          project: { include: { brand: true, room: { select: { name: true } } } },
        },
      },
    },
  });
  const { roomId, phase } = await getTaskRoomContext(row.taskId);
  return { ...row, roomId, phase };
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

export async function loadTaskAttachmentDetail(attachmentId: string) {
  const session = await requireTasksRoomHubSession();
  const ctx = await attachmentContextOrThrow(attachmentId);
  await assertRoomMemberHasTaskPhase(
    ctx.roomId,
    session.user.id,
    ctx.phase,
  );

  const attachment = await prisma.taskAttachment.findUniqueOrThrow({
    where: { id: attachmentId },
    select: {
      id: true,
      taskId: true,
      fileName: true,
      mimeType: true,
      size: true,
      publicPath: true,
      linkUrl: true,
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
      task: {
        select: {
          attachments: {
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              fileName: true,
              mimeType: true,
              publicPath: true,
              linkUrl: true,
            },
          },
        },
      },
    },
  });

  return attachment;
}

export async function addTaskAttachmentComment(
  input: z.infer<typeof addSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const data = addSchema.parse(input);
  const ctx = await attachmentContextOrThrow(data.attachmentId);
  await assertRoomMemberHasTaskPhase(
    ctx.roomId,
    session.user.id,
    ctx.phase,
  );

  if (data.assigneeId) {
    await validateAssignee(ctx.roomId, data.assigneeId);
  }

  const anchor = data.anchor as AttachmentCommentAnchor | null | undefined;
  const anchorJson = serializeAttachmentCommentAnchor(anchor ?? null);
  const selectedText =
    anchor?.kind === "text"
      ? anchor.selectedText
      : anchor?.kind === "region"
        ? anchor.selectedText ?? null
        : null;
  const anchorPage = anchor?.page ?? null;

  const comment = await prisma.taskAttachmentComment.create({
    data: {
      attachmentId: data.attachmentId,
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
    await prisma.notification.create({
      data: {
        userId: data.assigneeId,
        type: NotificationType.TASK_FILE_COMMENT_ASSIGNED,
        message: `${authorLabel} menugaskan Anda pada komentar file «${ctx.fileName}» (${ctx.task.title})`,
      },
    });
  }

  revalidateTasksAndRoomHub();
  return comment;
}

export async function resolveTaskAttachmentComment(
  input: z.infer<typeof resolveSchema>,
) {
  const session = await requireTasksRoomHubSession();
  const { commentId } = resolveSchema.parse(input);

  const comment = await prisma.taskAttachmentComment.findUniqueOrThrow({
    where: { id: commentId },
    select: {
      id: true,
      assigneeId: true,
      authorId: true,
      resolvedAt: true,
      attachment: { select: { taskId: true } },
    },
  });

  const { roomId, phase } = await getTaskRoomContext(comment.attachment.taskId);
  const member = await assertRoomMemberHasTaskPhase(
    roomId,
    session.user.id,
    phase,
  );
  const canModerate = isRoomHubManagerRole(member.role);
  const isAssignee = comment.assigneeId === session.user.id;
  const isAuthor = comment.authorId === session.user.id;

  if (!isAssignee && !isAuthor && !canModerate) {
    throw new Error("Anda tidak dapat menandai komentar ini selesai.");
  }

  await prisma.taskAttachmentComment.update({
    where: { id: commentId },
    data: { resolvedAt: comment.resolvedAt ? null : new Date() },
  });
  revalidateTasksAndRoomHub();
}

export async function deleteTaskAttachmentComment(commentId: string) {
  const session = await requireTasksRoomHubSession();
  const comment = await prisma.taskAttachmentComment.findUniqueOrThrow({
    where: { id: commentId },
    select: {
      authorId: true,
      attachment: { select: { taskId: true } },
    },
  });

  const { roomId, phase } = await getTaskRoomContext(comment.attachment.taskId);
  const member = await assertRoomMemberHasTaskPhase(
    roomId,
    session.user.id,
    phase,
  );
  const canModerate = isRoomHubManagerRole(member.role);
  if (comment.authorId !== session.user.id && !canModerate) {
    throw new Error("Anda tidak dapat menghapus komentar ini.");
  }

  await prisma.taskAttachmentComment.delete({ where: { id: commentId } });
  revalidateTasksAndRoomHub();
}
