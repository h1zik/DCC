"use client";

import { useMemo, useState } from "react";
import { Download, ExternalLink, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export type CrawlPageInventoryRow = {
  id: string;
  url: string;
  resourceType: string | null;
  statusCode: number | null;
  onpageScore: number | null;
  title: string | null;
  description: string | null;
  h1Count: number;
  wordCount: number | null;
  internalLinks: number | null;
  externalLinks: number | null;
  inboundLinks: number | null;
  imagesCount: number | null;
  clickDepth: number | null;
  sizeBytes: number | null;
  loadTimeMs: number | null;
  isRedirect: boolean;
  isBroken: boolean;
  fromSitemap: boolean;
  isHttps: boolean;
};

type PageFilter =
  | "all"
  | "issues"
  | "healthy"
  | "redirect"
  | "error"
  | "low_score"
  | "not_sitemap";
type PageSort = "url" | "score" | "status" | "depth";

const FILTERS: Array<{ value: PageFilter; label: string }> = [
  { value: "all", label: "Semua halaman" },
  { value: "issues", label: "Punya isu" },
  { value: "healthy", label: "Sehat (2xx)" },
  { value: "redirect", label: "Redirect (3xx)" },
  { value: "error", label: "Error (4xx/5xx)" },
  { value: "low_score", label: "Score di bawah 80" },
  { value: "not_sitemap", label: "Tidak ada di sitemap" },
];

const SORTS: Array<{ value: PageSort; label: string }> = [
  { value: "url", label: "URL (A–Z)" },
  { value: "score", label: "Score terendah" },
  { value: "status", label: "Status HTTP" },
  { value: "depth", label: "Kedalaman klik" },
];

function formatBytes(value: number | null): string {
  if (value == null) return "—";
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function statusTone(page: CrawlPageInventoryRow): string {
  const code = page.statusCode ?? 0;
  if (page.isBroken || code >= 400) {
    return "bg-rose-500/12 text-rose-700 dark:text-rose-300";
  }
  if (page.isRedirect || (code >= 300 && code < 400)) {
    return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
  }
  if (code >= 200 && code < 300) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }
  return "bg-muted text-muted-foreground";
}

function exportCsv(
  pages: CrawlPageInventoryRow[],
  issueCounts: Map<string, number>,
  domain: string,
) {
  const header = [
    "url",
    "status_code",
    "onpage_score",
    "title",
    "description",
    "h1_count",
    "word_count",
    "internal_links",
    "external_links",
    "inbound_links",
    "click_depth",
    "size_bytes",
    "load_time_ms",
    "from_sitemap",
    "https",
    "issue_count",
  ];
  const lines = pages.map((page) =>
    [
      page.url,
      page.statusCode ?? "",
      page.onpageScore ?? "",
      page.title ?? "",
      page.description ?? "",
      page.h1Count,
      page.wordCount ?? "",
      page.internalLinks ?? "",
      page.externalLinks ?? "",
      page.inboundLinks ?? "",
      page.clickDepth ?? "",
      page.sizeBytes ?? "",
      page.loadTimeMs ?? "",
      page.fromSitemap ? "yes" : "no",
      page.isHttps ? "yes" : "no",
      issueCounts.get(page.url) ?? 0,
    ]
      .map((value) => `"${String(value).replace(/"/g, '""')}"`)
      .join(","),
  );
  const blob = new Blob(["\ufeff" + [header.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `technical-crawl-${domain.replace(/[^a-z0-9.-]+/gi, "-")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function InventoryStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: React.ReactNode;
  detail: string;
}) {
  return (
    <div className="bg-muted/35 rounded-xl px-3 py-2.5">
      <p className="text-muted-foreground text-[10px] font-semibold uppercase tracking-wide">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      <p className="text-muted-foreground text-[10px]">{detail}</p>
    </div>
  );
}

export function CrawlPageInventory({
  pages,
  issues,
  domain,
}: {
  pages: CrawlPageInventoryRow[];
  issues: Array<{ url: string | null }>;
  domain: string;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PageFilter>("all");
  const [sort, setSort] = useState<PageSort>("url");

  const issueCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const issue of issues) {
      if (!issue.url) continue;
      counts.set(issue.url, (counts.get(issue.url) ?? 0) + 1);
    }
    return counts;
  }, [issues]);

  const metrics = useMemo(() => {
    const scoreValues = pages.flatMap((page) =>
      page.onpageScore == null ? [] : [page.onpageScore],
    );
    const loadValues = pages.flatMap((page) =>
      page.loadTimeMs == null ? [] : [page.loadTimeMs],
    );
    return {
      healthy: pages.filter(
        (page) =>
          !page.isBroken &&
          page.statusCode != null &&
          page.statusCode >= 200 &&
          page.statusCode < 300,
      ).length,
      redirects: pages.filter(
        (page) =>
          page.isRedirect ||
          (page.statusCode != null &&
            page.statusCode >= 300 &&
            page.statusCode < 400),
      ).length,
      errors: pages.filter(
        (page) =>
          page.isBroken || (page.statusCode != null && page.statusCode >= 400),
      ).length,
      avgScore:
        scoreValues.length > 0
          ? Math.round(scoreValues.reduce((a, b) => a + b, 0) / scoreValues.length)
          : null,
      sitemap: pages.filter((page) => page.fromSitemap).length,
      avgLoad:
        loadValues.length > 0
          ? Math.round(loadValues.reduce((a, b) => a + b, 0) / loadValues.length)
          : null,
    };
  }, [pages]);

  const visiblePages = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filtered = pages.filter((page) => {
      if (
        normalizedQuery &&
        !page.url.toLowerCase().includes(normalizedQuery) &&
        !(page.title ?? "").toLowerCase().includes(normalizedQuery)
      ) {
        return false;
      }
      if (filter === "issues") return (issueCounts.get(page.url) ?? 0) > 0;
      if (filter === "healthy") {
        return (
          !page.isBroken &&
          page.statusCode != null &&
          page.statusCode >= 200 &&
          page.statusCode < 300
        );
      }
      if (filter === "redirect") {
        return (
          page.isRedirect ||
          (page.statusCode != null &&
            page.statusCode >= 300 &&
            page.statusCode < 400)
        );
      }
      if (filter === "error") {
        return page.isBroken || (page.statusCode != null && page.statusCode >= 400);
      }
      if (filter === "low_score") {
        return page.onpageScore != null && page.onpageScore < 80;
      }
      if (filter === "not_sitemap") return !page.fromSitemap;
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (sort === "score") return (a.onpageScore ?? -1) - (b.onpageScore ?? -1);
      if (sort === "status") return (b.statusCode ?? 0) - (a.statusCode ?? 0);
      if (sort === "depth") return (b.clickDepth ?? -1) - (a.clickDepth ?? -1);
      return a.url.localeCompare(b.url, "id");
    });
  }, [filter, issueCounts, pages, query, sort]);

  if (pages.length === 0) {
    return (
      <div className="bento-tile justify-start gap-2">
        <span className="bento-label">Inventaris halaman</span>
        <p className="text-muted-foreground text-sm">
          Detail URL belum tersedia untuk crawl ini. Jalankan crawl ulang untuk
          mengisi inventaris halaman.
        </p>
      </div>
    );
  }

  return (
    <section className="border-border/70 bg-card overflow-hidden rounded-2xl border">
      <div className="flex flex-col gap-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-bold tracking-tight">Inventaris halaman</h2>
            <p className="text-muted-foreground text-xs">
              Semua URL yang ditemukan crawler, termasuk halaman sehat.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => exportCsv(visiblePages, issueCounts, domain)}
          >
            <Download className="size-3.5" aria-hidden />
            Export CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <InventoryStat label="Ditemukan" value={pages.length} detail="total URL" />
          <InventoryStat label="Sehat" value={metrics.healthy} detail="respons 2xx" />
          <InventoryStat label="Redirect" value={metrics.redirects} detail="respons 3xx" />
          <InventoryStat label="Error" value={metrics.errors} detail="broken / 4xx / 5xx" />
          <InventoryStat label="Rata-rata score" value={metrics.avgScore ?? "—"} detail="on-page /100" />
          <InventoryStat label="Di sitemap" value={`${metrics.sitemap}/${pages.length}`} detail={`muat rata-rata ${metrics.avgLoad ?? "—"} ms`} />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-52 flex-1 sm:max-w-80">
            <Search className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari URL atau title…"
              className="h-9 pl-8 text-xs"
            />
          </div>
          <Select
            value={filter}
            items={FILTERS}
            onValueChange={(value) => value && setFilter(value as PageFilter)}
          >
            <SelectTrigger className="h-9 text-xs">
              {FILTERS.find((item) => item.value === filter)?.label}
            </SelectTrigger>
            <SelectContent>
              {FILTERS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={sort}
            items={SORTS}
            onValueChange={(value) => value && setSort(value as PageSort)}
          >
            <SelectTrigger className="h-9 text-xs">
              {SORTS.find((item) => item.value === sort)?.label}
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-muted-foreground ml-auto text-xs tabular-nums">
            {visiblePages.length} dari {pages.length} URL
          </span>
        </div>
      </div>

      <div className="overflow-x-auto border-t">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="min-w-72">Halaman</TableHead>
              <TableHead>HTTP</TableHead>
              <TableHead>SEO score</TableHead>
              <TableHead>Konten</TableHead>
              <TableHead>Link</TableHead>
              <TableHead>Teknis</TableHead>
              <TableHead className="text-right">Isu</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {visiblePages.map((page) => {
              const pageIssueCount = issueCounts.get(page.url) ?? 0;
              return (
                <TableRow key={page.id}>
                  <TableCell className="max-w-md">
                    <a
                      href={page.url}
                      target="_blank"
                      rel="noreferrer"
                      className="group block"
                    >
                      <span className="flex items-center gap-1 truncate text-sm font-semibold group-hover:underline">
                        {page.title ?? "Tanpa title"}
                        <ExternalLink className="text-muted-foreground size-3 shrink-0" />
                      </span>
                      <span className="text-muted-foreground block truncate text-[11px]">
                        {page.url}
                      </span>
                    </a>
                  </TableCell>
                  <TableCell>
                    <span className={cn("inline-flex rounded-lg px-2 py-1 text-[11px] font-bold tabular-nums", statusTone(page))}>
                      {page.statusCode ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "font-extrabold tabular-nums",
                        page.onpageScore == null
                          ? "text-muted-foreground"
                          : page.onpageScore < 50
                            ? "text-rose-600"
                            : page.onpageScore < 80
                              ? "text-amber-600"
                              : "text-emerald-600",
                      )}
                    >
                      {page.onpageScore ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell className="text-xs">
                    <span className="block">{page.wordCount ?? "—"} kata</span>
                    <span className="text-muted-foreground">{page.h1Count} H1 · {page.imagesCount ?? 0} gambar</span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    <span className="block">{page.internalLinks ?? "—"} internal</span>
                    <span className="text-muted-foreground">{page.inboundLinks ?? "—"} masuk · {page.externalLinks ?? "—"} luar</span>
                  </TableCell>
                  <TableCell className="text-xs tabular-nums">
                    <span className="block">depth {page.clickDepth ?? "—"} · {page.loadTimeMs ?? "—"} ms</span>
                    <span className="text-muted-foreground">{formatBytes(page.sizeBytes)} · {page.fromSitemap ? "sitemap" : "di luar sitemap"}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    {pageIssueCount > 0 ? (
                      <a href="#page-issues" className="inline-flex rounded-lg bg-amber-500/12 px-2 py-1 text-[11px] font-bold text-amber-700 hover:underline dark:text-amber-300">
                        {pageIssueCount}
                      </a>
                    ) : (
                      <span className="text-emerald-600 text-xs font-semibold">Bersih</span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {visiblePages.length === 0 ? (
          <p className="text-muted-foreground py-8 text-center text-sm">
            Tidak ada halaman yang cocok dengan filter.
          </p>
        ) : null}
      </div>
    </section>
  );
}
