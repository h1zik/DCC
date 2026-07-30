import { RoomWhiteboardElementType } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  computeSnap,
  elementAABB,
  elementsBounds,
  hitTestElement,
  normalizeBounds,
  pickElement,
  pickElementsInBox,
  resizeBox,
  scaleElementWithinBox,
  screenToWorld,
  simplifyStroke,
  worldToScreen,
  zoomAt,
  type Viewport,
} from "./geometry";
import type { WhiteboardElement, WhiteboardProps } from "./types";

function element(
  overrides: Partial<WhiteboardElement> & Pick<WhiteboardElement, "id" | "type">,
): WhiteboardElement {
  return {
    zIndex: 0,
    x: 0,
    y: 0,
    width: 100,
    height: 100,
    rotation: 0,
    props: {} as WhiteboardProps,
    locked: false,
    frameId: null,
    rev: 0,
    deleted: false,
    updatedById: null,
    ...overrides,
  };
}

describe("viewport", () => {
  const viewport: Viewport = { x: 40, y: -20, zoom: 2 };

  it("mengonversi layar <-> world secara bolak-balik", () => {
    const world = screenToWorld({ x: 140, y: 80 }, viewport);
    expect(world).toEqual({ x: 50, y: 50 });
    expect(worldToScreen(world, viewport)).toEqual({ x: 140, y: 80 });
  });

  it("zoom mempertahankan titik di bawah kursor", () => {
    const anchor = { x: 300, y: 200 };
    const before = screenToWorld(anchor, viewport);
    const zoomed = zoomAt(viewport, anchor, 3.5);
    const after = screenToWorld(anchor, zoomed);
    expect(after.x).toBeCloseTo(before.x, 6);
    expect(after.y).toBeCloseTo(before.y, 6);
  });

  it("membatasi zoom pada rentang yang didukung", () => {
    expect(zoomAt(viewport, { x: 0, y: 0 }, 1000).zoom).toBeLessThanOrEqual(8);
    expect(zoomAt(viewport, { x: 0, y: 0 }, 0).zoom).toBeGreaterThan(0);
  });
});

describe("kotak pembatas", () => {
  it("menormalkan dimensi negatif", () => {
    expect(normalizeBounds({ x: 100, y: 80, width: -60, height: -20 })).toEqual({
      x: 40,
      y: 60,
      width: 60,
      height: 20,
    });
  });

  it("panah yang digambar mundur tetap punya AABB yang benar", () => {
    // Panah dari (100,100) ke (40,60): width & height negatif.
    const arrow = element({
      id: "a",
      type: RoomWhiteboardElementType.ARROW,
      x: 100,
      y: 100,
      width: -60,
      height: -40,
    });
    expect(elementAABB(arrow)).toEqual({ x: 40, y: 60, width: 60, height: 40 });
  });

  it("menggabungkan kotak beberapa elemen", () => {
    const bounds = elementsBounds([
      element({ id: "a", type: RoomWhiteboardElementType.RECTANGLE, x: 0, y: 0 }),
      element({
        id: "b",
        type: RoomWhiteboardElementType.RECTANGLE,
        x: 200,
        y: 50,
        width: 50,
        height: 50,
      }),
    ]);
    expect(bounds).toEqual({ x: 0, y: 0, width: 250, height: 100 });
  });

  it("mengembalikan null untuk daftar kosong", () => {
    expect(elementsBounds([])).toBeNull();
  });
});

describe("hit-test", () => {
  it("elips hanya kena di dalam kurvanya, bukan di sudut kotaknya", () => {
    const ellipse = element({
      id: "e",
      type: RoomWhiteboardElementType.ELLIPSE,
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
    expect(hitTestElement(ellipse, { x: 50, y: 50 })).toBe(true);
    // Sudut kiri-atas kotak berada di luar lingkaran.
    expect(hitTestElement(ellipse, { x: 2, y: 2 })).toBe(false);
  });

  it("diamond memakai jarak manhattan ternormalisasi", () => {
    const diamond = element({
      id: "d",
      type: RoomWhiteboardElementType.DIAMOND,
      width: 100,
      height: 100,
    });
    expect(hitTestElement(diamond, { x: 50, y: 50 })).toBe(true);
    expect(hitTestElement(diamond, { x: 5, y: 5 })).toBe(false);
  });

  it("memperhitungkan rotasi elemen", () => {
    const rotated = element({
      id: "r",
      type: RoomWhiteboardElementType.RECTANGLE,
      x: 0,
      y: 0,
      width: 200,
      height: 20,
      rotation: Math.PI / 2,
    });
    // Setelah diputar 90°, batang jadi vertikal melewati pusat (100,10).
    expect(hitTestElement(rotated, { x: 100, y: 90 })).toBe(true);
    expect(hitTestElement(rotated, { x: 190, y: 10 })).toBe(false);
  });

  it("memilih elemen paling atas dan melewati yang terkunci", () => {
    const bottom = element({
      id: "bottom",
      type: RoomWhiteboardElementType.RECTANGLE,
      zIndex: 0,
    });
    const top = element({
      id: "top",
      type: RoomWhiteboardElementType.RECTANGLE,
      zIndex: 1,
    });
    expect(pickElement([bottom, top], { x: 50, y: 50 })?.id).toBe("top");

    const lockedTop = { ...top, locked: true };
    expect(pickElement([bottom, lockedTop], { x: 50, y: 50 })?.id).toBe("bottom");
  });

  it("marquee bisa menuntut elemen sepenuhnya di dalam kotak", () => {
    const inside = element({
      id: "in",
      type: RoomWhiteboardElementType.RECTANGLE,
      x: 10,
      y: 10,
      width: 20,
      height: 20,
    });
    const straddling = element({
      id: "out",
      type: RoomWhiteboardElementType.RECTANGLE,
      x: 90,
      y: 10,
      width: 40,
      height: 20,
    });
    const box = { x: 0, y: 0, width: 100, height: 100 };

    expect(
      pickElementsInBox([inside, straddling], box).map((el) => el.id),
    ).toEqual(["in", "out"]);
    expect(
      pickElementsInBox([inside, straddling], box, true).map((el) => el.id),
    ).toEqual(["in"]);
  });
});

describe("resize", () => {
  const origin = { x: 0, y: 0, width: 100, height: 50 };

  it("menarik gagang tenggara memperbesar tanpa memindahkan sudut asal", () => {
    expect(resizeBox(origin, "se", { x: 20, y: 10 })).toEqual({
      x: 0,
      y: 0,
      width: 120,
      height: 60,
    });
  });

  it("menarik gagang barat laut menggeser titik asal", () => {
    expect(resizeBox(origin, "nw", { x: 20, y: 10 })).toEqual({
      x: 20,
      y: 10,
      width: 80,
      height: 40,
    });
  });

  it("menjaga proporsi saat diminta", () => {
    const result = resizeBox(origin, "se", { x: 100, y: 0 }, { keepAspect: true });
    expect(result.width / result.height).toBeCloseTo(origin.width / origin.height, 6);
  });

  it("tidak mengecil di bawah ukuran minimum", () => {
    const result = resizeBox(origin, "se", { x: -1000, y: -1000 });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it("resize dari tengah menahan titik pusat", () => {
    const result = resizeBox(origin, "e", { x: 10, y: 0 }, { fromCenter: true });
    expect(result.x + result.width / 2).toBeCloseTo(50, 6);
  });
});

describe("penskalaan dalam grup", () => {
  const before = { x: 0, y: 0, width: 100, height: 100 };
  const after = { x: 0, y: 0, width: 200, height: 100 };

  it("menskalakan bentuk secara proporsional", () => {
    const rect = element({
      id: "r",
      type: RoomWhiteboardElementType.RECTANGLE,
      x: 50,
      y: 0,
      width: 50,
      height: 50,
    });
    expect(scaleElementWithinBox(rect, before, after)).toEqual({
      x: 100,
      y: 0,
      width: 100,
      height: 50,
    });
  });

  it("mempertahankan tanda & nol pada garis (tidak dipaksa ke ukuran minimum)", () => {
    const line = element({
      id: "l",
      type: RoomWhiteboardElementType.LINE,
      x: 80,
      y: 0,
      width: -40,
      height: 0,
    });
    const scaled = scaleElementWithinBox(line, before, after);
    expect(scaled.width).toBe(-80);
    expect(scaled.height).toBe(0);
  });
});

describe("snapping", () => {
  const other = { x: 0, y: 0, width: 100, height: 100 };

  it("menarik tepi yang hampir sejajar", () => {
    const moving = { x: 3, y: 200, width: 100, height: 100 };
    const snap = computeSnap(moving, [other], 6);
    expect(snap.dx).toBe(-3);
    expect(snap.guides.some((g) => g.axis === "x")).toBe(true);
  });

  it("tidak menarik apa pun di luar ambang", () => {
    const moving = { x: 40, y: 200, width: 100, height: 100 };
    const snap = computeSnap(moving, [other], 6);
    expect(snap.dx).toBe(0);
    expect(snap.dy).toBe(0);
    expect(snap.guides).toHaveLength(0);
  });

  it("tidak melakukan apa-apa tanpa elemen pembanding", () => {
    const snap = computeSnap({ x: 0, y: 0, width: 10, height: 10 }, [], 6);
    expect(snap).toEqual({ dx: 0, dy: 0, guides: [] });
  });
});

describe("penyederhanaan coretan", () => {
  it("membuang titik yang tidak mengubah bentuk garis lurus", () => {
    const points: [number, number, number][] = Array.from({ length: 50 }, (_, i) => [
      i * 2,
      0,
      0.5,
    ]);
    const simplified = simplifyStroke(points, 0.6);
    expect(simplified.length).toBeLessThan(points.length);
    expect(simplified[0]).toEqual(points[0]);
    expect(simplified[simplified.length - 1]).toEqual(points[points.length - 1]);
  });

  it("mempertahankan belokan tajam", () => {
    const points: [number, number, number][] = [
      [0, 0, 0.5],
      [10, 0, 0.5],
      [20, 0, 0.5],
      [20, 40, 0.5],
      [20, 80, 0.5],
    ];
    const simplified = simplifyStroke(points, 0.6);
    expect(simplified).toContainEqual([20, 0, 0.5]);
  });

  it("membiarkan coretan sangat pendek apa adanya", () => {
    const points: [number, number, number][] = [
      [0, 0, 0.5],
      [1, 1, 0.5],
    ];
    expect(simplifyStroke(points)).toEqual(points);
  });
});
