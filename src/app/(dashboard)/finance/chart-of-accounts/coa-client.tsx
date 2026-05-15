"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FinanceLedgerType } from "@prisma/client";
import {
  Eye,
  EyeOff,
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  FINANCE_TYPE_GROUP_ORDER,
  FINANCE_TYPE_LABEL,
  FINANCE_TYPE_TONE,
} from "@/lib/finance-format";
import { cn } from "@/lib/utils";
import { FinanceEmptyState } from "@/components/finance/empty-state";

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
};

export function CoaClient({ initialRows }: { initialRows: Row[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [editing, setEditing] = useState<Row | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const filteredGrouped = useMemo(() => {
    const q = search.trim().toLowerCase();
    const map = new Map<FinanceLedgerType, Row[]>();
    for (const r of initialRows) {
      if (!showInactive && !r.isActive) continue;
      if (q) {
        const hay = `${r.code} ${r.name}`.toLowerCase();
        if (!hay.includes(q)) continue;
      }
      const cur = map.get(r.type) ?? [];
      cur.push(r);
      map.set(r.type, cur);
    }
    return FINANCE_TYPE_GROUP_ORDER.map((t) => ({
      type: t,
      rows: (map.get(t) ?? []).sort((a, b) =>
        a.sortOrder === b.sortOrder
          ? a.code.localeCompare(b.code)
          : a.sortOrder - b.sortOrder,
      ),
    }));
  }, [initialRows, search, showInactive]);

  const totalActive = initialRows.filter((r) => r.isActive).length;
  const totalInactive = initialRows.filter((r) => !r.isActive).length;

  function openEdit(row: Row | null) {
    setEditing(row);
    setDialogOpen(true);
  }

  function toggleActive(row: Row) {
    startTransition(async () => {
      try {
        await setFinanceAccountActive(row.id, !row.isActive);
        toast.success(`Akun ${row.isActive ? "dinonaktifkan" : "diaktifkan"}.`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal."));
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Toolbar */}
      <div className="border-border bg-card flex flex-wrap items-center gap-3 rounded-xl border p-3">
        <div className="relative min-w-[14rem] flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari kode atau nama akun…"
            className="h-8 pl-8 text-sm"
          />
          {search ? (
            <button
              type="button"
              onClick={() => setSearch("")}
              className="hover:text-foreground text-muted-foreground absolute right-2 top-1/2 -translate-y-1/2"
              aria-label="Kosongkan pencarian"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <Checkbox
            id="show-inactive"
            checked={showInactive}
            onCheckedChange={(c) => setShowInactive(!!c)}
          />
          <Label htmlFor="show-inactive" className="text-xs">
            Tampilkan nonaktif ({totalInactive})
          </Label>
        </div>
        <div className="text-muted-foreground text-xs">
          {totalActive} akun aktif
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button
                type="button"
                size="sm"
                onClick={() => openEdit(null)}
                className="ml-auto"
              />
            }
          >
            <Plus className="size-3.5" /> Akun baru
          </DialogTrigger>
          <CoaEditDialog
            row={editing}
            onClose={() => setDialogOpen(false)}
          />
        </Dialog>
      </div>

      {/* Tabs by type for quick navigation */}
      <Tabs defaultValue="ALL" className="gap-3">
        <TabsList variant="line">
          <TabsTrigger value="ALL">Semua</TabsTrigger>
          {FINANCE_TYPE_GROUP_ORDER.map((t) => (
            <TabsTrigger key={t} value={t}>
              <span
                className={cn("mr-1.5 size-2 rounded-full", FINANCE_TYPE_TONE[t].dot)}
                aria-hidden
              />
              {FINANCE_TYPE_LABEL[t]}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="ALL">
          <CoaGroups
            groups={filteredGrouped}
            pending={pending}
            onEdit={openEdit}
            onToggle={toggleActive}
          />
        </TabsContent>
        {FINANCE_TYPE_GROUP_ORDER.map((t) => (
          <TabsContent key={t} value={t}>
            <CoaGroups
              groups={filteredGrouped.filter((g) => g.type === t)}
              pending={pending}
              onEdit={openEdit}
              onToggle={toggleActive}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function CoaGroups({
  groups,
  pending,
  onEdit,
  onToggle,
}: {
  groups: { type: FinanceLedgerType; rows: Row[] }[];
  pending: boolean;
  onEdit: (r: Row) => void;
  onToggle: (r: Row) => void;
}) {
  const totalAccounts = groups.reduce((a, g) => a + g.rows.length, 0);
  if (totalAccounts === 0) {
    return (
      <FinanceEmptyState
        icon={<Search className="size-5" />}
        title="Tidak ada akun cocok"
        description="Coba ubah kata kunci pencarian atau aktifkan opsi 'Tampilkan nonaktif'."
      />
    );
  }
  return (
    <div className="flex flex-col gap-4">
      {groups.map((g) => {
        if (g.rows.length === 0) return null;
        const tone = FINANCE_TYPE_TONE[g.type];
        return (
          <div
            key={g.type}
            className="border-border bg-card overflow-hidden rounded-xl border shadow-sm"
          >
            <header className="border-border/60 flex items-center justify-between gap-3 border-b px-4 py-2.5">
              <h3 className="text-foreground inline-flex items-center gap-2 text-sm font-semibold tracking-tight">
                <span
                  className={cn("size-2.5 rounded-full", tone.dot)}
                  aria-hidden
                />
                {FINANCE_TYPE_LABEL[g.type]}
              </h3>
              <span className="text-muted-foreground text-xs tabular-nums">
                {g.rows.length} akun
              </span>
            </header>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-24">Kode</TableHead>
                  <TableHead>Nama</TableHead>
                  <TableHead className="w-32">Arus kas</TableHead>
                  <TableHead className="w-24">Status</TableHead>
                  <TableHead className="w-28 text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((r) => (
                  <TableRow key={r.id} className={cn(!r.isActive && "opacity-60")}>
                    <TableCell className="font-mono text-xs">{r.code}</TableCell>
                    <TableCell className="text-sm font-medium">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span>{r.name}</span>
                        {r.isApControl ? (
                          <span
                            className="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
                            title="Akun ini AP control — form jurnal akan dinamis."
                          >
                            AP
                          </span>
                        ) : null}
                        {r.isArControl ? (
                          <span
                            className="inline-flex items-center rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-violet-700 dark:text-violet-300"
                            title="Akun ini AR control — form jurnal akan dinamis."
                          >
                            AR
                          </span>
                        ) : null}
                      </div>
                    </TableCell>
                    <TableCell>
                      {r.tracksCashflow ? (
                        <span className="inline-flex items-center rounded-full bg-sky-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-sky-700 dark:text-sky-300">
                          Dilacak
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {r.isActive ? (
                        <span className="inline-flex items-center rounded-full bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300">
                          Aktif
                        </span>
                      ) : (
                        <span className="bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold">
                          Nonaktif
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label={r.isActive ? "Nonaktifkan" : "Aktifkan"}
                          disabled={pending}
                          onClick={() => onToggle(r)}
                        >
                          {r.isActive ? (
                            <EyeOff className="size-3.5" />
                          ) : (
                            <Eye className="size-3.5" />
                          )}
                        </Button>
                        <Button
                          type="button"
                          size="icon-xs"
                          variant="ghost"
                          aria-label="Edit akun"
                          disabled={pending}
                          onClick={() => onEdit(r)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Edit dialog ---------------- */

function CoaEditDialog({
  row,
  onClose,
}: {
  row: Row | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [code, setCode] = useState(row?.code ?? "");
  const [name, setName] = useState(row?.name ?? "");
  const [type, setType] = useState<FinanceLedgerType>(
    row?.type ?? FinanceLedgerType.EXPENSE,
  );
  const [tracksCashflow, setTracksCashflow] = useState(
    row?.tracksCashflow ?? false,
  );
  const [isApControl, setIsApControl] = useState(row?.isApControl ?? false);
  const [isArControl, setIsArControl] = useState(row?.isArControl ?? false);
  const [sortOrder, setSortOrder] = useState(row?.sortOrder ?? 900);

  // Reset when `row` changes (Dialog reopens for different row)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemoSync(() => {
    setCode(row?.code ?? "");
    setName(row?.name ?? "");
    setType(row?.type ?? FinanceLedgerType.EXPENSE);
    setTracksCashflow(row?.tracksCashflow ?? false);
    setIsApControl(row?.isApControl ?? false);
    setIsArControl(row?.isArControl ?? false);
    setSortOrder(row?.sortOrder ?? 900);
  }, [row?.id]);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
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
        });
        toast.success(row ? "Akun diperbarui." : "Akun ditambahkan.");
        onClose();
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menyimpan."));
      }
    });
  }

  return (
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{row ? "Edit akun" : "Akun baru"}</DialogTitle>
        <DialogDescription>
          Pakai kode konsisten (mis. 1xxx aktiva, 2xxx kewajiban). Akun yang
          sudah dipakai jurnal sebaiknya tidak ganti tipe.
        </DialogDescription>
      </DialogHeader>
      <form onSubmit={onSubmit} className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="coa-code">Kode</Label>
            <Input
              id="coa-code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              required
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="coa-sort">Urutan</Label>
            <Input
              id="coa-sort"
              type="number"
              value={sortOrder}
              onChange={(e) => setSortOrder(Number(e.target.value || 0))}
            />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="coa-name">Nama</Label>
          <Input
            id="coa-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label>Tipe</Label>
          <Select
            value={type}
            onValueChange={(v) =>
              setType((v ?? "EXPENSE") as FinanceLedgerType)
            }
          >
            <SelectTrigger className="w-full">
              <span>{FINANCE_TYPE_LABEL[type]}</span>
            </SelectTrigger>
            <SelectContent>
              {FINANCE_TYPE_GROUP_ORDER.map((t) => (
                <SelectItem key={t} value={t}>
                  {FINANCE_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="border-border/60 flex items-start gap-3 rounded-lg border p-3">
          <Checkbox
            id="coa-cf"
            checked={tracksCashflow}
            onCheckedChange={(c) => setTracksCashflow(!!c)}
          />
          <div className="flex flex-col">
            <Label htmlFor="coa-cf" className="text-sm font-medium">
              Akun kas / arus kas
            </Label>
            <p className="text-muted-foreground text-xs">
              Centang untuk akun Kas, Bank, atau e-wallet operasional. Saldo
              akun ini ikut dilaporkan di Arus Kas.
            </p>
          </div>
        </div>
        {type === FinanceLedgerType.LIABILITY ? (
          <div className="border-border/60 flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="coa-ap"
              checked={isApControl}
              onCheckedChange={(c) => {
                setIsApControl(!!c);
                if (c) setIsArControl(false);
              }}
            />
            <div className="flex flex-col">
              <Label htmlFor="coa-ap" className="text-sm font-medium">
                Akun AP control (Hutang Usaha)
              </Label>
              <p className="text-muted-foreground text-xs">
                Centang agar saat akun ini dipilih di baris jurnal, muncul
                form dinamis untuk membuat tagihan baru atau melunasi tagihan
                yang ada (sub-ledger AP otomatis ter-update).
              </p>
            </div>
          </div>
        ) : null}
        {type === FinanceLedgerType.ASSET ? (
          <div className="border-border/60 flex items-start gap-3 rounded-lg border p-3">
            <Checkbox
              id="coa-ar"
              checked={isArControl}
              onCheckedChange={(c) => {
                setIsArControl(!!c);
                if (c) setIsApControl(false);
              }}
            />
            <div className="flex flex-col">
              <Label htmlFor="coa-ar" className="text-sm font-medium">
                Akun AR control (Piutang Usaha)
              </Label>
              <p className="text-muted-foreground text-xs">
                Centang agar saat akun ini dipilih di baris jurnal, muncul
                form dinamis untuk membuat invoice baru atau menerima
                pembayaran (sub-ledger AR otomatis ter-update).
              </p>
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : row ? "Simpan perubahan" : "Tambah akun"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

/** Sinkronkan state sederhana saat deps berubah, tanpa effect cascade. */
function useMemoSync(fn: () => void, deps: unknown[]) {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useMemo(() => {
    fn();
  }, deps);
}
