"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { RoomWhiteboardElementType } from "@prisma/client";
import { toast } from "sonner";
import { useTheme } from "next-themes";
import {
  boxCenter,
  clampZoom,
  computeSnap,
  elementAABB,
  elementsBounds,
  hitTestElement,
  MIN_ELEMENT_SIZE,
  pickElement,
  pickElementsInBox,
  resizeBox,
  rotatePoint,
  round,
  scaleElementWithinBox,
  screenToWorld,
  simplifyStroke,
  snapAngle,
  zoomAt,
  type Box,
  type Point,
  type ResizeHandle,
  type SnapGuide,
  type Viewport,
} from "@/lib/whiteboard/geometry";
import type { SerializedElement } from "@/lib/whiteboard/serialize";
import {
  DRAG_CREATE_TOOLS,
  TOOL_META,
  toolByShortcut,
  type WhiteboardTool,
} from "@/lib/whiteboard/tools";
import {
  CLOSED_SHAPE_TYPES,
  defaultPropsForType,
  defaultSizeForType,
  LINEAR_TYPES,
  TEXT_CAPABLE_TYPES,
  type WhiteboardBackground,
  type WhiteboardElement,
  type WhiteboardElementInput,
  type WhiteboardElementPatch,
  type WhiteboardMutation,
  type WhiteboardProps,
} from "@/lib/whiteboard/types";
import { emptyMutation, useBoardStore } from "./use-board-store";
import { useWhiteboardSync, type DraftPatch } from "./use-whiteboard-sync";
import { WhiteboardElementNode } from "./whiteboard-element";
import { WhiteboardToolbar } from "./whiteboard-toolbar";
import { WhiteboardStylePanel } from "./whiteboard-style-panel";
import { WhiteboardPresenceLayer, WhiteboardPresenceBar } from "./whiteboard-presence";
import { WhiteboardTextEditor } from "./whiteboard-text-editor";
import { WhiteboardMinimap } from "./whiteboard-minimap";
import { WhiteboardZoomControls } from "./whiteboard-zoom-controls";
import { WhiteboardContextMenu, type ContextMenuState } from "./whiteboard-context-menu";
import { exportBoard, renderBoardThumbnail } from "./export";
import { saveRoomWhiteboardThumbnail } from "@/actions/room-whiteboards";

/**
 * Kanvas whiteboard: viewport tak terbatas, alat gambar, seleksi, dan
 * kolaborasi realtime.
 *
 * Interaksi ditangani sebagai mesin keadaan kecil di `interactionRef`. Selama
 * satu gerakan berlangsung (geser, ubah ukuran, putar, gambar), state-nya
 * tinggal di ref dan render dipicu per frame lewat `requestAnimationFrame` —
 * ini yang membuat papan tetap 60fps walau isinya ratusan objek.
 */

export type BoardMeta = {
  id: string;
  title: string;
  rev: number;
  background: string;
};

type Interaction =
  | { kind: "idle" }
  | { kind: "pan"; startScreen: Point; startViewport: Viewport }
  | {
      kind: "marquee";
      startWorld: Point;
      currentWorld: Point;
      additive: boolean;
      baseSelection: string[];
    }
  | {
      kind: "translate";
      startWorld: Point;
      currentWorld: Point;
      originals: Map<string, { x: number; y: number }>;
      moved: boolean;
      guides: SnapGuide[];
      staticBoxes: Box[];
      groupBox: Box;
    }
  | {
      kind: "resize";
      handle: ResizeHandle;
      startWorld: Point;
      originals: Map<string, WhiteboardElement>;
      groupBox: Box;
      /** Rotasi elemen tunggal — resize dilakukan di ruang lokalnya. */
      rotation: number;
    }
  | {
      kind: "rotate";
      center: Point;
      startAngle: number;
      originals: Map<string, { rotation: number; x: number; y: number; width: number; height: number }>;
    }
  | {
      kind: "create";
      tool: WhiteboardTool;
      startWorld: Point;
      currentWorld: Point;
      /** Ujung awal konektor kalau ditarik dari sebuah elemen. */
      startAttach: { elementId: string } | null;
    }
  | {
      kind: "draw";
      elementId: string;
      origin: Point;
      points: [number, number, number][];
      highlighter: boolean;
    }
  | { kind: "erase"; erased: Set<string> }
  | {
      kind: "endpoint";
      elementId: string;
      end: "start" | "end";
    };

/**
 * Bagian dari interaksi berjalan yang perlu digambar ulang tiap frame.
 * Elemen yang sedang digeser/diubah ukurannya tidak masuk sini — perubahannya
 * sudah tercermin lewat `applyTransient` di store.
 */
type Preview =
  | null
  | { kind: "marquee"; start: Point; current: Point }
  | { kind: "create"; tool: WhiteboardTool; start: Point; current: Point }
  | {
      kind: "draw";
      origin: Point;
      points: [number, number, number][];
      highlighter: boolean;
    }
  | { kind: "guides"; guides: SnapGuide[] }
  | { kind: "erase"; ids: string[] };

const SNAP_PX = 6;
const CLICK_SLOP_PX = 4;

const emptySubscribe = () => () => {};
const HANDLE_SCREEN_SIZE = 9;
const ROTATE_HANDLE_OFFSET = 26;

export function BoardCanvas({
  roomId,
  board,
  initialElements,
  currentUser,
  onRequestRename,
}: {
  roomId: string;
  board: BoardMeta;
  initialElements: SerializedElement[];
  currentUser: { id: string; name: string; image: string | null };
  onRequestRename?: () => void;
}) {
  const store = useBoardStore(initialElements);
  // Dipakai langsung (bukan lewat `store.x`) supaya dependency tiap hook
  // menunjuk ke nilai yang stabil, bukan ke objek store yang dibuat ulang.
  const {
    elements,
    elementsRef,
    ordered,
    apply: applyMutation,
    undo,
    redo,
    applyTransient,
    applyRemote,
    pushHistory,
    canUndo,
    canRedo,
  } = store;
  /**
   * Kanvas hanya dirender setelah mount.
   *
   * Dua hal yang dipakai kanvas tidak ada di server: tema yang sudah
   * diresolusi (next-themes baru tahu setelah hidrasi) dan pengukuran teks
   * lewat Canvas 2D. Keduanya membuat markup server dan klien pasti berbeda,
   * jadi lebih baik menunggu daripada memicu hydration mismatch.
   * `useSyncExternalStore` dipakai karena aman untuk SSR tanpa setState di
   * dalam effect.
   */
  const mounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [viewport, setViewport] = useState<Viewport>({ x: 0, y: 0, zoom: 1 });
  const [tool, setTool] = useState<WhiteboardTool>("select");
  const [selection, setSelection] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [spacePressed, setSpacePressed] = useState(false);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [hasClipboard, setHasClipboard] = useState(false);

  /** Gaya terakhir yang dipakai — diwariskan ke elemen berikutnya. */
  const [styleDefaults, setStyleDefaults] = useState<WhiteboardProps>({});

  /**
   * Cermin state terkini untuk handler pointer & papan tik.
   *
   * Handler-handler ini dipasang sekali dan dipanggil puluhan kali per detik;
   * kalau identitasnya ikut berubah setiap state berubah, listener harus
   * dipasang ulang terus-menerus. Menyalin ke ref (di dalam effect, bukan saat
   * render) membuat handler tetap stabil tapi selalu membaca nilai terbaru.
   */
  const viewportRef = useRef(viewport);
  const toolRef = useRef(tool);
  const selectionRef = useRef(selection);
  const styleDefaultsRef = useRef(styleDefaults);

  useEffect(() => {
    viewportRef.current = viewport;
    toolRef.current = tool;
    selectionRef.current = selection;
    styleDefaultsRef.current = styleDefaults;
  });

  /**
   * Keadaan gerakan yang sedang berlangsung. Disimpan di ref agar handler
   * pointer bisa memutakhirkannya puluhan kali per detik tanpa memicu render.
   */
  const interactionRef = useRef<Interaction>({ kind: "idle" });

  /**
   * Cuplikan dari `interactionRef` yang memang perlu digambar (kotak seleksi
   * sementara, pratinjau bentuk, coretan berjalan, garis panduan). Dipisah
   * sebagai state supaya render tidak pernah membaca ref — pola yang aman
   * untuk React Compiler.
   */
  const [preview, setPreview] = useState<Preview>(null);
  const previewFrameRef = useRef<number | null>(null);

  /** Jadwalkan pembaruan pratinjau maksimal sekali per frame. */
  const schedulePreview = useCallback((next: () => Preview) => {
    if (previewFrameRef.current !== null) return;
    previewFrameRef.current = requestAnimationFrame(() => {
      previewFrameRef.current = null;
      setPreview(next());
    });
  }, []);

  const clearPreview = useCallback(() => {
    if (previewFrameRef.current !== null) {
      cancelAnimationFrame(previewFrameRef.current);
      previewFrameRef.current = null;
    }
    setPreview(null);
  }, []);

  useEffect(
    () => () => {
      if (previewFrameRef.current !== null) {
        cancelAnimationFrame(previewFrameRef.current);
      }
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Sinkronisasi
  // -------------------------------------------------------------------------

  const handleRemote = useCallback(
    (incoming: SerializedElement[]) => applyRemote(incoming),
    [applyRemote],
  );

  const sync = useWhiteboardSync({
    roomId,
    boardId: board.id,
    initialRev: board.rev,
    onRemoteElements: handleRemote,
  });

  const { commit, markDirty, clearDirty, sendPresence, sendDraft, endDraft } = sync;

  /** Terapkan lokal + kirim ke server dalam satu langkah. */
  const applyAndCommit = useCallback(
    (mutation: WhiteboardMutation, options?: { coalesceKey?: string }) => {
      const applied = applyMutation(mutation, options);
      if (!applied) return;
      void commit(applied).catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Gagal menyimpan perubahan.",
        );
      });
    },
    [commit, applyMutation],
  );

  // -------------------------------------------------------------------------
  // Ukuran kontainer & posisi awal
  // -------------------------------------------------------------------------

  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (rect) setSize({ width: rect.width, height: rect.height });
    });
    observer.observe(node);
    setSize({ width: node.clientWidth, height: node.clientHeight });
    return () => observer.disconnect();
  }, []);

  const didInitialFit = useRef(false);
  useEffect(() => {
    if (didInitialFit.current || size.width === 0) return;
    didInitialFit.current = true;
    const bounds = elementsBounds(ordered);
    if (!bounds || bounds.width === 0 || bounds.height === 0) {
      // Papan kosong: taruh titik (0,0) di tengah layar.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- posisi awal baru bisa dihitung setelah ResizeObserver melaporkan ukuran kanvas; hanya sekali per papan
      setViewport({ x: size.width / 2, y: size.height / 2, zoom: 1 });
      return;
    }
    setViewport(fitViewport(bounds, size, 0.85));
  }, [size, ordered]);

  // -------------------------------------------------------------------------
  // Konversi koordinat
  // -------------------------------------------------------------------------

  const pointerScreen = useCallback((event: { clientX: number; clientY: number }): Point => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }, []);

  const pointerWorld = useCallback(
    (event: { clientX: number; clientY: number }): Point =>
      screenToWorld(pointerScreen(event), viewportRef.current),
    [pointerScreen],
  );

  // -------------------------------------------------------------------------
  // Bantuan seleksi
  // -------------------------------------------------------------------------

  const selectedElements = useMemo(
    () =>
      selection
        .map((id) => elements.get(id))
        .filter((el): el is WhiteboardElement => Boolean(el)),
    [selection, elements],
  );

  const selectionBox = useMemo(
    () => elementsBounds(selectedElements),
    [selectedElements],
  );

  const nextZIndex = useCallback(() => {
    let max = 0;
    for (const el of elementsRef.current.values()) {
      if (el.zIndex > max) max = el.zIndex;
    }
    return max + 1;
  }, [elementsRef]);

  const getElement = useCallback(
    (id: string) => elements.get(id),
    [elements],
  );

  // -------------------------------------------------------------------------
  // Membuat elemen
  // -------------------------------------------------------------------------

  const newId = useCallback(
    () =>
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `el-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    [],
  );

  const buildElement = useCallback(
    (
      type: WhiteboardElement["type"],
      box: Box,
      extraProps: WhiteboardProps = {},
    ): WhiteboardElementInput => {
      const base = defaultPropsForType(type);
      // Warisi gaya terakhir hanya untuk atribut yang relevan dengan tipe ini.
      const inherited = inheritableStyle(styleDefaultsRef.current, type);
      return {
        id: newId(),
        type,
        zIndex: nextZIndex(),
        x: box.x,
        y: box.y,
        width: box.width,
        height: box.height,
        rotation: 0,
        props: { ...base, ...inherited, ...extraProps },
        locked: false,
        frameId: null,
      };
    },
    [newId, nextZIndex],
  );

  // -------------------------------------------------------------------------
  // Penyuntingan teks
  // -------------------------------------------------------------------------

  const startEditing = useCallback((id: string) => {
    setEditingId(id);
    setSelection([id]);
  }, []);

  const commitText = useCallback(
    (id: string, text: string) => {
      const current = elementsRef.current.get(id);
      if (!current) return;
      if ((current.props.text ?? "") === text) {
        // Teks baru yang dibiarkan kosong tidak perlu ditinggalkan di kanvas.
        if (text.trim() === "" && current.type === RoomWhiteboardElementType.TEXT) {
          applyAndCommit({ ...emptyMutation(), delete: [id] });
        }
        return;
      }
      if (text.trim() === "" && current.type === RoomWhiteboardElementType.TEXT) {
        applyAndCommit({ ...emptyMutation(), delete: [id] });
        return;
      }
      applyAndCommit(
        {
          ...emptyMutation(),
          update: [{ id, props: { text } }],
        },
        { coalesceKey: `text:${id}` },
      );
    },
    [applyAndCommit, elementsRef],
  );

  // -------------------------------------------------------------------------
  // Penghapus
  // -------------------------------------------------------------------------

  const eraseAt = useCallback(
    (world: Point, tolerance: number) => {
      const state = interactionRef.current;
      if (state.kind !== "erase") return;
      for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const el = ordered[i]!;
        if (el.locked || state.erased.has(el.id)) continue;
        if (hitTestElement(el, world, tolerance)) {
          state.erased.add(el.id);
        }
      }
      setPreview({ kind: "erase", ids: [...state.erased] });
    },
    [ordered],
  );

  // -------------------------------------------------------------------------
  // Pointer: mulai
  // -------------------------------------------------------------------------

  const onPointerDown = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button === 1 || (event.button === 0 && spacePressed)) {
        // Klik tengah / spasi = geser kanvas.
        interactionRef.current = {
          kind: "pan",
          startScreen: pointerScreen(event),
          startViewport: viewportRef.current,
        };
        svgRef.current?.setPointerCapture(event.pointerId);
        event.preventDefault();
        return;
      }
      if (event.button === 2) return; // Ditangani oleh context menu.
      if (event.button !== 0) return;

      setContextMenu(null);
      const world = pointerWorld(event);
      const activeTool = toolRef.current;
      const zoom = viewportRef.current.zoom;
      const tolerance = 4 / zoom;

      if (editingId) {
        // Klik di luar teks yang sedang disunting menutup editor dulu.
        setEditingId(null);
      }

      svgRef.current?.setPointerCapture(event.pointerId);

      if (activeTool === "hand") {
        interactionRef.current = {
          kind: "pan",
          startScreen: pointerScreen(event),
          startViewport: viewportRef.current,
        };
        return;
      }

      if (activeTool === "laser") {
        // Laser hanya efemeral — tidak membuat apa pun.
        return;
      }

      if (activeTool === "eraser") {
        interactionRef.current = { kind: "erase", erased: new Set() };
        eraseAt(world, tolerance);
        return;
      }

      if (activeTool === "draw" || activeTool === "highlighter") {
        const highlighter = activeTool === "highlighter";
        const id = newId();
        interactionRef.current = {
          kind: "draw",
          elementId: id,
          origin: world,
          points: [[0, 0, event.pressure || 0.5]],
          highlighter,
        };
        setPreview({
          kind: "draw",
          origin: world,
          points: [[0, 0, event.pressure || 0.5]],
          highlighter,
        });
        return;
      }

      if (DRAG_CREATE_TOOLS.has(activeTool)) {
        let startAttach: { elementId: string } | null = null;
        if (activeTool === "connector") {
          const target = pickElement(ordered, world, tolerance);
          if (target && !LINEAR_TYPES.has(target.type)) {
            startAttach = { elementId: target.id };
          }
        }
        interactionRef.current = {
          kind: "create",
          tool: activeTool,
          startWorld: world,
          currentWorld: world,
          startAttach,
        };
        setPreview({
          kind: "create",
          tool: activeTool,
          start: world,
          current: world,
        });
        return;
      }

      // --- Alat pilih ---------------------------------------------------
      const handle = hitTestSelectionHandles(
        world,
        selectionBox,
        selectedElements,
        zoom,
      );
      if (handle) {
        if (handle.type === "rotate") {
          const center = boxCenter(selectionBox!);
          interactionRef.current = {
            kind: "rotate",
            center,
            startAngle: Math.atan2(world.y - center.y, world.x - center.x),
            originals: new Map(
              selectedElements.map((el) => [
                el.id,
                {
                  rotation: el.rotation,
                  x: el.x,
                  y: el.y,
                  width: el.width,
                  height: el.height,
                },
              ]),
            ),
          };
        } else if (handle.type === "endpoint") {
          interactionRef.current = {
            kind: "endpoint",
            elementId: selectedElements[0]!.id,
            end: handle.end,
          };
        } else {
          interactionRef.current = {
            kind: "resize",
            handle: handle.handle,
            startWorld: world,
            originals: new Map(selectedElements.map((el) => [el.id, el])),
            groupBox: selectionBox!,
            rotation:
              selectedElements.length === 1 ? selectedElements[0]!.rotation : 0,
          };
        }
        markDirty(selectionRef.current);
        return;
      }

      const hit = pickElement(ordered, world, tolerance);
      const additive = event.shiftKey || event.metaKey || event.ctrlKey;

      if (!hit) {
        interactionRef.current = {
          kind: "marquee",
          startWorld: world,
          currentWorld: world,
          additive,
          baseSelection: additive ? selectionRef.current : [],
        };
        if (!additive) setSelection([]);
        setPreview({ kind: "marquee", start: world, current: world });
        return;
      }

      let nextSelection = selectionRef.current;
      if (additive) {
        nextSelection = selectionRef.current.includes(hit.id)
          ? selectionRef.current.filter((id) => id !== hit.id)
          : [...selectionRef.current, hit.id];
        setSelection(nextSelection);
      } else if (!selectionRef.current.includes(hit.id)) {
        nextSelection = [hit.id];
        setSelection(nextSelection);
      }

      const moving = nextSelection
        .map((id) => elementsRef.current.get(id))
        .filter((el): el is WhiteboardElement => el !== undefined && !el.locked);
      if (moving.length === 0) return;

      const movingIds = new Set(moving.map((el) => el.id));
      const groupBox = elementsBounds(moving)!;
      interactionRef.current = {
        kind: "translate",
        startWorld: world,
        currentWorld: world,
        originals: new Map(moving.map((el) => [el.id, { x: el.x, y: el.y }])),
        moved: false,
        guides: [],
        staticBoxes: ordered
          .filter((el) => !movingIds.has(el.id))
          .map(elementAABB),
        groupBox,
      };
      markDirty(movingIds);
    },
    [
      elementsRef,
      ordered,
      spacePressed,
      pointerScreen,
      pointerWorld,
      viewportRef,
      toolRef,
      selectionRef,
      editingId,
      newId,
      eraseAt,
      selectionBox,
      selectedElements,
      markDirty,
    ],
  );

  // -------------------------------------------------------------------------
  // Pointer: bergerak
  // -------------------------------------------------------------------------

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const world = pointerWorld(event);
      const state = interactionRef.current;
      const zoom = viewportRef.current.zoom;

      // Kabarkan posisi kursor ke peserta lain.
      sendPresence({
        cursor: world,
        selection: selectionRef.current,
        tool: toolRef.current,
      });

      switch (state.kind) {
        case "pan": {
          const now = pointerScreen(event);
          setViewport({
            ...state.startViewport,
            x: state.startViewport.x + (now.x - state.startScreen.x),
            y: state.startViewport.y + (now.y - state.startScreen.y),
          });
          return;
        }
        case "marquee": {
          state.currentWorld = world;
          const box = normalizeBox(state.startWorld, world);
          const hits = pickElementsInBox(ordered, box);
          const ids = hits.map((el) => el.id);
          setSelection(
            state.additive
              ? [...new Set([...state.baseSelection, ...ids])]
              : ids,
          );
          setPreview({ kind: "marquee", start: state.startWorld, current: world });
          return;
        }
        case "translate": {
          state.currentWorld = world;
          let dx = world.x - state.startWorld.x;
          let dy = world.y - state.startWorld.y;
          if (Math.abs(dx) > CLICK_SLOP_PX / zoom || Math.abs(dy) > CLICK_SLOP_PX / zoom) {
            state.moved = true;
          }
          if (event.shiftKey) {
            // Kunci ke sumbu dominan.
            if (Math.abs(dx) > Math.abs(dy)) dy = 0;
            else dx = 0;
          }

          let guides: SnapGuide[] = [];
          if (!event.altKey) {
            const moved: Box = {
              x: state.groupBox.x + dx,
              y: state.groupBox.y + dy,
              width: state.groupBox.width,
              height: state.groupBox.height,
            };
            const snap = computeSnap(moved, state.staticBoxes, SNAP_PX / zoom);
            dx += snap.dx;
            dy += snap.dy;
            guides = snap.guides;
          }
          state.guides = guides;

          const update: WhiteboardElementPatch[] = [];
          for (const [id, origin] of state.originals) {
            update.push({ id, x: origin.x + dx, y: origin.y + dy });
          }
          applyTransient({ ...emptyMutation(), update });
          sendDraft(update as DraftPatch[]);
          setPreview(guides.length > 0 ? { kind: "guides", guides } : null);
          return;
        }
        case "resize": {
          const single = state.originals.size === 1;
          // Untuk elemen tunggal yang diputar, hitung di ruang lokalnya.
          const localStart = single && state.rotation
            ? rotatePoint(state.startWorld, boxCenter(state.groupBox), -state.rotation)
            : state.startWorld;
          const localNow = single && state.rotation
            ? rotatePoint(world, boxCenter(state.groupBox), -state.rotation)
            : world;
          const delta = { x: localNow.x - localStart.x, y: localNow.y - localStart.y };

          const keepAspect =
            event.shiftKey ||
            (single &&
              [...state.originals.values()][0]!.type ===
                RoomWhiteboardElementType.IMAGE);
          const after = resizeBox(state.groupBox, state.handle, delta, {
            keepAspect,
            fromCenter: event.altKey,
          });

          const update: WhiteboardElementPatch[] = [];
          for (const [id, original] of state.originals) {
            const scaled = scaleElementWithinBox(original, state.groupBox, after);
            update.push({ id, ...scaled });
          }
          applyTransient({ ...emptyMutation(), update });
          sendDraft(update as DraftPatch[]);
          return;
        }
        case "rotate": {
          const angle = Math.atan2(world.y - state.center.y, world.x - state.center.x);
          let delta = angle - state.startAngle;
          if (event.shiftKey) delta = snapAngle(delta);

          const update: WhiteboardElementPatch[] = [];
          for (const [id, original] of state.originals) {
            // Selain memutar elemennya, pusatnya ikut mengorbit titik pusat grup.
            const center = {
              x: original.x + original.width / 2,
              y: original.y + original.height / 2,
            };
            const rotated = rotatePoint(center, state.center, delta);
            update.push({
              id,
              rotation: original.rotation + delta,
              x: rotated.x - original.width / 2,
              y: rotated.y - original.height / 2,
            });
          }
          applyTransient({ ...emptyMutation(), update });
          sendDraft(update as DraftPatch[]);
          return;
        }
        case "create": {
          state.currentWorld = world;
          const creating = state;
          schedulePreview(() => ({
            kind: "create",
            tool: creating.tool,
            start: creating.startWorld,
            current: creating.currentWorld,
          }));
          return;
        }
        case "draw": {
          const local: [number, number, number] = [
            world.x - state.origin.x,
            world.y - state.origin.y,
            event.pressure || 0.5,
          ];
          const last = state.points[state.points.length - 1];
          // Buang titik yang terlalu rapat agar payload tidak membengkak.
          if (
            !last ||
            Math.hypot(local[0] - last[0], local[1] - last[1]) > 1 / zoom
          ) {
            state.points.push(local);
            const drawing = state;
            schedulePreview(() => ({
              kind: "draw",
              origin: drawing.origin,
              points: [...drawing.points],
              highlighter: drawing.highlighter,
            }));
          }
          return;
        }
        case "erase": {
          eraseAt(world, 4 / zoom);
          return;
        }
        case "endpoint": {
          const element = elementsRef.current.get(state.elementId);
          if (!element) return;
          const patch: WhiteboardElementPatch =
            state.end === "start"
              ? {
                  id: element.id,
                  x: world.x,
                  y: world.y,
                  width: element.x + element.width - world.x,
                  height: element.y + element.height - world.y,
                }
              : {
                  id: element.id,
                  width: world.x - element.x,
                  height: world.y - element.y,
                };
          applyTransient({ ...emptyMutation(), update: [patch] });
          sendDraft([patch as DraftPatch]);
          return;
        }
        default:
          return;
      }
    },
    [
      applyTransient,
      elementsRef,
      ordered,
      pointerWorld,
      pointerScreen,
      sendPresence,
      sendDraft,
      schedulePreview,
      eraseAt,
    ],
  );

  // -------------------------------------------------------------------------
  // Pointer: selesai
  // -------------------------------------------------------------------------

  /** Sisipkan entri riwayat buatan tangan (untuk interaksi bertahap). */
  const pushManualHistory = useCallback(
    (forward: WhiteboardMutation, backward: WhiteboardMutation) => {
      pushHistory(forward, backward);
    },
    [pushHistory],
  );

  /**
   * Commit hasil interaksi bertahap dengan riwayat yang memakai nilai
   * *sebelum* gerakan dimulai — bukan posisi antara yang sempat ditulis
   * `applyTransient` selama pointer masih ditekan.
   */
  const commitFromOriginals = useCallback(
    <T,>(
      update: WhiteboardElementPatch[],
      originals: Map<string, T>,
      toInverse: (id: string, origin: T) => WhiteboardElementPatch,
    ) => {
      if (update.length === 0) return;
      const mutation = { ...emptyMutation(), update };
      const inverse = [...originals.entries()].map(([id, origin]) =>
        toInverse(id, origin),
      );
      applyMutation(mutation, { history: false });
      pushManualHistory(mutation, { ...emptyMutation(), update: inverse });
      void commit(mutation).catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Gagal menyimpan perubahan.",
        );
      });
    },
    [pushManualHistory, commit, applyMutation],
  );

  const finishCreate = useCallback(
    (
      creating: Extract<Interaction, { kind: "create" }>,
      endWorld: Point,
      keepTool: boolean,
    ) => {
      const zoom = viewportRef.current.zoom;
      const type = TOOL_META[creating.tool].creates;
      if (!type) return;

      const dragged =
        Math.hypot(
          endWorld.x - creating.startWorld.x,
          endWorld.y - creating.startWorld.y,
        ) * zoom;

      if (LINEAR_TYPES.has(type)) {
        if (dragged < CLICK_SLOP_PX) return;
        const endTarget =
          creating.tool === "connector"
            ? pickElement(ordered, endWorld, 4 / zoom)
            : null;
        const extra: WhiteboardProps = {};
        if (creating.startAttach || endTarget) {
          extra.start = {
            elementId: creating.startAttach?.elementId ?? null,
            side: "auto",
            x: creating.startWorld.x,
            y: creating.startWorld.y,
          };
          extra.end = {
            elementId:
              endTarget && endTarget.id !== creating.startAttach?.elementId
                ? endTarget.id
                : null,
            side: "auto",
            x: endWorld.x,
            y: endWorld.y,
          };
        }
        const element = buildElement(
          type,
          {
            x: creating.startWorld.x,
            y: creating.startWorld.y,
            width: endWorld.x - creating.startWorld.x,
            height: endWorld.y - creating.startWorld.y,
          },
          extra,
        );
        applyAndCommit({ ...emptyMutation(), create: [element] });
        setSelection([element.id]);
        if (!keepTool) setTool("select");
        return;
      }

      const box =
        dragged < CLICK_SLOP_PX
          ? centeredBox(creating.startWorld, defaultSizeForType(type))
          : normalizeBox(creating.startWorld, endWorld);

      if (box.width < MIN_ELEMENT_SIZE || box.height < MIN_ELEMENT_SIZE) {
        const fallback = defaultSizeForType(type);
        box.width = Math.max(box.width, fallback.width);
        box.height = Math.max(box.height, fallback.height);
      }

      const element = buildElement(type, box);
      applyAndCommit({ ...emptyMutation(), create: [element] });
      setSelection([element.id]);

      // Sticky & teks yang dibuat dengan sekali klik langsung masuk mode
      // ketik — itu memang alurnya di Miro. Bentuk yang digambar dengan
      // menarik TIDAK, karena yang biasanya diinginkan berikutnya adalah
      // mengatur warna/garis, dan editor teks menutupi panel gaya. Untuk
      // mengetik di dalam bentuk: klik ganda atau tekan Enter.
      const clickCreated = dragged < CLICK_SLOP_PX;
      const autoEdit =
        clickCreated &&
        (type === RoomWhiteboardElementType.STICKY ||
          type === RoomWhiteboardElementType.TEXT);
      if (autoEdit) setEditingId(element.id);

      if (!keepTool) setTool("select");
    },
    [ordered, viewportRef, buildElement, applyAndCommit],
  );

  const finishDraw = useCallback(
    (drawing: Extract<Interaction, { kind: "draw" }>) => {
      const zoom = viewportRef.current.zoom;
      const simplified = simplifyStroke(drawing.points, 0.7 / zoom);
      if (simplified.length < 2) return;

      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [px, py] of simplified) {
        if (px < minX) minX = px;
        if (py < minY) minY = py;
        if (px > maxX) maxX = px;
        if (py > maxY) maxY = py;
      }
      // Normalisasi: titik disimpan relatif terhadap sudut kiri-atas.
      const normalized = simplified.map(
        ([px, py, pressure]) =>
          [px - minX, py - minY, pressure] as [number, number, number],
      );
      const defaults = styleDefaultsRef.current;
      const strokeWidth = defaults.strokeWidth ?? (drawing.highlighter ? 18 : 4);

      const element = buildElement(
        RoomWhiteboardElementType.DRAW,
        {
          x: drawing.origin.x + minX,
          y: drawing.origin.y + minY,
          width: Math.max(1, maxX - minX),
          height: Math.max(1, maxY - minY),
        },
        {
          points: normalized,
          highlighter: drawing.highlighter,
          strokeWidth: drawing.highlighter
            ? Math.max(12, strokeWidth)
            : strokeWidth,
          stroke: drawing.highlighter
            ? (defaults.stroke ?? "yellow")
            : (defaults.stroke ?? "slate"),
        },
      );
      applyAndCommit({ ...emptyMutation(), create: [element] });
    },
    [viewportRef, styleDefaultsRef, buildElement, applyAndCommit],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      const state = interactionRef.current;
      interactionRef.current = { kind: "idle" };
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer sudah lepas.
      }

      const world = pointerWorld(event);

      switch (state.kind) {
        case "translate": {
          endDraft();
          if (state.moved) {
            const update: WhiteboardElementPatch[] = [];
            for (const id of state.originals.keys()) {
              const el = elementsRef.current.get(id);
              if (!el) continue;
              update.push({ id, x: el.x, y: el.y });
            }
            commitFromOriginals(update, state.originals, (id, origin) => ({
              id,
              x: origin.x,
              y: origin.y,
            }));
          }
          clearDirty(state.originals.keys());
          break;
        }
        case "resize":
        case "rotate": {
          endDraft();
          const ids = [...state.originals.keys()];
          const update: WhiteboardElementPatch[] = [];
          for (const id of ids) {
            const el = elementsRef.current.get(id);
            if (!el) continue;
            update.push({
              id,
              x: el.x,
              y: el.y,
              width: el.width,
              height: el.height,
              rotation: el.rotation,
            });
          }
          commitFromOriginals(update, state.originals, (id, origin) => ({
            id,
            x: origin.x,
            y: origin.y,
            width: origin.width,
            height: origin.height,
            rotation: "rotation" in origin ? origin.rotation : 0,
          }));
          clearDirty(ids);
          break;
        }
        case "endpoint": {
          endDraft();
          const el = elementsRef.current.get(state.elementId);
          if (el) {
            applyAndCommit({
              ...emptyMutation(),
              update: [
                {
                  id: el.id,
                  x: el.x,
                  y: el.y,
                  width: el.width,
                  height: el.height,
                },
              ],
            });
          }
          clearDirty([state.elementId]);
          break;
        }
        case "create":
          finishCreate(state, world, event.shiftKey);
          break;
        case "draw":
          finishDraw(state);
          break;
        case "erase":
          if (state.erased.size > 0) {
            applyAndCommit({ ...emptyMutation(), delete: [...state.erased] });
          }
          break;
        default:
          break;
      }

      clearPreview();
    },
    [
      elementsRef,
      pointerWorld,
      endDraft,
      clearDirty,
      applyAndCommit,
      commitFromOriginals,
      finishCreate,
      finishDraw,
      clearPreview,
    ],
  );

  // -------------------------------------------------------------------------
  // Zoom & scroll
  // -------------------------------------------------------------------------

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const rect = node.getBoundingClientRect();
      const screen = { x: event.clientX - rect.left, y: event.clientY - rect.top };

      if (event.ctrlKey || event.metaKey) {
        // Pinch-zoom trackpad & Ctrl+scroll.
        const factor = Math.exp(-event.deltaY * 0.01);
        setViewport((v) => zoomAt(v, screen, v.zoom * factor));
        return;
      }
      if (event.shiftKey) {
        setViewport((v) => ({ ...v, x: v.x - event.deltaY, y: v.y }));
        return;
      }
      setViewport((v) => ({ ...v, x: v.x - event.deltaX, y: v.y - event.deltaY }));
    };

    node.addEventListener("wheel", onWheel, { passive: false });
    return () => node.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = useCallback(
    (factor: number) => {
      const center = { x: size.width / 2, y: size.height / 2 };
      setViewport((v) => zoomAt(v, center, v.zoom * factor));
    },
    [size],
  );

  const zoomTo = useCallback(
    (zoom: number) => {
      const center = { x: size.width / 2, y: size.height / 2 };
      setViewport((v) => zoomAt(v, center, zoom));
    },
    [size],
  );

  const zoomToFit = useCallback(
    (targets?: WhiteboardElement[]) => {
      const bounds = elementsBounds(targets ?? ordered);
      if (!bounds || size.width === 0) return;
      setViewport(fitViewport(bounds, size, 0.85));
    },
    [ordered, size],
  );

  // -------------------------------------------------------------------------
  // Aksi pada seleksi
  // -------------------------------------------------------------------------

  const deleteSelection = useCallback(() => {
    const ids = selectionRef.current.filter((id) => {
      const el = elementsRef.current.get(id);
      return el && !el.locked;
    });
    if (ids.length === 0) return;
    applyAndCommit({ ...emptyMutation(), delete: ids });
    setSelection([]);
  }, [applyAndCommit, elementsRef]);

  const duplicateSelection = useCallback(
    (offset = 24) => {
      const originals = selectionRef.current
        .map((id) => elementsRef.current.get(id))
        .filter((el): el is WhiteboardElement => Boolean(el));
      if (originals.length === 0) return;

      const idMap = new Map(originals.map((el) => [el.id, newId()]));
      let z = nextZIndex();
      const create: WhiteboardElementInput[] = originals.map((el) => ({
        id: idMap.get(el.id)!,
        type: el.type,
        zIndex: z++,
        x: el.x + offset,
        y: el.y + offset,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        props: remapConnectorProps(el.props, idMap),
        locked: false,
        frameId: el.frameId ? (idMap.get(el.frameId) ?? null) : null,
      }));
      applyAndCommit({ ...emptyMutation(), create });
      setSelection(create.map((el) => el.id));
    },
    [newId, nextZIndex, applyAndCommit, elementsRef],
  );

  const updateSelectionProps = useCallback(
    (props: WhiteboardProps, coalesceKey?: string) => {
      const ids = selectionRef.current.filter((id) =>
        elementsRef.current.has(id),
      );
      setStyleDefaults((prev) => ({ ...prev, ...props }));
      if (ids.length === 0) return;
      applyAndCommit(
        { ...emptyMutation(), update: ids.map((id) => ({ id, props })) },
        coalesceKey ? { coalesceKey } : undefined,
      );
    },
    [applyAndCommit, elementsRef],
  );

  const reorderSelection = useCallback(
    (direction: "front" | "back" | "forward" | "backward") => {
      const ids = new Set(selectionRef.current);
      if (ids.size === 0) return;
      const all = ordered;
      const update: WhiteboardElementPatch[] = [];

      if (direction === "front" || direction === "back") {
        const extreme =
          direction === "front"
            ? Math.max(0, ...all.map((el) => el.zIndex))
            : Math.min(0, ...all.map((el) => el.zIndex));
        let offset = 1;
        for (const el of all) {
          if (!ids.has(el.id)) continue;
          update.push({
            id: el.id,
            zIndex: direction === "front" ? extreme + offset : extreme - offset,
          });
          offset += 1;
        }
      } else {
        // Tukar posisi dengan tetangga terdekat di luar seleksi.
        const step = direction === "forward" ? 1 : -1;
        const list = direction === "forward" ? [...all].reverse() : all;
        for (const el of list) {
          if (!ids.has(el.id)) continue;
          const index = all.indexOf(el);
          const neighbour = all[index + step];
          if (!neighbour || ids.has(neighbour.id)) continue;
          update.push({ id: el.id, zIndex: neighbour.zIndex });
          update.push({ id: neighbour.id, zIndex: el.zIndex });
        }
      }

      if (update.length > 0) applyAndCommit({ ...emptyMutation(), update });
    },
    [applyAndCommit, ordered],
  );

  const toggleLockSelection = useCallback(() => {
    const elements = selectionRef.current
      .map((id) => elementsRef.current.get(id))
      .filter((el): el is WhiteboardElement => Boolean(el));
    if (elements.length === 0) return;
    const lock = elements.some((el) => !el.locked);
    applyAndCommit({
      ...emptyMutation(),
      update: elements.map((el) => ({ id: el.id, locked: lock })),
    });
    if (lock) setSelection([]);
  }, [applyAndCommit, elementsRef]);

  const alignSelection = useCallback(
    (
      mode:
        | "left"
        | "center-x"
        | "right"
        | "top"
        | "center-y"
        | "bottom"
        | "distribute-x"
        | "distribute-y",
    ) => {
      const elements = selectionRef.current
        .map((id) => elementsRef.current.get(id))
        .filter((el): el is WhiteboardElement => el !== undefined && !el.locked);
      if (elements.length < 2) return;
      const bounds = elementsBounds(elements)!;
      const update: WhiteboardElementPatch[] = [];

      if (mode === "distribute-x" || mode === "distribute-y") {
        const horizontal = mode === "distribute-x";
        const sorted = [...elements].sort((a, b) =>
          horizontal ? a.x - b.x : a.y - b.y,
        );
        const totalSize = sorted.reduce(
          (sum, el) => sum + (horizontal ? el.width : el.height),
          0,
        );
        const span = horizontal ? bounds.width : bounds.height;
        const gap = (span - totalSize) / (sorted.length - 1);
        let cursor = horizontal ? bounds.x : bounds.y;
        for (const el of sorted) {
          update.push(horizontal ? { id: el.id, x: cursor } : { id: el.id, y: cursor });
          cursor += (horizontal ? el.width : el.height) + gap;
        }
      } else {
        for (const el of elements) {
          switch (mode) {
            case "left":
              update.push({ id: el.id, x: bounds.x });
              break;
            case "right":
              update.push({ id: el.id, x: bounds.x + bounds.width - el.width });
              break;
            case "center-x":
              update.push({
                id: el.id,
                x: bounds.x + (bounds.width - el.width) / 2,
              });
              break;
            case "top":
              update.push({ id: el.id, y: bounds.y });
              break;
            case "bottom":
              update.push({ id: el.id, y: bounds.y + bounds.height - el.height });
              break;
            case "center-y":
              update.push({
                id: el.id,
                y: bounds.y + (bounds.height - el.height) / 2,
              });
              break;
          }
        }
      }

      if (update.length > 0) applyAndCommit({ ...emptyMutation(), update });
    },
    [applyAndCommit, elementsRef],
  );

  // -------------------------------------------------------------------------
  // Undo / redo
  // -------------------------------------------------------------------------

  const doUndo = useCallback(() => {
    const mutation = undo();
    if (!mutation) return;
    void commit(mutation).catch(() => undefined);
  }, [commit, undo]);

  const doRedo = useCallback(() => {
    const mutation = redo();
    if (!mutation) return;
    void commit(mutation).catch(() => undefined);
  }, [commit, redo]);

  // -------------------------------------------------------------------------
  // Clipboard
  // -------------------------------------------------------------------------

  const clipboardRef = useRef<WhiteboardElement[]>([]);

  const copySelection = useCallback(() => {
    const copied = selectionRef.current
      .map((id) => elementsRef.current.get(id))
      .filter((el): el is WhiteboardElement => Boolean(el))
      .map((el) => ({ ...el }));
    clipboardRef.current = copied;
    setHasClipboard(copied.length > 0);
  }, [elementsRef]);

  const pasteClipboard = useCallback(
    (at?: Point) => {
      const source = clipboardRef.current;
      if (source.length === 0) return;
      const bounds = elementsBounds(source)!;
      const target = at ?? {
        x: bounds.x + 24,
        y: bounds.y + 24,
      };
      const dx = target.x - bounds.x;
      const dy = target.y - bounds.y;

      const idMap = new Map(source.map((el) => [el.id, newId()]));
      let z = nextZIndex();
      const create: WhiteboardElementInput[] = source.map((el) => ({
        id: idMap.get(el.id)!,
        type: el.type,
        zIndex: z++,
        x: el.x + dx,
        y: el.y + dy,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        props: remapConnectorProps(el.props, idMap),
        locked: false,
        frameId: el.frameId ? (idMap.get(el.frameId) ?? null) : null,
      }));
      applyAndCommit({ ...emptyMutation(), create });
      setSelection(create.map((el) => el.id));
    },
    [newId, nextZIndex, applyAndCommit],
  );

  // -------------------------------------------------------------------------
  // Unggah gambar
  // -------------------------------------------------------------------------

  const uploadImage = useCallback(
    async (file: File, at: Point) => {
      const form = new FormData();
      form.append("file", file);
      const toastId = toast.loading("Mengunggah gambar…");
      try {
        const res = await fetch(
          `/api/rooms/${roomId}/whiteboards/${board.id}/images`,
          { method: "POST", body: form },
        );
        const data = (await res.json()) as {
          src?: string;
          width?: number;
          height?: number;
          error?: string;
        };
        if (!res.ok || !data.src) {
          throw new Error(data.error ?? "Gambar gagal diunggah.");
        }
        // Batasi ukuran tampil awal agar gambar besar tidak memenuhi kanvas.
        const maxSide = 420;
        const scale = Math.min(1, maxSide / Math.max(data.width!, data.height!));
        const width = Math.round(data.width! * scale);
        const height = Math.round(data.height! * scale);

        const element = buildElement(
          RoomWhiteboardElementType.IMAGE,
          { x: at.x - width / 2, y: at.y - height / 2, width, height },
          {
            src: data.src,
            naturalWidth: data.width,
            naturalHeight: data.height,
            alt: file.name.slice(0, 300),
          },
        );
        applyAndCommit({ ...emptyMutation(), create: [element] });
        setSelection([element.id]);
        toast.success("Gambar ditambahkan.", { id: toastId });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Gambar gagal diunggah.",
          { id: toastId },
        );
      }
    },
    [roomId, board.id, buildElement, applyAndCommit],
  );

  const pickImage = useCallback(() => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const center = screenToWorld(
        { x: size.width / 2, y: size.height / 2 },
        viewportRef.current,
      );
      void uploadImage(file, center);
    };
    input.click();
  }, [size, uploadImage]);

  // -------------------------------------------------------------------------
  // Papan tik
  // -------------------------------------------------------------------------

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (typing) return;

      const mod = event.metaKey || event.ctrlKey;

      if (event.code === "Space" && !event.repeat) {
        setSpacePressed(true);
        event.preventDefault();
        return;
      }

      if (mod && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) doRedo();
        else doUndo();
        return;
      }
      if (mod && event.key.toLowerCase() === "y") {
        event.preventDefault();
        doRedo();
        return;
      }
      if (mod && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setSelection(ordered.filter((el) => !el.locked).map((el) => el.id));
        return;
      }
      if (mod && event.key.toLowerCase() === "c") {
        copySelection();
        return;
      }
      if (mod && event.key.toLowerCase() === "x") {
        copySelection();
        deleteSelection();
        return;
      }
      if (mod && event.key.toLowerCase() === "v") {
        // Tempel gambar ditangani oleh listener `paste`.
        if (hasClipboard) {
          event.preventDefault();
          pasteClipboard();
        }
        return;
      }
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && event.key === "0") {
        event.preventDefault();
        zoomTo(1);
        return;
      }
      if (mod && (event.key === "=" || event.key === "+")) {
        event.preventDefault();
        zoomBy(1.2);
        return;
      }
      if (mod && event.key === "-") {
        event.preventDefault();
        zoomBy(1 / 1.2);
        return;
      }
      if (mod) return;

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === "Escape") {
        setSelection([]);
        setEditingId(null);
        setContextMenu(null);
        setTool("select");
        return;
      }
      if (event.key === "Enter" && selectionRef.current.length === 1) {
        const el = elementsRef.current.get(selectionRef.current[0]!);
        if (el && TEXT_CAPABLE_TYPES.has(el.type)) {
          event.preventDefault();
          startEditing(el.id);
        }
        return;
      }
      if (event.key === "1" && !event.shiftKey) {
        zoomToFit();
        return;
      }
      if (event.key === "2" && !event.shiftKey && selectedElements.length > 0) {
        zoomToFit(selectedElements);
        return;
      }

      // Geser seleksi dengan panah.
      const nudge: Record<string, [number, number]> = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      };
      const direction = nudge[event.key];
      if (direction && selectionRef.current.length > 0) {
        event.preventDefault();
        const step = event.shiftKey ? 10 : 1;
        const update: WhiteboardElementPatch[] = [];
        for (const id of selectionRef.current) {
          const el = elementsRef.current.get(id);
          if (!el || el.locked) continue;
          update.push({
            id,
            x: el.x + direction[0] * step,
            y: el.y + direction[1] * step,
          });
        }
        applyAndCommit({ ...emptyMutation(), update }, { coalesceKey: "nudge" });
        return;
      }

      const shortcutTool = toolByShortcut(event.key);
      if (shortcutTool) {
        event.preventDefault();
        setTool(shortcutTool);
      }
    };

    const onKeyUp = (event: KeyboardEvent) => {
      if (event.code === "Space") setSpacePressed(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
    };
  }, [
    doUndo,
    doRedo,
    elementsRef,
    hasClipboard,
    ordered,
    copySelection,
    deleteSelection,
    pasteClipboard,
    duplicateSelection,
    zoomTo,
    zoomBy,
    zoomToFit,
    selectedElements,
    startEditing,
    applyAndCommit,
  ]);

  // Tempel gambar / teks dari clipboard sistem.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      const items = event.clipboardData?.items;
      if (!items) return;

      const center = screenToWorld(
        { x: size.width / 2, y: size.height / 2 },
        viewportRef.current,
      );

      for (const item of items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void uploadImage(file, center);
            return;
          }
        }
      }

      const text = event.clipboardData?.getData("text/plain");
      if (text && text.trim() && !hasClipboard) {
        event.preventDefault();
        const element = buildElement(
          RoomWhiteboardElementType.STICKY,
          centeredBox(center, defaultSizeForType(RoomWhiteboardElementType.STICKY)),
          { text: text.slice(0, 2000) },
        );
        applyAndCommit({ ...emptyMutation(), create: [element] });
        setSelection([element.id]);
      }
    };

    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [size, uploadImage, buildElement, applyAndCommit, hasClipboard]);

  // -------------------------------------------------------------------------
  // Drag & drop gambar
  // -------------------------------------------------------------------------

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const file = event.dataTransfer.files?.[0];
      if (!file || !file.type.startsWith("image/")) return;
      void uploadImage(file, pointerWorld(event));
    },
    [uploadImage, pointerWorld],
  );

  // -------------------------------------------------------------------------
  // Ekspor
  // -------------------------------------------------------------------------

  const handleExport = useCallback(
    (format: "png" | "svg" | "json") => {
      const targets =
        selectedElements.length > 0 ? selectedElements : ordered;
      if (targets.length === 0) {
        toast.error("Papan masih kosong.");
        return;
      }
      void exportBoard({
        elements: targets,
        allElements: ordered,
        format,
        dark,
        title: board.title,
      }).catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Ekspor gagal.",
        );
      });
    },
    [selectedElements, ordered, dark, board.title],
  );

  // -------------------------------------------------------------------------
  // Pratinjau papan
  // -------------------------------------------------------------------------

  const thumbnailDirty = useRef(false);
  const lastThumbnailAt = useRef(0);

  useEffect(() => {
    // Tandai perlu pratinjau baru setiap kali isi papan berubah — termasuk
    // perubahan dari peserta lain, supaya kartu di daftar papan ikut segar.
    thumbnailDirty.current = true;
  }, [elements]);

  useEffect(() => {
    const THROTTLE_MS = 45_000;
    const id = window.setInterval(() => {
      if (!thumbnailDirty.current) return;
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastThumbnailAt.current < THROTTLE_MS) return;
      if (interactionRef.current.kind !== "idle") return;

      thumbnailDirty.current = false;
      lastThumbnailAt.current = Date.now();
      void (async () => {
        try {
          const thumbnail = await renderBoardThumbnail({
            elements: elementsRef.current
              ? [...elementsRef.current.values()]
              : [],
            dark,
          });
          if (!thumbnail) return;
          await saveRoomWhiteboardThumbnail({ boardId: board.id, thumbnail });
        } catch {
          // Pratinjau bersifat kosmetik — kegagalan tidak perlu diributkan.
        }
      })();
    }, 15_000);
    return () => window.clearInterval(id);
  }, [board.id, dark, elementsRef]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  const activeCursor = spacePressed ? "grab" : TOOL_META[tool].cursor;

  const remoteDraftOverrides = useMemo(() => {
    const map = new Map<string, DraftPatch>();
    for (const draft of sync.drafts.values()) {
      for (const [id, patch] of draft.elements) map.set(id, patch);
    }
    return map;
  }, [sync.drafts]);

  const renderElements = useMemo(() => {
    if (remoteDraftOverrides.size === 0) return ordered;
    return ordered.map((el) => {
      const patch = remoteDraftOverrides.get(el.id);
      if (!patch) return el;
      return {
        ...el,
        x: patch.x ?? el.x,
        y: patch.y ?? el.y,
        width: patch.width ?? el.width,
        height: patch.height ?? el.height,
        rotation: patch.rotation ?? el.rotation,
      };
    });
  }, [ordered, remoteDraftOverrides]);

  const erasing = useMemo(
    () => (preview?.kind === "erase" ? new Set(preview.ids) : null),
    [preview],
  );

  const renderContext = useMemo(
    () => ({ dark, getElement, editingId }),
    [dark, getElement, editingId],
  );

  const editingElement = editingId ? elements.get(editingId) : undefined;

  // Semua hook sudah dipanggil di atas, jadi keluar lebih awal di sini aman.
  if (!mounted) {
    return (
      <div
        ref={containerRef}
        className="bg-muted/40 relative h-full w-full overflow-hidden"
        aria-busy
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-muted/40 relative h-full w-full touch-none overflow-hidden outline-none select-none"
      tabIndex={0}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onContextMenu={(event) => {
        event.preventDefault();
        const world = pointerWorld(event);
        const hit = pickElement(ordered, world, 4 / viewport.zoom);
        if (hit && !selectionRef.current.includes(hit.id)) {
          setSelection([hit.id]);
        }
        setContextMenu({
          screen: pointerScreen(event),
          world,
          onElement: Boolean(hit),
        });
      }}
    >
      <svg
        ref={svgRef}
        className="absolute inset-0 h-full w-full"
        style={{ cursor: activeCursor }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() =>
          sendPresence({ cursor: null, selection: selectionRef.current, tool })
        }
        onDoubleClick={(event) => {
          const world = pointerWorld(event);
          const hit = pickElement(ordered, world, 4 / viewport.zoom);
          if (hit && TEXT_CAPABLE_TYPES.has(hit.type)) {
            startEditing(hit.id);
            return;
          }
          if (!hit && tool === "select") {
            // Klik ganda di area kosong membuat sticky baru — kebiasaan Miro.
            const element = buildElement(
              RoomWhiteboardElementType.STICKY,
              centeredBox(
                world,
                defaultSizeForType(RoomWhiteboardElementType.STICKY),
              ),
            );
            applyAndCommit({ ...emptyMutation(), create: [element] });
            setSelection([element.id]);
            setTimeout(() => startEditing(element.id), 0);
          }
        }}
      >
        <BoardBackground
          background={board.background as WhiteboardBackground}
          viewport={viewport}
          dark={dark}
        />

        <g
          transform={`translate(${round(viewport.x)} ${round(viewport.y)}) scale(${viewport.zoom})`}
        >
          {renderElements.map((element) => (
            <g
              key={element.id}
              opacity={erasing?.has(element.id) ? 0.25 : undefined}
            >
              <WhiteboardElementNode element={element} ctx={renderContext} />
            </g>
          ))}

          <CreationPreview
            preview={preview}
            dark={dark}
            styleDefaults={styleDefaults}
          />

          <SelectionOverlay
            box={selectionBox}
            elements={selectedElements}
            zoom={viewport.zoom}
            dark={dark}
            preview={preview}
          />

          {preview?.kind === "marquee" ? (
            <MarqueeBox
              start={preview.start}
              current={preview.current}
              dark={dark}
            />
          ) : null}

          {preview?.kind === "guides"
            ? preview.guides.map((guide, i) => (
                <SnapGuideLine key={i} guide={guide} zoom={viewport.zoom} />
              ))
            : null}
        </g>

        <WhiteboardPresenceLayer
          presence={sync.presence}
          viewport={viewport}
          currentUserId={currentUser.id}
        />
      </svg>

      {editingElement ? (
        <WhiteboardTextEditor
          // `key` memaksa editor dibuat ulang saat berpindah objek, sehingga
          // isi textarea selalu dimulai dari teks objek yang benar.
          key={editingElement.id}
          element={editingElement}
          viewport={viewport}
          dark={dark}
          onCommit={(text) => {
            commitText(editingElement.id, text);
            setEditingId(null);
          }}
        />
      ) : null}

      {/* Panel & kontrol mengambang */}
      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute top-3 left-1/2 -translate-x-1/2">
          <WhiteboardToolbar
            tool={tool}
            onToolChange={(next) => {
              setTool(next);
              if (next === "image") pickImage();
            }}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={doUndo}
            onRedo={doRedo}
          />
        </div>

        {selectedElements.length > 0 && !editingId ? (
          <div className="pointer-events-auto absolute top-3 left-3 max-h-[calc(100%-6rem)] overflow-y-auto">
            <WhiteboardStylePanel
              elements={selectedElements}
              dark={dark}
              onChange={updateSelectionProps}
              onReorder={reorderSelection}
              onAlign={alignSelection}
              onDuplicate={() => duplicateSelection()}
              onDelete={deleteSelection}
              onToggleLock={toggleLockSelection}
            />
          </div>
        ) : null}

        <div className="pointer-events-auto absolute top-3 right-3">
          <WhiteboardPresenceBar
            presence={sync.presence}
            status={sync.status}
            currentUser={currentUser}
            onExport={handleExport}
            onRename={onRequestRename}
          />
        </div>

        <div className="pointer-events-auto absolute right-3 bottom-3 flex flex-col items-end gap-2">
          <WhiteboardMinimap
            elements={ordered}
            viewport={viewport}
            size={size}
            dark={dark}
            onNavigate={(world) => {
              setViewport((v) => ({
                ...v,
                x: size.width / 2 - world.x * v.zoom,
                y: size.height / 2 - world.y * v.zoom,
              }));
            }}
          />
          <WhiteboardZoomControls
            zoom={viewport.zoom}
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onReset={() => zoomTo(1)}
            onFit={() => zoomToFit()}
          />
        </div>
      </div>

      {contextMenu ? (
        <WhiteboardContextMenu
          state={contextMenu}
          hasSelection={selectedElements.length > 0}
          multiple={selectedElements.length > 1}
          locked={selectedElements.some((el) => el.locked)}
          canPaste={hasClipboard}
          onClose={() => setContextMenu(null)}
          onAction={(action) => {
            setContextMenu(null);
            switch (action) {
              case "copy":
                copySelection();
                break;
              case "paste":
                pasteClipboard(contextMenu.world);
                break;
              case "duplicate":
                duplicateSelection();
                break;
              case "delete":
                deleteSelection();
                break;
              case "bring-front":
                reorderSelection("front");
                break;
              case "send-back":
                reorderSelection("back");
                break;
              case "bring-forward":
                reorderSelection("forward");
                break;
              case "send-backward":
                reorderSelection("backward");
                break;
              case "lock":
                toggleLockSelection();
                break;
              case "select-all":
                setSelection(
                  ordered.filter((el) => !el.locked).map((el) => el.id),
                );
                break;
              case "zoom-fit":
                zoomToFit();
                break;
              case "edit-text": {
                const first = selectedElements[0];
                if (first) startEditing(first.id);
                break;
              }
            }
          }}
        />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-komponen render
// ---------------------------------------------------------------------------

function BoardBackground({
  background,
  viewport,
  dark,
}: {
  background: WhiteboardBackground;
  viewport: Viewport;
  dark: boolean;
}) {
  const canvasFill = dark ? "#111113" : "#f8f8f9";
  if (background === "plain") {
    return <rect width="100%" height="100%" fill={canvasFill} />;
  }

  const baseGap = 24;
  // Pilih kelipatan grid agar kerapatannya tetap enak dilihat di semua zoom.
  let gap = baseGap * viewport.zoom;
  while (gap < 14) gap *= 4;
  while (gap > 90) gap /= 4;

  const ink = dark ? "#ffffff" : "#000000";
  const offsetX = viewport.x % gap;
  const offsetY = viewport.y % gap;
  const patternId = `wb-bg-${background}`;

  return (
    <>
      <defs>
        <pattern
          id={patternId}
          width={gap}
          height={gap}
          patternUnits="userSpaceOnUse"
          x={offsetX}
          y={offsetY}
        >
          {background === "dots" ? (
            <circle cx={1} cy={1} r={1.1} fill={ink} opacity={dark ? 0.18 : 0.16} />
          ) : background === "lines" ? (
            <line
              x1="0"
              y1={gap}
              x2={gap}
              y2={gap}
              stroke={ink}
              strokeWidth="1"
              opacity={dark ? 0.1 : 0.08}
            />
          ) : (
            <path
              d={`M ${gap} 0 L 0 0 0 ${gap}`}
              fill="none"
              stroke={ink}
              strokeWidth="1"
              opacity={dark ? 0.1 : 0.08}
            />
          )}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={canvasFill} />
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </>
  );
}

function MarqueeBox({
  start,
  current,
  dark,
}: {
  start: Point;
  current: Point;
  dark: boolean;
}) {
  const box = normalizeBox(start, current);
  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      fill={dark ? "rgba(96,165,250,0.12)" : "rgba(37,99,235,0.1)"}
      stroke={dark ? "#60a5fa" : "#2563eb"}
      strokeWidth={1}
      vectorEffect="non-scaling-stroke"
    />
  );
}

function SnapGuideLine({ guide, zoom }: { guide: SnapGuide; zoom: number }) {
  const pad = 24 / zoom;
  return guide.axis === "x" ? (
    <line
      x1={guide.position}
      y1={guide.start - pad}
      x2={guide.position}
      y2={guide.end + pad}
      stroke="#f43f5e"
      strokeWidth={1}
      strokeDasharray="4 3"
      vectorEffect="non-scaling-stroke"
    />
  ) : (
    <line
      x1={guide.start - pad}
      y1={guide.position}
      x2={guide.end + pad}
      y2={guide.position}
      stroke="#f43f5e"
      strokeWidth={1}
      strokeDasharray="4 3"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function CreationPreview({
  preview,
  dark,
  styleDefaults,
}: {
  preview: Preview;
  dark: boolean;
  styleDefaults: WhiteboardProps;
}) {
  if (preview?.kind === "draw") {
    const d = preview.points
      .map(
        (p, i) =>
          `${i === 0 ? "M" : "L"} ${round(preview.origin.x + p[0])} ${round(preview.origin.y + p[1])}`,
      )
      .join(" ");
    return (
      <path
        d={d}
        fill="none"
        stroke={
          preview.highlighter
            ? "#facc15"
            : dark
              ? "#e4e4e7"
              : "#334155"
        }
        strokeWidth={
          preview.highlighter
            ? Math.max(12, styleDefaults.strokeWidth ?? 18)
            : (styleDefaults.strokeWidth ?? 4)
        }
        strokeOpacity={preview.highlighter ? 0.45 : 1}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    );
  }

  if (preview?.kind !== "create") return null;

  const accent = dark ? "#60a5fa" : "#2563eb";
  const type = TOOL_META[preview.tool].creates;
  if (!type) return null;

  if (LINEAR_TYPES.has(type)) {
    return (
      <line
        x1={preview.start.x}
        y1={preview.start.y}
        x2={preview.current.x}
        y2={preview.current.y}
        stroke={accent}
        strokeWidth={2}
        strokeDasharray="6 4"
        vectorEffect="non-scaling-stroke"
      />
    );
  }

  const box = normalizeBox(preview.start, preview.current);
  if (box.width < 1 && box.height < 1) return null;

  return (
    <rect
      x={box.x}
      y={box.y}
      width={box.width}
      height={box.height}
      fill={dark ? "rgba(96,165,250,0.1)" : "rgba(37,99,235,0.08)"}
      stroke={accent}
      strokeWidth={1}
      strokeDasharray="6 4"
      vectorEffect="non-scaling-stroke"
    />
  );
}

function SelectionOverlay({
  box,
  elements,
  zoom,
  dark,
  preview,
}: {
  box: Box | null;
  elements: WhiteboardElement[];
  zoom: number;
  dark: boolean;
  preview: Preview;
}) {
  if (!box || elements.length === 0) return null;
  // Sembunyikan gagang saat sedang menggambar/membuat agar tidak mengganggu.
  if (preview?.kind === "create" || preview?.kind === "draw") return null;

  const accent = dark ? "#60a5fa" : "#2563eb";
  const single = elements.length === 1 ? elements[0]! : null;
  const isLinear = single ? LINEAR_TYPES.has(single.type) : false;
  const handleSize = HANDLE_SCREEN_SIZE / zoom;
  const rotation = single?.rotation ?? 0;
  const center = boxCenter(box);
  const transform = rotation
    ? `rotate(${(rotation * 180) / Math.PI} ${center.x} ${center.y})`
    : undefined;

  // Untuk elemen tunggal yang diputar, kotak seleksi mengikuti kotak lokalnya.
  const frame = single && rotation
    ? { x: single.x, y: single.y, width: single.width, height: single.height }
    : box;

  if (isLinear && single) {
    const a = { x: single.x, y: single.y };
    const b = { x: single.x + single.width, y: single.y + single.height };
    return (
      <g>
        <line
          x1={a.x}
          y1={a.y}
          x2={b.x}
          y2={b.y}
          stroke={accent}
          strokeWidth={1}
          strokeOpacity={0.6}
          vectorEffect="non-scaling-stroke"
        />
        {[a, b].map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={handleSize * 0.6}
            fill={dark ? "#18181b" : "#ffffff"}
            stroke={accent}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            data-endpoint={i === 0 ? "start" : "end"}
          />
        ))}
      </g>
    );
  }

  const handles: Array<{ handle: ResizeHandle; x: number; y: number }> = [
    { handle: "nw", x: frame.x, y: frame.y },
    { handle: "n", x: frame.x + frame.width / 2, y: frame.y },
    { handle: "ne", x: frame.x + frame.width, y: frame.y },
    { handle: "e", x: frame.x + frame.width, y: frame.y + frame.height / 2 },
    { handle: "se", x: frame.x + frame.width, y: frame.y + frame.height },
    { handle: "s", x: frame.x + frame.width / 2, y: frame.y + frame.height },
    { handle: "sw", x: frame.x, y: frame.y + frame.height },
    { handle: "w", x: frame.x, y: frame.y + frame.height / 2 },
  ];

  return (
    <g transform={transform}>
      {/* Garis bantu tiap elemen saat memilih banyak objek sekaligus. */}
      {elements.length > 1
        ? elements.map((el) => {
            const aabb = elementAABB(el);
            return (
              <rect
                key={el.id}
                x={aabb.x}
                y={aabb.y}
                width={aabb.width}
                height={aabb.height}
                fill="none"
                stroke={accent}
                strokeOpacity={0.35}
                strokeWidth={1}
                vectorEffect="non-scaling-stroke"
              />
            );
          })
        : null}

      <rect
        x={frame.x}
        y={frame.y}
        width={frame.width}
        height={frame.height}
        fill="none"
        stroke={accent}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />

      <line
        x1={frame.x + frame.width / 2}
        y1={frame.y}
        x2={frame.x + frame.width / 2}
        y2={frame.y - ROTATE_HANDLE_OFFSET / zoom}
        stroke={accent}
        strokeWidth={1}
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx={frame.x + frame.width / 2}
        cy={frame.y - ROTATE_HANDLE_OFFSET / zoom}
        r={handleSize * 0.62}
        fill={dark ? "#18181b" : "#ffffff"}
        stroke={accent}
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />

      {handles.map(({ handle, x, y }) => (
        <rect
          key={handle}
          x={x - handleSize / 2}
          y={y - handleSize / 2}
          width={handleSize}
          height={handleSize}
          rx={handleSize * 0.22}
          fill={dark ? "#18181b" : "#ffffff"}
          stroke={accent}
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </g>
  );
}

// ---------------------------------------------------------------------------
// Bantuan
// ---------------------------------------------------------------------------

function normalizeBox(a: Point, b: Point): Box {
  return {
    x: Math.min(a.x, b.x),
    y: Math.min(a.y, b.y),
    width: Math.abs(b.x - a.x),
    height: Math.abs(b.y - a.y),
  };
}

function centeredBox(center: Point, size: { width: number; height: number }): Box {
  return {
    x: center.x - size.width / 2,
    y: center.y - size.height / 2,
    width: size.width,
    height: size.height,
  };
}

function fitViewport(
  bounds: Box,
  size: { width: number; height: number },
  padding: number,
): Viewport {
  const zoom = clampZoom(
    Math.min(
      (size.width * padding) / Math.max(1, bounds.width),
      (size.height * padding) / Math.max(1, bounds.height),
      2,
    ),
  );
  return {
    zoom,
    x: size.width / 2 - (bounds.x + bounds.width / 2) * zoom,
    y: size.height / 2 - (bounds.y + bounds.height / 2) * zoom,
  };
}

type HandleHit =
  | { type: "resize"; handle: ResizeHandle }
  | { type: "rotate" }
  | { type: "endpoint"; end: "start" | "end" };

function hitTestSelectionHandles(
  world: Point,
  box: Box | null,
  elements: WhiteboardElement[],
  zoom: number,
): HandleHit | null {
  if (!box || elements.length === 0) return null;
  if (elements.every((el) => el.locked)) return null;

  const slop = (HANDLE_SCREEN_SIZE * 0.9) / zoom;
  const single = elements.length === 1 ? elements[0]! : null;

  if (single && LINEAR_TYPES.has(single.type)) {
    const a = { x: single.x, y: single.y };
    const b = { x: single.x + single.width, y: single.y + single.height };
    if (Math.hypot(world.x - a.x, world.y - a.y) <= slop) {
      return { type: "endpoint", end: "start" };
    }
    if (Math.hypot(world.x - b.x, world.y - b.y) <= slop) {
      return { type: "endpoint", end: "end" };
    }
    return null;
  }

  const rotation = single?.rotation ?? 0;
  const frame =
    single && rotation
      ? { x: single.x, y: single.y, width: single.width, height: single.height }
      : box;
  const local = rotation
    ? rotatePoint(world, boxCenter(frame), -rotation)
    : world;

  const rotateHandle = {
    x: frame.x + frame.width / 2,
    y: frame.y - ROTATE_HANDLE_OFFSET / zoom,
  };
  if (Math.hypot(local.x - rotateHandle.x, local.y - rotateHandle.y) <= slop) {
    return { type: "rotate" };
  }

  const spots: Array<{ handle: ResizeHandle; x: number; y: number }> = [
    { handle: "nw", x: frame.x, y: frame.y },
    { handle: "n", x: frame.x + frame.width / 2, y: frame.y },
    { handle: "ne", x: frame.x + frame.width, y: frame.y },
    { handle: "e", x: frame.x + frame.width, y: frame.y + frame.height / 2 },
    { handle: "se", x: frame.x + frame.width, y: frame.y + frame.height },
    { handle: "s", x: frame.x + frame.width / 2, y: frame.y + frame.height },
    { handle: "sw", x: frame.x, y: frame.y + frame.height },
    { handle: "w", x: frame.x, y: frame.y + frame.height / 2 },
  ];

  for (const spot of spots) {
    if (Math.abs(local.x - spot.x) <= slop && Math.abs(local.y - spot.y) <= slop) {
      return { type: "resize", handle: spot.handle };
    }
  }
  return null;
}

/** Atribut gaya yang masuk akal diwariskan ke elemen baru bertipe tertentu. */
function inheritableStyle(
  defaults: WhiteboardProps,
  type: WhiteboardElement["type"],
): WhiteboardProps {
  const out: WhiteboardProps = {};
  if (defaults.opacity !== undefined) out.opacity = defaults.opacity;

  if (CLOSED_SHAPE_TYPES.has(type)) {
    if (defaults.fill) out.fill = defaults.fill;
    if (defaults.fillStyle) out.fillStyle = defaults.fillStyle;
    if (defaults.stroke) out.stroke = defaults.stroke;
    if (defaults.strokeWidth !== undefined) out.strokeWidth = defaults.strokeWidth;
    if (defaults.strokeStyle) out.strokeStyle = defaults.strokeStyle;
  }
  if (type === RoomWhiteboardElementType.STICKY && defaults.fill) {
    out.fill = defaults.fill;
  }
  if (LINEAR_TYPES.has(type)) {
    if (defaults.stroke) out.stroke = defaults.stroke;
    if (defaults.strokeWidth !== undefined) out.strokeWidth = defaults.strokeWidth;
    if (defaults.strokeStyle) out.strokeStyle = defaults.strokeStyle;
  }
  if (TEXT_CAPABLE_TYPES.has(type)) {
    if (defaults.fontFamily) out.fontFamily = defaults.fontFamily;
    if (defaults.textColor) out.textColor = defaults.textColor;
    if (defaults.fontWeight) out.fontWeight = defaults.fontWeight;
  }
  return out;
}

function remapConnectorProps(
  props: WhiteboardProps,
  idMap: Map<string, string>,
): WhiteboardProps {
  if (!props.start && !props.end) return { ...props };
  const clone: WhiteboardProps = { ...props };
  for (const key of ["start", "end"] as const) {
    const endpoint = clone[key];
    if (!endpoint) continue;
    clone[key] = {
      ...endpoint,
      elementId: endpoint.elementId
        ? (idMap.get(endpoint.elementId) ?? null)
        : null,
    };
  }
  return clone;
}
