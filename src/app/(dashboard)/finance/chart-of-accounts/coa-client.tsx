"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FinanceLedgerType } from "@prisma/client";
import {
  BookOpen,
  ChevronDown,
  Eye,
  EyeOff,
  MoreHorizontal,
  Pencil,
  Plus,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import {
  setFinanceAccountActive,
  upsertFinanceLedgerAccount,
} from "@/actions/finance-accounts";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Collapsible,
  CollapsiblePanel,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import type { SelectItemDef } from "@/lib/select-option-items";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FINANCE_TYPE_GROUP_ORDER,
  FINANCE_TYPE_LABEL,
  FINANCE_TYPE_TONE,
  formatIdrShort,
} from "@/lib/finance-format";
import { cn } from "@/lib/utils";
import { FinanceEmptyState } from "@/components/finance/empty-state";

const FINANCE_TYPE_ITEMS: SelectItemDef[] = FINANCE_TYPE_GROUP_ORDER.map(
  (t) => ({ value: t, label: FINANCE_TYPE_LABEL[t] }),
);

type Row = {
  id: string;
  code: string;
  name: string;
  type: FinanceLedgerType;
  isActive: boolean;
  sortOrder: number;
  tracksCashflow: boolean;
  isApControl: boolean;
  isArControl: boolean;
  /** Sudah terdaftar sebagai rekening (bisa dipilih di pembayaran/transfer). */
  hasBankAccount: boolean;
  /** Mis. "BCA ··1234" — null bila bukan rekening atau tanpa detail. */
  bankLabel: string | null;
  /** Saldo bertanda sesuai sifat akun (string Decimal). */
  balance: string;
};

type StatusFilter = "active" | "inactive" | "all";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "active", label: "Aktif" },
  { value: "inactive", label: "Nonaktif" },
  { value: "all", label: "Semua" },
];

/** Operator di depan tiap suku persamaan akuntansi (suku pertama tanpa operator). */
const EQUATION_OPERATOR: Record<FinanceLedgerType, string | null> = {
  ASSET: null,
  LIABILITY: "=",
  EQUITY: "+",
  REVENUE: null,
  EXPENSE: "−",
};

const idrFormatter = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 0,
});

function formatBalance(n: number): string {
  return n === 0 ? "—" : idrFormatter.format(n);
}

/** Tebakan tipe dari digit pertama kode (konvensi 1xxx aktiva, dst.). */
function typeFromCode(code: string): FinanceLedgerType | null {
  switch (code.trim()[0]) {
    case "1":
      return FinanceLedgerType.ASSET;
    case "2":
      return FinanceLedgerType.LIABILITY;
    case "3":
      return FinanceLedgerType.EQUITY;
    case "4":
      return FinanceLedgerType.REVENUE;
    case "5":
    case "6":
    case "7":
    case "8":
    case "9":
      return FinanceLedgerType.EXPENSE;
    default:
      return null;
  }
}

function rolesFor(r: Row): string[] {
  const roles: string[] = [];
  if (r.hasBankAccount) {
    roles.push(r.bankLabel ? `Rekening ${r.bankLabel}` : "Rekening");
  }
  if (r.tracksCashflow) roles.push("Arus kas");
  if (r.isApControl) roles.push("Kontrol hutang (AP)");
  if (r.isArControl) roles.push("Kontrol piutang (AR)");
  return roles;
}

export function CoaClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusFilter>("active");
  const [typeFilter, setTypeFilter] = useState<FinanceLedgerType | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogKey, setDialogKey] = useState(0);

  const statusCounts = useMemo(() => {
    const active = initialRows.filter((r) => r.isActive).length;
    return {
      active,
      inactive: initialRows.length - active,
      all: initialRows.length,
    };
  }, [initialRows]);

  // Baris sesuai filter status — dasar strip persamaan (tidak ikut pencarian
  // agar angka ringkasan tetap stabil selama user mengetik).
  const statusRows = useMemo(
    () =>
      initialRows.filter((r) =>
        status === "all" ? true : status === "active" ? r.isActive : !r.isActive,
      ),
    [initialRows, status],
  );

  const typeSummary = useMemo(() => {
    const summary = new Map<FinanceLedgerType, { count: number; total: number }>();
    for (const t of FINANCE_TYPE_GROUP_ORDER) summary.set(t, { count: 0, total: 0 });
    for (const r of statusRows) {
      const s = summary.get(r.type)!;
      s.count += 1;
      s.total += Number(r.balance);
    }
    return summary;
  }, [statusRows]);

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FINANCE_TYPE_GROUP_ORDER.filter(
      (t) => typeFilter == null || typeFilter === t,
    )
      .map((t) => {
        const rows = statusRows
          .filter((r) => r.type === t)
          .filter((r) => !q || `${r.code} ${r.name}`.toLowerCase().includes(q))
          .sort((a, b) =>
            a.sortOrder === b.sortOrder
              ? a.code.localeCompare(b.code)
              : a.sortOrder - b.sortOrder,
          );
        const total = rows.reduce((a, r) => a + Number(r.balance), 0);
        return { type: t, rows, total };
      })
      .filter((g) => g.rows.length > 0);
  }, [statusRows, search, typeFilter]);

  function openEdit(row: Row | null) {
    setEditing(row);
    setDialogKey((k) => k + 1);
    setDialogOpen(true);
  }

  function toggleActive(row: Row) {
    startTransition(async () => {
      try {
        await setFinanceAccountActive(row.id, !row.isActive);
        toast.success(
          `${row.code} ${row.name} ${row.isActive ? "dinonaktifkan" : "diaktifkan"}.`,
        );
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal mengubah status akun."));
      }
    });
  }

  function resetFilters() {
    setSearch("");
    setTypeFilter(null);
    setStatus("active");
  }

  return (
    <div className="flex flex-col gap-4">
      <EquationStrip
        summary={typeSummary}
        selected={typeFilter}
        onSelect={(t) => setTypeFilter((cur) => (cur === t ? null : t))}
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[14rem] flex-1 sm:max-w-sm">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama akun"
            aria-label="Cari akun"
            className="h-8 pl-8 text-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="hover:text-foreground text-muted-foreground absolute top-1/2 right-2 -translate-y-1/2"
              aria-label="Hapus pencarian"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>

        <div
          role="group"
          aria-label="Filter status akun"
          className="bg-muted inline-flex rounded-lg p-0.5"
        >
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={status === opt.value}
              onClick={() => setStatus(opt.value)}
              className={cn(
                "focus-visible:ring-ring/50 rounded-md px-2.5 py-1 text-xs font-medium transition-colors outline-none focus-visible:ring-2",
                status === opt.value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {opt.label}
              <span className="text-muted-foreground ml-1 tabular-nums">
                {statusCounts[opt.value]}
              </span>
            </button>
          ))}
        </div>

        <Button
          type="button"
          size="sm"
          onClick={() => openEdit(null)}
          className="ml-auto"
        >
          <Plus className="size-3.5" aria-hidden />
          Akun baru
        </Button>
      </div>

      {groups.length === 0 ? (
        <FinanceEmptyState
          icon={<Search className="size-5" />}
          title={
            search.trim()
              ? `Tidak ada akun dengan kode atau nama "${search.trim()}"`
              : "Tidak ada akun di filter ini"
          }
          description="Ubah kata kunci, tipe, atau status untuk melihat akun lain."
          action={
            <Button type="button" variant="outline" size="sm" onClick={resetFilters}>
              Hapus semua filter
            </Button>
          }
        />
      ) : (
        <div className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="w-20 pl-4">Kode</TableHead>
                <TableHead>Akun</TableHead>
                <TableHead className="w-48 text-right">Saldo</TableHead>
                <TableHead className="w-12 pr-4">
                  <span className="sr-only">Aksi</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            {groups.map((g) => (
              <TableBody key={g.type} className="border-border/60 border-t first:border-t-0">
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableCell colSpan={2} className="py-2 pl-4">
                    <span className="text-foreground inline-flex items-center gap-2 text-sm font-semibold">
                      <span
                        className={cn("size-2 rounded-full", FINANCE_TYPE_TONE[g.type].dot)}
                        aria-hidden
                      />
                      {FINANCE_TYPE_LABEL[g.type]}
                      <span className="text-muted-foreground text-xs font-normal tabular-nums">
                        {g.rows.length} akun
                      </span>
                    </span>
                  </TableCell>
                  <TableCell className="text-foreground py-2 text-right text-sm font-semibold tabular-nums">
                    {formatBalance(g.total)}
                  </TableCell>
                  <TableCell className="pr-4" />
                </TableRow>
                {g.rows.map((r) => (
                  <AccountRow
                    key={r.id}
                    row={r}
                    pending={pending}
                    onEdit={() => openEdit(r)}
                    onToggle={() => toggleActive(r)}
                    onOpenLedger={() =>
                      router.push(`/finance/general-ledger?accountId=${r.id}`)
                    }
                  />
                ))}
              </TableBody>
            ))}
          </Table>
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <CoaEditDialog
          key={dialogKey}
          row={editing}
          existingCodes={initialRows}
          onClose={() => setDialogOpen(false)}
        />
      </Dialog>
    </div>
  );
}

/* ---------------- Strip persamaan akuntansi ---------------- */

function EquationStrip({
  summary,
  selected,
  onSelect,
}: {
  summary: Map<FinanceLedgerType, { count: number; total: number }>;
  selected: FinanceLedgerType | null;
  onSelect: (t: FinanceLedgerType) => void;
}) {
  return (
    <div
      role="group"
      aria-label="Filter menurut tipe akun"
      className="border-border bg-card flex items-stretch gap-1 overflow-x-auto rounded-2xl border p-1.5 shadow-sm [scrollbar-width:thin]"
    >
      {FINANCE_TYPE_GROUP_ORDER.map((t) => {
        const s = summary.get(t)!;
        const op = EQUATION_OPERATOR[t];
        const active = selected === t;
        const startsNominal = t === FinanceLedgerType.REVENUE;
        return (
          <div key={t} className="flex shrink-0 items-stretch gap-1 sm:flex-1">
            {startsNominal ? (
              <span
                aria-hidden
                className="bg-border mx-1.5 my-2 hidden w-px shrink-0 sm:block"
              />
            ) : null}
            {op ? (
              <span
                aria-hidden
                className="text-muted-foreground hidden w-4 shrink-0 items-center justify-center text-base sm:flex"
              >
                {op}
              </span>
            ) : null}
            <button
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(t)}
              title={
                active ? "Tampilkan semua tipe" : `Tampilkan akun ${FINANCE_TYPE_LABEL[t]} saja`
              }
              className={cn(
                "focus-visible:ring-ring/50 flex min-w-[8.5rem] flex-1 flex-col gap-0.5 rounded-xl px-3 py-2.5 text-left transition-colors outline-none focus-visible:ring-2",
                active ? "bg-muted ring-border ring-1" : "hover:bg-muted/60",
                selected && !active && "opacity-60",
              )}
            >
              <span className="text-foreground inline-flex items-center gap-1.5 text-sm font-medium">
                <span
                  className={cn("size-2 rounded-full", FINANCE_TYPE_TONE[t].dot)}
                  aria-hidden
                />
                {FINANCE_TYPE_LABEL[t]}
              </span>
              <span
                className="text-foreground text-base font-semibold tracking-tight tabular-nums"
                title={idrFormatter.format(s.total)}
              >
                {s.total === 0 ? "Rp 0" : formatIdrShort(s.total)}
              </span>
              <span className="text-muted-foreground text-xs tabular-nums">
                {s.count} akun
              </span>
            </button>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Baris akun ---------------- */

function AccountRow({
  row: r,
  pending,
  onEdit,
  onToggle,
  onOpenLedger,
}: {
  row: Row;
  pending: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onOpenLedger: () => void;
}) {
  const balance = Number(r.balance);
  const roles = rolesFor(r);
  return (
    <TableRow className={cn("group", !r.isActive && "text-muted-foreground")}>
      <TableCell className="pl-4 align-top text-sm font-semibold tabular-nums">
        {r.code}
      </TableCell>
      <TableCell className="align-top whitespace-normal">
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "hover:text-primary focus-visible:ring-ring/50 rounded-sm text-left text-sm font-medium outline-none focus-visible:ring-2",
            r.isActive ? "text-foreground" : "text-muted-foreground",
          )}
        >
          {r.name}
        </button>
        {!r.isActive ? (
          <span className="bg-muted text-muted-foreground ml-2 rounded px-1.5 py-0.5 text-[11px] font-medium">
            Nonaktif
          </span>
        ) : null}
        {roles.length > 0 ? (
          <p className="text-muted-foreground mt-0.5 text-xs">{roles.join(", ")}</p>
        ) : null}
      </TableCell>
      <TableCell
        className={cn(
          "text-right align-top text-sm tabular-nums",
          balance < 0
            ? "text-rose-700 dark:text-rose-400"
            : balance === 0
              ? "text-muted-foreground"
              : r.isActive
                ? "text-foreground"
                : undefined,
        )}
        title={
          balance < 0 ? "Saldo berlawanan dengan sifat normal akun ini" : undefined
        }
      >
        {formatBalance(balance)}
      </TableCell>
      <TableCell className="pr-4 text-right align-top">
        <DropdownMenu>
          <DropdownMenuTrigger
            disabled={pending}
            aria-label={`Aksi untuk ${r.code} ${r.name}`}
            className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-7 items-center justify-center rounded-md outline-none focus-visible:ring-2 disabled:opacity-50"
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-44">
            <DropdownMenuItem onClick={onEdit}>
              <Pencil className="size-3.5" />
              Edit akun
            </DropdownMenuItem>
            <DropdownMenuItem onClick={onOpenLedger}>
              <BookOpen className="size-3.5" />
              Buka buku besar
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant={r.isActive ? "destructive" : "default"}
              onClick={onToggle}
            >
              {r.isActive ? (
                <EyeOff className="size-3.5" />
              ) : (
                <Eye className="size-3.5" />
              )}
              {r.isActive ? "Nonaktifkan akun" : "Aktifkan akun"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}

/* ---------------- Edit dialog ---------------- */

function CoaEditDialog({
  row,
  existingCodes,
  onClose,
}: {
  row: Row | null;
  existingCodes: Pick<Row, "id" | "code" | "name">[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [type, setType] = useState<FinanceLedgerType>(
    row?.type ?? FinanceLedgerType.EXPENSE,
  );
  // Selama tipe belum dipilih manual, akun baru mengikuti tebakan dari kode.
  const [typeTouched, setTypeTouched] = useState(row != null);
  const [tracksCashflow, setTracksCashflow] = useState(
    row?.tracksCashflow ?? false,
  );
  const [isApControl, setIsApControl] = useState(row?.isApControl ?? false);
  const [isArControl, setIsArControl] = useState(row?.isArControl ?? false);
  const [sortOrder, setSortOrder] = useState(row?.sortOrder ?? 900);
  const [institution, setInstitution] = useState("");
  const [accountMask, setAccountMask] = useState("");
  const [opening, setOpening] = useState("0");
  const [openingAsOf, setOpeningAsOf] = useState(todayIso);

  const duplicate = useMemo(() => {
    const c = code.trim();
    if (!c) return null;
    return existingCodes.find((r) => r.code === c && r.id !== row?.id) ?? null;
  }, [code, existingCodes, row?.id]);

  // Akun Aktiva aktif ber-flag arus kas yang belum punya rekening akan
  // didaftarkan sebagai rekening saat disimpan.
  const willRegisterBank =
    type === FinanceLedgerType.ASSET &&
    tracksCashflow &&
    (row?.isActive ?? true) &&
    !row?.hasBankAccount;

  function onCodeChange(value: string) {
    setCode(value);
    if (!typeTouched) {
      const guess = typeFromCode(value);
      if (guess) setType(guess);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (duplicate) return;
    startTransition(async () => {
      try {
        await upsertFinanceLedgerAccount({
          id: row?.id,
          code: code.trim(),
          name: name.trim(),
          type,
          tracksCashflow,
          isApControl,
          isArControl,
          sortOrder,
          isActive: row?.isActive ?? true,
          bank: willRegisterBank
            ? {
                institution: institution.trim() || null,
                accountMask: accountMask.trim() || null,
                openingBalance: opening.trim() || "0",
                openingAsOf: new Date(openingAsOf),
              }
            : undefined,
        });
        toast.success(row ? "Perubahan akun disimpan." : "Akun ditambahkan.");
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan akun."));
      }
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{row ? `Edit akun ${row.code}` : "Akun baru"}</DialogTitle>
        <DialogDescription>
          Kode menentukan urutan dan kelompok: 1 aktiva, 2 kewajiban, 3 ekuitas,
          4 pendapatan, 5 ke atas beban.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-4">
        <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="coa-code">Kode</Label>
            <Input
              id="coa-code"
              value={code}
              onChange={(e) => onCodeChange(e.target.value)}
              required
              aria-invalid={duplicate ? true : undefined}
              aria-describedby={duplicate ? "coa-code-error" : undefined}
              className="tabular-nums"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coa-name">Nama akun</Label>
            <Input
              id="coa-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          {duplicate ? (
            <p
              id="coa-code-error"
              className="text-destructive col-span-2 -mt-1 text-xs"
            >
              Kode {duplicate.code} sudah dipakai {duplicate.name}. Pilih kode lain.
            </p>
          ) : null}
        </div>

        <div className="space-y-1.5">
          <Label>Tipe</Label>
          <Select
            value={type}
            items={FINANCE_TYPE_ITEMS}
            onValueChange={(v) => {
              setTypeTouched(true);
              setType((v ?? "EXPENSE") as FinanceLedgerType);
            }}
          >
            <SelectTrigger className="w-full">
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn("size-2 rounded-full", FINANCE_TYPE_TONE[type].dot)}
                  aria-hidden
                />
                {FINANCE_TYPE_LABEL[type]}
              </span>
            </SelectTrigger>
            <SelectContent>
              {FINANCE_TYPE_GROUP_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {FINANCE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {row ? (
            <p className="text-muted-foreground text-xs">
              Hindari mengganti tipe akun yang sudah dipakai jurnal.
            </p>
          ) : !typeTouched && typeFromCode(code) ? (
            <p className="text-muted-foreground text-xs">
              Dipilih otomatis dari kode. Ubah bila perlu.
            </p>
          ) : null}
        </div>

        <div className="border-border/60 divide-border/60 divide-y rounded-lg border">
          <OptionRow
            id="coa-cf"
            checked={tracksCashflow}
            onChange={setTracksCashflow}
            label="Akun kas atau bank"
            hint={
              type === FinanceLedgerType.ASSET
                ? "Ikut dilaporkan di arus kas dan bisa dipilih sebagai rekening untuk pembayaran dan transfer."
                : "Saldo akun ini ikut dilaporkan di arus kas."
            }
          />
          {type === FinanceLedgerType.LIABILITY ? (
            <OptionRow
              id="coa-ap"
              checked={isApControl}
              onChange={(c) => {
                setIsApControl(c);
                if (c) setIsArControl(false);
              }}
              label="Kontrol hutang usaha (AP)"
              hint="Saat dipilih di baris jurnal, muncul form untuk membuat atau melunasi tagihan vendor."
            />
          ) : null}
          {type === FinanceLedgerType.ASSET ? (
            <OptionRow
              id="coa-ar"
              checked={isArControl}
              onChange={(c) => {
                setIsArControl(c);
                if (c) setIsApControl(false);
              }}
              label="Kontrol piutang usaha (AR)"
              hint="Saat dipilih di baris jurnal, muncul form untuk membuat invoice atau menerima pembayaran."
            />
          ) : null}
        </div>

        {willRegisterBank ? (
          <fieldset className="border-border/60 grid gap-3 rounded-lg border p-3">
            <legend className="px-1 text-sm font-medium">Detail rekening</legend>
            <p className="text-muted-foreground -mt-1 text-xs">
              Saldo awal dijurnal otomatis dengan lawan akun 3000 Modal pemilik.
              Isi 0 bila saldo awalnya sudah pernah dijurnal.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="coa-bank-inst">Bank atau e-wallet</Label>
                <Input
                  id="coa-bank-inst"
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="BCA"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coa-bank-mask">4 digit akhir rekening</Label>
                <Input
                  id="coa-bank-mask"
                  value={accountMask}
                  onChange={(e) => setAccountMask(e.target.value)}
                  placeholder="1234"
                  maxLength={32}
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coa-bank-opening">Saldo awal</Label>
                <Input
                  id="coa-bank-opening"
                  value={opening}
                  onChange={(e) => setOpening(e.target.value)}
                  inputMode="decimal"
                  className="tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="coa-bank-asof">Per tanggal</Label>
                <Input
                  id="coa-bank-asof"
                  type="date"
                  value={openingAsOf}
                  onChange={(e) => setOpeningAsOf(e.target.value)}
                  required
                />
              </div>
            </div>
          </fieldset>
        ) : null}

        <Collapsible>
          <CollapsibleTrigger className="text-muted-foreground hover:text-foreground group inline-flex items-center gap-1 text-xs font-medium">
            <ChevronDown
              className="size-3.5 transition-transform group-data-[panel-open]:rotate-180"
              aria-hidden
            />
            Pengaturan lanjutan
          </CollapsibleTrigger>
          <CollapsiblePanel>
            <div className="space-y-1.5 pt-3">
              <Label htmlFor="coa-sort">Urutan tampil</Label>
              <Input
                id="coa-sort"
                type="number"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value || 0))}
                className="w-32 tabular-nums"
              />
              <p className="text-muted-foreground text-xs">
                Angka kecil tampil lebih dulu di dalam kelompoknya. Akun dengan
                urutan sama diurutkan menurut kode.
              </p>
            </div>
          </CollapsiblePanel>
        </Collapsible>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending || Boolean(duplicate)}>
            {pending ? "Menyimpan…" : row ? "Simpan perubahan" : "Tambah akun"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

function OptionRow({
  id,
  checked,
  onChange,
  label,
  hint,
}: {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3">
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(c) => onChange(!!c)}
        className="mt-0.5"
      />
      <div className="flex flex-col gap-0.5">
        <Label htmlFor={id} className="text-sm font-medium">
          {label}
        </Label>
        <p className="text-muted-foreground text-xs leading-relaxed">{hint}</p>
      </div>
    </div>
  );
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}
