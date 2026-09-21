import Link from "next/link";
import { FinanceAuditAction, type Prisma } from "@prisma/client";
import { History } from "lucide-react";
import { FinanceEmptyState } from "@/components/finance/empty-state";
import { FinanceExportMenu } from "@/components/finance/export-menu";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireFinance } from "@/lib/auth-helpers";
import { FINANCE_AUDIT_ACTION_LABEL } from "@/lib/finance-audit-labels";
import {
  jakartaCurrentMonthRange,
  utcDateOnly,
  utcEndOfDay,
} from "@/lib/finance-dates";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 100;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

type SearchParams = {
  from?: string;
  to?: string;
  action?: string;
  page?: string;
};

function isAction(v: string | undefined): v is FinanceAuditAction {
  return !!v && v in FinanceAuditAction;
}

/** Waktu kejadian ditampilkan dalam WIB — jejak audit dibaca oleh tim di Jakarta. */
function formatWib(d: Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    dateStyle: "medium",
    timeStyle: "medium",
  }).format(d);
}

function MetaDiff({ meta }: { meta: Prisma.JsonValue }) {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const { before, after } = meta as { before?: unknown; after?: unknown };
  const asRecord = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" && !Array.isArray(v)
      ? (v as Record<string, unknown>)
      : {};
  const b = asRecord(before);
  const a = asRecord(after);
  const changed = [...new Set([...Object.keys(b), ...Object.keys(a)])].filter(
    (k) => JSON.stringify(b[k]) !== JSON.stringify(a[k]),
  );
  if (changed.length === 0) return null;
  const show = (v: unknown) => (v === undefined || v === null ? "—" : String(v));
  return (
    <ul className="text-muted-foreground mt-1 space-y-0.5 font-mono text-[11px]">
      {changed.map((k) => (
        <li key={k}>
          {k}: {show(b[k])} → <span className="text-foreground">{show(a[k])}</span>
        </li>
      ))}
    </ul>
  );
}

export default async function FinanceAuditLogPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireFinance();
  const sp = await searchParams;

  const current = jakartaCurrentMonthRange();
  const parse = (raw: string | undefined, fallback: Date) =>
    raw && DATE_RE.test(raw) && !Number.isNaN(Date.parse(raw))
      ? new Date(raw)
      : fallback;
  const from = parse(sp.from, current.from);
  const to = parse(sp.to, utcDateOnly(current.to));
  const action = isAction(sp.action) ? sp.action : null;
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.FinanceAuditEventWhereInput = {
    createdAt: { gte: utcDateOnly(from), lte: utcEndOfDay(to) },
    ...(action ? { action } : {}),
  };

  const [events, total] = await Promise.all([
    prisma.financeAuditEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { actor: { select: { name: true, email: true } } },
    }),
    prisma.financeAuditEvent.count({ where }),
  ]);

  const fromStr = from.toISOString().slice(0, 10);
  const toStr = to.toISOString().slice(0, 10);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const q = new URLSearchParams({ from: fromStr, to: toStr, page: String(p) });
    if (action) q.set("action", action);
    return `/finance/audit-log?${q.toString()}`;
  };

  return (
    <FinancePageShell
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Jejak audit" },
      ]}
      icon={<History className="size-5" />}
      title="Jejak audit"
      description="Siapa melakukan apa dan kapan di modul keuangan. Catatan ini hanya bisa ditambah — tidak bisa diubah atau dihapus dari aplikasi."
      actions={
        <FinanceExportMenu
          from={fromStr}
          to={toStr}
          items={[{ report: "audit-log", label: "Jejak audit (periode ini)" }]}
        />
      }
    >
      <form
        method="get"
        className="border-border flex flex-wrap items-end gap-3 rounded-xl border p-4"
      >
        <label className="flex flex-col gap-1 text-xs font-medium">
          Dari
          <input
            type="date"
            name="from"
            defaultValue={fromStr}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Sampai
          <input
            type="date"
            name="to"
            defaultValue={toStr}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium">
          Aksi
          <select
            name="action"
            defaultValue={action ?? ""}
            className="border-input bg-background h-8 rounded-md border px-2 text-sm"
          >
            <option value="">Semua aksi</option>
            {Object.values(FinanceAuditAction).map((a) => (
              <option key={a} value={a}>
                {FINANCE_AUDIT_ACTION_LABEL[a]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="bg-primary text-primary-foreground h-8 rounded-md px-3 text-sm font-medium"
        >
          Terapkan
        </button>
        <span className="text-muted-foreground ml-auto text-xs">
          {total.toLocaleString("id-ID")} catatan
        </span>
      </form>

      {events.length === 0 ? (
        <FinanceEmptyState
          icon={<History className="size-5" />}
          title="Tidak ada catatan"
          description="Belum ada aktivitas keuangan pada periode/filter ini."
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-48">Waktu (WIB)</TableHead>
                <TableHead className="w-48">Aksi</TableHead>
                <TableHead className="w-44">Pelaku</TableHead>
                <TableHead>Detail</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((e) => (
                <TableRow key={e.id} className="align-top">
                  <TableCell className="text-xs whitespace-nowrap">
                    {formatWib(e.createdAt)}
                  </TableCell>
                  <TableCell className="text-xs font-medium">
                    {FINANCE_AUDIT_ACTION_LABEL[e.action]}
                  </TableCell>
                  <TableCell className="text-xs">
                    {e.actor.name?.trim() || e.actor.email}
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="break-words">{e.detail ?? "—"}</span>
                    <MetaDiff meta={e.meta} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {pageCount > 1 ? (
        <nav
          aria-label="Halaman jejak audit"
          className="flex items-center justify-between text-sm"
        >
          {page > 1 ? (
            <Link href={pageHref(page - 1)} className="text-primary hover:underline">
              ← Lebih baru
            </Link>
          ) : (
            <span />
          )}
          <span className="text-muted-foreground text-xs">
            Halaman {page} dari {pageCount}
          </span>
          {page < pageCount ? (
            <Link href={pageHref(page + 1)} className="text-primary hover:underline">
              Lebih lama →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      ) : null}
    </FinancePageShell>
  );
}
