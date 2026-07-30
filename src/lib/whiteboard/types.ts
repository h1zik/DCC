import { RoomWhiteboardElementType } from "@prisma/client";
import { z } from "zod";

/**
 * Model data kanvas whiteboard.
 *
 * Semua koordinat memakai satuan "world" (kanvas tak terbatas), bukan piksel
 * layar. Konversi world -> layar dilakukan oleh viewport di klien.
 */

export const WHITEBOARD_ELEMENT_TYPES = [
  RoomWhiteboardElementType.STICKY,
  RoomWhiteboardElementType.RECTANGLE,
  RoomWhiteboardElementType.ELLIPSE,
  RoomWhiteboardElementType.DIAMOND,
  RoomWhiteboardElementType.TRIANGLE,
  RoomWhiteboardElementType.LINE,
  RoomWhiteboardElementType.ARROW,
  RoomWhiteboardElementType.DRAW,
  RoomWhiteboardElementType.TEXT,
  RoomWhiteboardElementType.IMAGE,
  RoomWhiteboardElementType.FRAME,
  RoomWhiteboardElementType.CONNECTOR,
] as const;

export type WhiteboardElementType = (typeof WHITEBOARD_ELEMENT_TYPES)[number];

/** Bentuk tertutup yang punya isi + garis tepi dan bisa memuat teks di tengah. */
export const CLOSED_SHAPE_TYPES = new Set<WhiteboardElementType>([
  RoomWhiteboardElementType.RECTANGLE,
  RoomWhiteboardElementType.ELLIPSE,
  RoomWhiteboardElementType.DIAMOND,
  RoomWhiteboardElementType.TRIANGLE,
]);

/** Elemen berbasis dua titik ujung (garis, panah, konektor). */
export const LINEAR_TYPES = new Set<WhiteboardElementType>([
  RoomWhiteboardElementType.LINE,
  RoomWhiteboardElementType.ARROW,
  RoomWhiteboardElementType.CONNECTOR,
]);

/** Elemen yang menampung teks yang bisa diedit langsung di kanvas. */
export const TEXT_CAPABLE_TYPES = new Set<WhiteboardElementType>([
  RoomWhiteboardElementType.STICKY,
  RoomWhiteboardElementType.RECTANGLE,
  RoomWhiteboardElementType.ELLIPSE,
  RoomWhiteboardElementType.DIAMOND,
  RoomWhiteboardElementType.TRIANGLE,
  RoomWhiteboardElementType.TEXT,
  RoomWhiteboardElementType.FRAME,
]);

// ---------------------------------------------------------------------------
// Palet & token gaya
// ---------------------------------------------------------------------------

/**
 * Warna disimpan sebagai *token* (bukan hex mentah) supaya papan ikut
 * menyesuaikan tema terang/gelap aplikasi. `transparent` dipakai untuk isi
 * kosong. Token dipetakan ke warna asli di `palette.ts`.
 */
export const WHITEBOARD_COLOR_TOKENS = [
  "slate",
  "gray",
  "red",
  "orange",
  "amber",
  "yellow",
  "lime",
  "green",
  "teal",
  "cyan",
  "blue",
  "indigo",
  "violet",
  "purple",
  "pink",
  "rose",
  "black",
  "white",
  "transparent",
] as const;

export type WhiteboardColorToken = (typeof WHITEBOARD_COLOR_TOKENS)[number];

export const WHITEBOARD_FILL_STYLES = ["solid", "soft", "hachure", "none"] as const;
export type WhiteboardFillStyle = (typeof WHITEBOARD_FILL_STYLES)[number];

export const WHITEBOARD_STROKE_STYLES = ["solid", "dashed", "dotted"] as const;
export type WhiteboardStrokeStyle = (typeof WHITEBOARD_STROKE_STYLES)[number];

export const WHITEBOARD_STROKE_WIDTHS = [1, 2, 4, 8] as const;

export const WHITEBOARD_FONT_FAMILIES = ["sans", "serif", "mono", "hand"] as const;
export type WhiteboardFontFamily = (typeof WHITEBOARD_FONT_FAMILIES)[number];

export const WHITEBOARD_TEXT_ALIGNS = ["left", "center", "right"] as const;
export type WhiteboardTextAlign = (typeof WHITEBOARD_TEXT_ALIGNS)[number];

export const WHITEBOARD_VERTICAL_ALIGNS = ["top", "middle", "bottom"] as const;
export type WhiteboardVerticalAlign = (typeof WHITEBOARD_VERTICAL_ALIGNS)[number];

export const WHITEBOARD_ARROWHEADS = ["none", "arrow", "triangle", "dot", "bar"] as const;
export type WhiteboardArrowhead = (typeof WHITEBOARD_ARROWHEADS)[number];

export const WHITEBOARD_EDGE_STYLES = ["sharp", "round"] as const;

export const WHITEBOARD_CONNECTOR_SHAPES = ["straight", "elbow", "curved"] as const;
export type WhiteboardConnectorShape = (typeof WHITEBOARD_CONNECTOR_SHAPES)[number];

export const WHITEBOARD_BACKGROUNDS = ["dots", "grid", "lines", "plain"] as const;
export type WhiteboardBackground = (typeof WHITEBOARD_BACKGROUNDS)[number];

/** Sisi tempat konektor menempel pada elemen. `auto` memilih sisi terdekat. */
export const WHITEBOARD_ANCHOR_SIDES = ["auto", "top", "right", "bottom", "left"] as const;
export type WhiteboardAnchorSide = (typeof WHITEBOARD_ANCHOR_SIDES)[number];

// ---------------------------------------------------------------------------
// Skema `props` per tipe elemen
// ---------------------------------------------------------------------------

const colorToken = z.enum(WHITEBOARD_COLOR_TOKENS);

/** Titik pada coretan bebas: [x, y, tekanan]. */
const drawPoint = z.tuple([z.number(), z.number(), z.number().min(0).max(1)]);

/** Ujung konektor: titik bebas, atau menempel ke elemen lain. */
const connectorEndpoint = z.object({
  /** Elemen yang ditempeli. Null = titik bebas di koordinat `x`/`y`. */
  elementId: z.string().max(64).nullable().default(null),
  side: z.enum(WHITEBOARD_ANCHOR_SIDES).default("auto"),
  /** Koordinat world, dipakai saat `elementId` null (atau sebagai fallback). */
  x: z.number().default(0),
  y: z.number().default(0),
});

export type WhiteboardConnectorEndpoint = z.infer<typeof connectorEndpoint>;

/**
 * Semua atribut visual dipakai lintas tipe. Field yang tidak relevan untuk
 * sebuah tipe cukup diabaikan saat render — ini membuat pengubahan gaya
 * (mis. ganti warna untuk campuran sticky + panah) tetap seragam.
 *
 * PENTING: tidak ada `.default()` di sini, dan itu disengaja.
 *
 * Skema ini dipakai juga untuk *patch* parsial ("ubah tebal garis saja").
 * `.partial()` di Zod TIDAK membatalkan `.default()`, jadi kalau field-nya
 * punya default, mengirim `{ strokeWidth: 8 }` akan kembali sebagai objek
 * lengkap berisi seluruh default — dan karena server menggabungkan props
 * dengan `e.props || v.props`, isian, teks, titik coretan, serta sumber
 * gambar milik elemen ikut tertimpa. Nilai awal tiap tipe elemen disediakan
 * oleh `defaultPropsForType()`, dan saat render setiap atribut sudah punya
 * fallback `?? ...` masing-masing.
 */
export const whiteboardPropsSchema = z
  .object({
    // Isi & garis
    fill: colorToken,
    fillStyle: z.enum(WHITEBOARD_FILL_STYLES),
    stroke: colorToken,
    strokeWidth: z.number().min(0).max(32),
    strokeStyle: z.enum(WHITEBOARD_STROKE_STYLES),
    opacity: z.number().min(0.05).max(1),
    /** Radius sudut untuk persegi & frame (piksel world). */
    cornerRadius: z.number().min(0).max(400),

    // Teks
    text: z.string().max(20_000),
    fontSize: z.number().min(6).max(400),
    fontFamily: z.enum(WHITEBOARD_FONT_FAMILIES),
    fontWeight: z.union([
      z.literal(400),
      z.literal(500),
      z.literal(600),
      z.literal(700),
    ]),
    italic: z.boolean(),
    underline: z.boolean(),
    textColor: colorToken,
    textAlign: z.enum(WHITEBOARD_TEXT_ALIGNS),
    verticalAlign: z.enum(WHITEBOARD_VERTICAL_ALIGNS),
    /** Sticky & shape: perbesar font otomatis agar teks memenuhi kotak. */
    autoFit: z.boolean(),

    // Garis / panah / konektor
    startArrowhead: z.enum(WHITEBOARD_ARROWHEADS),
    endArrowhead: z.enum(WHITEBOARD_ARROWHEADS),
    connectorShape: z.enum(WHITEBOARD_CONNECTOR_SHAPES),
    start: connectorEndpoint,
    end: connectorEndpoint,
    /** Titik belok manual untuk garis/panah multi-segmen (koordinat relatif). */
    bend: z.number().min(-1).max(1),

    // Coretan bebas
    points: z.array(drawPoint).max(20_000),
    /** Coretan mode stabilo: warna transparan & menyatu (multiply). */
    highlighter: z.boolean(),

    // Gambar
    src: z.string().max(2048),
    naturalWidth: z.number().min(0),
    naturalHeight: z.number().min(0),
    alt: z.string().max(300),

    // Frame
    /** Frame ikut memindahkan anak-anaknya saat digeser. */
    clipContent: z.boolean(),
  })
  .partial();

export type WhiteboardProps = z.infer<typeof whiteboardPropsSchema>;

/** Bentuk elemen yang dipakai di klien (props sudah lengkap dengan default). */
export type WhiteboardElement = {
  id: string;
  type: WhiteboardElementType;
  zIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  props: WhiteboardProps;
  locked: boolean;
  frameId: string | null;
  rev: number;
  deleted: boolean;
  updatedById: string | null;
};

// ---------------------------------------------------------------------------
// Skema mutasi (dipakai bersama oleh klien & server)
// ---------------------------------------------------------------------------

const elementIdSchema = z.string().min(1).max(64);

export const whiteboardElementInputSchema = z.object({
  id: elementIdSchema,
  type: z.nativeEnum(RoomWhiteboardElementType),
  zIndex: z.number().int().min(-1_000_000).max(1_000_000).default(0),
  x: z.number().finite().default(0),
  y: z.number().finite().default(0),
  width: z.number().finite().min(0).max(1_000_000).default(0),
  height: z.number().finite().min(0).max(1_000_000).default(0),
  rotation: z.number().finite().min(-Math.PI * 4).max(Math.PI * 4).default(0),
  props: whiteboardPropsSchema.default({}),
  locked: z.boolean().default(false),
  frameId: elementIdSchema.nullable().default(null),
});

export type WhiteboardElementInput = z.infer<typeof whiteboardElementInputSchema>;

export const whiteboardElementPatchSchema = z.object({
  id: elementIdSchema,
  zIndex: z.number().int().min(-1_000_000).max(1_000_000).optional(),
  x: z.number().finite().optional(),
  y: z.number().finite().optional(),
  width: z.number().finite().min(0).max(1_000_000).optional(),
  height: z.number().finite().min(0).max(1_000_000).optional(),
  rotation: z.number().finite().min(-Math.PI * 4).max(Math.PI * 4).optional(),
  props: whiteboardPropsSchema.optional(),
  locked: z.boolean().optional(),
  frameId: elementIdSchema.nullable().optional(),
});

export type WhiteboardElementPatch = z.infer<typeof whiteboardElementPatchSchema>;

/**
 * Satu batch mutasi. Klien mengirim create/update/delete sekaligus supaya
 * satu aksi pengguna (mis. "tempel 12 objek") jadi satu revisi papan.
 */
export const whiteboardMutationSchema = z.object({
  create: z.array(whiteboardElementInputSchema).max(2000).default([]),
  update: z.array(whiteboardElementPatchSchema).max(2000).default([]),
  delete: z.array(elementIdSchema).max(2000).default([]),
});

export type WhiteboardMutation = z.infer<typeof whiteboardMutationSchema>;

// ---------------------------------------------------------------------------
// Default per tipe
// ---------------------------------------------------------------------------

export const STICKY_DEFAULT_SIZE = 180;
export const FRAME_DEFAULT_WIDTH = 800;
export const FRAME_DEFAULT_HEIGHT = 560;

/** Nilai `props` awal saat sebuah tipe elemen dibuat dari toolbar. */
export function defaultPropsForType(
  type: WhiteboardElementType,
): WhiteboardProps {
  switch (type) {
    case RoomWhiteboardElementType.STICKY:
      return {
        fill: "yellow",
        fillStyle: "solid",
        stroke: "transparent",
        strokeWidth: 0,
        text: "",
        fontSize: 20,
        fontFamily: "sans",
        textColor: "slate",
        textAlign: "center",
        verticalAlign: "middle",
        autoFit: true,
        opacity: 1,
      };
    case RoomWhiteboardElementType.TEXT:
      return {
        text: "",
        fontSize: 24,
        fontFamily: "sans",
        textColor: "slate",
        textAlign: "left",
        verticalAlign: "top",
        autoFit: false,
        fill: "transparent",
        stroke: "transparent",
        strokeWidth: 0,
        opacity: 1,
      };
    case RoomWhiteboardElementType.FRAME:
      return {
        fill: "white",
        fillStyle: "solid",
        stroke: "gray",
        strokeWidth: 2,
        cornerRadius: 4,
        text: "Frame",
        fontSize: 14,
        textColor: "gray",
        textAlign: "left",
        clipContent: true,
        opacity: 1,
      };
    case RoomWhiteboardElementType.DRAW:
      return {
        stroke: "slate",
        strokeWidth: 4,
        strokeStyle: "solid",
        points: [],
        highlighter: false,
        fill: "transparent",
        opacity: 1,
      };
    case RoomWhiteboardElementType.LINE:
    case RoomWhiteboardElementType.ARROW:
    case RoomWhiteboardElementType.CONNECTOR:
      return {
        stroke: "slate",
        strokeWidth: 2,
        strokeStyle: "solid",
        fill: "transparent",
        startArrowhead: "none",
        endArrowhead:
          type === RoomWhiteboardElementType.LINE ? "none" : "arrow",
        connectorShape:
          type === RoomWhiteboardElementType.CONNECTOR ? "elbow" : "straight",
        bend: 0,
        opacity: 1,
        fontSize: 14,
        text: "",
        textColor: "slate",
      };
    case RoomWhiteboardElementType.IMAGE:
      return {
        src: "",
        opacity: 1,
        cornerRadius: 4,
        fill: "transparent",
        stroke: "transparent",
        strokeWidth: 0,
      };
    default:
      // Bentuk tertutup: persegi, elips, diamond, segitiga.
      return {
        fill: "blue",
        fillStyle: "soft",
        stroke: "blue",
        strokeWidth: 2,
        strokeStyle: "solid",
        cornerRadius: 8,
        text: "",
        fontSize: 18,
        fontFamily: "sans",
        textColor: "slate",
        textAlign: "center",
        verticalAlign: "middle",
        autoFit: false,
        opacity: 1,
      };
  }
}

/** Ukuran awal saat elemen dibuat dengan sekali klik (tanpa drag). */
export function defaultSizeForType(type: WhiteboardElementType): {
  width: number;
  height: number;
} {
  switch (type) {
    case RoomWhiteboardElementType.STICKY:
      return { width: STICKY_DEFAULT_SIZE, height: STICKY_DEFAULT_SIZE };
    case RoomWhiteboardElementType.TEXT:
      return { width: 240, height: 40 };
    case RoomWhiteboardElementType.FRAME:
      return { width: FRAME_DEFAULT_WIDTH, height: FRAME_DEFAULT_HEIGHT };
    case RoomWhiteboardElementType.ELLIPSE:
      return { width: 160, height: 160 };
    default:
      return { width: 200, height: 140 };
  }
}
