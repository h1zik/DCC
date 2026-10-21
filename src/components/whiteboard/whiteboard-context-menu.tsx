"use client";

import { useEffect, useRef } from "react";
import {
  ArrowDownToLine,
  ArrowUpToLine,
  ClipboardPaste,
  Copy,
  CopyPlus,
  Lock,
  Maximize,
  ScanSearch,
  StickyNote,
  Unlock,
  MousePointerSquareDashed,
  MoveDown,
  MoveUp,
  Trash2,
  Type,
} from "lucide-react";
import type { Point } from "@/lib/whiteboard/geometry";

/**
 * Menu klik-kanan kanvas. Ditulis sebagai panel absolut sederhana (bukan
 * dropdown Base UI) supaya bisa muncul persis di koordinat pointer.
 */

export type ContextMenuState = {
  screen: Point;
  world: Point;
  onElement: boolean;
};

export type ContextMenuAction =
  | "copy"
  | "paste"
  | "duplicate"
  | "delete"
  | "bring-front"
  | "send-back"
  | "bring-forward"
  | "send-backward"
  | "lock"
  | "select-all"
  | "zoom-fit"
  | "zoom-selection"
  | "unlock-all"
  | "add-sticky"
  | "edit-text";

export function WhiteboardContextMenu({
  state,
  hasSelection,
  multiple,
  locked,
  canEditText,
  canPaste,
  lockedCount,
  bounds,
  onClose,
  onAction,
}: {
  state: ContextMenuState;
  hasSelection: boolean;
  multiple: boolean;
  locked: boolean;
  canEditText: boolean;
  canPaste: boolean;
  /** Jumlah objek terkunci di papan — menampilkan "Buka semua kunci". */
  lockedCount: number;
  /** Ukuran kanvas; menu dijaga tetap di dalamnya. */
  bounds: { width: number; height: number };
  onClose: () => void;
  onAction: (action: ContextMenuAction) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Menu kanvas"
      className="border-border bg-popover text-popover-foreground animate-in fade-in-0 zoom-in-95 absolute z-50 w-52 rounded-xl border p-1 shadow-xl duration-100"
      style={{
        // Menu diposisikan relatif terhadap kanvas, jadi batasnya pun ukuran
        // kanvas — bukan jendela — agar tidak terpotong di tepi kanan/bawah.
        left: Math.max(4, Math.min(state.screen.x, bounds.width - 212)),
        top: Math.max(
          4,
          Math.min(state.screen.y, bounds.height - (hasSelection ? 330 : 170)),
        ),
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hasSelection ? (
        <>
          {!multiple && canEditText ? (
            <Item
              icon={Type}
              label="Edit teks"
              hint="Enter"
              onClick={() => onAction("edit-text")}
            />
          ) : null}
          <Item icon={Copy} label="Salin" hint="Ctrl+C" onClick={() => onAction("copy")} />
          <Item
            icon={CopyPlus}
            label="Duplikat"
            hint="Ctrl+D"
            onClick={() => onAction("duplicate")}
          />
          <Divider />
          <Item
            icon={ArrowUpToLine}
            label="Bawa ke depan"
            onClick={() => onAction("bring-front")}
          />
          <Item icon={MoveUp} label="Maju satu" onClick={() => onAction("bring-forward")} />
          <Item
            icon={MoveDown}
            label="Mundur satu"
            onClick={() => onAction("send-backward")}
          />
          <Item
            icon={ArrowDownToLine}
            label="Kirim ke belakang"
            onClick={() => onAction("send-back")}
          />
          <Divider />
          <Item
            icon={ScanSearch}
            label="Perbesar ke pilihan"
            hint="2"
            onClick={() => onAction("zoom-selection")}
          />
          <Item
            icon={locked ? Unlock : Lock}
            label={locked ? "Buka kunci" : "Kunci posisi"}
            onClick={() => onAction("lock")}
          />
          <Item
            icon={Trash2}
            label="Hapus"
            hint="Del"
            destructive
            onClick={() => onAction("delete")}
          />
        </>
      ) : (
        <>
          <Item
            icon={StickyNote}
            label="Sticky note di sini"
            onClick={() => onAction("add-sticky")}
          />
          {canPaste ? (
            <Item
              icon={ClipboardPaste}
              label="Tempel di sini"
              hint="Ctrl+V"
              onClick={() => onAction("paste")}
            />
          ) : null}
          <Item
            icon={MousePointerSquareDashed}
            label="Pilih semua"
            hint="Ctrl+A"
            onClick={() => onAction("select-all")}
          />
          <Item
            icon={Maximize}
            label="Muat seluruh papan"
            hint="1"
            onClick={() => onAction("zoom-fit")}
          />
          {lockedCount > 0 ? (
            <>
              <Divider />
              <Item
                icon={Unlock}
                label={`Buka semua kunci (${lockedCount})`}
                onClick={() => onAction("unlock-all")}
              />
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  hint,
  destructive = false,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  label: string;
  hint?: string;
  destructive?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={`hover:bg-accent focus-visible:bg-accent outline-none hover:text-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
        destructive ? "text-destructive hover:text-destructive" : ""
      }`}
    >
      <Icon className="size-3.5 shrink-0" aria-hidden />
      <span className="flex-1">{label}</span>
      {hint ? (
        <span className="text-muted-foreground text-[10px]">{hint}</span>
      ) : null}
    </button>
  );
}

function Divider() {
  return <div className="bg-border my-1 h-px" />;
}
