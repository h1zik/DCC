"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Vendor } from "@prisma/client";
import type { ColumnDef } from "@tanstack/react-table";
import { Factory, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteVendor } from "@/actions/vendors";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DataTable } from "@/components/data-table";
import { InitialsAvatar } from "@/components/initials-avatar";
import { LogisticsFilterBar } from "@/components/logistics/logistics-filter-bar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { VendorFormDialog } from "./vendor-form-dialog";

type VendorRow = Vendor & {
  _count: { preferredByProducts: number; stockLogs: number };
};

export function VendorsClient({
  vendors,
  receipts30d,
}: {
  vendors: VendorRow[];
  receipts30d: Record<string, number>;
}) {
  const router = useRouter();
  const [search, setSearch] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Vendor | null>(null);
  const [formSession, setFormSession] = useState(0);

  const [deleteTarget, setDeleteTarget] = useState<VendorRow | null>(null);
  const [deletePending, setDeletePending] = useState(false);

  function openCreate() {
    setEditing(null);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  }

  function openEdit(v: Vendor) {
    setEditing(v);
    setFormSession((s) => s + 1);
    setFormOpen(true);
  }

  async function onConfirmDelete() {
    if (!deleteTarget) return;
    setDeletePending(true);
    try {
      await deleteVendor(deleteTarget.id);
      toast.success("Vendor dihapus.");
      setDeleteTarget(null);
      router.refresh();
    } catch {
      toast.error("Gagal menghapus vendor.");
    } finally {
      setDeletePending(false);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vendors;
    return vendors.filter((v) =>
      [v.name, v.picName, v.contact, v.specialty]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [vendors, search]);

  const columns = useMemo<ColumnDef<VendorRow>[]>(
    () => [
      {
        accessorKey: "name",
        header: "Vendor",
        cell: ({ row }) => (
          <div className="flex items-center gap-2.5">
            <InitialsAvatar
              name={row.original.name}
              seed={row.original.id}
              size="sm"
            />
            <div className="min-w-0">
              <p className="font-medium">{row.original.name}</p>
              {row.original.specialty ? (
                <p className="text-muted-foreground truncate text-xs">
                  {row.original.specialty}
                </p>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        id: "contact",
        header: "Kontak",
        cell: ({ row }) => {
          const contactLine =
            row.original.contact?.split(/\r?\n/)[0]?.trim() ?? "";
          if (!row.original.picName && !contactLine) {
            return <span className="text-muted-foreground">—</span>;
          }
          return (
            <div className="min-w-0">
              {row.original.picName ? (
                <p className="font-medium">{row.original.picName}</p>
              ) : null}
              {contactLine ? (
                <p
                  className="text-muted-foreground max-w-[220px] truncate text-xs"
                  title={row.original.contact ?? undefined}
                >
                  {contactLine}
                </p>
              ) : null}
            </div>
          );
        },
      },
      {
        accessorKey: "leadTimeDays",
        header: "Lead time",
        cell: ({ row }) =>
          row.original.leadTimeDays != null ? (
            <div>
              <p className="tabular-nums">{row.original.leadTimeDays} hari</p>
              <p className="text-muted-foreground text-[11px]">
                safety {row.original.safetyStockDays}h · review{" "}
                {row.original.reviewPeriodDays}h
              </p>
            </div>
          ) : (
            <Badge
              variant="outline"
              className="border-warning/40 bg-warning/10 text-warning"
            >
              Belum diset
            </Badge>
          ),
      },
      {
        id: "products",
        header: "SKU terhubung",
        cell: ({ row }) =>
          row.original._count.preferredByProducts > 0 ? (
            <Badge variant="outline">
              {row.original._count.preferredByProducts}
            </Badge>
          ) : (
            <span className="text-muted-foreground">—</span>
          ),
      },
      {
        id: "receipts",
        header: "Penerimaan",
        cell: ({ row }) => (
          <div>
            <p className="font-medium tabular-nums">
              {receipts30d[row.original.id] ?? 0}{" "}
              <span className="text-muted-foreground text-xs font-normal">
                / 30 hari
              </span>
            </p>
            <p className="text-muted-foreground text-[11px] tabular-nums">
              {row.original._count.stockLogs} log total
            </p>
          </div>
        ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <DropdownMenu>
            <DropdownMenuTrigger
              className={cn(
                buttonVariants({ variant: "ghost", size: "icon-sm" }),
                "size-8",
              )}
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => openEdit(row.original)}>
                <Pencil className="size-4" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem
                variant="destructive"
                onClick={() => setDeleteTarget(row.original)}
              >
                <Trash2 className="size-4" />
                Hapus
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
      },
    ],
    [receipts30d],
  );

  return (
    <div className="flex flex-col gap-4">
      <LogisticsFilterBar
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Cari vendor, PIC, spesialisasi…"
        right={
          <Button onClick={openCreate}>
            <Plus className="size-4" />
            Vendor baru
          </Button>
        }
      />

      {vendors.length === 0 ? (
        <EmptyState
          icon={Factory}
          title="Belum ada vendor"
          description="Tambahkan pabrik maklon pertama beserta parameter lead time untuk perencanaan PO."
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Vendor baru
            </Button>
          }
        />
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          empty="Tidak ada vendor yang cocok dengan pencarian."
          sortable
          viewportMaxHeight="calc(100dvh - 300px)"
          stickyHeader
        />
      )}

      <VendorFormDialog
        key={formSession}
        open={formOpen}
        onOpenChange={setFormOpen}
        editing={editing}
      />

      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
        title={`Hapus vendor "${deleteTarget?.name ?? ""}"?`}
        description={
          deleteTarget
            ? `Vendor "${deleteTarget.name}" terhubung ke ${deleteTarget._count.preferredByProducts} SKU dan ${deleteTarget._count.stockLogs} log penerimaan. Tindakan ini tidak bisa dibatalkan.`
            : undefined
        }
        confirmLabel="Hapus vendor"
        pending={deletePending}
        onConfirm={onConfirmDelete}
      />
    </div>
  );
}
