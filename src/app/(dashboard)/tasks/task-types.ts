import type {
  Brand,
  Project,
  Task,
  TaskChecklistItem,
  TaskStatus,
  User,
  Vendor,
} from "@prisma/client";

export type TaskCommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  author: Pick<User, "id" | "name" | "email">;
};

export type TaskAttachmentCommentRow = {
  id: string;
  body: string;
  resolvedAt: Date | null;
  createdAt: Date;
  author: Pick<User, "id" | "name" | "email">;
  assignee: Pick<User, "id" | "name" | "email"> | null;
};

export type TaskAttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath: string | null;
  linkUrl: string | null;
  createdAt: Date;
  uploadedBy: Pick<User, "id" | "name" | "email">;
  commentCount?: number;
  unresolvedCommentCount?: number;
};

export type TaskTagRow = {
  taskId: string;
  tagId: string;
  tag: {
    id: string;
    roomId: string;
    name: string;
    colorHex: string;
  };
};

/**
 * Bentuk baris tugas yang diteruskan ke workspace + detail sheet.
 *
 * `comments` & `attachments` bersifat OPSIONAL — daftar tugas tidak lagi
 * memuatnya di SSR untuk menghemat payload. Detail sheet me-lazy-load via
 * `loadTaskDetail()` lalu memerge ke `localTasks` lewat `onTaskPatched`.
 */
export type TaskRow = Task & {
  project: Project & { brand: Brand | null; room?: { name: string } };
  assignees: { user: Pick<User, "id" | "name" | "email" | "image"> }[];
  vendor: Pick<Vendor, "id" | "name"> | null;
  checklistItems: TaskChecklistItem[];
  comments?: TaskCommentRow[];
  attachments?: TaskAttachmentRow[];
  tags: TaskTagRow[];
  kanbanPositions?: { status: TaskStatus; sortKey: number }[];
};
