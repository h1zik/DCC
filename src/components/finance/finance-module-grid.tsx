import Link from "next/link";
import {
  ArrowLeftRight,
  BadgeCent,
  Building2,
  Calculator,
  Coins,
  FileBarChart,
  Landmark,
  PiggyBank,
  Scale,
  ScrollText,
  Wallet,
} from "lucide-react";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

const LINKS = [
  {
    href: "/finance/chart-of-accounts",
    title: "1. Chart of accounts",
    desc: "Daftar akun (Kas, Bank, Piutang, Hutang, Modal, Pendapatan, Biaya).",
    icon: Scale,
    section: "Core accounting",
  },
  {
    href: "/finance/journals",
    title: "Jurnal & double-entry",
    desc: "Draft, baris debit/kredit, posting.",
    icon: ScrollText,
    section: "Core accounting",
  },
  {
    href: "/finance/general-ledger",
    title: "Buku besar",
    desc: "Mutasi per akun dan saldo berjalan.",
    icon: Landmark,
    section: "Core accounting",
  },
  {
    href: "/finance/bank",
    title: "Rekonsiliasi bank",
    desc: "Rekening bank & impor mutasi CSV.",
    icon: Wallet,
    section: "Core accounting",
  },
  {
    href: "/finance/currencies",
    title: "Multi-mata uang",
    desc: "Kurs terhadap IDR untuk jurnal valas.",
    icon: Coins,
    section: "Core accounting",
  },
  {
    href: "/finance/treasury",
    title: "Kas & treasury",
    desc: "Arus kas operasional & transfer antar rekening.",
    icon: ArrowLeftRight,
    section: "Cash & treasury",
  },
  {
    href: "/finance/ap-ar",
    title: "AP & AR",
    desc: "Hutang/piutang, pembayaran, aging AP.",
    icon: BadgeCent,
    section: "AP & AR",
  },
  {
    href: "/finance/brands-costing",
    title: "Brand & costing",
    desc: "Laba rugi per brand & kalkulator HPP.",
    icon: Building2,
    section: "Brand / project",
  },
  {
    href: "/finance/budget",
    title: "Budget vs aktual",
    desc: "Plafon periode & pembandingan realisasi.",
    icon: PiggyBank,
    section: "Budget",
  },
  {
    href: "/finance/approvals",
    title: "Persetujuan pengeluaran",
    desc: "Alur pengajuan → setuju/tolak → pembayaran.",
    icon: PiggyBank,
    section: "Budget",
  },
  {
    href: "/finance/reports",
    title: "Pelaporan",
    desc: "L/R, neraca, arus kas, rekapitulasi pajak.",
    icon: FileBarChart,
    section: "Reporting",
  },
  {
    href: "/finance/fixed-assets",
    title: "Aset tetap",
    desc: "Registrasi & penyusutan bulanan.",
    icon: Calculator,
    section: "Fixed assets",
  },
] as const;

export function FinanceModuleGrid() {
  const sections = Array.from(
    new Map(LINKS.map((l) => [l.section, true])).keys(),
  );

  return (
    <div className="flex flex-col gap-10">
      {sections.map((section) => (
        <section key={section} className="flex flex-col gap-3">
          <h2 className="text-muted-foreground text-xs font-semibold uppercase tracking-wider">
            {section}
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {LINKS.filter((l) => l.section === section).map((item) => (
              <Link key={item.href} href={item.href} className="group block">
                <Card
                  className={cn(
                    "h-full border-sidebar-border/80 transition-colors",
                    "hover:border-primary/40",
                  )}
                >
                  <CardHeader className="gap-2">
                    <div className="flex items-center gap-2">
                      <item.icon className="text-primary size-4 shrink-0" />
                      <CardTitle className="text-sm font-semibold leading-snug group-hover:text-primary">
                        {item.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs leading-relaxed">
                      {item.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
