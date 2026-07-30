"use client";

import { RoomWhiteboardElementType } from "@prisma/client";
import {
  AlignCenter,
  AlignEndHorizontal,
  AlignHorizontalSpaceAround,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignVerticalSpaceAround,
  ArrowDownToLine,
  ArrowUpToLine,
  Bold,
  Copy,
  FlipHorizontal,
  Italic,
  Lock,
  MoveDown,
  MoveUp,
  Trash2,
  Underline,
  Unlock,
} from "lucide-react";
import {
  PALETTE_ORDER,
  paletteEntry,
  STICKY_PALETTE,
} from "@/lib/whiteboard/palette";
import {
  CLOSED_SHAPE_TYPES,
  LINEAR_TYPES,
  TEXT_CAPABLE_TYPES,
  WHITEBOARD_ARROWHEADS,
  WHITEBOARD_CONNECTOR_SHAPES,
  WHITEBOARD_FILL_STYLES,
  WHITEBOARD_FONT_FAMILIES,
  WHITEBOARD_STROKE_STYLES,
  WHITEBOARD_STROKE_WIDTHS,
  WHITEBOARD_TEXT_ALIGNS,
  type WhiteboardColorToken,
  type WhiteboardElement,
  type WhiteboardProps,
} from "@/lib/whiteboard/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Slider } from "@/components/ui/slider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

/**
 * Panel gaya kontekstual.
 *
 * Isinya menyesuaikan tipe objek yang sedang dipilih — memilih sticky
 * memunculkan warna kertas & teks, memilih panah memunculkan pilihan ujung
 * panah, dan seterusnya. Untuk seleksi campuran, hanya kontrol yang berlaku
 * untuk semuanya yang ditampilkan.
 */

type Reorder = "front" | "back" | "forward" | "backward";
type Align =
  | "left"
  | "center-x"
  | "right"
  | "top"
  | "center-y"
  | "bottom"
  | "distribute-x"
  | "distribute-y";

export function WhiteboardStylePanel({
  elements,
  dark,
  onChange,
  onReorder,
  onAlign,
  onDuplicate,
  onDelete,
  onToggleLock,
}: {
  elements: WhiteboardElement[];
  dark: boolean;
  onChange: (props: WhiteboardProps, coalesceKey?: string) => void;
  onReorder: (direction: Reorder) => void;
  onAlign: (mode: Align) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onToggleLock: () => void;
}) {
  const types = new Set(elements.map((el) => el.type));
  const first = elements[0]!;
  const props = first.props;

  const hasSticky = types.has(RoomWhiteboardElementType.STICKY);
  const hasClosed = [...types].some((t) => CLOSED_SHAPE_TYPES.has(t));
  const hasLinear = [...types].some((t) => LINEAR_TYPES.has(t));
  const hasDraw = types.has(RoomWhiteboardElementType.DRAW);
  const hasText = [...types].some((t) => TEXT_CAPABLE_TYPES.has(t));
  const hasConnector = types.has(RoomWhiteboardElementType.CONNECTOR);
  const hasImage = types.has(RoomWhiteboardElementType.IMAGE);
  const locked = elements.some((el) => el.locked);

  const showFill = hasSticky || hasClosed;
  const showStroke = hasClosed || hasLinear || hasDraw;

  return (
    <div className="border-border bg-card/95 flex w-60 flex-col gap-3 rounded-xl border p-3 shadow-lg backdrop-blur">
      <div className="text-muted-foreground flex items-center justify-between text-[11px] font-medium">
        <span>
          {elements.length === 1
            ? typeLabel(first.type)
            : `${elements.length} objek terpilih`}
        </span>
        <Tooltip>
          <TooltipTrigger
            render={
              <button
                type="button"
                onClick={onToggleLock}
                className="hover:text-foreground"
                aria-label={locked ? "Buka kunci" : "Kunci"}
              >
                {locked ? (
                  <Lock className="size-3.5" aria-hidden />
                ) : (
                  <Unlock className="size-3.5" aria-hidden />
                )}
              </button>
            }
          />
          <TooltipContent>{locked ? "Buka kunci" : "Kunci objek"}</TooltipContent>
        </Tooltip>
      </div>

      {showFill ? (
        <Field label={hasSticky ? "Warna kertas" : "Isi"}>
          <ColorRow
            tokens={hasSticky ? STICKY_PALETTE : PALETTE_ORDER}
            value={props.fill}
            dark={dark}
            surface
            onSelect={(fill) => onChange({ fill })}
            allowNone={!hasSticky}
          />
        </Field>
      ) : null}

      {hasClosed ? (
        <Field label="Gaya isian">
          <SegmentRow
            options={WHITEBOARD_FILL_STYLES.map((style) => ({
              value: style,
              label: fillStyleLabel(style),
            }))}
            value={props.fillStyle ?? "solid"}
            onSelect={(fillStyle) =>
              onChange({ fillStyle: fillStyle as WhiteboardProps["fillStyle"] })
            }
          />
        </Field>
      ) : null}

      {showStroke ? (
        <>
          <Field label="Garis">
            <ColorRow
              tokens={PALETTE_ORDER}
              value={props.stroke}
              dark={dark}
              onSelect={(stroke) => onChange({ stroke })}
              allowNone={hasClosed}
            />
          </Field>
          <Field label="Tebal garis">
            <SegmentRow
              options={WHITEBOARD_STROKE_WIDTHS.map((w) => ({
                value: String(w),
                label: (
                  <span
                    className="bg-foreground inline-block w-4 rounded-full"
                    style={{ height: Math.max(1, w / 1.6) }}
                  />
                ),
              }))}
              value={String(props.strokeWidth ?? 2)}
              onSelect={(value) => onChange({ strokeWidth: Number(value) })}
            />
          </Field>
          {!hasDraw ? (
            <Field label="Jenis garis">
              <SegmentRow
                options={WHITEBOARD_STROKE_STYLES.map((s) => ({
                  value: s,
                  label: strokeStyleLabel(s),
                }))}
                value={props.strokeStyle ?? "solid"}
                onSelect={(strokeStyle) =>
                  onChange({
                    strokeStyle: strokeStyle as WhiteboardProps["strokeStyle"],
                  })
                }
              />
            </Field>
          ) : null}
        </>
      ) : null}

      {hasLinear ? (
        <Field label="Ujung">
          <div className="grid grid-cols-2 gap-1.5">
            <SegmentRow
              compact
              options={WHITEBOARD_ARROWHEADS.map((a) => ({
                value: a,
                label: arrowheadLabel(a, "start"),
              }))}
              value={props.startArrowhead ?? "none"}
              onSelect={(value) =>
                onChange({
                  startArrowhead: value as WhiteboardProps["startArrowhead"],
                })
              }
            />
            <SegmentRow
              compact
              options={WHITEBOARD_ARROWHEADS.map((a) => ({
                value: a,
                label: arrowheadLabel(a, "end"),
              }))}
              value={props.endArrowhead ?? "arrow"}
              onSelect={(value) =>
                onChange({ endArrowhead: value as WhiteboardProps["endArrowhead"] })
              }
            />
          </div>
        </Field>
      ) : null}

      {hasConnector ? (
        <Field label="Bentuk konektor">
          <SegmentRow
            options={WHITEBOARD_CONNECTOR_SHAPES.map((s) => ({
              value: s,
              label: connectorShapeLabel(s),
            }))}
            value={props.connectorShape ?? "elbow"}
            onSelect={(value) =>
              onChange({
                connectorShape: value as WhiteboardProps["connectorShape"],
              })
            }
          />
        </Field>
      ) : null}

      {hasText ? (
        <>
          <Separator />
          <Field label="Teks">
            <ColorRow
              tokens={PALETTE_ORDER}
              value={props.textColor}
              dark={dark}
              onSelect={(textColor) => onChange({ textColor })}
            />
          </Field>
          <div className="flex items-center gap-1.5">
            <SegmentRow
              className="flex-1"
              options={WHITEBOARD_FONT_FAMILIES.map((f) => ({
                value: f,
                label: fontLabel(f),
              }))}
              value={props.fontFamily ?? "sans"}
              onSelect={(value) =>
                onChange({ fontFamily: value as WhiteboardProps["fontFamily"] })
              }
            />
          </div>
          <div className="flex items-center gap-1">
            <ToggleButton
              active={(props.fontWeight ?? 400) >= 600}
              label="Tebal"
              onClick={() =>
                onChange({ fontWeight: (props.fontWeight ?? 400) >= 600 ? 400 : 700 })
              }
            >
              <Bold className="size-3.5" aria-hidden />
            </ToggleButton>
            <ToggleButton
              active={Boolean(props.italic)}
              label="Miring"
              onClick={() => onChange({ italic: !props.italic })}
            >
              <Italic className="size-3.5" aria-hidden />
            </ToggleButton>
            <ToggleButton
              active={Boolean(props.underline)}
              label="Garis bawah"
              onClick={() => onChange({ underline: !props.underline })}
            >
              <Underline className="size-3.5" aria-hidden />
            </ToggleButton>
            <Separator orientation="vertical" className="mx-0.5 h-5" />
            {WHITEBOARD_TEXT_ALIGNS.map((align) => (
              <ToggleButton
                key={align}
                active={(props.textAlign ?? "center") === align}
                label={`Rata ${align === "left" ? "kiri" : align === "right" ? "kanan" : "tengah"}`}
                onClick={() =>
                  onChange({ textAlign: align as WhiteboardProps["textAlign"] })
                }
              >
                {align === "left" ? (
                  <AlignLeft className="size-3.5" aria-hidden />
                ) : align === "right" ? (
                  <AlignRight className="size-3.5" aria-hidden />
                ) : (
                  <AlignCenter className="size-3.5" aria-hidden />
                )}
              </ToggleButton>
            ))}
          </div>
          {!hasSticky ? (
            <Field label={`Ukuran font · ${Math.round(props.fontSize ?? 16)}`}>
              <Slider
                value={props.fontSize ?? 16}
                min={8}
                max={120}
                step={1}
                onValueChange={(value) =>
                  onChange({ fontSize: value, autoFit: false }, "fontSize")
                }
              />
            </Field>
          ) : null}
        </>
      ) : null}

      <Separator />

      <Field label={`Transparansi · ${Math.round((props.opacity ?? 1) * 100)}%`}>
        <Slider
          value={Math.round((props.opacity ?? 1) * 100)}
          min={10}
          max={100}
          step={5}
          onValueChange={(value) => onChange({ opacity: value / 100 }, "opacity")}
        />
      </Field>

      {hasImage || hasClosed ? (
        <Field label={`Sudut · ${Math.round(props.cornerRadius ?? 0)}`}>
          <Slider
            value={props.cornerRadius ?? 0}
            min={0}
            max={80}
            step={1}
            onValueChange={(value) => onChange({ cornerRadius: value }, "cornerRadius")}
          />
        </Field>
      ) : null}

      {elements.length > 1 ? (
        <>
          <Separator />
          <Field label="Perataan">
            <div className="grid grid-cols-4 gap-1">
              <IconButton label="Rata kiri" onClick={() => onAlign("left")}>
                <AlignLeft className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton label="Tengah horizontal" onClick={() => onAlign("center-x")}>
                <AlignCenter className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton label="Rata kanan" onClick={() => onAlign("right")}>
                <AlignRight className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton
                label="Sebar horizontal"
                onClick={() => onAlign("distribute-x")}
              >
                <AlignHorizontalSpaceAround className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton label="Rata atas" onClick={() => onAlign("top")}>
                <AlignStartHorizontal className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton label="Tengah vertikal" onClick={() => onAlign("center-y")}>
                <FlipHorizontal className="size-3.5 rotate-90" aria-hidden />
              </IconButton>
              <IconButton label="Rata bawah" onClick={() => onAlign("bottom")}>
                <AlignEndHorizontal className="size-3.5" aria-hidden />
              </IconButton>
              <IconButton
                label="Sebar vertikal"
                onClick={() => onAlign("distribute-y")}
              >
                <AlignVerticalSpaceAround className="size-3.5" aria-hidden />
              </IconButton>
            </div>
          </Field>
        </>
      ) : null}

      <Separator />

      <div className="grid grid-cols-4 gap-1">
        <IconButton label="Ke depan" onClick={() => onReorder("front")}>
          <ArrowUpToLine className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton label="Maju satu" onClick={() => onReorder("forward")}>
          <MoveUp className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton label="Mundur satu" onClick={() => onReorder("backward")}>
          <MoveDown className="size-3.5" aria-hidden />
        </IconButton>
        <IconButton label="Ke belakang" onClick={() => onReorder("back")}>
          <ArrowDownToLine className="size-3.5" aria-hidden />
        </IconButton>
      </div>

      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1.5 text-xs"
          onClick={onDuplicate}
        >
          <Copy className="size-3.5" aria-hidden />
          Duplikat
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="text-destructive hover:text-destructive size-7"
          onClick={onDelete}
          aria-label="Hapus"
        >
          <Trash2 className="size-3.5" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <span className="text-muted-foreground block text-[10px] font-medium tracking-wide uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function ColorRow({
  tokens,
  value,
  dark,
  onSelect,
  surface = false,
  allowNone = false,
}: {
  tokens: WhiteboardColorToken[];
  value: WhiteboardColorToken | undefined;
  dark: boolean;
  onSelect: (token: WhiteboardColorToken) => void;
  surface?: boolean;
  allowNone?: boolean;
}) {
  return (
    <div className="flex flex-wrap gap-1">
      {allowNone ? (
        <button
          type="button"
          onClick={() => onSelect("transparent")}
          aria-label="Tanpa warna"
          aria-pressed={value === "transparent"}
          className={cn(
            "border-border relative size-5 overflow-hidden rounded-full border",
            value === "transparent" && "ring-primary ring-2 ring-offset-1",
          )}
        >
          <span className="absolute inset-x-0 top-1/2 h-px rotate-45 bg-red-500" />
        </button>
      ) : null}
      {tokens.map((token) => {
        const entry = paletteEntry(token, dark);
        return (
          <button
            key={token}
            type="button"
            onClick={() => onSelect(token)}
            aria-label={entry.label}
            aria-pressed={value === token}
            title={entry.label}
            className={cn(
              "border-border/60 size-5 rounded-full border transition-transform hover:scale-110",
              value === token && "ring-primary ring-2 ring-offset-1",
            )}
            style={{ background: surface ? entry.surface : entry.ink }}
          />
        );
      })}
    </div>
  );
}

function SegmentRow({
  options,
  value,
  onSelect,
  className,
  compact = false,
}: {
  options: Array<{ value: string; label: React.ReactNode }>;
  value: string;
  onSelect: (value: string) => void;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "bg-muted/60 flex items-center gap-0.5 rounded-lg p-0.5",
        className,
      )}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onSelect(option.value)}
          aria-pressed={value === option.value}
          className={cn(
            "flex flex-1 items-center justify-center rounded-md py-1 text-[10px] font-medium transition-colors",
            compact ? "px-0.5" : "px-1.5",
            value === option.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function ToggleButton({
  active,
  label,
  onClick,
  children,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            aria-pressed={active}
            className={cn(
              "flex size-6 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {children}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={onClick}
            aria-label={label}
            className="text-muted-foreground hover:bg-muted hover:text-foreground flex h-7 items-center justify-center rounded-md transition-colors"
          >
            {children}
          </button>
        }
      />
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}

// ---------------------------------------------------------------------------

function typeLabel(type: WhiteboardElement["type"]): string {
  switch (type) {
    case RoomWhiteboardElementType.STICKY:
      return "Sticky note";
    case RoomWhiteboardElementType.RECTANGLE:
      return "Persegi";
    case RoomWhiteboardElementType.ELLIPSE:
      return "Elips";
    case RoomWhiteboardElementType.DIAMOND:
      return "Diamond";
    case RoomWhiteboardElementType.TRIANGLE:
      return "Segitiga";
    case RoomWhiteboardElementType.LINE:
      return "Garis";
    case RoomWhiteboardElementType.ARROW:
      return "Panah";
    case RoomWhiteboardElementType.CONNECTOR:
      return "Konektor";
    case RoomWhiteboardElementType.DRAW:
      return "Coretan";
    case RoomWhiteboardElementType.TEXT:
      return "Teks";
    case RoomWhiteboardElementType.IMAGE:
      return "Gambar";
    case RoomWhiteboardElementType.FRAME:
      return "Frame";
    default:
      return "Objek";
  }
}

function fillStyleLabel(style: string): string {
  switch (style) {
    case "solid":
      return "Padat";
    case "soft":
      return "Lembut";
    case "hachure":
      return "Arsir";
    default:
      return "Kosong";
  }
}

function strokeStyleLabel(style: string): React.ReactNode {
  const dash =
    style === "dashed" ? "6 4" : style === "dotted" ? "1.5 4" : undefined;
  return (
    <svg width="26" height="8" viewBox="0 0 26 8" aria-hidden>
      <line
        x1="1"
        y1="4"
        x2="25"
        y2="4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash}
      />
    </svg>
  );
}

function arrowheadLabel(kind: string, side: "start" | "end"): React.ReactNode {
  const flip = side === "start";
  return (
    <svg
      width="22"
      height="10"
      viewBox="0 0 22 10"
      aria-hidden
      style={{ transform: flip ? "scaleX(-1)" : undefined }}
    >
      <line
        x1="1"
        y1="5"
        x2="16"
        y2="5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {kind === "arrow" ? (
        <path
          d="M12 1.5 L17 5 L12 8.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : kind === "triangle" ? (
        <path d="M12 1.5 L18 5 L12 8.5 Z" fill="currentColor" />
      ) : kind === "dot" ? (
        <circle cx="17" cy="5" r="2.6" fill="currentColor" />
      ) : kind === "bar" ? (
        <line
          x1="17"
          y1="1.5"
          x2="17"
          y2="8.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      ) : null}
    </svg>
  );
}

function connectorShapeLabel(shape: string): React.ReactNode {
  const d =
    shape === "straight"
      ? "M2 12 L26 4"
      : shape === "curved"
        ? "M2 12 Q14 0 26 8"
        : "M2 12 L14 12 L14 4 L26 4";
  return (
    <svg width="28" height="16" viewBox="0 0 28 16" aria-hidden>
      <path
        d={d}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function fontLabel(family: string): React.ReactNode {
  const style: React.CSSProperties = {
    fontFamily:
      family === "serif"
        ? "ui-serif, Georgia, serif"
        : family === "mono"
          ? "ui-monospace, monospace"
          : family === "hand"
            ? '"Segoe Print", "Comic Sans MS", cursive'
            : "inherit",
  };
  return <span style={style}>Aa</span>;
}
