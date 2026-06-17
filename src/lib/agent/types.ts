import type { TaskPriority, TaskStatus } from "@prisma/client";

export type AgentUser = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

export type AgentMessage = {
  role: "user" | "assistant";
  content: string;
};

export type AgentRoomSummary = {
  id: string;
  name: string;
  brandName: string | null;
  workspaceSection: string;
};

export type AgentTaskSummary = {
  id: string;
  title: string;
  status: TaskStatus;
  kanbanColumnId?: string | null;
  statusLabel: string;
  priority: TaskPriority;
  dueDate: string | null;
  assignees: string[];
  projectName: string;
  roomName: string;
  roomId: string;
  phaseId: string | null;
  phaseName: string | null;
  isAssignedToMe: boolean;
};

export type AgentKanbanBoard = {
  roomId: string;
  roomName: string;
  phaseName: string | null;
  columns: {
    columnId: string;
    kind: string;
    status: TaskStatus;
    label: string;
    tasks: AgentTaskSummary[];
  }[];
};

export type AgentToolResult = {
  ok: boolean;
  data?: unknown;
  error?: string;
};
