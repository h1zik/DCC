import type { StockLog } from "@prisma/client";

export type SystemLogAction = "REVERSAL" | "REPLACEMENT" | "VOID" | null;

export type SystemMeta = {
  action: SystemLogAction;
  targetId: string | null;
  reason: string;
  extraNote: string;
};

export function isSystemStockLog(note: string | null | undefined): boolean {
  return (note ?? "").startsWith("[SYS]");
}

export function parseSystemMeta(log: Pick<StockLog, "note">): SystemMeta {
  const raw = (log.note ?? "").trim();
  if (!raw.startsWith("[SYS]")) {
    return { action: null, targetId: null, reason: "", extraNote: "" };
  }
  if (raw.startsWith("[SYS] |")) {
    const parts = raw.split("|").map((x) => x.trim());
    const action = parts.find((p) => p.startsWith("action="))?.slice(7) ?? "";
    const targetId = parts.find((p) => p.startsWith("target="))?.slice(7) ?? "";
    const reason = parts.find((p) => p.startsWith("reason="))?.slice(7) ?? "";
    const extraNote = parts.find((p) => p.startsWith("note="))?.slice(5) ?? "";
    return {
      action:
        action === "REVERSAL" || action === "REPLACEMENT" || action === "VOID"
          ? action
          : null,
      targetId: targetId || null,
      reason,
      extraNote,
    };
  }
  const body = raw.replace(/^\[SYS\]\s*/i, "").trim();
  const m = body.match(
    /^(REVERSAL|REPLACEMENT|VOID)\s+untuk\s+(\S+)(?:\s+oleh\s+[^:]+:\s*)?([\s\S]*)$/i,
  );
  if (!m) return { action: null, targetId: null, reason: body, extraNote: "" };
  const rest = (m[3] ?? "").trim();
  const [reason, extraNote] = rest.split("|").map((x) => x.trim());
  return {
    action: m[1]!.toUpperCase() as "REVERSAL" | "REPLACEMENT" | "VOID",
    targetId: m[2]!.trim() || null,
    reason: reason ?? "",
    extraNote: extraNote ?? "",
  };
}

function formatSystemLogNote(raw: string): string {
  const parts = raw.split("|").map((x) => x.trim());
  const action = parts.find((p) => p.startsWith("action="))?.slice(7) ?? "";
  const reason = parts.find((p) => p.startsWith("reason="))?.slice(7) ?? "";
  const note = parts.find((p) => p.startsWith("note="))?.slice(5) ?? "";
  const actionLabel =
    action === "REVERSAL"
      ? "Pembalik otomatis"
      : action === "REPLACEMENT"
        ? "Koreksi data"
        : action === "VOID"
          ? "Void mutasi"
          : "Mutasi sistem";
  const detail = [reason, note].filter(Boolean).join(" - ");
  return detail ? `${actionLabel}: ${detail}` : actionLabel;
}

function formatLegacySystemLogNote(raw: string): string {
  const body = raw.replace(/^\[SYS\]\s*/i, "").trim();
  const m = body.match(
    /^(REVERSAL|REPLACEMENT|VOID)\s+untuk\s+(\S+)(?:\s+oleh\s+[^:]+:\s*)?([\s\S]*)$/i,
  );
  if (!m) {
    return body.replace(/\s+/g, " ").trim() || "Mutasi sistem";
  }
  const kind = m[1]!.toUpperCase();
  const targetId = m[2]!.trim();
  const rest = (m[3] ?? "").trim();
  const reason = rest.replace(/\s*\|\s*/g, " — ").trim();
  const shortRef =
    targetId.length > 10 ? `${targetId.slice(0, 6)}…${targetId.slice(-4)}` : targetId;
  const actionLabel =
    kind === "REVERSAL"
      ? "Pembalik otomatis"
      : kind === "REPLACEMENT"
        ? "Koreksi data"
        : kind === "VOID"
          ? "Void mutasi"
          : "Mutasi sistem";
  const detail = [reason ? `Alasan: ${reason}` : null, `Ref: ${shortRef}`]
    .filter(Boolean)
    .join(" · ");
  return `${actionLabel} · ${detail}`;
}

export function formatStockLogNote(log: Pick<StockLog, "note">): string {
  const raw = (log.note ?? "").trim();
  if (!raw) return "—";
  if (raw.startsWith("[SYS] |")) return formatSystemLogNote(raw);
  if (raw.startsWith("[SYS]")) return formatLegacySystemLogNote(raw);
  return raw;
}

export const SALES_CATEGORY_LABELS: Record<string, string> = {
  penjualan: "Penjualan",
  sampling: "Sampling",
  retur: "Retur",
  rusak: "Rusak / expired",
};

export function formatSalesCategory(value: string | null | undefined): string {
  if (!value) return "—";
  return SALES_CATEGORY_LABELS[value] ?? value;
}

export type OutLogRow = {
  id: string;
  amount: number;
  type: "IN" | "OUT";
  salesCategory: string | null;
  note: string | null;
  productId?: string;
};

/**
 * Resolve effective OUT business logs after void/replacement corrections.
 * Only returns rows that are still valid OUT (penjualan filter applied by caller).
 */
export function resolveEffectiveOutLogs<T extends OutLogRow>(logs: T[]): T[] {
  const businessLogs = logs.filter((row) => !isSystemStockLog(row.note));
  const correctionLogs = logs.filter((row) => isSystemStockLog(row.note));

  const replacementByTargetId = new Map<string, T>();
  const voidTargetIds = new Set<string>();

  for (const row of correctionLogs) {
    const meta = parseSystemMeta(row);
    if (!meta.targetId) continue;
    if (meta.action === "REPLACEMENT") replacementByTargetId.set(meta.targetId, row);
    if (meta.action === "VOID") voidTargetIds.add(meta.targetId);
  }

  return businessLogs
    .filter((row) => !voidTargetIds.has(row.id))
    .map((row) => replacementByTargetId.get(row.id) ?? row)
    .filter((row) => row.type === "OUT");
}
