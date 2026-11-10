import Link from "next/link";
import { Boxes, PackageCheck } from "lucide-react";
import { listFinanceAccounts } from "@/actions/finance-accounts";
import {
  listFinanceStockNotices,
  type StockNoticeTab,
} from "@/actions/finance-stock-notices";
import { FinanceEmptyState } from "@/components/finance/empty-state";
import { FinancePageShell } from "@/components/finance/finance-page-shell";
import { formatSalesCategory, formatStockLogNote } from "@/lib/stock-log-utils";
import { cn } from "@/lib/utils";
import { StockMovementsClient, type StockNoticeRow } from "./stock-movements-client";

const TABS: { key: StockNoticeTab; label: string }[] = [
  { key: "pending", label: "Menunggu dicatat" },
  { key: "recorded", label: "Sudah dicatat" },
  { key: "dismissed", label: "Diabaikan" },
];

const EMPTY: Record<StockNoticeTab, { title: string; description: string }> = {
  pending: {
    title: "Tidak ada mutasi yang menunggu",
    description:
      "Setiap barang masuk atau keluar yang dicatat tim logistik di Inventori akan muncul di sini untuk dimasukkan ke pencatatan.",
  },
  recorded: {
    title: "Belum ada mutasi yang dicatat",
    description: "Mutasi yang sudah dibuatkan jurnal akan pindah ke tab ini.",
  },
  dismissed: {
    title: "Tidak ada mutasi yang diabaikan",
    description:
      "Mutasi yang ditandai tidak perlu jurnal, atau di-void sebelum sempat dicatat, tampil di sini.",
  },
};

function first(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

export default async function FinanceStockMovementsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const sp = await searchParams;
  const rawTab = first(sp.tab);
  const tab: StockNoticeTab =
    rawTab === "recorded" || rawTab === "dismissed" ? rawTab : "pending";

  const [{ rows, counts, limit }, accounts] = await Promise.all([
    listFinanceStockNotices(tab),
    listFinanceAccounts(),
  ]);

  const data: StockNoticeRow[] = rows.map((n) => {
    const log = n.stockLog;
    const note = formatStockLogNote(log);
    return {
      id: n.id,
      occurredAt: log.createdAt.toISOString(),
      type: log.type,
      amount: log.amount,
      productName: log.product.name,
      sku: log.product.sku,
      brandName: log.product.brand.name,
      salesCategory:
        log.type === "OUT" && log.salesCategory
          ? formatSalesCategory(log.salesCategory)
          : null,
      salesCategoryKey: log.type === "OUT" ? log.salesCategory : null,
      vendorName: log.vendor?.name ?? null,
      reference: log.reference,
      note: note === "—" ? null : note,
      createdByName: log.createdBy?.name ?? log.createdBy?.email ?? null,
      journal: n.journalEntry
        ? {
            id: n.journalEntry.id,
            status: n.journalEntry.status,
            entryNumber: n.journalEntry.entryNumber,
          }
        : null,
      dismissNote: n.dismissNote,
      handledByName: n.handledBy?.name ?? n.handledBy?.email ?? null,
    };
  });

  return (
    <FinancePageShell
      breadcrumbs={[
        { label: "Keuangan", href: "/finance" },
        { label: "Mutasi stok" },
      ]}
      icon={<Boxes className="size-5" />}
      title="Mutasi stok dari Inventori"
      description="Barang masuk dan keluar yang dicatat tim logistik. Masukkan ke pencatatan untuk membuat draf jurnal, lalu periksa dan posting di editor jurnal."
    >
      <nav className="flex flex-wrap gap-1.5" aria-label="Filter status">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={
              t.key === "pending"
                ? "/finance/stock-movements"
                : `/finance/stock-movements?tab=${t.key}`
            }
            aria-current={tab === t.key ? "page" : undefined}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-lg border px-3 text-sm transition-colors",
              tab === t.key
                ? "border-primary/40 bg-primary/10 text-foreground font-medium"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {t.label}
            <span className="text-xs tabular-nums opacity-80">{counts[t.key]}</span>
          </Link>
        ))}
      </nav>

      {data.length === 0 ? (
        <FinanceEmptyState
          icon={<PackageCheck className="size-5" />}
          title={EMPTY[tab].title}
          description={EMPTY[tab].description}
        />
      ) : (
        <>
          <StockMovementsClient
            tab={tab}
            rows={data}
            accounts={accounts
              // Akun hutang/piutang usaha butuh data tagihan — ditambahkan di editor jurnal.
              .filter((a) => !a.isApControl && !a.isArControl)
              .map((a) => ({ id: a.id, code: a.code, name: a.name }))}
          />
          {counts[tab] > limit ? (
            <p className="text-muted-foreground text-xs">
              Menampilkan {limit} mutasi terbaru dari {counts[tab]}.
            </p>
          ) : null}
        </>
      )}
    </FinancePageShell>
  );
}
