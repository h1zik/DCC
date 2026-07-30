"use client";

import { memo, useMemo } from "react";
import { RoomWhiteboardElementType } from "@prisma/client";
import {
  anchorPoint,
  elbowPath,
  pointsToPath,
  round,
  strokeToPath,
  type Point,
} from "@/lib/whiteboard/geometry";
import { paletteEntry, resolveFill, resolveStroke } from "@/lib/whiteboard/palette";
import {
  FONT_STACKS,
  fitFontSize,
  firstLineBaseline,
  layoutText,
  svgTextAnchor,
  TEXT_PADDING,
  textAnchorX,
} from "@/lib/whiteboard/text-layout";
import {
  type WhiteboardElement,
  type WhiteboardFontFamily,
  type WhiteboardTextAlign,
  type WhiteboardVerticalAlign,
} from "@/lib/whiteboard/types";

/**
 * Render satu elemen kanvas sebagai SVG.
 *
 * Komponen ini di-`memo` dan sengaja hanya bergantung pada nilai primitif +
 * objek elemen. Saat satu elemen digeser, hanya elemen itu yang objeknya
 * berganti identitas, sehingga ratusan elemen lain tidak ikut dirender ulang.
 */

export type ElementRenderContext = {
  dark: boolean;
  /** Untuk konektor yang menempel: cara mencari elemen tujuan. */
  getElement: (id: string) => WhiteboardElement | undefined;
  /** Sembunyikan teks elemen yang sedang disunting (digantikan overlay). */
  editingId: string | null;
};

function dashArray(style: string | undefined, width: number): string | undefined {
  if (style === "dashed") return `${Math.max(4, width * 3)} ${Math.max(4, width * 2.4)}`;
  if (style === "dotted") return `${Math.max(0.6, width * 0.2)} ${Math.max(3, width * 2)}`;
  return undefined;
}

export const WhiteboardElementNode = memo(function WhiteboardElementNode({
  element,
  ctx,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
}) {
  const { dark } = ctx;
  const props = element.props;
  const opacity = props.opacity ?? 1;

  const transform = element.rotation
    ? `rotate(${round((element.rotation * 180) / Math.PI)} ${round(element.x + element.width / 2)} ${round(element.y + element.height / 2)})`
    : undefined;

  const body = (() => {
    switch (element.type) {
      case RoomWhiteboardElementType.STICKY:
        return <StickyShape element={element} ctx={ctx} />;
      case RoomWhiteboardElementType.IMAGE:
        return <ImageShape element={element} dark={dark} />;
      case RoomWhiteboardElementType.DRAW:
        return <DrawShape element={element} dark={dark} />;
      case RoomWhiteboardElementType.TEXT:
        return <TextShape element={element} ctx={ctx} />;
      case RoomWhiteboardElementType.FRAME:
        return <FrameShape element={element} ctx={ctx} />;
      case RoomWhiteboardElementType.LINE:
      case RoomWhiteboardElementType.ARROW:
      case RoomWhiteboardElementType.CONNECTOR:
        return <LinearShape element={element} ctx={ctx} />;
      default:
        return <ClosedShape element={element} ctx={ctx} />;
    }
  })();

  return (
    <g
      data-element-id={element.id}
      transform={transform}
      opacity={opacity === 1 ? undefined : opacity}
      style={{ mixBlendMode: props.highlighter ? "multiply" : undefined }}
    >
      {body}
    </g>
  );
});

// ---------------------------------------------------------------------------
// Bentuk tertutup (persegi, elips, diamond, segitiga)
// ---------------------------------------------------------------------------

function closedShapePath(element: WhiteboardElement): string {
  const { x, y, width: w, height: h } = element;
  switch (element.type) {
    case RoomWhiteboardElementType.DIAMOND:
      return `M ${round(x + w / 2)} ${round(y)} L ${round(x + w)} ${round(y + h / 2)} L ${round(x + w / 2)} ${round(y + h)} L ${round(x)} ${round(y + h / 2)} Z`;
    case RoomWhiteboardElementType.TRIANGLE:
      return `M ${round(x + w / 2)} ${round(y)} L ${round(x + w)} ${round(y + h)} L ${round(x)} ${round(y + h)} Z`;
    default:
      return "";
  }
}

function ClosedShape({
  element,
  ctx,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
}) {
  const { dark } = ctx;
  const props = element.props;
  const strokeWidth = props.strokeWidth ?? 2;
  const stroke = resolveStroke(props.stroke, dark);
  const fillStyle = props.fillStyle ?? "solid";
  const fill = resolveFill(props.fill, fillStyle, dark);
  const dash = dashArray(props.strokeStyle, strokeWidth);
  const hachureId = `wb-hachure-${element.id}`;

  const shared = {
    fill: fillStyle === "hachure" ? `url(#${hachureId})` : fill,
    stroke: strokeWidth > 0 ? stroke : "none",
    strokeWidth,
    strokeDasharray: dash,
    strokeLinejoin: "round" as const,
  };

  const hachure =
    fillStyle === "hachure" ? (
      <defs>
        <pattern
          id={hachureId}
          width="8"
          height="8"
          patternUnits="userSpaceOnUse"
          patternTransform="rotate(45)"
        >
          <line
            x1="0"
            y1="0"
            x2="0"
            y2="8"
            stroke={paletteEntry(props.fill, dark).ink}
            strokeWidth="1.6"
          />
        </pattern>
      </defs>
    ) : null;

  let shape: React.ReactNode;
  if (element.type === RoomWhiteboardElementType.ELLIPSE) {
    shape = (
      <ellipse
        cx={round(element.x + element.width / 2)}
        cy={round(element.y + element.height / 2)}
        rx={round(Math.max(0, element.width / 2))}
        ry={round(Math.max(0, element.height / 2))}
        {...shared}
      />
    );
  } else if (element.type === RoomWhiteboardElementType.RECTANGLE) {
    shape = (
      <rect
        x={round(element.x)}
        y={round(element.y)}
        width={round(Math.max(0, element.width))}
        height={round(Math.max(0, element.height))}
        rx={Math.min(props.cornerRadius ?? 8, element.width / 2, element.height / 2)}
        {...shared}
      />
    );
  } else {
    shape = <path d={closedShapePath(element)} {...shared} />;
  }

  return (
    <>
      {hachure}
      {shape}
      <ElementText element={element} ctx={ctx} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Sticky note
// ---------------------------------------------------------------------------

function StickyShape({
  element,
  ctx,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
}) {
  const { dark } = ctx;
  const fill = resolveFill(element.props.fill, "solid", ctx.dark);
  const shadow = dark ? "rgba(0,0,0,0.5)" : "rgba(15,23,42,0.18)";

  return (
    <>
      <rect
        x={round(element.x)}
        y={round(element.y + 2)}
        width={round(Math.max(0, element.width))}
        height={round(Math.max(0, element.height))}
        rx="3"
        fill={shadow}
        // Bayangan tipis agar sticky terasa menempel di atas kanvas.
        style={{ filter: "blur(3px)" }}
      />
      <rect
        x={round(element.x)}
        y={round(element.y)}
        width={round(Math.max(0, element.width))}
        height={round(Math.max(0, element.height))}
        rx="3"
        fill={fill}
      />
      <ElementText element={element} ctx={ctx} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Teks lepas
// ---------------------------------------------------------------------------

function TextShape({
  element,
  ctx,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
}) {
  return <ElementText element={element} ctx={ctx} standalone />;
}

// ---------------------------------------------------------------------------
// Frame
// ---------------------------------------------------------------------------

function FrameShape({
  element,
  ctx,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
}) {
  const { dark } = ctx;
  const props = element.props;
  const fill = resolveFill(props.fill ?? "white", "solid", dark);
  const stroke = resolveStroke(props.stroke ?? "gray", dark);
  const label = props.text ?? "Frame";
  const labelSize = 13;

  return (
    <>
      <rect
        x={round(element.x)}
        y={round(element.y)}
        width={round(Math.max(0, element.width))}
        height={round(Math.max(0, element.height))}
        rx={props.cornerRadius ?? 4}
        fill={fill}
        stroke={stroke}
        strokeWidth={props.strokeWidth ?? 2}
      />
      {ctx.editingId === element.id ? null : (
        <text
          x={round(element.x)}
          y={round(element.y - 8)}
          fill={paletteEntry(props.textColor ?? "gray", dark).ink}
          fontSize={labelSize}
          fontFamily={FONT_STACKS.sans}
          fontWeight={600}
          style={{ userSelect: "none" }}
        >
          {label}
        </text>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Gambar
// ---------------------------------------------------------------------------

function ImageShape({
  element,
  dark,
}: {
  element: WhiteboardElement;
  dark: boolean;
}) {
  const props = element.props;
  const clipId = `wb-clip-${element.id}`;
  const radius = Math.min(
    props.cornerRadius ?? 4,
    element.width / 2,
    element.height / 2,
  );

  if (!props.src) {
    return (
      <rect
        x={round(element.x)}
        y={round(element.y)}
        width={round(Math.max(0, element.width))}
        height={round(Math.max(0, element.height))}
        rx={radius}
        fill={dark ? "#27272a" : "#f4f4f5"}
        stroke={dark ? "#3f3f46" : "#e4e4e7"}
        strokeDasharray="6 4"
      />
    );
  }

  return (
    <>
      <defs>
        <clipPath id={clipId}>
          <rect
            x={round(element.x)}
            y={round(element.y)}
            width={round(Math.max(0, element.width))}
            height={round(Math.max(0, element.height))}
            rx={radius}
          />
        </clipPath>
      </defs>
      <image
        href={props.src}
        x={round(element.x)}
        y={round(element.y)}
        width={round(Math.max(0, element.width))}
        height={round(Math.max(0, element.height))}
        preserveAspectRatio="xMidYMid slice"
        clipPath={`url(#${clipId})`}
        // Gambar tidak boleh menangkap drag bawaan browser.
        style={{ pointerEvents: "none" }}
      />
    </>
  );
}

// ---------------------------------------------------------------------------
// Coretan bebas
// ---------------------------------------------------------------------------

function DrawShape({
  element,
  dark,
}: {
  element: WhiteboardElement;
  dark: boolean;
}) {
  const props = element.props;
  // `?? []` sengaja di dalam useMemo: kalau di luar, literal array baru tiap
  // render akan membatalkan memoisasi jalur coretan yang justru paling mahal.
  const d = useMemo(() => strokeToPath(props.points ?? []), [props.points]);
  const stroke = resolveStroke(props.stroke, dark);

  return (
    <path
      d={d}
      transform={`translate(${round(element.x)} ${round(element.y)})`}
      fill="none"
      stroke={stroke}
      strokeWidth={props.strokeWidth ?? 4}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={props.highlighter ? 0.45 : undefined}
      strokeDasharray={dashArray(props.strokeStyle, props.strokeWidth ?? 4)}
    />
  );
}

// ---------------------------------------------------------------------------
// Garis, panah, konektor
// ---------------------------------------------------------------------------

/** Titik ujung konektor setelah memperhitungkan tempelan ke elemen lain. */
export function connectorPoints(
  element: WhiteboardElement,
  getElement: (id: string) => WhiteboardElement | undefined,
): Point[] {
  const props = element.props;
  const rawStart: Point = { x: element.x, y: element.y };
  const rawEnd: Point = {
    x: element.x + element.width,
    y: element.y + element.height,
  };

  const startLink = props.start?.elementId ? getElement(props.start.elementId) : undefined;
  const endLink = props.end?.elementId ? getElement(props.end.elementId) : undefined;

  // Setiap sisi "auto" diarahkan ke pusat lawannya.
  const startTarget = endLink
    ? { x: endLink.x + endLink.width / 2, y: endLink.y + endLink.height / 2 }
    : rawEnd;
  const endTarget = startLink
    ? { x: startLink.x + startLink.width / 2, y: startLink.y + startLink.height / 2 }
    : rawStart;

  const a = startLink
    ? anchorPoint(startLink, props.start?.side ?? "auto", startTarget)
    : rawStart;
  const b = endLink
    ? anchorPoint(endLink, props.end?.side ?? "auto", endTarget)
    : rawEnd;

  const shape = props.connectorShape ?? "straight";
  if (shape === "elbow" && element.type === RoomWhiteboardElementType.CONNECTOR) {
    return elbowPath(a, b);
  }
  return [a, b];
}

function arrowheadPath(
  tip: Point,
  from: Point,
  kind: string,
  size: number,
): string | null {
  if (kind === "none") return null;
  const angle = Math.atan2(tip.y - from.y, tip.x - from.x);

  if (kind === "dot") {
    const r = size * 0.42;
    return `M ${round(tip.x - r)} ${round(tip.y)} a ${round(r)} ${round(r)} 0 1 0 ${round(r * 2)} 0 a ${round(r)} ${round(r)} 0 1 0 ${round(-r * 2)} 0 Z`;
  }
  if (kind === "bar") {
    const half = size * 0.5;
    const nx = Math.cos(angle + Math.PI / 2) * half;
    const ny = Math.sin(angle + Math.PI / 2) * half;
    return `M ${round(tip.x - nx)} ${round(tip.y - ny)} L ${round(tip.x + nx)} ${round(tip.y + ny)}`;
  }

  const spread = kind === "triangle" ? 0.42 : 0.55;
  const p1 = {
    x: tip.x - size * Math.cos(angle - spread),
    y: tip.y - size * Math.sin(angle - spread),
  };
  const p2 = {
    x: tip.x - size * Math.cos(angle + spread),
    y: tip.y - size * Math.sin(angle + spread),
  };
  if (kind === "triangle") {
    return `M ${round(tip.x)} ${round(tip.y)} L ${round(p1.x)} ${round(p1.y)} L ${round(p2.x)} ${round(p2.y)} Z`;
  }
  return `M ${round(p1.x)} ${round(p1.y)} L ${round(tip.x)} ${round(tip.y)} L ${round(p2.x)} ${round(p2.y)}`;
}

function LinearShape({
  element,
  ctx,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
}) {
  const { dark } = ctx;
  const props = element.props;
  const stroke = resolveStroke(props.stroke, dark);
  const strokeWidth = props.strokeWidth ?? 2;
  const points = connectorPoints(element, ctx.getElement);
  if (points.length < 2) return null;

  const isCurved =
    props.connectorShape === "curved" &&
    element.type === RoomWhiteboardElementType.CONNECTOR;

  const first = points[0]!;
  const last = points[points.length - 1]!;

  let d: string;
  if (isCurved) {
    const mx = (first.x + last.x) / 2;
    const my = (first.y + last.y) / 2;
    // Lengkungkan tegak lurus terhadap garis lurusnya.
    const dx = last.x - first.x;
    const dy = last.y - first.y;
    const len = Math.hypot(dx, dy) || 1;
    const bend = (props.bend ?? 0.25) || 0.25;
    const cx = mx + (-dy / len) * len * bend * 0.5;
    const cy = my + (dx / len) * len * bend * 0.5;
    d = `M ${round(first.x)} ${round(first.y)} Q ${round(cx)} ${round(cy)} ${round(last.x)} ${round(last.y)}`;
  } else {
    d = pointsToPath(points, points.length > 2 ? 12 : 0);
  }

  const headSize = Math.max(9, strokeWidth * 4.2);
  const startNeighbor = points[1]!;
  const endNeighbor = points[points.length - 2]!;
  const startHead = arrowheadPath(
    first,
    startNeighbor,
    props.startArrowhead ?? "none",
    headSize,
  );
  const endHead = arrowheadPath(last, endNeighbor, props.endArrowhead ?? "none", headSize);
  const filled = (kind: string | undefined) => kind === "triangle" || kind === "dot";

  const midpoint = points[Math.floor(points.length / 2)] ?? first;
  const label = props.text?.trim();

  return (
    <>
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray={dashArray(props.strokeStyle, strokeWidth)}
      />
      {startHead ? (
        <path
          d={startHead}
          fill={filled(props.startArrowhead) ? stroke : "none"}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {endHead ? (
        <path
          d={endHead}
          fill={filled(props.endArrowhead) ? stroke : "none"}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
      {label && ctx.editingId !== element.id ? (
        <ConnectorLabel
          text={label}
          at={midpoint}
          fontSize={props.fontSize ?? 14}
          color={paletteEntry(props.textColor ?? "slate", dark).ink}
          dark={dark}
        />
      ) : null}
    </>
  );
}

function ConnectorLabel({
  text,
  at,
  fontSize,
  color,
  dark,
}: {
  text: string;
  at: Point;
  fontSize: number;
  color: string;
  dark: boolean;
}) {
  const layout = useMemo(
    () =>
      layoutText({
        text,
        fontSize,
        fontFamily: "sans",
        fontWeight: 500,
        italic: false,
        maxWidth: 240,
      }),
    [text, fontSize],
  );
  const padX = 6;
  const padY = 3;
  const w = layout.width + padX * 2;
  const h = layout.height + padY * 2;

  return (
    <>
      <rect
        x={round(at.x - w / 2)}
        y={round(at.y - h / 2)}
        width={round(w)}
        height={round(h)}
        rx="4"
        fill={dark ? "#18181b" : "#ffffff"}
        fillOpacity={0.92}
      />
      <text
        x={round(at.x)}
        y={round(at.y - layout.height / 2 + layout.lineHeight * 0.78)}
        textAnchor="middle"
        fill={color}
        fontSize={fontSize}
        fontFamily={FONT_STACKS.sans}
        fontWeight={500}
        style={{ userSelect: "none" }}
      >
        {layout.lines.map((line, i) => (
          <tspan
            key={i}
            x={round(at.x)}
            dy={i === 0 ? 0 : round(layout.lineHeight)}
          >
            {line}
          </tspan>
        ))}
      </text>
    </>
  );
}

// ---------------------------------------------------------------------------
// Teks di dalam elemen
// ---------------------------------------------------------------------------

/** Ukuran font efektif sebuah elemen (memperhitungkan auto-fit sticky). */
export function effectiveFontSize(element: WhiteboardElement): number {
  const props = element.props;
  const text = props.text ?? "";
  if (!props.autoFit) return props.fontSize ?? 16;
  return fitFontSize({
    text,
    fontFamily: (props.fontFamily ?? "sans") as WhiteboardFontFamily,
    fontWeight: props.fontWeight ?? 400,
    italic: props.italic ?? false,
    boxWidth: element.width,
    boxHeight: element.height,
    min: 10,
    max: Math.max(14, Math.min(72, element.height * 0.5)),
  });
}

function ElementText({
  element,
  ctx,
  standalone = false,
}: {
  element: WhiteboardElement;
  ctx: ElementRenderContext;
  standalone?: boolean;
}) {
  const props = element.props;
  const raw = props.text ?? "";
  const fontSize = effectiveFontSize(element);

  const layout = useMemo(
    () =>
      layoutText({
        text: raw,
        fontSize,
        fontFamily: (props.fontFamily ?? "sans") as WhiteboardFontFamily,
        fontWeight: props.fontWeight ?? 400,
        italic: props.italic ?? false,
        maxWidth: Math.max(8, element.width - TEXT_PADDING * 2),
      }),
    [
      raw,
      fontSize,
      props.fontFamily,
      props.fontWeight,
      props.italic,
      element.width,
    ],
  );

  if (ctx.editingId === element.id) return null;
  if (raw === "") return null;

  const align = (props.textAlign ?? (standalone ? "left" : "center")) as WhiteboardTextAlign;
  const vAlign = (props.verticalAlign ??
    (standalone ? "top" : "middle")) as WhiteboardVerticalAlign;
  const x = textAnchorX(element.x, element.width, align);
  const baseline = firstLineBaseline(element.y, element.height, layout, vAlign);

  const color = props.textColor
    ? paletteEntry(props.textColor, ctx.dark).on
    : ctx.dark
      ? "#fafafa"
      : "#18181b";

  return (
    <text
      x={round(x)}
      y={round(baseline)}
      textAnchor={svgTextAnchor(align)}
      fill={color}
      fontSize={fontSize}
      fontFamily={FONT_STACKS[(props.fontFamily ?? "sans") as WhiteboardFontFamily]}
      fontWeight={props.fontWeight ?? 400}
      fontStyle={props.italic ? "italic" : undefined}
      textDecoration={props.underline ? "underline" : undefined}
      style={{ userSelect: "none", whiteSpace: "pre" }}
    >
      {layout.lines.map((line, i) => (
        <tspan key={i} x={round(x)} dy={i === 0 ? 0 : round(layout.lineHeight)}>
          {line === "" ? " " : line}
        </tspan>
      ))}
    </text>
  );
}

export { ElementText };
