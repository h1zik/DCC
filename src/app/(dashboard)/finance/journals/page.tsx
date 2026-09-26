import Link from "next/link";
import { FinanceJournalStatus } from "@prisma/client";
import { FileText, Plus, ScrollText, SearchX } from "lucide-react";
import {
  listFinanceJournalEntries,
  redirectNewFinanceJournal,
} from "@/actions/finance-journals";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { FinanceEmptyState } from "@/components/finance/empty-state";
import { Money } from "@/components/finance/money";
import { prisma } from "@/lib/prisma";
import { JournalFilters, type JournalStatusFilter } from "./journal-filters";

const POSTED_LIMIT = 100;
const DRAFT_LIMIT = 50;

type SearchParams = {
  status?: string | string[];
  q?: string | string[];
  period?: string | string[];
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

function parsePeriod(raw: string | undefined) {
  const m = raw?.match(/^(\d{4})-(\d{1,2})$/);
  if (!m) return null;
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  return { year: Number(m[1]), month };
}

// `entryDate` disimpan sebagai tanggal murni UTC — format dengan zona UTC agar
// tidak bergeser sehari.
const dayHeading = new Intl.DateTimeFormat("id-ID", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});
const shortDate = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

type Entry = Awaited<ReturnType<typeof listFinanceJournalEntries>>[number];

function describe(e: Entry) {
  return e.memo?.trim() || e.reference?.trim() || "Tanpa keterangan";
}

export default async function FinanceJournalsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const sp = await searchParams;
  const rawStatus = first(sp.status);
  const status: JournalStatusFilter =
    rawStatus === "draft" || rawStatus === "posted" ? rawStatus : "all";
  const q = first(sp.q)?.trim() ?? "";
  const period = parsePeriod(first(sp.period));
  const periodValue = period
    ? `${period.year}-${String(period.month).padStart(2, "0")}`
    : "";
  const filtered = Boolean(q || period || status !== "all");

  const [drafts, posted, draftCount] = await Promise.all([
    status === "posted"
      ? Promise.resolve([] as Entry[])
      : listFinanceJournalEntries({
          status: FinanceJournalStatus.DRAFT,
          q,
          period: period ?? undefined,
          take: DRAFT_LIMIT,
        }),
    status === "draft"
      ? Promise.resolve([] as Entry[])
      : listFinanceJournalEntries({
          status: FinanceJournalStatus.POSTED,
          q,
          period: period ?? undefined,
          take: POSTED_LIMIT,
        }),
    prisma.financeJournalEntry.count({
      where: { status: FinanceJournalStatus.DRAFT },
    }),
  ]);

  // Total per jurnal = jumlah sisi debit.
  const ids = [...drafts, ...posted].map((e) => e.id);
  const totals =
    ids.length === 0
      ? []
      : await prisma.financeJournalLine.groupBy({
          by: ["entryId"],
          where: { entryId: { in: ids } },
          _sum: { debitBase: true },
        });
  const totalById = new Map(
    totals.map((t) => [t.entryId, Number(t._sum.debitBase ?? 0)]),
  );

  // Kelompokkan jurnal posted per hari (urutan query sudah terbaru dulu).
  const days: { key: string; date: Date; entries: Entry[]; total: number }[] = [];
  for (const e of posted) {
    const key = e.entryDate.toISOString().slice(0, 10);
    let day = days[days.length - 1];
    if (!day || day.key !== key) {
      day = { key, date: e.entryDate, entries: [], total: 0 };
      days.push(day);
    }
    day.entries.push(e);
    day.total += totalById.get(e.id) ?? 0;
  }

  const newJournalButton = (size: "sm" | "default") => (
    <form action={redirectNewFinanceJournal}>
      <Button type="submit" size={size}>
        <Plus className="size-3.5" aria-hidden /> Jurnal baru
      </Button>
    </form>
  );

  const nothing = drafts.length === 0 && posted.length === 0;

  return (
    <FinancePageShell
      icon={<ScrollText className="size-5" />}
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Jurnal" },
      ]}
      title="Jurnal"
      description="Draf bisa disunting. Jurnal yang sudah diposting dikoreksi lewat jurnal pembalik."
      actions={newJournalButton("default")}
    >
      <div className="flex flex-col gap-4">
        <JournalFilters
          q={q}
          status={status}
          period={periodValue}
          draftCount={draftCount}
        />

        {nothing ? (
          filtered ? (
            <FinanceEmptyState
              icon={<SearchX className="size-5" />}
              title="Tidak ada jurnal yang cocok"
              description="Ubah kata kunci, status, atau bulan untuk melihat jurnal lain."
              action={
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href="/finance/journals" />}
                >
                  Hapus semua filter
                </Button>
              }
            />
          ) : (
            <FinanceEmptyState
              icon={<FileText className="size-5" />}
              title="Belum ada jurnal"
              description="Buat jurnal pertama. Isi minimal satu baris debit dan satu baris kredit dengan nilai yang sama."
              action={newJournalButton("sm")}
            />
          )
        ) : null}

        {drafts.length > 0 ? (
          <section
            aria-labelledby="drafts-heading"
            className="border-border bg-card rounded-2xl border shadow-sm"
          >
            <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-2">
              <h2 id="drafts-heading" className="text-foreground text-sm font-semibold">
                Draf belum diposting
                <span className="ml-1.5 font-normal text-amber-700 tabular-nums dark:text-amber-400">
                  {drafts.length}
                </span>
              </h2>
              <p className="text-muted-foreground text-xs">
                Tidak masuk laporan sampai diposting
              </p>
            </div>
            <ul className="divide-border/60 divide-y">
              {drafts.map((e) => (
                <li key={e.id}>
                  <Link
                    href={`/finance/journals/${e.id}`}
                    className="hover:bg-muted/50 focus-visible:bg-muted/50 grid grid-cols-[4rem_minmax(0,1fr)_auto] items-baseline gap-3 px-4 py-2.5 transition-colors outline-none sm:grid-cols-[4rem_minmax(0,1fr)_5rem_9rem_5.5rem]"
                  >
                    <span className="text-muted-foreground text-xs tabular-nums">
                      {shortDate.format(e.entryDate)}
                    </span>
                    <span className="text-foreground truncate text-sm font-medium">
                      {describe(e)}
                    </span>
                    <span className="text-muted-foreground hidden text-right text-xs tabular-nums sm:block">
                      {e._count.lines} baris
                    </span>
                    <span className="text-foreground hidden text-right text-sm tabular-nums sm:block">
                      <Money value={totalById.get(e.id) ?? 0} zeroAsDash />
                    </span>
                    <span className="text-primary text-right text-xs font-medium">
                      Lanjutkan
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        {days.length > 0 ? (
          <section
            aria-label="Jurnal terposting"
            className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm"
          >
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-36 pl-4">Nomor</TableHead>
                  <TableHead>Keterangan</TableHead>
                  <TableHead className="hidden w-20 text-right md:table-cell">
                    Baris
                  </TableHead>
                  <TableHead className="w-40 pr-4 text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              {days.map((day) => (
                <TableBody key={day.key}>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead
                      scope="rowgroup"
                      colSpan={2}
                      className="text-foreground h-auto py-2 pl-4 text-sm font-semibold"
                    >
                      {dayHeading.format(day.date)}
                    </TableHead>
                    <TableCell className="hidden md:table-cell" />
                    <TableCell className="text-muted-foreground py-2 pr-4 text-right text-sm tabular-nums">
                      <Money value={day.total} zeroAsDash />
                    </TableCell>
                  </TableRow>
                  {day.entries.map((e) => (
                    <TableRow key={e.id}>
                      <TableCell className="text-muted-foreground pl-4 align-top text-xs tabular-nums">
                        {e.entryNumber ?? "—"}
                      </TableCell>
                      <TableCell className="align-top whitespace-normal">
                        <Link
                          href={`/finance/journals/${e.id}`}
                          className="text-foreground hover:text-primary line-clamp-1 text-sm font-medium transition-colors"
                        >
                          {describe(e)}
                        </Link>
                        <EntryMeta e={e} />
                      </TableCell>
                      <TableCell className="text-muted-foreground hidden text-right align-top text-sm tabular-nums md:table-cell">
                        {e._count.lines}
                      </TableCell>
                      <TableCell className="text-foreground pr-4 text-right align-top text-sm tabular-nums">
                        <Money value={totalById.get(e.id) ?? 0} zeroAsDash />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              ))}
            </Table>
          </section>
        ) : null}

        {posted.length >= POSTED_LIMIT ? (
          <p className="text-muted-foreground text-xs">
            Menampilkan {POSTED_LIMIT} jurnal terposting terbaru.{" "}
            {period
              ? "Tambahkan kata kunci untuk menemukan jurnal lain di bulan ini."
              : "Pilih bulan untuk melihat jurnal yang lebih lama."}
          </p>
        ) : null}
      </div>
    </FinancePageShell>
  );
}

function EntryMeta({ e }: { e: Entry }) {
  const parts: React.ReactNode[] = [];
  if (e.reference?.trim() && e.memo?.trim()) {
    parts.push(<span key="ref">Ref {e.reference}</span>);
  }
  if (e.reversedBy.length > 0) {
    const r = e.reversedBy[0];
    parts.push(
      <span key="rev" className="text-rose-700 dark:text-rose-400">
        Dibalik oleh{" "}
        <Link
          href={`/finance/journals/${r.id}`}
          className="underline underline-offset-2"
        >
          {r.entryNumber ?? "jurnal pembalik"}
        </Link>
      </span>,
    );
  }
  if (e.reversesEntry) {
    parts.push(
      <span key="src">
        Pembalik untuk{" "}
        <Link
          href={`/finance/journals/${e.reversesEntry.id}`}
          className="underline underline-offset-2"
        >
          {e.reversesEntry.entryNumber ?? "jurnal sumber"}
        </Link>
      </span>,
    );
  }
  const author = e.createdBy?.name ?? e.createdBy?.email;
  if (author) parts.push(<span key="by">oleh {author}</span>);
  if (parts.length === 0) return null;
  return (
    <p className="text-muted-foreground mt-0.5 flex flex-wrap gap-x-2 text-xs">
      {parts.map((p, i) => (
        <span key={i} className="inline-flex gap-x-2">
          {i > 0 ? <span aria-hidden>·</span> : null}
          {p}
        </span>
      ))}
    </p>
  );
}
