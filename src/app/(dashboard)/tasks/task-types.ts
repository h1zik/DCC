import type {
  Brand,
  Project,
  Task,
  TaskChecklistItem,
  User,
  Vendor,
} from "@prisma/client";

export type TaskCommentRow = {
  id: string;
  body: string;
  createdAt: Date;
  author: Pick<User, "id" | "name" | "email">;
};

export type TaskAttachmentRow = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  publicPath: string;
  createdAt: Date;
  uploadedBy: Pick<User, "id" | "name" | "email">;
};

export type TaskRow = Task & {
  project: Project & { brand: Brand | null; room?: { name: string } };
  assignee: Pick<User, "id" | "name" | "email" | "image"> | null;
  vendor: Pick<Vendor, "id" | "name"> | null;
  checklistItems: TaskChecklistItem[];
  comments: TaskCommentRow[];
  attachments: TaskAttachmentRow[];
};
