type ToolRun = {
  name: string;
  ok: boolean;
  data?: unknown;
  error?: string;
};

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === "object" ? (v as Record<string, unknown>) : null;
}

function formatAnalyzeRoomWorkload(data: Record<string, unknown>): string {
  const roomName = String(data.roomName ?? "ruangan");
  const total = Number(data.totalActive ?? 0);
  const overdue = Number(data.overdueCount ?? 0);
  const blocked = Number(data.blockedCount ?? 0);
  const dueWeek = Number(data.dueThisWeekCount ?? 0);
  const myTasks = Number(data.myTasksCount ?? 0);

  const byStatus = Array.isArray(data.byStatus)
    ? (data.byStatus as { label: string; count: number }[])
        .map((s) => `${s.label}: ${s.count}`)
        .join(", ")
    : "";

  const insights = Array.isArray(data.insights)
    ? (data.insights as string[]).map((i) => `• ${i}`).join("\n")
    : "";

  const topOverdue = Array.isArray(data.topOverdue)
    ? (data.topOverdue as { title: string; phaseName?: string }[])
        .slice(0, 3)
        .map((t) => `• ${t.title}${t.phaseName ? ` (${t.phaseName})` : ""}`)
        .join("\n")
    : "";

  let msg = `**${roomName}** — ${total} tugas aktif.\n`;
  if (byStatus) msg += `Distribusi: ${byStatus}.\n`;
  if (overdue > 0) msg += `⚠️ ${overdue} overdue.\n`;
  if (blocked > 0) msg += `🚧 ${blocked} diblokir.\n`;
  if (dueWeek > 0) msg += `📅 ${dueWeek} deadline minggu ini.\n`;
  if (myTasks > 0) msg += `👤 ${myTasks} tugas kamu di sini.\n`;
  if (insights) msg += `\n${insights}\n`;
  if (topOverdue) msg += `\nOverdue teratas:\n${topOverdue}`;

  return msg.trim();
}

function formatBulkMove(data: Record<string, unknown>): string {
  const count = Number(data.movedCount ?? 0);
  const room = String(data.roomName ?? "");
  const status = String(data.targetStatus ?? "");
  const titles = Array.isArray(data.movedTitles)
    ? (data.movedTitles as string[]).map((t) => `• ${t}`).join("\n")
    : "";

  if (count === 0) return `Tidak ada tugas yang berhasil dipindahkan di ${room}.`;
  let msg = `**${count}** tugas dipindahkan ke **${status}** di ${room}.`;
  if (titles) msg += `\n\n${titles}`;
  return msg;
}

function formatDeleteConfirm(data: Record<string, unknown>): string {
  const room = String(data.roomName ?? "ruangan");
  const count = Number(data.taskCount ?? 0);
  const tasks = Array.isArray(data.tasks)
    ? (data.tasks as { title: string; phaseName?: string; statusLabel: string }[])
        .map(
          (t) =>
            `• **${t.title}** (${t.phaseName ?? "—"}, ${t.statusLabel})`,
        )
        .join("\n")
    : "";

  return `⚠️ **${count}** tugas akan dihapus permanen dari **${room}**:\n\n${tasks}\n\nYakin? Balas **ya** atau **konfirmasi** untuk lanjut, atau **batal** untuk membatalkan.`;
}

function formatBulkDelete(data: Record<string, unknown>): string {
  const count = Number(data.deletedCount ?? 0);
  const room = String(data.roomName ?? "");
  const titles = Array.isArray(data.deletedTitles)
    ? (data.deletedTitles as string[]).map((t) => `• ${t}`).join("\n")
    : "";

  if (count === 0) return `Tidak ada tugas yang berhasil dihapus di ${room}.`;
  let msg = `**${count}** tugas berhasil dihapus dari ${room}.`;
  if (titles) msg += `\n\n${titles}`;
  return msg;
}

function formatArchiveBulk(data: Record<string, unknown>): string {
  const count = Number(data.archivedCount ?? 0);
  const room = String(data.roomName ?? "");
  const phase = data.phaseName ? ` fase ${data.phaseName}` : "";
  const titles = Array.isArray(data.archivedTitles)
    ? (data.archivedTitles as string[]).map((t) => `• ${t}`).join("\n")
    : "";

  if (count === 0) {
    return `Tidak ada tugas selesai yang perlu diarsipkan di ${room}${phase}.`;
  }

  let msg = `Berhasil mengarsipkan **${count}** tugas selesai di ${room}${phase}.`;
  if (titles) msg += `\n\n${titles}`;
  return msg;
}

function formatSummarizeWorkspaces(data: Record<string, unknown>): string {
  const rooms = Array.isArray(data.rooms)
    ? (data.rooms as {
        roomName: string;
        totalActive: number;
        overdue: number;
        myTasks: number;
      }[])
    : [];

  const highlights = Array.isArray(data.highlights)
    ? (data.highlights as string[]).map((h) => `• ${h}`).join("\n")
    : "";

  const lines = rooms
    .filter((r) => r.totalActive > 0 || r.overdue > 0 || r.myTasks > 0)
    .slice(0, 8)
    .map(
      (r) =>
        `• **${r.roomName}**: ${r.totalActive} aktif${r.overdue > 0 ? `, ${r.overdue} overdue` : ""}${r.myTasks > 0 ? `, ${r.myTasks} tugas kamu` : ""}`,
    );

  let msg = "Ringkasan workspace:\n";
  if (highlights) msg += `${highlights}\n\n`;
  if (lines.length) msg += lines.join("\n");
  else msg += "Belum ada aktivitas signifikan di ruangan kamu.";

  return msg.trim();
}

function formatMyTasks(data: Record<string, unknown>): string {
  const total = Number(data.total ?? 0);
  const tasks = Array.isArray(data.tasks)
    ? (data.tasks as {
        title: string;
        statusLabel: string;
        roomName: string;
        dueDate?: string | null;
      }[])
    : [];

  if (total === 0) return "Kamu belum punya tugas yang ditugaskan saat ini.";

  const lines = tasks.slice(0, 8).map((t) => {
    const due = t.dueDate
      ? ` — deadline ${new Date(t.dueDate).toLocaleDateString("id-ID")}`
      : "";
    return `• **${t.title}** (${t.statusLabel}, ${t.roomName})${due}`;
  });

  return `Kamu punya **${total}** tugas:\n\n${lines.join("\n")}`;
}

function formatListTasks(data: unknown): string | null {
  if (!Array.isArray(data) || data.length === 0) {
    return "Tidak ada tugas yang cocok dengan filter tersebut.";
  }

  const tasks = data as {
    title: string;
    statusLabel: string;
    phaseName?: string;
    roomName: string;
  }[];

  const lines = tasks.slice(0, 10).map(
    (t) =>
      `• **${t.title}** — ${t.statusLabel}${t.phaseName ? ` (${t.phaseName})` : ""} · ${t.roomName}`,
  );

  return `Ditemukan **${tasks.length}** tugas:\n\n${lines.join("\n")}`;
}

/** Fallback jika model Gemini tidak mengembalikan teks setelah tool call. */
export function synthesizeAgentReply(toolRuns: ToolRun[]): string | null {
  const successful = toolRuns.filter((t) => t.ok);
  if (successful.length === 0) {
    const lastErr = toolRuns.find((t) => !t.ok)?.error;
    if (!lastErr) return null;
    if (lastErr.includes("NEED_PHASE:")) {
      const phaseLines = lastErr.match(/^• .+$/gm) ?? [];
      const roomMatch = lastErr.match(/ruangan "([^"]+)"/);
      const room = roomMatch?.[1] ?? "ruangan ini";
      if (phaseLines.length > 0) {
        return `Kamu punya akses ke beberapa fase di **${room}**. Mau tugasnya ditambahkan ke fase mana?\n\n${phaseLines.join("\n")}`;
      }
    }
    return `Maaf, terjadi kesalahan: ${lastErr}`;
  }

  const last = successful[successful.length - 1]!;
  const data = asRecord(last.data);
  if (!data) return null;

  if (data.needsConfirmation === true && data.action?.toString().includes("delete")) {
    return formatDeleteConfirm(data);
  }

  switch (last.name) {
    case "analyze_room_workload":
      return formatAnalyzeRoomWorkload(data);
    case "move_tasks_in_room":
      return formatBulkMove(data);
    case "delete_task_in_room":
      if (data.needsConfirmation) return formatDeleteConfirm(data);
      return String(data.message ?? "Tugas berhasil dihapus.");
    case "delete_tasks_in_room":
      if (data.needsConfirmation) return formatDeleteConfirm(data);
      return formatBulkDelete(data);
    case "archive_completed_tasks_in_room":
      return formatArchiveBulk(data);
    case "summarize_workspaces":
      return formatSummarizeWorkspaces(data);
    case "get_my_tasks":
      return formatMyTasks(data);
    case "list_tasks":
      return formatListTasks(last.data);
    case "archive_task_in_room":
      return String(data.message ?? "Tugas berhasil diarsipkan.");
    case "create_task_in_room":
    case "edit_task_in_room":
    case "move_task_in_room":
      return String(data.message ?? "Aksi berhasil.");
    default:
      if (data.message) return String(data.message);
      if (data.insights && Array.isArray(data.insights)) {
        return (data.insights as string[]).join("\n");
      }
      if (data.highlights && Array.isArray(data.highlights)) {
        return (data.highlights as string[]).join("\n");
      }
      return null;
  }
}
