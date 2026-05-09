"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Lock,
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
import { BalancePill } from "@/components/finance/balance-pill";
import {
  LineAttachmentControl,
  type LineAttachmentItem,
} from "@/components/finance/line-attachment-control";
import { Money } from "@/components/finance/money";
import { FinanceSectionCard } from "@/components/finance/section-card";
import { FinanceEmptyState } from "@/components/finance/empty-state";
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

  // Real-time totals & balance check
  const { totalDebit, totalCredit } = useMemo(() => {
    let d = 0;
    let c = 0;
    for (const line of props.lines) {
      d += Number(line.debitBase);
      c += Number(line.creditBase);
    }
    return { totalDebit: d, totalCredit: c };
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
        toast.error(e instanceof Error ? e.message : "Gagal menyimpan.");
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
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Gagal menambah baris.");
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
        toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
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
        toast.error(e instanceof Error ? e.message : "Posting gagal.");
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
        toast.error(e instanceof Error ? e.message : "Gagal menghapus.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Banner: locked / reversed-by / reverses-entry */}
      <div className="flex flex-col gap-2">
        {isLocked ? (
          <Banner tone="amber" icon={<Lock className="size-4" />}>
            <strong>Periode terkunci.</strong> {props.periodLockedReason}
          </Banner>
        ) : null}
        {props.reversedBy ? (
          <Banner tone="rose" icon={<RotateCcw className="size-4" />}>
            <strong>Sudah dibalik</strong> oleh{" "}
            <Link
              href={`/finance/journals/${props.reversedBy.id}`}
              className="font-medium underline underline-offset-2"
            >
              {props.reversedBy.entryNumber ?? "jurnal pembalik"}
            </Link>
            .
          </Banner>
        ) : null}
        {props.reversesEntry ? (
          <Banner tone="violet" icon={<RotateCcw className="size-4" />}>
            Jurnal pembalik untuk{" "}
            <Link
              href={`/finance/journals/${props.reversesEntry.id}`}
              className="font-medium underline underline-offset-2"
            >
              {props.reversesEntry.entryNumber ?? "jurnal sumber"}
            </Link>
            .
          </Banner>
        ) : null}
      </div>

      {/* Header card */}
      <FinanceSectionCard
        title="Identitas jurnal"
        accent="violet"
        right={
          <span className="text-muted-foreground inline-flex items-center gap-1.5 text-xs">
            {isPosted ? (
              <>
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                <span>POSTED</span>
              </>
            ) : (
              <>
                <span className="size-1.5 rounded-full bg-amber-500" />
                <span>DRAFT</span>
              </>
            )}
            {props.entryNumber ? (
              <span className="font-mono">· {props.entryNumber}</span>
            ) : null}
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="jd">Tanggal</Label>
            <Input
              id="jd"
              type="date"
              value={entryDate}
              disabled={!canEdit}
              onChange={(e) => setEntryDate(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="jr">Referensi (opsional)</Label>
            <Input
              id="jr"
              value={reference}
              disabled={!canEdit}
              placeholder="mis. INV-2026-001"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="jm">Memo</Label>
            <Input
              id="jm"
              value={memo}
              disabled={!canEdit}
              placeholder="Keterangan singkat"
              onChange={(e) => setMemo(e.target.value)}
            />
          </div>
          {canEdit ? (
            <div className="sm:col-span-2">
              <Button type="button" size="sm" disabled={pending} onClick={saveHeader}>
                Simpan header
              </Button>
            </div>
          ) : null}
        </div>
      </FinanceSectionCard>

      {/* Lines table */}
      <FinanceSectionCard
        title="Baris jurnal"
        accent={
          totalDebit === totalCredit && totalDebit > 0
            ? "emerald"
            : props.lines.length === 0
              ? "neutral"
              : "rose"
        }
        description="Setiap baris hanya boleh berisi nominal di salah satu kolom (debit ATAU kredit)."
        right={<BalancePill debit={totalDebit} credit={totalCredit} />}
      >
        {props.lines.length === 0 ? (
          <FinanceEmptyState
            icon={<AlertTriangle className="size-5" />}
            title="Belum ada baris"
            description="Tambah minimal dua baris (debit & kredit) sebelum memposting jurnal."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Akun</TableHead>
                  <TableHead className="w-32 text-right">Debit</TableHead>
                  <TableHead className="w-32 text-right">Kredit</TableHead>
                  <TableHead>Brand</TableHead>
                  <TableHead>Memo</TableHead>
                  <TableHead className="w-12 text-center">Bukti</TableHead>
                  {canEdit ? <TableHead className="w-12" /> : null}
                </TableRow>
              </TableHeader>
              <TableBody>
                {props.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm">
                      <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground font-mono text-xs">
                          {line.account.code}
                        </span>{" "}
                        <span>{line.account.name}</span>
                        {line.link ? (
                          <span
                            className="rounded-full bg-violet-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300"
                            title={modeLabel(line.link.mode)}
                          >
                            {line.link.mode === "CREATE_BILL" ||
                            line.link.mode === "PAY_BILL"
                              ? "AP"
                              : "AR"}
                          </span>
                        ) : null}
                      </div>
                      {line.link?.partyName ? (
                        <p className="text-muted-foreground text-[11px]">
                          {line.link.partyName}
                          {line.link.docNumber ? ` · ${line.link.docNumber}` : ""}
                        </p>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <Money value={line.debitBase} zeroAsDash />
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      <Money value={line.creditBase} zeroAsDash />
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {line.brand?.name ?? "—"}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground line-clamp-1">
                      {line.memo ?? "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <LineAttachmentControl
                        lineId={line.id}
                        attachments={line.attachments}
                        canEdit={canEdit}
                      />
                    </TableCell>
                    {canEdit ? (
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Hapus baris"
                          disabled={pending}
                          onClick={() => removeLine(line.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </TableCell>
                    ) : null}
                  </TableRow>
                ))}
                <TableRow className="bg-muted/30 border-t-2 border-foreground/30">
                  <TableCell className="text-xs font-semibold uppercase">
                    Total
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold">
                    <Money value={totalDebit} />
                  </TableCell>
                  <TableCell className="text-right text-sm font-bold">
                    <Money value={totalCredit} />
                  </TableCell>
                  <TableCell colSpan={canEdit ? 4 : 3} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        )}
      </FinanceSectionCard>

      {/* Add-line panel */}
      {canEdit ? (
        <FinanceSectionCard
          title="Tambah baris"
          accent="sky"
          description="Pilih akun, isi salah satu kolom debit/kredit, lalu Tambahkan."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-12">
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-5">
              <Label>Akun</Label>
              <Select
                value={safeAccountId}
                onValueChange={(v) =>
                  setAccountId(!v || v === "__none__" ? "" : v)
                }
              >
                <SelectTrigger className="w-full">
                  <span className="line-clamp-1">
                    {safeAccountId === "__none__"
                      ? "Pilih akun"
                      : (() => {
                          const a = props.accounts.find(
                            (x) => x.id === safeAccountId,
                          );
                          return a ? `${a.code} — ${a.name}` : "Pilih akun";
                        })()}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  {props.accounts.length === 0 ? (
                    <SelectItem value="__none__">Belum ada akun</SelectItem>
                  ) : null}
                  {props.accounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Debit (IDR)</Label>
              <Input
                value={debit}
                onChange={(e) => {
                  setDebit(e.target.value);
                  if (e.target.value) setCredit("");
                }}
                placeholder="0"
                className={cn("text-right tabular-nums", debit && "bg-emerald-500/5")}
              />
            </div>
            <div className="space-y-1.5 lg:col-span-2">
              <Label>Kredit (IDR)</Label>
              <Input
                value={credit}
                onChange={(e) => {
                  setCredit(e.target.value);
                  if (e.target.value) setDebit("");
                }}
                placeholder="0"
                className={cn("text-right tabular-nums", credit && "bg-rose-500/5")}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label>Brand (opsional)</Label>
              <Select
                value={safeBrandId}
                onValueChange={(v) => setBrandId(!v || v === "__none__" ? "" : v)}
              >
                <SelectTrigger className="w-full">
                  <span className="line-clamp-1">
                    {safeBrandId === "__none__"
                      ? "Tanpa tag"
                      : props.brands.find((b) => b.id === safeBrandId)?.name ??
                        "Tanpa tag"}
                  </span>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Tanpa tag brand</SelectItem>
                  {props.brands.map((b) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-9">
              <Label>Memo baris (opsional)</Label>
              <Input value={lineMemo} onChange={(e) => setLineMemo(e.target.value)} />
            </div>
            <div className="flex items-end sm:col-span-2 lg:col-span-3">
              <Button
                type="button"
                disabled={
                  pending ||
                  !accountId ||
                  safeAccountId === "__none__" ||
                  (!debit && !credit)
                }
                onClick={addLine}
                className="w-full"
              >
                Tambahkan baris
              </Button>
            </div>
          </div>

          {/* Dynamic AP/AR sub-form */}
          {showLinkPanel ? (
            <div className="border-violet-500/30 bg-violet-500/5 mt-4 rounded-lg border p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                  {isApAccount ? "Hutang usaha (AP)" : "Piutang usaha (AR)"}
                </span>
                <Select
                  value={effectiveLinkMode}
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
                        Lunasi tagihan existing
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

              <p className="text-muted-foreground mt-2 text-[11px]">
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
        </FinanceSectionCard>
      ) : null}

      {/* Action footer */}
      <div className="border-border/60 sticky bottom-0 z-10 -mx-2 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 p-3 backdrop-blur supports-backdrop-filter:bg-background/70 sm:-mx-4 sm:px-4">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          nativeButton={false}
          render={<Link href="/finance/journals" />}
        >
          <ArrowLeft className="size-3.5" /> Daftar jurnal
        </Button>
        <div className="flex flex-wrap items-center gap-2">
          {canPost ? (
            <Button
              type="button"
              size="sm"
              disabled={pending || totalDebit === 0 || totalDebit !== totalCredit}
              onClick={post}
            >
              <Send className="size-3.5" /> Posting jurnal
            </Button>
          ) : null}
          {canEdit ? (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              disabled={pending}
              onClick={removeDraft}
            >
              <Trash2 className="size-3.5" /> Hapus draf
            </Button>
          ) : null}
          {canReverse ? <ReverseDialog entryId={props.entryId} /> : null}
        </div>
      </div>
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
        toast.error(err instanceof Error ? err.message : "Gagal membalik jurnal.");
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
            Best practice akuntansi: jangan edit/hapus jurnal terposting. Jurnal
            pembalik baru akan dibuat dengan menukar debit ↔ kredit, sehingga
            audit trail tetap utuh.
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
      return "Lunasi tagihan existing";
    case "CREATE_INVOICE":
      return "Buat invoice baru";
    case "RECEIVE_INVOICE":
      return "Terima pembayaran invoice";
    default:
      return "Pilih mode link";
  }
}

function Banner({
  tone,
  icon,
  children,
}: {
  tone: "amber" | "rose" | "violet";
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  const toneClass: Record<typeof tone, string> = {
    amber:
      "border-amber-500/35 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    rose: "border-rose-500/35 bg-rose-500/10 text-rose-700 dark:text-rose-300",
    violet:
      "border-violet-500/35 bg-violet-500/10 text-violet-700 dark:text-violet-300",
  };
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs",
        toneClass[tone],
      )}
    >
      <span aria-hidden>{icon}</span>
      <span>{children}</span>
    </div>
  );
}
