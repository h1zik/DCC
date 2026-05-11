"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useOptimistic,
  useRef,
  useState,
  useTransition,
} from "react";
import { toast } from "sonner";
import { RoomListColumnType } from "@prisma/client";
import {
  Calendar,
  CheckSquare,
  ExternalLink,
  Hash,
  Link as LinkIcon,
  List,
  Plus,
  Square,
  Trash2,
  Type,
} from "lucide-react";
import {
  addEmptyRoomListRow,
  addQuickRoomListColumn,
  deleteRoomListColumn,
  deleteRoomListRow,
  updateRoomListCell,
  upsertRoomListColumn,
} from "@/actions/room-view-list";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type Column = {
  id: string;
  key: string;
  label: string;
  type: RoomListColumnType;
  options: string[];
};

type Row = {
  id: string;
  data: Record<string, unknown>;
};

const COLUMN_TYPE_META: Record<
  RoomListColumnType,
  { label: string; icon: typeof Type }
> = {
  [RoomListColumnType.TEXT]: { label: "Teks", icon: Type },
  [RoomListColumnType.NUMBER]: { label: "Angka", icon: Hash },
  [RoomListColumnType.DATE]: { label: "Tanggal", icon: Calendar },
  [RoomListColumnType.CHECKBOX]: { label: "Centang", icon: CheckSquare },
  [RoomListColumnType.SELECT]: { label: "Pilihan", icon: List },
  [RoomListColumnType.URL]: { label: "Tautan", icon: LinkIcon },
};

function fmtDateForDisplay(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function toDateInputValue(value: unknown): string {
  if (!value) return "";
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Deteksi URL ringan untuk auto-link di sel teks (seperti Google Sheets).
 * Cocokkan pola yang umum: protokol (http/https), `www.`, atau bentuk domain
 * `kata.tld[/jalur]`. Sengaja agak konservatif agar kalimat biasa tidak salah
 * dideteksi sebagai link.
 */
const URL_PATTERN =
  /^(?:https?:\/\/|www\.)[^\s]+$|^[\w-]+(?:\.[\w-]+)+(?:\/[^\s]*)?$/i;

function isLikelyUrl(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 2048) return false;
  if (v.includes(" ")) return false;
  return URL_PATTERN.test(v);
}

/** Tambahkan prefix `https://` bila URL tidak punya protokol agar href valid. */
function normalizeHref(value: string): string {
  const v = value.trim();
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(v)) return v;
  return `https://${v}`;
}

/** Tampilan ringkas: host saja untuk URL panjang. */
function displayUrlLabel(value: string): string {
  const v = value.trim();
  try {
    const u = new URL(normalizeHref(v));
    const host = u.host.replace(/^www\./, "");
    const path = u.pathname && u.pathname !== "/" ? u.pathname : "";
    return path ? `${host}${path}` : host;
  } catch {
    return v;
  }
}

type OptimisticAction =
  | { type: "update_cell"; rowId: string; key: string; value: unknown }
  | { type: "delete_row"; rowId: string }
  | { type: "add_row"; row: Row };

function applyOptimistic(state: Row[], action: OptimisticAction): Row[] {
  switch (action.type) {
    case "update_cell":
      return state.map((r) => {
        if (r.id !== action.rowId) return r;
        if (
          action.value === null ||
          action.value === undefined ||
          action.value === ""
        ) {
          const next = { ...r.data };
          delete next[action.key];
          return { ...r, data: next };
        }
        return { ...r, data: { ...r.data, [action.key]: action.value } };
      });
    case "delete_row":
      return state.filter((r) => r.id !== action.rowId);
    case "add_row":
      return [...state, action.row];
    default:
      return state;
  }
}

export function ListViewClient({
  viewId,
  canManage,
  columns,
  rows: initialRows,
}: {
  viewId: string;
  canManage: boolean;
  columns: Column[];
  rows: Row[];
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  /**
   * Optimistic state: berlaku selama transition pending; auto-reset ke props
   * server saat data baru turun. Menghindari pola setState-in-effect.
   */
  const [rows, applyAction] = useOptimistic<Row[], OptimisticAction>(
    initialRows,
    applyOptimistic,
  );

  /** State edit sel: { rowId, key } yang sedang diedit. */
  const [editingCell, setEditingCell] = useState<{
    rowId: string;
    key: string;
  } | null>(null);
  const [editingHeader, setEditingHeader] = useState<string | null>(null);

  /** Dialog edit opsi untuk kolom SELECT. */
  const [selectOptionsDlg, setSelectOptionsDlg] = useState<{
    column: Column;
  } | null>(null);
  const [optionsDraft, setOptionsDraft] = useState("");

  const commitCell = useCallback(
    (rowId: string, key: string, value: unknown) => {
      startTransition(async () => {
        applyAction({ type: "update_cell", rowId, key, value });
        try {
          await updateRoomListCell({
            rowId,
            key,
            value:
              value === undefined || value === null
                ? null
                : (value as string | number | boolean),
          });
        } catch (err) {
          toast.error(
            err instanceof Error ? err.message : "Gagal menyimpan sel.",
          );
        } finally {
          router.refresh();
        }
      });
      setEditingCell(null);
    },
    [applyAction, router],
  );

  function onAddRow() {
    startTransition(async () => {
      try {
        const res = await addEmptyRoomListRow(viewId);
        applyAction({ type: "add_row", row: { id: res.id, data: {} } });
        if (columns[0]) {
          setEditingCell({ rowId: res.id, key: columns[0].key });
        }
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menambah baris.",
        );
      }
    });
  }

  function onAddColumn() {
    startTransition(async () => {
      try {
        await addQuickRoomListColumn({ viewId });
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menambah kolom.",
        );
      }
    });
  }

  function onRenameColumn(col: Column, nextLabel: string) {
    const trimmed = nextLabel.trim();
    if (!trimmed || trimmed === col.label) {
      setEditingHeader(null);
      return;
    }
    startTransition(async () => {
      try {
        await upsertRoomListColumn({
          id: col.id,
          viewId,
          label: trimmed,
          type: col.type,
          options: col.options,
        });
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal mengubah label.",
        );
      } finally {
        setEditingHeader(null);
      }
    });
  }

  function onChangeColumnType(col: Column, nextType: RoomListColumnType) {
    if (nextType === col.type) return;
    if (nextType === RoomListColumnType.SELECT && col.options.length === 0) {
      setSelectOptionsDlg({ column: { ...col, type: nextType } });
      setOptionsDraft("");
      return;
    }
    startTransition(async () => {
      try {
        await upsertRoomListColumn({
          id: col.id,
          viewId,
          label: col.label,
          type: nextType,
          options: col.options,
        });
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal mengubah tipe kolom.",
        );
      }
    });
  }

  function onSubmitSelectOptions(e: React.FormEvent) {
    e.preventDefault();
    if (!selectOptionsDlg) return;
    const opts = optionsDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (opts.length === 0) {
      toast.error("Tambahkan minimal satu opsi.");
      return;
    }
    const col = selectOptionsDlg.column;
    startTransition(async () => {
      try {
        await upsertRoomListColumn({
          id: col.id,
          viewId,
          label: col.label,
          type: RoomListColumnType.SELECT,
          options: opts,
        });
        setSelectOptionsDlg(null);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menyimpan opsi.",
        );
      }
    });
  }

  function onDeleteColumn(col: Column) {
    if (
      !confirm(
        `Hapus kolom “${col.label}”? Nilai pada kolom ini akan dihapus dari semua baris.`,
      )
    )
      return;
    startTransition(async () => {
      try {
        await deleteRoomListColumn(col.id);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menghapus kolom.",
        );
      }
    });
  }

  function onDeleteRow(row: Row) {
    if (!confirm("Hapus baris ini?")) return;
    startTransition(async () => {
      applyAction({ type: "delete_row", rowId: row.id });
      try {
        await deleteRoomListRow(row.id);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Gagal menghapus baris.",
        );
        router.refresh();
      }
    });
  }

  const hasColumns = columns.length > 0;
  const hasRows = rows.length > 0;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-muted-foreground text-sm">
          {rows.length} baris · {columns.length} kolom
        </p>
        <p className="text-muted-foreground hidden text-xs sm:block">
          Klik sel untuk mengedit · Enter untuk simpan · Esc untuk batal
        </p>
      </div>

      {!hasColumns ? (
        <Card>
          <CardContent className="text-muted-foreground flex flex-col items-center gap-3 py-10 text-center text-sm">
            <List
              className="text-muted-foreground/60 size-8"
              aria-hidden
            />
            <p>
              Belum ada kolom.
              {canManage
                ? " Tambah kolom pertama untuk mulai menyusun list."
                : " Hubungi manager ruangan untuk menambah kolom."}
            </p>
            {canManage ? (
              <Button
                type="button"
                size="sm"
                onClick={onAddColumn}
                className="gap-1.5"
              >
                <Plus className="size-3.5" aria-hidden />
                Tambah kolom
              </Button>
            ) : null}
          </CardContent>
        </Card>
      ) : (
        <div className="border-border bg-card overflow-x-auto rounded-xl border">
          <table className="w-full min-w-max border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-xs uppercase tracking-wider">
                {columns.map((c) => {
                  const TypeIcon = COLUMN_TYPE_META[c.type].icon;
                  return (
                    <th
                      key={c.id}
                      className="border-border border-b px-0 py-0 text-left font-medium"
                    >
                      <div className="group flex min-h-9 items-center gap-1 px-2">
                        <TypeIcon
                          className="text-muted-foreground/70 size-3 shrink-0"
                          aria-hidden
                        />
                        {editingHeader === c.id ? (
                          <input
                            type="text"
                            defaultValue={c.label}
                            autoFocus
                            maxLength={80}
                            onBlur={(e) => onRenameColumn(c, e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                onRenameColumn(c, e.currentTarget.value);
                              } else if (e.key === "Escape") {
                                setEditingHeader(null);
                              }
                            }}
                            className="bg-background text-foreground min-w-0 flex-1 rounded px-1.5 py-0.5 text-xs uppercase tracking-wider outline-none ring-2 ring-primary/40"
                          />
                        ) : (
                          <button
                            type="button"
                            disabled={!canManage}
                            onClick={() =>
                              canManage ? setEditingHeader(c.id) : null
                            }
                            className={cn(
                              "min-w-0 flex-1 truncate text-left",
                              canManage && "hover:text-foreground cursor-text",
                            )}
                            title={canManage ? "Klik untuk ubah nama" : c.label}
                          >
                            {c.label}
                          </button>
                        )}
                        {canManage ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger
                              render={
                                <button
                                  type="button"
                                  className="hover:text-foreground text-muted-foreground/70 ml-0.5 rounded px-1 py-0.5 text-[10px] opacity-0 transition-opacity group-hover:opacity-100 focus:opacity-100"
                                  aria-label={`Atur kolom ${c.label}`}
                                >
                                  ⋯
                                </button>
                              }
                            />
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Tipe kolom</DropdownMenuLabel>
                              <DropdownMenuRadioGroup
                                value={c.type}
                                onValueChange={(v) =>
                                  onChangeColumnType(
                                    c,
                                    v as RoomListColumnType,
                                  )
                                }
                              >
                                {(Object.keys(COLUMN_TYPE_META) as RoomListColumnType[]).map(
                                  (t) => {
                                    const Meta = COLUMN_TYPE_META[t];
                                    const TIcon = Meta.icon;
                                    return (
                                      <DropdownMenuRadioItem key={t} value={t}>
                                        <TIcon
                                          className="size-3.5"
                                          aria-hidden
                                        />
                                        {Meta.label}
                                      </DropdownMenuRadioItem>
                                    );
                                  },
                                )}
                              </DropdownMenuRadioGroup>
                              {c.type === RoomListColumnType.SELECT ? (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setSelectOptionsDlg({ column: c });
                                      setOptionsDraft(c.options.join(", "));
                                    }}
                                  >
                                    Atur opsi pilihan…
                                  </DropdownMenuItem>
                                </>
                              ) : null}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => onDeleteColumn(c)}
                              >
                                <Trash2 className="size-3.5" aria-hidden />
                                Hapus kolom
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : null}
                      </div>
                    </th>
                  );
                })}
                {canManage ? (
                  <th
                    className="border-border w-9 border-b px-0 py-0"
                    aria-label="Tambah kolom"
                  >
                    <button
                      type="button"
                      onClick={onAddColumn}
                      className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-9 w-full items-center justify-center"
                      title="Tambah kolom"
                    >
                      <Plus className="size-3.5" aria-hidden />
                    </button>
                  </th>
                ) : (
                  <th
                    className="border-border w-2 border-b px-0 py-0"
                    aria-hidden
                  />
                )}
              </tr>
            </thead>
            <tbody>
              {hasRows ? (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    {columns.map((c) => (
                      <Cell
                        key={c.id}
                        column={c}
                        row={r}
                        editing={
                          editingCell?.rowId === r.id &&
                          editingCell.key === c.key
                        }
                        onStartEdit={() =>
                          setEditingCell({ rowId: r.id, key: c.key })
                        }
                        onCancel={() => setEditingCell(null)}
                        onCommit={(value) => commitCell(r.id, c.key, value)}
                        onToggle={(value) => commitCell(r.id, c.key, value)}
                      />
                    ))}
                    <td className="border-border border-b px-0 py-0 text-right align-middle">
                      <button
                        type="button"
                        onClick={() => onDeleteRow(r)}
                        className="text-muted-foreground/60 hover:text-destructive flex h-9 w-9 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label="Hapus baris"
                        title="Hapus baris"
                      >
                        <Trash2 className="size-3.5" aria-hidden />
                      </button>
                    </td>
                  </tr>
                ))
              ) : null}
              <tr>
                <td
                  colSpan={columns.length + 1}
                  className="border-border border-b p-0"
                >
                  <button
                    type="button"
                    onClick={onAddRow}
                    className="text-muted-foreground hover:bg-muted/40 hover:text-foreground flex w-full items-center gap-1.5 px-3 py-2 text-left text-xs"
                  >
                    <Plus className="size-3.5" aria-hidden />
                    Tambah baris
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <Dialog
        open={!!selectOptionsDlg}
        onOpenChange={(o) => {
          if (!o) setSelectOptionsDlg(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Atur opsi pilihan</DialogTitle>
          </DialogHeader>
          <form onSubmit={onSubmitSelectOptions} className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="select-options">
                Pisahkan opsi dengan koma
              </Label>
              <Input
                id="select-options"
                value={optionsDraft}
                onChange={(e) => setOptionsDraft(e.target.value)}
                placeholder="Mis. Rendah, Sedang, Tinggi"
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button type="submit">Simpan</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ----------------------------- Cell component ----------------------------- */

function Cell({
  column,
  row,
  editing,
  onStartEdit,
  onCancel,
  onCommit,
  onToggle,
}: {
  column: Column;
  row: Row;
  editing: boolean;
  onStartEdit: () => void;
  onCancel: () => void;
  onCommit: (value: unknown) => void;
  onToggle: (value: unknown) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);
  const rawValue = row.data[column.key];

  useEffect(() => {
    if (editing) {
      const node = inputRef.current ?? selectRef.current;
      if (node) {
        node.focus();
        if (
          node instanceof HTMLInputElement &&
          (column.type === RoomListColumnType.TEXT ||
            column.type === RoomListColumnType.URL ||
            column.type === RoomListColumnType.NUMBER)
        ) {
          node.select();
        }
      }
    }
  }, [editing, column.type]);

  // CHECKBOX selalu interaktif (klik = toggle, tanpa mode edit).
  if (column.type === RoomListColumnType.CHECKBOX) {
    const checked = Boolean(rawValue);
    return (
      <td className="border-border border-b px-2 py-1 align-middle">
        <button
          type="button"
          onClick={() => onToggle(!checked)}
          className="hover:text-primary text-muted-foreground inline-flex items-center"
          aria-label={`Centang ${column.label}`}
        >
          {checked ? (
            <CheckSquare className="text-primary size-4" aria-hidden />
          ) : (
            <Square className="size-4" aria-hidden />
          )}
        </button>
      </td>
    );
  }

  if (editing) {
    if (column.type === RoomListColumnType.SELECT) {
      return (
        <td className="border-border border-b px-1 py-0.5 align-middle">
          <select
            ref={selectRef}
            defaultValue={rawValue ? String(rawValue) : ""}
            onBlur={(e) => onCommit(e.target.value || null)}
            onChange={(e) => onCommit(e.target.value || null)}
            onKeyDown={(e) => {
              if (e.key === "Escape") onCancel();
            }}
            className="bg-background text-foreground w-full min-w-[120px] rounded px-1 py-1 text-sm outline-none ring-2 ring-primary/40"
          >
            <option value="">—</option>
            {column.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </td>
      );
    }

    const inputType =
      column.type === RoomListColumnType.NUMBER
        ? "number"
        : column.type === RoomListColumnType.DATE
          ? "date"
          : column.type === RoomListColumnType.URL
            ? "url"
            : "text";

    const initialValue =
      column.type === RoomListColumnType.DATE
        ? toDateInputValue(rawValue)
        : rawValue == null
          ? ""
          : String(rawValue);

    return (
      <td className="border-border border-b px-1 py-0.5 align-middle">
        <input
          ref={inputRef}
          type={inputType}
          defaultValue={initialValue}
          onBlur={(e) => {
            const v = e.target.value;
            if (column.type === RoomListColumnType.NUMBER) {
              if (v === "") onCommit(null);
              else {
                const n = Number(v);
                onCommit(Number.isFinite(n) ? n : null);
              }
            } else {
              onCommit(v || null);
            }
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.currentTarget.blur();
            } else if (e.key === "Escape") {
              onCancel();
            }
          }}
          className="bg-background text-foreground w-full min-w-[120px] rounded px-1.5 py-1 text-sm outline-none ring-2 ring-primary/40"
        />
      </td>
    );
  }

  // View mode
  const display = (() => {
    if (rawValue == null || rawValue === "") return null;
    switch (column.type) {
      case RoomListColumnType.DATE:
        return fmtDateForDisplay(rawValue);
      case RoomListColumnType.URL: {
        const v = String(rawValue);
        return (
          <a
            href={normalizeHref(v)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-primary hover:underline inline-flex items-center gap-1"
            title={v}
          >
            <ExternalLink className="size-3" aria-hidden />
            <span className="truncate">{displayUrlLabel(v)}</span>
          </a>
        );
      }
      case RoomListColumnType.SELECT:
        return (
          <span className="border-border bg-muted/60 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[11px] font-medium">
            {String(rawValue)}
          </span>
        );
      case RoomListColumnType.TEXT: {
        const v = String(rawValue);
        if (isLikelyUrl(v)) {
          return (
            <a
              href={normalizeHref(v)}
              target="_blank"
              rel="noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="text-primary hover:underline inline-flex items-center gap-1"
              title={v}
            >
              <ExternalLink className="size-3" aria-hidden />
              <span className="truncate">{displayUrlLabel(v)}</span>
            </a>
          );
        }
        return v;
      }
      default:
        return String(rawValue);
    }
  })();

  return (
    <td
      onClick={onStartEdit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " " || e.key === "F2") {
          e.preventDefault();
          onStartEdit();
        }
      }}
      role="button"
      tabIndex={0}
      className={cn(
        "border-border min-w-[120px] cursor-text border-b px-2 py-1 align-middle text-sm",
        "hover:bg-muted/30 focus:bg-muted/50 outline-none",
      )}
    >
      {display ?? (
        <span className="text-muted-foreground/50 text-xs italic">
          {column.type === RoomListColumnType.URL ? "https://…" : "—"}
        </span>
      )}
    </td>
  );
}
