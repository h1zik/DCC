"use client";
import { actionErrorMessage } from "@/lib/action-error-message";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Lock,
  MoreHorizontal,
  Plus,
  RotateCcw,
  Send,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  deleteFinanceJournalDraft,
  deleteFinanceJournalLine,
  postFinanceJournal,
  reverseFinanceJournal,
  updateFinanceJournalHeader,
  upsertFinanceJournalLine,
} from "@/actions/finance-journals";
import type { FinanceJournalStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
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
  LineAttachmentControl,
  type LineAttachmentItem,
} from "@/components/finance/line-attachment-control";
import { Money } from "@/components/finance/money";
import { formatIdrShort } from "@/lib/finance-format";
import { cn } from "@/lib/utils";

export type JournalEditorAccount = {
  id: string;
  code: string;
  name: string;
  isApControl: boolean;
  isArControl: boolean;
};

export type JournalEditorBrand = { id: string; name: string };

export type JournalEditorVendor = { id: string; name: string };

export type JournalEditorOpenBill = {
  id: string;
  vendorName: string;
  billNumber: string | null;
  dueDateIso: string;
  amount: string;
  remaining: string;
};

export type JournalEditorOpenInvoice = {
  id: string;
  customerName: string;
  invoiceNumber: string | null;
  dueDateIso: string;
  amount: string;
  remaining: string;
};

export type JournalEditorLineLink = {
  mode:
    | "CREATE_BILL"
    | "PAY_BILL"
    | "CREATE_INVOICE"
    | "RECEIVE_INVOICE";
  vendorId: string | null;
  partyName: string | null;
  partyEmail: string | null;
  docNumber: string | null;
  docDateIso: string | null;
  dueDateIso: string | null;
  billId: string | null;
  invoiceId: string | null;
  createdBillId: string | null;
  createdInvoiceId: string | null;
};

export type JournalEditorLine = {
  id: string;
  accountId: string;
  debitBase: string;
  creditBase: string;
  memo: string | null;
  brandId: string | null;
  account: {
    code: string;
    name: string;
    isApControl: boolean;
    isArControl: boolean;
  };
  brand: { id: string; name: string } | null;
  attachments: LineAttachmentItem[];
  link: JournalEditorLineLink | null;
};

type Props = {
  entryId: string;
  entryNumber: string | null;
  status: FinanceJournalStatus;
  entryDateIso: string;
  reference: string | null;
  memo: string | null;
  lines: JournalEditorLine[];
  accounts: JournalEditorAccount[];
  brands: JournalEditorBrand[];
  vendors: JournalEditorVendor[];
  openBills: JournalEditorOpenBill[];
  openInvoices: JournalEditorOpenInvoice[];
  /** Jika jurnal ini adalah pembalikan, info jurnal sumber. */
  reversesEntry: { id: string; entryNumber: string | null; entryDate: Date } | null;
  /** Jika jurnal ini sudah dibalik, info jurnal pembaliknya. */
  reversedBy: { id: string; entryNumber: string | null } | null;
  /** Pesan jika periode entry sudah terkunci. */
  periodLockedReason: string | null;
};

export function JournalEditorClient(props: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [entryDate, setEntryDate] = useState(props.entryDateIso.slice(0, 10));
  const [reference, setReference] = useState(props.reference ?? "");
  const [memo, setMemo] = useState(props.memo ?? "");

  const [accountId, setAccountId] = useState(props.accounts[0]?.id ?? "");
  const [debit, setDebit] = useState("");
  const [credit, setCredit] = useState("");
  const [lineMemo, setLineMemo] = useState("");
  const [brandId, setBrandId] = useState<string>("");
  const safeAccountId = props.accounts.some((a) => a.id === accountId)
    ? accountId
    : props.accounts[0]?.id ?? "__none__";
  const safeBrandId =
    brandId && props.brands.some((b) => b.id === brandId) ? brandId : "__none__";

  const accountItems = useMemo(
    (): SelectItemDef[] => [
      ...(props.accounts.length === 0
        ? [{ value: "__none__", label: "Belum ada akun" }]
        : []),
      ...props.accounts.map((a) => ({
        value: a.id,
        label: `${a.code} — ${a.name}`,
      })),
    ],
    [props.accounts],
  );
  const brandItems = useMemo(
    (): SelectItemDef[] => [
      { value: "__none__", label: "Tanpa tag brand" },
      ...props.brands.map((b) => ({ value: b.id, label: b.name })),
    ],
    [props.brands],
  );
  const vendorItems = useMemo(
    (): SelectItemDef[] => [
      { value: "__none__", label: "— Tanpa master —" },
      ...props.vendors.map((v) => ({ value: v.id, label: v.name })),
    ],
    [props.vendors],
  );
  const openBillItems = useMemo(
    (): SelectItemDef[] => [
      ...(props.openBills.length === 0
        ? [{ value: "__none__", label: "Tidak ada tagihan terbuka" }]
        : []),
      ...props.openBills.map((b) => ({
        value: b.id,
        label: `${b.vendorName} — ${b.billNumber ?? "no#?"} — sisa ${formatIdrShort(b.remaining)}`,
      })),
    ],
    [props.openBills],
  );
  const openInvoiceItems = useMemo(
    (): SelectItemDef[] => [
      ...(props.openInvoices.length === 0
        ? [{ value: "__none__", label: "Tidak ada invoice terbuka" }]
        : []),
      ...props.openInvoices.map((i) => ({
        value: i.id,
        label: `${i.customerName} — ${i.invoiceNumber ?? "no#?"} — sisa ${formatIdrShort(i.remaining)}`,
      })),
    ],
    [props.openInvoices],
  );

  // Sub-state untuk dynamic AP/AR link pada add-line panel.
  const selectedAccount = props.accounts.find((a) => a.id === accountId);
  const isApAccount = !!selectedAccount?.isApControl;
  const isArAccount = !!selectedAccount?.isArControl;
  const sideIsDebit = !!debit && !credit;
  const sideIsCredit = !!credit && !debit;

  type LinkMode =
    | "NONE"
    | "CREATE_BILL"
    | "PAY_BILL"
    | "CREATE_INVOICE"
    | "RECEIVE_INVOICE";
  const addFormRef = useRef<HTMLFormElement>(null);
  const [linkMode, setLinkMode] = useState<LinkMode>("NONE");
  const [linkVendorId, setLinkVendorId] = useState("");
  const [linkPartyName, setLinkPartyName] = useState("");
  const [linkPartyEmail, setLinkPartyEmail] = useState("");
  const [linkDocNumber, setLinkDocNumber] = useState("");
  const [linkDocDate, setLinkDocDate] = useState(entryDate);
  const [linkDueDate, setLinkDueDate] = useState(entryDate);
  const [linkBillId, setLinkBillId] = useState("");
  const [linkInvoiceId, setLinkInvoiceId] = useState("");

  // Auto-suggest mode default ketika akun atau sisi berubah.
  // CREATE_BILL  ↔ AP control, sisi kredit
  // PAY_BILL     ↔ AP control, sisi debit
  // CREATE_INVOICE ↔ AR control, sisi debit
  // RECEIVE_INVOICE ↔ AR control, sisi kredit
  // Re-derive saat akun/sisi berubah, kecuali user sudah memilih manual.
  const autoMode: LinkMode = (() => {
    if (isApAccount && sideIsDebit) return "PAY_BILL";
    if (isApAccount && sideIsCredit) return "CREATE_BILL";
    if (isArAccount && sideIsDebit) return "CREATE_INVOICE";
    if (isArAccount && sideIsCredit) return "RECEIVE_INVOICE";
    return "NONE";
  })();
  const effectiveLinkMode: LinkMode = linkMode === "NONE" ? autoMode : linkMode;
  const showLinkPanel =
    (isApAccount || isArAccount) && (sideIsDebit || sideIsCredit);
  const linkModeItems = useMemo(
    (): SelectItemDef[] =>
      (
        [
          ...(isApAccount && sideIsCredit ? ["CREATE_BILL" as const] : []),
          ...(isApAccount && sideIsDebit ? ["PAY_BILL" as const] : []),
          ...(isArAccount && sideIsDebit ? ["CREATE_INVOICE" as const] : []),
          ...(isArAccount && sideIsCredit ? ["RECEIVE_INVOICE" as const] : []),
        ]
      ).map((mode) => ({ value: mode, label: modeLabel(mode) })),
    [isApAccount, isArAccount, sideIsDebit, sideIsCredit],
  );

  function resetLink() {
    setLinkMode("NONE");
    setLinkVendorId("");
    setLinkPartyName("");
    setLinkPartyEmail("");
    setLinkDocNumber("");
    setLinkDocDate(entryDate);
    setLinkDueDate(entryDate);
    setLinkBillId("");
    setLinkInvoiceId("");
  }

  const isDraft = props.status === "DRAFT";
  const isPosted = props.status === "POSTED";
  const isLocked = Boolean(props.periodLockedReason);
  const canEdit = isDraft && !isLocked;
  const canPost = canEdit;
  const canReverse = isPosted && !props.reversedBy && !isLocked;

  // Real-time totals & balance check — dijumlahkan dalam sen-integer agar
  // perbandingan eksak; penjumlahan float membuat 0.10+0.20 !== 0.30 dan
  // jurnal yang sebenarnya seimbang tidak bisa diposting dari UI.
  const { totalDebit, totalCredit } = useMemo(() => {
    let dCents = 0;
    let cCents = 0;
    for (const line of props.lines) {
      dCents += Math.round(Number(line.debitBase) * 100);
      cCents += Math.round(Number(line.creditBase) * 100);
    }
    return { totalDebit: dCents / 100, totalCredit: cCents / 100 };
  }, [props.lines]);

  function saveHeader() {
    startTransition(async () => {
      try {
        await updateFinanceJournalHeader({
          entryId: props.entryId,
          entryDate: new Date(entryDate),
          reference: reference || null,
          memo: memo || null,
        });
        toast.success("Header disimpan.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menyimpan."));
      }
    });
  }

  function addLine() {
    startTransition(async () => {
      try {
        // Bangun payload link kalau akun AP/AR & ada nilai.
        let linkPayload: Parameters<typeof upsertFinanceJournalLine>[0]["link"] =
          null;
        if (showLinkPanel && effectiveLinkMode !== "NONE") {
          if (
            effectiveLinkMode === "CREATE_BILL" ||
            effectiveLinkMode === "CREATE_INVOICE"
          ) {
            if (!linkPartyName.trim()) {
              throw new Error(
                effectiveLinkMode === "CREATE_BILL"
                  ? "Nama vendor wajib."
                  : "Nama pelanggan wajib.",
              );
            }
            if (!linkDueDate) {
              throw new Error("Jatuh tempo wajib.");
            }
            linkPayload = {
              mode: effectiveLinkMode,
              vendorId:
                effectiveLinkMode === "CREATE_BILL"
                  ? linkVendorId || null
                  : null,
              partyName: linkPartyName.trim(),
              partyEmail:
                effectiveLinkMode === "CREATE_INVOICE"
                  ? linkPartyEmail.trim() || null
                  : null,
              docNumber: linkDocNumber.trim() || null,
              docDate: linkDocDate ? new Date(linkDocDate) : null,
              dueDate: new Date(linkDueDate),
            };
          } else if (effectiveLinkMode === "PAY_BILL") {
            if (!linkBillId) throw new Error("Pilih tagihan yang dilunasi.");
            linkPayload = { mode: "PAY_BILL", billId: linkBillId };
          } else if (effectiveLinkMode === "RECEIVE_INVOICE") {
            if (!linkInvoiceId) throw new Error("Pilih invoice yang dilunasi.");
            linkPayload = { mode: "RECEIVE_INVOICE", invoiceId: linkInvoiceId };
          }
        }

        await upsertFinanceJournalLine({
          entryId: props.entryId,
          accountId,
          debit,
          credit,
          memo: lineMemo || null,
          brandId: brandId || null,
          link: linkPayload,
        });
        setDebit("");
        setCredit("");
        setLineMemo("");
        resetLink();
        toast.success("Baris ditambahkan.");
        // Kembali ke pilihan akun untuk baris berikutnya.
        addFormRef.current?.querySelector<HTMLButtonElement>("button")?.focus();
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menambah baris."));
      }
    });
  }

  function removeLine(lineId: string) {
    startTransition(async () => {
      try {
        await deleteFinanceJournalLine(lineId);
        toast.success("Baris dihapus.");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus."));
      }
    });
  }

  function post() {
    startTransition(async () => {
      try {
        await postFinanceJournal(props.entryId);
        toast.success("Jurnal diposting.");
        router.push("/finance/journals");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Posting gagal."));
      }
    });
  }

  function removeDraft() {
    startTransition(async () => {
      try {
        await deleteFinanceJournalDraft(props.entryId);
        toast.success("Draf dihapus.");
        router.push("/finance/journals");
        router.refresh();
      } catch (e) {
        toast.error(actionErrorMessage(e, "Gagal menghapus."));
      }
    });
  }

  const [confirmPost, setConfirmPost] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const headerDirty =
    entryDate !== props.entryDateIso.slice(0, 10) ||
    reference !== (props.reference ?? "") ||
    memo !== (props.memo ?? "");

  function resetHeader() {
    setEntryDate(props.entryDateIso.slice(0, 10));
    setReference(props.reference ?? "");
    setMemo(props.memo ?? "");
  }

  const canAddLine =
    !pending && !!accountId && safeAccountId !== "__none__" && (!!debit || !!credit);
  const balanced = totalDebit > 0 && totalDebit === totalCredit;

  return (
    <div className="flex flex-col gap-4">
      {/* Catatan status: periode terkunci & relasi pembalikan */}
      {isLocked || props.reversedBy || props.reversesEntry ? (
        <ul className="text-muted-foreground flex flex-col gap-1.5 text-sm">
          {isLocked ? (
            <li className="flex items-start gap-2">
              <Lock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
              <span>
                {props.periodLockedReason} Jurnal di periode ini tidak bisa
                diubah, diposting, atau dibalik.
              </span>
            </li>
          ) : null}
          {props.reversedBy ? (
            <li className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400" aria-hidden />
              <span>
                Sudah dibalik oleh{" "}
                <Link
                  href={`/finance/journals/${props.reversedBy.id}`}
                  className="text-foreground font-medium underline underline-offset-2"
                >
                  {props.reversedBy.entryNumber ?? "jurnal pembalik"}
                </Link>
                .
              </span>
            </li>
          ) : null}
          {props.reversesEntry ? (
            <li className="flex items-start gap-2">
              <RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                Jurnal ini membalik{" "}
                <Link
                  href={`/finance/journals/${props.reversesEntry.id}`}
                  className="text-foreground font-medium underline underline-offset-2"
                >
                  {props.reversesEntry.entryNumber ?? "jurnal sumber"}
                </Link>
                .
              </span>
            </li>
          ) : null}
        </ul>
      ) : null}

      {/* Header jurnal */}
      <section
        aria-label="Informasi jurnal"
        className="border-border bg-card rounded-2xl border p-4 shadow-sm sm:p-5"
      >
        {canEdit ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (headerDirty) saveHeader();
            }}
            className="grid gap-3 sm:grid-cols-[10rem_12rem_minmax(0,1fr)]"
          >
            <div className="space-y-1.5">
              <Label htmlFor="jd">Tanggal</Label>
              <Input
                id="jd"
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jr">Referensi</Label>
              <Input
                id="jr"
                value={reference}
                placeholder="INV-2026-001"
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="jm">Memo</Label>
              <Input
                id="jm"
                value={memo}
                placeholder="Apa yang dicatat jurnal ini"
                onChange={(e) => setMemo(e.target.value)}
              />
            </div>
            {headerDirty ? (
              <div className="flex flex-wrap items-center justify-end gap-2 sm:col-span-3">
                <span className="mr-auto text-xs text-amber-700 dark:text-amber-400">
                  Perubahan belum disimpan
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={resetHeader}>
                  Batalkan
                </Button>
                <Button type="submit" size="sm" disabled={pending}>
                  Simpan
                </Button>
              </div>
            ) : null}
          </form>
        ) : (
          <dl className="grid gap-3 sm:grid-cols-[10rem_12rem_minmax(0,1fr)]">
            <div className="space-y-0.5">
              <dt className="text-muted-foreground text-xs">Tanggal</dt>
              <dd className="text-foreground text-sm font-medium tabular-nums">
                {entryDateLabel.format(new Date(props.entryDateIso))}
              </dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground text-xs">Referensi</dt>
              <dd className="text-foreground text-sm">{props.reference || "—"}</dd>
            </div>
            <div className="space-y-0.5">
              <dt className="text-muted-foreground text-xs">Memo</dt>
              <dd className="text-foreground text-sm">{props.memo || "—"}</dd>
            </div>
          </dl>
        )}
      </section>

      {/* Baris jurnal + form tambah */}
      <section
        aria-labelledby="lines-heading"
        className="border-border bg-card overflow-hidden rounded-2xl border shadow-sm"
      >
        <div className="flex items-baseline justify-between gap-2 px-4 pt-4 pb-3 sm:px-5">
          <h2 id="lines-heading" className="text-foreground text-base font-semibold">
            Baris jurnal
          </h2>
          <span className="text-muted-foreground text-xs tabular-nums">
            {props.lines.length} baris
          </span>
        </div>

        {props.lines.length === 0 ? (
          <p className="text-muted-foreground px-4 pb-4 text-sm sm:px-5">
            {canEdit
              ? "Belum ada baris. Tambahkan baris debit dan kredit di bawah; totalnya harus sama sebelum diposting."
              : "Jurnal ini tidak punya baris."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead className="pl-4 sm:pl-5">Akun</TableHead>
                <TableHead className="w-36 text-right">Debit</TableHead>
                <TableHead className="w-36 text-right">Kredit</TableHead>
                <TableHead className="hidden w-36 md:table-cell">Brand</TableHead>
                <TableHead className="w-14 text-center">Bukti</TableHead>
                {canEdit ? (
                  <TableHead className="w-12 pr-4 sm:pr-5">
                    <span className="sr-only">Hapus</span>
                  </TableHead>
                ) : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {props.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="pl-4 align-top whitespace-normal sm:pl-5">
                    <div className="flex items-baseline gap-2 text-sm">
                      <span className="text-muted-foreground shrink-0 text-xs font-medium tabular-nums">
                        {line.account.code}
                      </span>
                      <span className="text-foreground font-medium">
                        {line.account.name}
                      </span>
                    </div>
                    {line.link ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">
                        {modeLabel(line.link.mode)}
                        {line.link.partyName ? `: ${line.link.partyName}` : ""}
                        {line.link.docNumber ? ` (${line.link.docNumber})` : ""}
                      </p>
                    ) : null}
                    {line.memo ? (
                      <p className="text-muted-foreground mt-0.5 text-xs">{line.memo}</p>
                    ) : null}
                    {line.brand ? (
                      <p className="text-muted-foreground mt-0.5 text-xs md:hidden">
                        Brand {line.brand.name}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-right align-top text-sm">
                    <Money value={line.debitBase} zeroAsDash />
                  </TableCell>
                  <TableCell className="text-right align-top text-sm">
                    <Money value={line.creditBase} zeroAsDash />
                  </TableCell>
                  <TableCell className="text-muted-foreground hidden align-top text-xs md:table-cell">
                    {line.brand?.name ?? "—"}
                  </TableCell>
                  <TableCell className="text-center align-top">
                    <LineAttachmentControl
                      lineId={line.id}
                      attachments={line.attachments}
                      canEdit={canEdit}
                      canUpload={canEdit || isPosted}
                    />
                  </TableCell>
                  {canEdit ? (
                    <TableCell className="pr-4 text-right align-top sm:pr-5">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-xs"
                        aria-label={`Hapus baris ${line.account.code} ${line.account.name}`}
                        disabled={pending}
                        onClick={() => removeLine(line.id)}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {canEdit ? (
          <form
            ref={addFormRef}
            aria-label="Tambah baris"
            onSubmit={(e) => {
              e.preventDefault();
              if (canAddLine) addLine();
            }}
            className="border-border bg-muted/20 flex flex-col gap-3 border-t border-dashed p-4 sm:p-5"
          >
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_9rem_9rem_auto] lg:items-end">
              <div className="space-y-1.5 sm:col-span-2 lg:col-span-1">
                <Label>Akun</Label>
                <Select
                  value={safeAccountId}
                  items={accountItems}
                  onValueChange={(v) => setAccountId(!v || v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="bg-background w-full">
                    <span className="line-clamp-1">
                      {safeAccountId === "__none__"
                        ? "Pilih akun"
                        : (() => {
                            const a = props.accounts.find((x) => x.id === safeAccountId);
                            return a ? `${a.code} ${a.name}` : "Pilih akun";
                          })()}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {props.accounts.length === 0 ? (
                      <SelectItem value="__none__">Belum ada akun</SelectItem>
                    ) : null}
                    {props.accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jl-debit">Debit</Label>
                <Input
                  id="jl-debit"
                  value={debit}
                  inputMode="decimal"
                  onChange={(e) => {
                    setDebit(e.target.value);
                    if (e.target.value) setCredit("");
                  }}
                  placeholder="0"
                  className="bg-background text-right tabular-nums"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jl-credit">Kredit</Label>
                <Input
                  id="jl-credit"
                  value={credit}
                  inputMode="decimal"
                  onChange={(e) => {
                    setCredit(e.target.value);
                    if (e.target.value) setDebit("");
                  }}
                  placeholder="0"
                  className="bg-background text-right tabular-nums"
                />
              </div>
              <Button
                type="submit"
                disabled={!canAddLine}
                className="sm:col-span-2 lg:col-span-1"
              >
                <Plus className="size-3.5" aria-hidden />
                Tambah baris
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[14rem_minmax(0,1fr)]">
              <div className="space-y-1.5">
                <Label>Brand</Label>
                <Select
                  value={safeBrandId}
                  items={brandItems}
                  onValueChange={(v) => setBrandId(!v || v === "__none__" ? "" : v)}
                >
                  <SelectTrigger className="bg-background w-full">
                    <span className="line-clamp-1">
                      {safeBrandId === "__none__"
                        ? "Tanpa brand"
                        : props.brands.find((b) => b.id === safeBrandId)?.name ??
                          "Tanpa brand"}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Tanpa brand</SelectItem>
                    {props.brands.map((b) => (
                      <SelectItem key={b.id} value={b.id}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="jl-memo">Memo baris</Label>
                <Input
                  id="jl-memo"
                  value={lineMemo}
                  onChange={(e) => setLineMemo(e.target.value)}
                  placeholder="Opsional"
                  className="bg-background"
                />
              </div>
            </div>

            {/* Sub-form AP/AR dinamis */}
            {showLinkPanel ? (
              <div className="border-border bg-background rounded-xl border p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-foreground text-sm font-medium">
                  {isApAccount ? "Hutang usaha (AP)" : "Piutang usaha (AR)"}
                </span>
                <Select
                  value={effectiveLinkMode}
                  items={linkModeItems}
                  onValueChange={(v) => setLinkMode(v as LinkMode)}
                >
                  <SelectTrigger className="h-7 w-56 text-xs">
                    <span className="line-clamp-1">
                      {modeLabel(effectiveLinkMode)}
                    </span>
                  </SelectTrigger>
                  <SelectContent>
                    {isApAccount && sideIsCredit ? (
                      <SelectItem value="CREATE_BILL">
                        Buat tagihan baru
                      </SelectItem>
                    ) : null}
                    {isApAccount && sideIsDebit ? (
                      <SelectItem value="PAY_BILL">
                        Lunasi tagihan yang ada
                      </SelectItem>
                    ) : null}
                    {isArAccount && sideIsDebit ? (
                      <SelectItem value="CREATE_INVOICE">
                        Buat invoice baru
                      </SelectItem>
                    ) : null}
                    {isArAccount && sideIsCredit ? (
                      <SelectItem value="RECEIVE_INVOICE">
                        Terima pembayaran invoice
                      </SelectItem>
                    ) : null}
                  </SelectContent>
                </Select>
              </div>

              {effectiveLinkMode === "CREATE_BILL" ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                    <Label className="text-xs">Vendor (master, opsional)</Label>
                    <Select
                      value={linkVendorId || "__none__"}
                      items={vendorItems}
                      onValueChange={(v) => {
                        const next = v ?? "";
                        if (!next || next === "__none__") {
                          setLinkVendorId("");
                        } else {
                          setLinkVendorId(next);
                          const ven = props.vendors.find((x) => x.id === next);
                          if (ven && !linkPartyName) setLinkPartyName(ven.name);
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 w-full text-sm">
                        <span className="line-clamp-1">
                          {props.vendors.find((v) => v.id === linkVendorId)
                            ?.name ?? "Tanpa vendor master"}
                        </span>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">— Tanpa master —</SelectItem>
                        {props.vendors.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                    <Label className="text-xs">Nama vendor *</Label>
                    <Input
                      value={linkPartyName}
                      onChange={(e) => setLinkPartyName(e.target.value)}
                      placeholder="PT Petani Sumatra"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-xs">No. tagihan</Label>
                    <Input
                      value={linkDocNumber}
                      onChange={(e) => setLinkDocNumber(e.target.value)}
                      placeholder="SS-2026-101"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-xs">Jatuh tempo *</Label>
                    <Input
                      type="date"
                      value={linkDueDate}
                      onChange={(e) => setLinkDueDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {effectiveLinkMode === "PAY_BILL" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Tagihan yang dilunasi *</Label>
                  <Select
                    value={linkBillId || "__none__"}
                    items={openBillItems}
                    onValueChange={(v) => {
                      const next = v ?? "";
                      setLinkBillId(!next || next === "__none__" ? "" : next);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span className="line-clamp-1">
                        {(() => {
                          const b = props.openBills.find(
                            (x) => x.id === linkBillId,
                          );
                          if (!b) return "Pilih tagihan terbuka";
                          return `${b.vendorName} · ${b.billNumber ?? "no#?"} · sisa ${formatIdrShort(b.remaining)}`;
                        })()}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {props.openBills.length === 0 ? (
                        <SelectItem value="__none__">
                          Tidak ada tagihan terbuka
                        </SelectItem>
                      ) : null}
                      {props.openBills.map((b) => (
                        <SelectItem key={b.id} value={b.id}>
                          {b.vendorName} — {b.billNumber ?? "no#?"} — sisa{" "}
                          {formatIdrShort(b.remaining)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {effectiveLinkMode === "CREATE_INVOICE" ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                    <Label className="text-xs">Nama pelanggan *</Label>
                    <Input
                      value={linkPartyName}
                      onChange={(e) => setLinkPartyName(e.target.value)}
                      placeholder="Cafe Senopati"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2 lg:col-span-4">
                    <Label className="text-xs">Email pelanggan</Label>
                    <Input
                      type="email"
                      value={linkPartyEmail}
                      onChange={(e) => setLinkPartyEmail(e.target.value)}
                      placeholder="finance@cafesenopati.id"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-xs">No. invoice</Label>
                    <Input
                      value={linkDocNumber}
                      onChange={(e) => setLinkDocNumber(e.target.value)}
                      placeholder="INV-2026-001"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1.5 lg:col-span-2">
                    <Label className="text-xs">Jatuh tempo *</Label>
                    <Input
                      type="date"
                      value={linkDueDate}
                      onChange={(e) => setLinkDueDate(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ) : null}

              {effectiveLinkMode === "RECEIVE_INVOICE" ? (
                <div className="space-y-1.5">
                  <Label className="text-xs">Invoice yang dilunasi *</Label>
                  <Select
                    value={linkInvoiceId || "__none__"}
                    items={openInvoiceItems}
                    onValueChange={(v) => {
                      const next = v ?? "";
                      setLinkInvoiceId(!next || next === "__none__" ? "" : next);
                    }}
                  >
                    <SelectTrigger className="h-8 w-full text-sm">
                      <span className="line-clamp-1">
                        {(() => {
                          const i = props.openInvoices.find(
                            (x) => x.id === linkInvoiceId,
                          );
                          if (!i) return "Pilih invoice terbuka";
                          return `${i.customerName} · ${i.invoiceNumber ?? "no#?"} · sisa ${formatIdrShort(i.remaining)}`;
                        })()}
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {props.openInvoices.length === 0 ? (
                        <SelectItem value="__none__">
                          Tidak ada invoice terbuka
                        </SelectItem>
                      ) : null}
                      {props.openInvoices.map((i) => (
                        <SelectItem key={i.id} value={i.id}>
                          {i.customerName} — {i.invoiceNumber ?? "no#?"} — sisa{" "}
                          {formatIdrShort(i.remaining)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              <p className="text-muted-foreground mt-3 text-xs">
                Saat baris ini di-posting, sistem akan otomatis{" "}
                {effectiveLinkMode === "CREATE_BILL"
                  ? "membuat tagihan baru di sub-ledger AP."
                  : effectiveLinkMode === "PAY_BILL"
                    ? "mencatat pembayaran ke tagihan yang dipilih."
                    : effectiveLinkMode === "CREATE_INVOICE"
                      ? "membuat invoice baru di sub-ledger AR."
                      : effectiveLinkMode === "RECEIVE_INVOICE"
                        ? "mencatat penerimaan ke invoice yang dipilih."
                        : "—"}
              </p>
              </div>
            ) : null}
          </form>
        ) : null}
      </section>

      <BalanceBar debit={totalDebit} credit={totalCredit} lineCount={props.lines.length}>
        {canPost ? (
          <>
            <Button
              type="button"
              size="sm"
              disabled={pending || !balanced}
              onClick={() => setConfirmPost(true)}
            >
              <Send className="size-3.5" aria-hidden /> Posting jurnal
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Aksi lain"
                disabled={pending}
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring/50 inline-flex size-8 items-center justify-center rounded-md outline-none focus-visible:ring-2 disabled:opacity-50"
              >
                <MoreHorizontal className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem variant="destructive" onClick={() => setConfirmDelete(true)}>
                  <Trash2 className="size-3.5" />
                  Hapus draf
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
        {canReverse ? <ReverseDialog entryId={props.entryId} /> : null}
      </BalanceBar>

      <Dialog open={confirmPost} onOpenChange={setConfirmPost}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Posting jurnal ini?</DialogTitle>
            <DialogDescription>
              Setelah diposting, jurnal masuk ke buku besar dan laporan. Koreksi
              hanya bisa lewat jurnal pembalik.
            </DialogDescription>
          </DialogHeader>
          <dl className="bg-muted/50 grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1.5 rounded-lg p-3 text-sm">
            <dt className="text-muted-foreground">Tanggal</dt>
            <dd className="text-foreground tabular-nums">
              {entryDateLabel.format(new Date(`${entryDate}T00:00:00Z`))}
            </dd>
            <dt className="text-muted-foreground">Baris</dt>
            <dd className="text-foreground tabular-nums">{props.lines.length}</dd>
            <dt className="text-muted-foreground">Total</dt>
            <dd className="text-foreground font-medium tabular-nums">
              {idr.format(totalDebit)}
            </dd>
          </dl>
          {headerDirty ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              Perubahan tanggal, referensi, atau memo belum disimpan dan tidak
              ikut diposting.
            </p>
          ) : null}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmPost(false)}>
              Batal
            </Button>
            <Button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirmPost(false);
                post();
              }}
            >
              Posting jurnal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Hapus draf ini?</DialogTitle>
            <DialogDescription>
              Semua baris ({props.lines.length}) dan lampirannya ikut terhapus.
              Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmDelete(false)}>
              Batal
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={pending}
              onClick={() => {
                setConfirmDelete(false);
                removeDraft();
              }}
            >
              Hapus draf
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReverseDialog({ entryId }: { entryId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [reversalDate, setReversalDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [memo, setMemo] = useState("");

  function run(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      try {
        const r = await reverseFinanceJournal({
          entryId,
          reversalDate: new Date(reversalDate),
          memo: memo || null,
        });
        toast.success(`Jurnal pembalik dibuat: ${r.entryNumber ?? r.id}`);
        setOpen(false);
        router.push(`/finance/journals/${r.id}`);
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membalik jurnal."));
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant="outline" size="sm" />}
      >
        <RotateCcw className="size-3.5" /> Balik jurnal
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Balik jurnal terposting</DialogTitle>
          <DialogDescription>
            Jurnal baru dibuat dengan debit dan kredit ditukar, sehingga efeknya
            batal tanpa menghapus jurnal ini dari riwayat.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={run} className="grid gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="rev-date">Tanggal pembalikan</Label>
            <Input
              id="rev-date"
              type="date"
              value={reversalDate}
              onChange={(e) => setReversalDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="rev-memo">Catatan</Label>
            <Input
              id="rev-memo"
              value={memo}
              placeholder="mis. Koreksi salah akun"
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Memproses…" : "Buat pembalik"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function modeLabel(mode: string): string {
  switch (mode) {
    case "CREATE_BILL":
      return "Buat tagihan baru";
    case "PAY_BILL":
      return "Lunasi tagihan yang ada";
    case "CREATE_INVOICE":
      return "Buat invoice baru";
    case "RECEIVE_INVOICE":
      return "Terima pembayaran invoice";
    default:
      return "Pilih mode link";
  }
}

const idr = new Intl.NumberFormat("id-ID", {
  style: "currency",
  currency: "IDR",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

// `entryDate` disimpan sebagai tanggal murni UTC.
const entryDateLabel = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/**
 * Bar keseimbangan sticky: total debit vs kredit, timbangan sederhana
 * (garis tengah = seimbang), dan aksi utama jurnal.
 */
function BalanceBar({
  debit,
  credit,
  lineCount,
  children,
}: {
  debit: number;
  credit: number;
  lineCount: number;
  children: React.ReactNode;
}) {
  const sum = debit + credit;
  const empty = sum === 0;
  const diff = Math.round((debit - credit) * 100) / 100;
  const balanced = !empty && diff === 0;
  const debitPct = empty ? 50 : (debit / sum) * 100;

  const status = empty
    ? lineCount === 0
      ? "Tambah baris debit dan kredit"
      : "Nilai baris masih nol"
    : balanced
      ? "Seimbang"
      : diff > 0
        ? `Kredit kurang ${idr.format(diff)}`
        : `Debit kurang ${idr.format(-diff)}`;

  return (
    <div className="border-border/60 bg-background/95 supports-backdrop-filter:bg-background/80 sticky bottom-0 z-10 -mx-2 border-t px-3 py-3 backdrop-blur sm:-mx-4 sm:px-4">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <dl className="flex items-center gap-4 text-sm">
          <div>
            <dt className="text-muted-foreground text-xs">Debit</dt>
            <dd className="text-foreground font-semibold tabular-nums">
              {idr.format(debit)}
            </dd>
          </div>
          <div
            role="img"
            aria-label={`Porsi debit ${debitPct.toFixed(0)}%, kredit ${(100 - debitPct).toFixed(0)}%`}
            className="relative hidden h-2 w-28 sm:block"
          >
            <div className="bg-muted absolute inset-0 overflow-hidden rounded-full">
              {!empty ? (
                <div
                  className={cn(
                    "absolute inset-y-0 left-0 rounded-full transition-[width] duration-300 motion-reduce:transition-none",
                    balanced ? "bg-emerald-500" : "bg-foreground/35",
                  )}
                  style={{ width: `${debitPct}%` }}
                />
              ) : null}
            </div>
            <span
              aria-hidden
              className="bg-foreground/60 absolute -top-1 left-1/2 h-4 w-px -translate-x-1/2"
            />
          </div>
          <div>
            <dt className="text-muted-foreground text-xs">Kredit</dt>
            <dd className="text-foreground font-semibold tabular-nums">
              {idr.format(credit)}
            </dd>
          </div>
        </dl>
        <p
          aria-live="polite"
          className={cn(
            "inline-flex items-center gap-1.5 text-sm font-medium",
            balanced
              ? "text-emerald-700 dark:text-emerald-400"
              : empty
                ? "text-muted-foreground"
                : "text-rose-700 dark:text-rose-400",
          )}
        >
          {balanced ? (
            <CheckCircle2 className="size-4" aria-hidden />
          ) : empty ? null : (
            <AlertTriangle className="size-4" aria-hidden />
          )}
          {status}
        </p>
        <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
      </div>
    </div>
  );
}
