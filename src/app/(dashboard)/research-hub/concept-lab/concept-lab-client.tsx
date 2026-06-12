"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { FlaskConical, Plus, Trash2 } from "lucide-react";
import {
  ProductConceptMode,
  ProductConceptStatus,
} from "@prisma/client";
import { toast } from "sonner";
import {
  createProductConcept,
  deleteProductConcept,
} from "@/actions/research-concept-lab";
import { actionErrorMessage } from "@/lib/action-error-message";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
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
import {
  PRODUCT_CONCEPT_MODE_LABELS,
  PRODUCT_CONCEPT_STATUS_LABELS,
} from "@/lib/research/labels";
import { cn } from "@/lib/utils";

export type ConceptRow = {
  id: string;
  title: string;
  category: string;
  mode: ProductConceptMode;
  status: ProductConceptStatus;
  overallScore: number | null;
  createdAt: string;
};

function statusTone(status: ProductConceptStatus) {
  switch (status) {
    case "READY":
      return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300";
    case "ARCHIVED":
      return "bg-muted text-muted-foreground";
    case "VALIDATING":
      return "bg-amber-500/15 text-amber-700 dark:text-amber-300";
    default:
      return "bg-muted text-muted-foreground";
  }
}

export function ConceptLabClient({ concepts }: { concepts: ConceptRow[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mode, setMode] = useState<ProductConceptMode>(
    ProductConceptMode.AI_GENERATED,
  );
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [showArchived, setShowArchived] = useState(false);

  const hasInProgress = concepts.some((c) => c.status === "VALIDATING");

  useEffect(() => {
    if (!hasInProgress) return;
    const id = window.setInterval(() => router.refresh(), 12_000);
    return () => window.clearInterval(id);
  }, [hasInProgress, router]);

  const filtered = showArchived
    ? concepts
    : concepts.filter((c) => c.status !== "ARCHIVED");

  function handleCreate() {
    if (!title.trim() || !category.trim()) {
      toast.error("Isi judul dan kategori.");
      return;
    }
    startTransition(async () => {
      try {
        const result = await createProductConcept({
          mode,
          title,
          category,
          targetMarket: targetMarket || undefined,
          priceTargetMin: priceMin ? Number(priceMin) : undefined,
          priceTargetMax: priceMax ? Number(priceMax) : undefined,
        });
        toast.success(
          mode === ProductConceptMode.AI_GENERATED
            ? "Konsep AI sedang dibuat."
            : "Konsep draft dibuat.",
        );
        setDialogOpen(false);
        router.push(`/research-hub/concept-lab/${result.id}`);
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal membuat konsep."));
      }
    });
  }

  function handleDelete(id: string) {
    startTransition(async () => {
      try {
        await deleteProductConcept(id);
        toast.success("Konsep dihapus.");
        router.refresh();
      } catch (err) {
        toast.error(actionErrorMessage(err, "Gagal menghapus."));
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={showArchived}
            onCheckedChange={(v) => setShowArchived(!!v)}
          />
          Tampilkan arsip
        </label>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger
            render={
              <Button size="sm">
                <Plus className="mr-1.5 size-4" />
                Konsep Baru
              </Button>
            }
          />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Konsep Produk Baru</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-2">
                <Label>Mode</Label>
                <Select
                  value={mode}
                  onValueChange={(v) => v && setMode(v as ProductConceptMode)}
                >
                  <SelectTrigger />
                  <SelectContent>
                    <SelectItem value={ProductConceptMode.AI_GENERATED}>
                      AI Generate
                    </SelectItem>
                    <SelectItem value={ProductConceptMode.MANUAL}>
                      Manual
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Judul konsep</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Input
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="body serum brightening"
                />
              </div>
              <div className="space-y-2">
                <Label>Target market</Label>
                <Input
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label>Harga min</Label>
                  <Input
                    type="number"
                    value={priceMin}
                    onChange={(e) => setPriceMin(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Harga max</Label>
                  <Input
                    type="number"
                    value={priceMax}
                    onChange={(e) => setPriceMax(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button onClick={handleCreate} disabled={pending}>
                {mode === ProductConceptMode.AI_GENERATED
                  ? "Generate"
                  : "Buat Draft"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="border-border/60 overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Konsep</TableHead>
              <TableHead>Mode</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Score</TableHead>
              <TableHead className="text-right">Aksi</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                  <FlaskConical className="mx-auto mb-2 size-8 opacity-40" />
                  Belum ada konsep produk.
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((c) => (
                <TableRow key={c.id}>
                  <TableCell>
                    <Link
                      href={`/research-hub/concept-lab/${c.id}`}
                      className="font-medium hover:underline"
                    >
                      {c.title}
                    </Link>
                    <p className="text-muted-foreground text-xs">{c.category}</p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {PRODUCT_CONCEPT_MODE_LABELS[c.mode]}
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase",
                        statusTone(c.status),
                      )}
                    >
                      {PRODUCT_CONCEPT_STATUS_LABELS[c.status]}
                    </span>
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {c.overallScore != null ? Math.round(c.overallScore) : "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-8 text-rose-600"
                      disabled={pending}
                      onClick={() => handleDelete(c.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
