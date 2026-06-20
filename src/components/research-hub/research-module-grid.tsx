import Link from "next/link";
import {
  BarChart3,
  FileText,
  FlaskConical,
  MessageSquare,
  PackageSearch,
  Radar,
  Search,
  Star,
  Target,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const MODULES = [
  {
    href: "/research-hub/product-discovery",
    title: "1. Product Discovery",
    desc: "Cari produk kompetitor by keyword — puluhan SKU dari berbagai brand.",
    icon: PackageSearch,
    active: true,
  },
  {
    href: "/research-hub/review-intelligence",
    title: "2. Review Intelligence",
    desc: "Scrape & analisis ribuan review kompetitor — sentimen, keluhan, pujian, keyword.",
    icon: Star,
    active: true,
  },
  {
    href: "/research-hub/competitor-tracker",
    title: "3. Competitor Tracker",
    desc: "Pantau harga, SKU, rating, dan promo kompetitor secara otomatis.",
    icon: Target,
    active: true,
  },
  {
    href: "/research-hub/trend-radar",
    title: "4. Trend Radar",
    desc: "Deteksi tren bahan, klaim, dan kategori sebelum mainstream.",
    icon: Radar,
    active: true,
  },
  {
    href: "/research-hub/keyword-intel",
    title: "5. Keyword & Search Intel",
    desc: "Eksplorasi keyword marketplace dan Google untuk naming & copy.",
    icon: Search,
    active: true,
  },
  {
    href: "/research-hub/social-listening",
    title: "6. Social Listening",
    desc: "Monitor percakapan organik di sosial media dan marketplace.",
    icon: MessageSquare,
    active: true,
  },
  {
    href: "/research-hub/usp-analyzer",
    title: "7. USP & Gap Analyzer",
    desc: "Temukan celah pasar dan formulasi USP berbasis data.",
    icon: BarChart3,
    active: true,
  },
  {
    href: "/research-hub/concept-lab",
    title: "8. Product Concept Lab",
    desc: "Bangun dan validasi konsep produk siap brief ke R&D.",
    icon: FlaskConical,
    active: true,
  },
  {
    href: "/research-hub/research-reports",
    title: "9. Research Reports",
    desc: "Laporan riset terdokumentasi dan bisa di-share.",
    icon: FileText,
    active: true,
  },
] as const;

export function ResearchModuleGrid() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {MODULES.map((mod, i) => {
        const Icon = mod.icon;
        const inner = (
          <Card
            className={cn(
              "group h-full transition-[transform,shadow,border-color] duration-200 ease-out motion-reduce:transition-none",
              mod.active
                ? "hover:-translate-y-0.5 motion-reduce:hover:translate-y-0 hover:border-primary/40 hover:shadow-md"
                : "opacity-60",
            )}
          >
            <CardHeader className="gap-2">
              <div className="flex items-start justify-between gap-2">
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200 ease-out motion-reduce:transition-none group-hover:scale-105",
                    mod.active
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icon className="size-4" />
                </span>
                {!mod.active ? (
                  <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase">
                    Segera
                  </span>
                ) : null}
              </div>
              <CardTitle className="text-base">{mod.title}</CardTitle>
              <CardDescription className="text-xs leading-relaxed">
                {mod.desc}
              </CardDescription>
            </CardHeader>
          </Card>
        );

        const wrapperClass =
          "block h-full animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none";
        const wrapperStyle = { animationDelay: `${(i % 4) * 50}ms` };

        if (mod.active && "href" in mod && mod.href) {
          return (
            <Link
              key={mod.title}
              href={mod.href}
              className={wrapperClass}
              style={wrapperStyle}
            >
              {inner}
            </Link>
          );
        }

        return (
          <div key={mod.title} className={cn(wrapperClass, "cursor-not-allowed")} style={wrapperStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
