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
  | "edit-text";

export function WhiteboardContextMenu({
  state,
  hasSelection,
  multiple,
  locked,
  canPaste,
  onClose,
  onAction,
}: {
  state: ContextMenuState;
  hasSelection: boolean;
  multiple: boolean;
  locked: boolean;
  canPaste: boolean;
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
      className="border-border bg-popover text-popover-foreground absolute z-50 min-w-48 rounded-lg border p-1 shadow-xl"
      style={{
        // Jaga menu tetap di dalam layar saat diklik dekat tepi kanan/bawah.
        left: Math.min(state.screen.x, window.innerWidth - 220),
        top: Math.min(state.screen.y, window.innerHeight - 340),
      }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {hasSelection ? (
        <>
          {!multiple ? (
            <Item icon={Type} label="Edit teks" onClick={() => onAction("edit-text")} />
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
            icon={Lock}
            label={locked ? "Buka kunci" : "Kunci"}
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
      onClick={onClick}
      className={`hover:bg-accent hover:text-accent-foreground flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition-colors ${
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
