"use client";

import {
  Fragment,
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
  boxContains,
  boxesIntersect,
  clampZoom,
  computeSnap,
  elementAABB,
  elementsBounds,
  handleCursor,
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
  whiteboardElementInputSchema,
  type WhiteboardBackground,
  type WhiteboardColorToken,
  type WhiteboardElement,
  type WhiteboardElementInput,
  type WhiteboardElementPatch,
  type WhiteboardMutation,
  type WhiteboardProps,
} from "@/lib/whiteboard/types";
import { emptyMutation, useBoardStore } from "./use-board-store";
import { useWhiteboardSync, type DraftPatch } from "./use-whiteboard-sync";
import { connectorPoints, WhiteboardElementNode } from "./whiteboard-element";
import { LaserTrail, RemoteLaser, useLaserTrail } from "./whiteboard-laser";
import { WhiteboardShortcutsDialog } from "./whiteboard-shortcuts";
import { cursorColorFor, STICKY_PALETTE } from "@/lib/whiteboard/palette";
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
      /** Ukuran hanya diisi untuk garis yang tempelannya dilepas. */
      originals: Map<string, { x: number; y: number; width?: number; height?: number }>;
      /** Ujung garis yang menempel ke elemen di luar seleksi — dilepas saat digeser. */
      detach: Map<string, Array<"start" | "end">>;
      moved: boolean;
      guides: SnapGuide[];
      staticBoxes: Box[];
      groupBox: Box;
      touched: Touched;
    }
  | {
      kind: "resize";
      handle: ResizeHandle;
      startWorld: Point;
      originals: Map<string, WhiteboardElement>;
      groupBox: Box;
      /** Rotasi elemen tunggal — resize dilakukan di ruang lokalnya. */
      rotation: number;
      touched: Touched;
    }
  | {
      kind: "rotate";
      center: Point;
      startAngle: number;
      originals: Map<string, { rotation: number; x: number; y: number; width: number; height: number }>;
      touched: Touched;
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
      /** Elemen di bawah pointer yang akan ditempeli saat dilepas. */
      target: string | null;
      touched: Touched;
    }
  | {
      kind: "pinch";
      startDistance: number;
      startMid: Point;
      startViewport: Viewport;
    };

/**
 * Salinan elemen *sebelum* interaksi bertahap mulai mengubahnya, per id.
 * Diisi malas (saat elemen pertama kali disentuh) dan dipakai untuk dua hal:
 * mutasi kebalikan untuk undo, dan memulihkan papan saat gerakan dibatalkan.
 */
type Touched = Map<string, WhiteboardElement>;

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

/** Penanda isi clipboard sistem yang berasal dari whiteboard ini. */
const CLIPBOARD_MARKER = "dcc-whiteboard/v1";


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
  onThumbnailSaved,
}: {
  roomId: string;
  board: BoardMeta;
  initialElements: SerializedElement[];
  currentUser: { id: string; name: string; image: string | null };
  /** Pratinjau baru tersimpan — daftar papan bisa langsung memakainya. */
  onThumbnailSaved?: (thumbnail: string) => void;
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
  /** Alat tetap aktif setelah membuat objek (tidak kembali ke Pilih). */
  const [toolLocked, setToolLocked] = useState(false);
  /** Elemen di bawah kursor saat alat Pilih aktif — diberi garis tipis. */
  const [hoverId, setHoverId] = useState<string | null>(null);
  /** Kursor kontekstual (gagang resize, putar, geser) yang menimpa kursor alat. */
  const [hoverCursor, setHoverCursor] = useState<string | null>(null);
  /** Elemen yang akan ditempeli ujung konektor/panah yang sedang ditarik. */
  const [attachTarget, setAttachTarget] = useState<string | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  /** Sticky berikutnya dibuat dengan warna ini (dipilih dari dock). */
  const [stickyColor, setStickyColor] = useState<WhiteboardColorToken>("yellow");
  const stickyColorRef = useRef(stickyColor);
  const toolLockedRef = useRef(toolLocked);

  /** Pointer sentuh yang sedang menempel di layar, untuk pinch-zoom. */
  const touchPointsRef = useRef(new Map<number, Point>());
  const { push: pushLaser, trail: laserTrail } = useLaserTrail();

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
    stickyColorRef.current = stickyColor;
    toolLockedRef.current = toolLocked;
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

  const didInitialFit = useRef(false);

  // `mounted` ikut jadi dependency: render pertama setelah hidrasi memakai
  // div placeholder, lalu diganti div kanvas asli. Tanpa ini observer (dan
  // listener wheel di bawah) tetap menempel ke placeholder yang sudah lepas,
  // sehingga ukuran kanvas membeku — layar penuh, resize jendela, dan
  // buka-tutup daftar papan tidak pernah terdeteksi.
  useLayoutEffect(() => {
    const node = containerRef.current;
    if (!node || !mounted) return;
    let last = { width: node.clientWidth, height: node.clientHeight };
    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      if (!rect) return;
      const next = { width: rect.width, height: rect.height };
      const dx = (next.width - last.width) / 2;
      const dy = (next.height - last.height) / 2;
      last = next;
      setSize(next);
      // Pertahankan titik tengah layar saat kanvas membesar/mengecil (mis.
      // masuk layar penuh), supaya isi papan tidak "melompat" ke pojok.
      if (didInitialFit.current && (dx !== 0 || dy !== 0)) {
        setViewport((v) => ({ ...v, x: v.x + dx, y: v.y + dy }));
      }
    });
    observer.observe(node);
    setSize(last);
    return () => observer.disconnect();
  }, [mounted]);

  // Papan lama bisa menyimpan geometri konektor yang basi (sebelum konektor
  // ikut diperbarui saat objeknya bergeser). Rapikan sekali saat dibuka,
  // tanpa masuk riwayat undo.
  useEffect(() => {
    const linearIds = new Set<string>();
    for (const el of elementsRef.current.values()) {
      if (LINEAR_TYPES.has(el.type)) linearIds.add(el.id);
    }
    if (linearIds.size === 0) return;
    const fix = connectorFollowUps(linearIds, elementsRef.current);
    if (fix.length === 0) return;
    const mutation = { ...emptyMutation(), update: fix };
    applyMutation(mutation, { history: false });
    void commit(mutation).catch(() => undefined);
  }, [elementsRef, applyMutation, commit]);

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
      if (type === RoomWhiteboardElementType.STICKY) {
        inherited.fill = stickyColorRef.current;
      }
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
  // Interaksi bertahap: pencatatan, konektor ikutan, commit & batal
  // -------------------------------------------------------------------------

  /** Catat keadaan awal elemen sebelum interaksi mengubahnya. */
  const touch = useCallback(
    (touched: Touched, ids: Iterable<string>) => {
      const fresh: string[] = [];
      for (const id of ids) {
        if (touched.has(id)) continue;
        const el = elementsRef.current.get(id);
        if (!el) continue;
        touched.set(id, el);
        fresh.push(id);
      }
      if (fresh.length > 0) markDirty(fresh);
    },
    [elementsRef, markDirty],
  );

  /**
   * Terapkan patch sementara, lalu ikutkan garis/konektor yang menempel ke
   * elemen yang berubah. Tanpa ini geometri tersimpan konektor jadi basi:
   * tampilannya mengikuti elemen, tapi klik & kotak seleksinya tertinggal.
   */
  const applyTransientWithFollowUps = useCallback(
    (update: WhiteboardElementPatch[], touched: Touched): WhiteboardElementPatch[] => {
      touch(touched, update.map((patch) => patch.id));
      applyTransient({ ...emptyMutation(), update });
      const follow = connectorFollowUps(
        new Set(update.map((patch) => patch.id)),
        elementsRef.current,
      );
      if (follow.length > 0) {
        touch(touched, follow.map((patch) => patch.id));
        applyTransient({ ...emptyMutation(), update: follow });
      }
      return [...update, ...follow];
    },
    [touch, applyTransient, elementsRef],
  );

  /**
   * Commit hasil interaksi bertahap dengan riwayat yang memakai nilai
   * *sebelum* gerakan dimulai — bukan posisi antara yang sempat ditulis
   * `applyTransient` selama pointer masih ditekan.
   */
  const commitTouched = useCallback(
    (touched: Touched) => {
      const forward: WhiteboardElementPatch[] = [];
      const backward: WhiteboardElementPatch[] = [];
      for (const [id, before] of touched) {
        const after = elementsRef.current.get(id);
        if (!after || sameGeometry(before, after)) continue;
        const withEnds = hasEndpoints(before) || hasEndpoints(after);
        forward.push(geometryPatch(after, withEnds));
        backward.push(geometryPatch(before, withEnds));
      }
      if (forward.length === 0) return;
      const mutation = { ...emptyMutation(), update: forward };
      pushHistory(mutation, { ...emptyMutation(), update: backward });
      void commit(mutation).catch((error: unknown) => {
        toast.error(
          error instanceof Error ? error.message : "Gagal menyimpan perubahan.",
        );
      });
    },
    [elementsRef, pushHistory, commit],
  );

  /** Kembalikan elemen yang sempat diubah sementara ke keadaan awalnya. */
  const revertTouched = useCallback(
    (touched: Touched) => {
      const update = [...touched.values()].map((before) =>
        geometryPatch(before, hasEndpoints(before)),
      );
      applyTransient({ ...emptyMutation(), update });
    },
    [applyTransient],
  );

  /**
   * Hentikan gerakan yang sedang berlangsung tanpa menyimpannya (Esc, atau
   * jari kedua menyentuh layar untuk pinch-zoom).
   */
  const cancelInteraction = useCallback(() => {
    const state = interactionRef.current;
    interactionRef.current = { kind: "idle" };
    if ("touched" in state) {
      revertTouched(state.touched);
      endDraft();
      clearDirty(state.touched.keys());
    }
    setAttachTarget(null);
    clearPreview();
  }, [revertTouched, endDraft, clearDirty, clearPreview]);

  /** Elemen bertubuh (bukan garis) di titik ini yang bisa ditempeli konektor. */
  const attachableAt = useCallback(
    (world: Point, excludeId?: string) => {
      const zoom = viewportRef.current.zoom;
      for (let i = ordered.length - 1; i >= 0; i -= 1) {
        const el = ordered[i]!;
        if (el.id === excludeId || LINEAR_TYPES.has(el.type)) continue;
        if (el.type === RoomWhiteboardElementType.DRAW) continue;
        if (hitTestElement(el, world, 6 / zoom)) return el;
      }
      return null;
    },
    [ordered],
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
      if (event.pointerType === "touch") {
        touchPointsRef.current.set(event.pointerId, pointerScreen(event));
        if (touchPointsRef.current.size === 2) {
          // Jari kedua: batalkan apa pun yang dimulai jari pertama, lalu
          // beralih ke pinch-zoom + geser dua jari.
          cancelInteraction();
          const [p1, p2] = [...touchPointsRef.current.values()] as [Point, Point];
          interactionRef.current = {
            kind: "pinch",
            startDistance: Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y)),
            startMid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 },
            startViewport: viewportRef.current,
          };
          svgRef.current?.setPointerCapture(event.pointerId);
          return;
        }
        if (touchPointsRef.current.size > 2) return;
      }

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
        // Laser hanya efemeral — jejaknya digambar dari gerakan pointer.
        pushLaser(world);
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
        if (ATTACHING_TOOLS.has(activeTool)) {
          const target = attachableAt(world);
          if (target) startAttach = { elementId: target.id };
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
              selectedElements
                .filter((el) => !el.locked)
                .map((el) => [
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
            touched: new Map(),
          };
        } else if (handle.type === "endpoint") {
          interactionRef.current = {
            kind: "endpoint",
            elementId: selectedElements[0]!.id,
            end: handle.end,
            target: null,
            touched: new Map(),
          };
        } else {
          interactionRef.current = {
            kind: "resize",
            handle: handle.handle,
            startWorld: world,
            originals: new Map(
              selectedElements
                .filter((el) => !el.locked)
                .map((el) => [el.id, el]),
            ),
            groupBox: selectionBox!,
            rotation:
              selectedElements.length === 1 ? selectedElements[0]!.rotation : 0,
            touched: new Map(),
          };
        }
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
      // Frame membawa serta semua objek yang sepenuhnya berada di dalamnya.
      const frames = moving.filter(
        (el) => el.type === RoomWhiteboardElementType.FRAME,
      );
      for (const frame of frames) {
        const frameBox = elementAABB(frame);
        for (const other of ordered) {
          if (movingIds.has(other.id) || other.locked) continue;
          if (other.type === RoomWhiteboardElementType.FRAME) continue;
          if (!boxContains(frameBox, elementAABB(other))) continue;
          moving.push(other);
          movingIds.add(other.id);
        }
      }

      // Garis yang ujungnya menempel ke objek di luar seleksi dilepas
      // tempelannya, kalau tidak ia tidak akan ikut bergeser sama sekali.
      const originals = new Map<string, { x: number; y: number; width?: number; height?: number }>();
      const detach = new Map<string, Array<"start" | "end">>();
      for (const el of moving) {
        if (LINEAR_TYPES.has(el.type)) {
          const ends = (["start", "end"] as const).filter((end) => {
            const target = el.props[end]?.elementId;
            return Boolean(target) && !movingIds.has(target!);
          });
          if (ends.length > 0) {
            detach.set(el.id, ends);
            originals.set(el.id, resolvedLinearGeometry(el, elementsRef.current));
            continue;
          }
        }
        originals.set(el.id, { x: el.x, y: el.y });
      }

      interactionRef.current = {
        kind: "translate",
        startWorld: world,
        currentWorld: world,
        originals,
        detach,
        moved: false,
        guides: [],
        staticBoxes: ordered
          .filter((el) => !movingIds.has(el.id))
          .map(elementAABB),
        groupBox: elementsBounds(moving)!,
        touched: new Map(),
      };
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
      cancelInteraction,
      attachableAt,
      pushLaser,
    ],
  );

  // -------------------------------------------------------------------------
  // Pointer: bergerak
  // -------------------------------------------------------------------------

  /** Kursor & sorotan saat kursor sekadar melintas (tanpa tombol ditekan). */
  const updateHover = useCallback(
    (world: Point) => {
      if (toolRef.current !== "select" || spacePressed) {
        setHoverId(null);
        setHoverCursor(null);
        return;
      }
      const zoom = viewportRef.current.zoom;
      const handle = hitTestSelectionHandles(
        world,
        selectionBox,
        selectedElements,
        zoom,
      );
      if (handle) {
        setHoverId(null);
        setHoverCursor(
          handle.type === "resize"
            ? handleCursor(
                handle.handle,
                selectedElements.length === 1 ? selectedElements[0]!.rotation : 0,
              )
            : handle.type === "rotate"
              ? "grab"
              : "crosshair",
        );
        return;
      }
      const hit = pickElement(ordered, world, 4 / zoom);
      setHoverId(hit && !selectionRef.current.includes(hit.id) ? hit.id : null);
      setHoverCursor(hit ? "move" : null);
    },
    [ordered, selectionBox, selectedElements, spacePressed],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.pointerType === "touch" && touchPointsRef.current.has(event.pointerId)) {
        touchPointsRef.current.set(event.pointerId, pointerScreen(event));
      }

      const world = pointerWorld(event);
      const state = interactionRef.current;
      const zoom = viewportRef.current.zoom;

      // Kabarkan posisi kursor ke peserta lain.
      sendPresence({
        cursor: world,
        selection: selectionRef.current,
        tool: toolRef.current,
      });

      if (toolRef.current === "laser") pushLaser(world);

      switch (state.kind) {
        case "idle": {
          if (event.pointerType !== "touch") updateHover(world);
          return;
        }
        case "pinch": {
          const points = [...touchPointsRef.current.values()];
          if (points.length < 2) return;
          const [p1, p2] = points as [Point, Point];
          const distance = Math.max(1, Math.hypot(p2.x - p1.x, p2.y - p1.y));
          const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
          const start = state.startViewport;
          const anchor = screenToWorld(state.startMid, start);
          const nextZoom = clampZoom(start.zoom * (distance / state.startDistance));
          setViewport({
            zoom: nextZoom,
            x: mid.x - anchor.x * nextZoom,
            y: mid.y - anchor.y * nextZoom,
          });
          return;
        }
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
          if (
            !state.moved &&
            Math.abs(dx) <= CLICK_SLOP_PX / zoom &&
            Math.abs(dy) <= CLICK_SLOP_PX / zoom
          ) {
            // Klik biasa sering bergeser 1–2 piksel; jangan anggap itu geseran.
            return;
          }
          state.moved = true;
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
            const patch: WhiteboardElementPatch = {
              id,
              x: origin.x + dx,
              y: origin.y + dy,
            };
            const ends = state.detach.get(id);
            if (ends && origin.width !== undefined && origin.height !== undefined) {
              patch.width = origin.width;
              patch.height = origin.height;
              const props: WhiteboardProps = {};
              for (const end of ends) {
                props[end] = {
                  elementId: null,
                  side: "auto",
                  x: end === "start" ? patch.x! : patch.x! + origin.width,
                  y: end === "start" ? patch.y! : patch.y! + origin.height,
                };
              }
              patch.props = props;
            }
            update.push(patch);
          }
          const all = applyTransientWithFollowUps(update, state.touched);
          sendDraft(all as DraftPatch[]);
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
          const all = applyTransientWithFollowUps(update, state.touched);
          sendDraft(all as DraftPatch[]);
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
          const all = applyTransientWithFollowUps(update, state.touched);
          sendDraft(all as DraftPatch[]);
          return;
        }
        case "create": {
          state.currentWorld = world;
          const creating = state;
          if (ATTACHING_TOOLS.has(creating.tool)) {
            const target = attachableAt(world, creating.startAttach?.elementId);
            setAttachTarget(target?.id ?? null);
          }
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
          const canAttach = element.type !== RoomWhiteboardElementType.LINE;
          const target = canAttach ? attachableAt(world, element.id) : null;
          state.target = target?.id ?? null;
          setAttachTarget(state.target);

          // Ujung yang ditarik dilepas dulu; ujung lainnya tetap di posisinya
          // yang sudah diresolusi (bisa jadi menempel ke elemen lain).
          const resolved = connectorPoints(element, (id) => elementsRef.current.get(id));
          const fixed =
            state.end === "start" ? resolved[resolved.length - 1]! : resolved[0]!;
          const free = { elementId: null, side: "auto" as const, x: world.x, y: world.y };
          const patch: WhiteboardElementPatch =
            state.end === "start"
              ? {
                  id: element.id,
                  x: world.x,
                  y: world.y,
                  width: fixed.x - world.x,
                  height: fixed.y - world.y,
                  props: { start: free },
                }
              : {
                  id: element.id,
                  x: fixed.x,
                  y: fixed.y,
                  width: world.x - fixed.x,
                  height: world.y - fixed.y,
                  props: { end: free },
                };
          applyTransientWithFollowUps([patch], state.touched);
          sendDraft([patch as DraftPatch]);
          return;
        }
        default:
          return;
      }
    },
    [
      applyTransientWithFollowUps,
      elementsRef,
      ordered,
      pointerWorld,
      pointerScreen,
      sendPresence,
      sendDraft,
      schedulePreview,
      eraseAt,
      attachableAt,
      updateHover,
      pushLaser,
    ],
  );

  // -------------------------------------------------------------------------
  // Pointer: selesai
  // -------------------------------------------------------------------------

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
        const endTarget = ATTACHING_TOOLS.has(creating.tool)
          ? attachableAt(endWorld, creating.startAttach?.elementId)
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
            elementId: endTarget?.id ?? null,
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
        if (creating.startAttach || endTarget) {
          // Simpan geometri yang sudah menempel ke tepi objek, bukan titik
          // mentah pointer — supaya klik & kotak seleksinya tepat sejak awal.
          Object.assign(
            element,
            resolvedLinearGeometry(element as WhiteboardElement, elementsRef.current),
          );
        }
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
      if (type === RoomWhiteboardElementType.FRAME) {
        // Frame berlatar padat; kalau ditaruh di atas, objek yang dibingkainya
        // tertutup. Letakkan di bawah semua objek lain.
        let min = 0;
        for (const el of elementsRef.current.values()) {
          if (el.zIndex < min) min = el.zIndex;
        }
        element.zIndex = min - 1;
      }
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
    [viewportRef, buildElement, applyAndCommit, attachableAt, elementsRef],
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
      if (event.pointerType === "touch") {
        touchPointsRef.current.delete(event.pointerId);
      }
      const state = interactionRef.current;
      try {
        svgRef.current?.releasePointerCapture(event.pointerId);
      } catch {
        // Pointer sudah lepas.
      }
      if (state.kind === "pinch") {
        // Satu jari diangkat mengakhiri pinch; jari sisanya diabaikan sampai
        // ikut diangkat, supaya tidak tiba-tiba mulai menyeleksi.
        if (touchPointsRef.current.size === 0) {
          interactionRef.current = { kind: "idle" };
        }
        return;
      }
      interactionRef.current = { kind: "idle" };

      const world = pointerWorld(event);
      setAttachTarget(null);

      switch (state.kind) {
        case "translate":
        case "resize":
        case "rotate": {
          endDraft();
          commitTouched(state.touched);
          clearDirty(state.touched.keys());
          break;
        }
        case "endpoint": {
          endDraft();
          const element = elementsRef.current.get(state.elementId);
          if (element && state.target) {
            // Lepas di atas objek: tempelkan, lalu rapikan geometrinya ke tepi.
            const current = element.props[state.end];
            applyTransientWithFollowUps(
              [
                {
                  id: element.id,
                  props: {
                    [state.end]: {
                      elementId: state.target,
                      side: "auto",
                      x: current?.x ?? world.x,
                      y: current?.y ?? world.y,
                    },
                  },
                },
              ],
              state.touched,
            );
          }
          commitTouched(state.touched);
          clearDirty(state.touched.keys());
          break;
        }
        case "create":
          finishCreate(state, world, event.shiftKey || toolLockedRef.current);
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
      applyTransientWithFollowUps,
      commitTouched,
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
    if (!node || !mounted) return;

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
  }, [mounted]);

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

  /**
   * Terapkan mutasi berisi patch posisi/ukuran, plus konektor yang menempel
   * ke elemen yang bergerak — satu langkah undo untuk semuanya.
   */
  const commitWithFollowUps = useCallback(
    (update: WhiteboardElementPatch[], options?: { coalesceKey?: string }) => {
      if (update.length === 0) return;
      const preview = new Map(elementsRef.current);
      for (const patch of update) {
        const el = preview.get(patch.id);
        if (!el) continue;
        preview.set(patch.id, {
          ...el,
          x: patch.x ?? el.x,
          y: patch.y ?? el.y,
          width: patch.width ?? el.width,
          height: patch.height ?? el.height,
        });
      }
      const follow = connectorFollowUps(
        new Set(update.map((patch) => patch.id)),
        preview,
      );
      applyAndCommit(
        { ...emptyMutation(), update: [...update, ...follow] },
        options,
      );
    },
    [applyAndCommit, elementsRef],
  );

  const deleteSelection = useCallback(() => {
    const ids = selectionRef.current.filter((id) => {
      const el = elementsRef.current.get(id);
      return el && !el.locked;
    });
    if (ids.length === 0) return;
    applyAndCommit({ ...emptyMutation(), delete: ids });
    setSelection([]);
  }, [applyAndCommit, elementsRef]);

  /**
   * Sisipkan salinan elemen dengan id baru, digeser sejauh (dx, dy).
   * Urutan tumpukan asal dipertahankan (frame tetap di bawah isinya) dan
   * tempelan konektor dipetakan ulang ke salinannya.
   */
  const insertClones = useCallback(
    (source: WhiteboardElement[], dx: number, dy: number) => {
      if (source.length === 0) return;
      const sorted = [...source].sort((a, b) => a.zIndex - b.zIndex);
      const idMap = new Map(sorted.map((el) => [el.id, newId()]));
      let z = nextZIndex();
      const create: WhiteboardElementInput[] = sorted.map((el) => ({
        id: idMap.get(el.id)!,
        type: el.type,
        zIndex: z++,
        x: el.x + dx,
        y: el.y + dy,
        width: el.width,
        height: el.height,
        rotation: el.rotation,
        props: remapConnectorProps(el.props, idMap, dx, dy),
        locked: false,
        frameId: el.frameId ? (idMap.get(el.frameId) ?? null) : null,
      }));
      applyAndCommit({ ...emptyMutation(), create });
      setSelection(create.map((el) => el.id));
    },
    [newId, nextZIndex, applyAndCommit],
  );

  const duplicateSelection = useCallback(
    (offset = 24) => {
      const originals = selectionRef.current
        .map((id) => elementsRef.current.get(id))
        .filter((el): el is WhiteboardElement => Boolean(el));
      insertClones(originals, offset, offset);
    },
    [insertClones, elementsRef],
  );

  const updateSelectionProps = useCallback(
    (props: WhiteboardProps, coalesceKey?: string) => {
      const ids = selectionRef.current.filter((id) =>
        elementsRef.current.has(id),
      );
      setStyleDefaults((prev) => ({ ...prev, ...props }));
      // Warna kertas yang baru dipilih jadi warna sticky berikutnya.
      if (
        props.fill &&
        STICKY_PALETTE.includes(props.fill) &&
        ids.some(
          (id) =>
            elementsRef.current.get(id)?.type === RoomWhiteboardElementType.STICKY,
        )
      ) {
        setStickyColor(props.fill);
      }
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
        // "Ke belakang" harus menjaga urutan relatif seleksi: yang paling
        // bawah di antara seleksi tetap paling bawah.
        const chosen = all.filter((el) => ids.has(el.id));
        const count = chosen.length;
        chosen.forEach((el, index) => {
          update.push({
            id: el.id,
            zIndex:
              direction === "front"
                ? extreme + index + 1
                : extreme - count + index,
          });
        });
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
    toast.success(
      lock
        ? "Objek dikunci. Klik kanan objek untuk membuka kuncinya."
        : "Kunci objek dibuka.",
    );
    if (lock) setSelection([]);
  }, [applyAndCommit, elementsRef]);

  const unlockAll = useCallback(() => {
    const locked = ordered.filter((el) => el.locked);
    if (locked.length === 0) return;
    applyAndCommit({
      ...emptyMutation(),
      update: locked.map((el) => ({ id: el.id, locked: false })),
    });
    setSelection(locked.map((el) => el.id));
    toast.success(`${locked.length} objek dibuka kuncinya.`);
  }, [applyAndCommit, ordered]);

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

      commitWithFollowUps(update);
    },
    [commitWithFollowUps, elementsRef],
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

  /**
   * Salinan internal — dipakai menu klik kanan, yang tidak bisa membaca
   * clipboard sistem secara sinkron. Pintasan papan tik memakai clipboard
   * sistem (lihat listener copy/cut/paste) sehingga objek bisa ditempel ke
   * papan lain, dan gambar/teks dari aplikasi lain tetap bisa ditempel.
   */
  const clipboardRef = useRef<WhiteboardElement[]>([]);

  const selectedForClipboard = useCallback(
    () =>
      selectionRef.current
        .map((id) => elementsRef.current.get(id))
        .filter((el): el is WhiteboardElement => Boolean(el))
        .map((el) => ({ ...el })),
    [elementsRef],
  );

  const copySelection = useCallback(() => {
    const copied = selectedForClipboard();
    if (copied.length === 0) return;
    clipboardRef.current = copied;
    setHasClipboard(true);
    // Menu klik kanan: tulis juga ke clipboard sistem kalau diizinkan.
    void navigator.clipboard
      ?.writeText(serializeClipboard(copied))
      .catch(() => undefined);
  }, [selectedForClipboard]);

  /**
   * Tempel objek. Kalau posisi asalnya masih terlihat, salinan digeser
   * sedikit; kalau tidak (mis. dari papan lain), diletakkan di tengah layar.
   */
  const pasteElements = useCallback(
    (source: WhiteboardElement[], at?: Point) => {
      if (source.length === 0) return;
      const bounds = elementsBounds(source)!;
      let target: Point;
      if (at) {
        target = at;
      } else {
        const view = visibleWorldBox(viewportRef.current, size);
        target = boxesIntersect(view, bounds)
          ? { x: bounds.x + 24, y: bounds.y + 24 }
          : {
              x: view.x + view.width / 2 - bounds.width / 2,
              y: view.y + view.height / 2 - bounds.height / 2,
            };
      }
      insertClones(source, target.x - bounds.x, target.y - bounds.y);
    },
    [insertClones, size],
  );

  const pasteClipboard = useCallback(
    (at?: Point) => pasteElements(clipboardRef.current, at),
    [pasteElements],
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
      if (isTypingTarget(event.target)) return;
      // Dialog/menu lain sedang terbuka di atas papan — jangan curi tombolnya.
      if (document.querySelector("[role=dialog], [role=menu]")) return;

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
      // Salin/potong/tempel ditangani listener `copy`/`cut`/`paste` di bawah.
      if (mod && event.key.toLowerCase() === "d") {
        event.preventDefault();
        duplicateSelection();
        return;
      }
      if (mod && event.key === "]") {
        event.preventDefault();
        reorderSelection(event.shiftKey ? "front" : "forward");
        return;
      }
      if (mod && event.key === "[") {
        event.preventDefault();
        reorderSelection(event.shiftKey ? "back" : "backward");
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

      if (event.key === "?") {
        event.preventDefault();
        setShortcutsOpen(true);
        return;
      }
      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelection();
        return;
      }
      if (event.key === "Escape") {
        if (interactionRef.current.kind !== "idle") {
          // Esc di tengah gerakan membatalkan gerakan itu saja.
          cancelInteraction();
          return;
        }
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
      if (event.key.toLowerCase() === "q") {
        setToolLocked((locked) => !locked);
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
        commitWithFollowUps(update, { coalesceKey: "nudge" });
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
    // Tab berpindah fokus saat spasi ditahan → keyup tidak pernah datang.
    const onBlur = () => setSpacePressed(false);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [
    doUndo,
    doRedo,
    elementsRef,
    ordered,
    deleteSelection,
    duplicateSelection,
    reorderSelection,
    zoomTo,
    zoomBy,
    zoomToFit,
    selectedElements,
    startEditing,
    commitWithFollowUps,
    cancelInteraction,
  ]);

  // Salin, potong & tempel lewat clipboard sistem.
  useEffect(() => {
    const onCopyOrCut = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target) || editingId) return;
      const copied = selectedForClipboard();
      if (copied.length === 0) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", serializeClipboard(copied));
      clipboardRef.current = copied;
      setHasClipboard(true);
      if (event.type === "cut") deleteSelection();
    };

    const onPaste = (event: ClipboardEvent) => {
      if (isTypingTarget(event.target) || editingId) return;
      const data = event.clipboardData;
      if (!data) return;

      const center = screenToWorld(
        { x: size.width / 2, y: size.height / 2 },
        viewportRef.current,
      );

      for (const item of data.items) {
        if (item.type.startsWith("image/")) {
          const file = item.getAsFile();
          if (file) {
            event.preventDefault();
            void uploadImage(file, center);
            return;
          }
        }
      }

      const text = data.getData("text/plain");
      const elements = text ? parseClipboard(text) : null;
      if (elements) {
        event.preventDefault();
        pasteElements(elements);
        return;
      }
      if (text && text.trim()) {
        // Teks biasa dari aplikasi lain jadi sticky baru; tiap paragraf
        // (dipisah baris kosong) jadi satu sticky, berjajar ke kanan.
        event.preventDefault();
        const chunks = text
          .split(/\r?\n\s*\r?\n/u)
          .map((chunk) => chunk.trim())
          .filter(Boolean)
          .slice(0, 24);
        const size = defaultSizeForType(RoomWhiteboardElementType.STICKY);
        const gap = 24;
        const perRow = Math.min(chunks.length, 6);
        const rowWidth = perRow * size.width + (perRow - 1) * gap;
        const create = chunks.map((chunk, index) =>
          buildElement(
            RoomWhiteboardElementType.STICKY,
            {
              x: center.x - rowWidth / 2 + (index % perRow) * (size.width + gap),
              y:
                center.y -
                size.height / 2 +
                Math.floor(index / perRow) * (size.height + gap),
              width: size.width,
              height: size.height,
            },
            { text: chunk.slice(0, 2000) },
          ),
        );
        // `buildElement` memberi z-index sama untuk semua; jadikan berurutan.
        create.forEach((el, index) => {
          el.zIndex += index;
        });
        applyAndCommit({ ...emptyMutation(), create });
        setSelection(create.map((el) => el.id));
      }
    };

    window.addEventListener("copy", onCopyOrCut);
    window.addEventListener("cut", onCopyOrCut);
    window.addEventListener("paste", onPaste);
    return () => {
      window.removeEventListener("copy", onCopyOrCut);
      window.removeEventListener("cut", onCopyOrCut);
      window.removeEventListener("paste", onPaste);
    };
  }, [
    size,
    editingId,
    uploadImage,
    buildElement,
    applyAndCommit,
    selectedForClipboard,
    deleteSelection,
    pasteElements,
  ]);

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

  const onThumbnailSavedRef = useRef(onThumbnailSaved);
  useEffect(() => {
    onThumbnailSavedRef.current = onThumbnailSaved;
  });

  useEffect(() => {
    // Kanvas baru dimuat belum mengubah apa pun.
    thumbnailDirty.current = false;
    const THROTTLE_MS = 45_000;
    const saveThumbnail = async () => {
      thumbnailDirty.current = false;
      lastThumbnailAt.current = Date.now();
      try {
        const thumbnail = await renderBoardThumbnail({
          elements: [...elementsRef.current.values()],
          dark,
        });
        if (!thumbnail) return;
        await saveRoomWhiteboardThumbnail({ boardId: board.id, thumbnail });
        onThumbnailSavedRef.current?.(thumbnail);
      } catch {
        // Pratinjau bersifat kosmetik — kegagalan tidak perlu diributkan.
      }
    };
    const id = window.setInterval(() => {
      if (!thumbnailDirty.current) return;
      if (document.visibilityState === "hidden") return;
      if (Date.now() - lastThumbnailAt.current < THROTTLE_MS) return;
      if (interactionRef.current.kind !== "idle") return;
      void saveThumbnail();
    }, 15_000);
    return () => {
      window.clearInterval(id);
      // Pindah papan sebelum jadwal berikutnya: simpan pratinjau terakhir
      // supaya kartu di daftar tidak menampilkan isi lama.
      if (thumbnailDirty.current) void saveThumbnail();
    };
  }, [board.id, dark, elementsRef]);

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  /**
   * Tab saat menulis di sticky: simpan, lalu langsung buat sticky baru di
   * kanannya — cara cepat menuangkan banyak ide berturut-turut.
   */
  const createNextSticky = useCallback(
    (fromId: string) => {
      const from = elementsRef.current.get(fromId);
      if (!from) return;
      const gap = 24;
      const element = buildElement(
        RoomWhiteboardElementType.STICKY,
        {
          x: from.x + from.width + gap,
          y: from.y,
          width: from.width,
          height: from.height,
        },
        { fill: from.props.fill ?? stickyColorRef.current },
      );
      applyAndCommit({ ...emptyMutation(), create: [element] });
      setSelection([element.id]);
      setEditingId(element.id);
      // Ikuti sticky baru kalau ia keluar dari layar.
      const view = visibleWorldBox(viewportRef.current, size);
      if (!boxContains(view, element)) {
        setViewport((v) => ({
          ...v,
          x: v.x - (element.width + gap) * v.zoom,
        }));
      }
    },
    [elementsRef, buildElement, applyAndCommit, size],
  );

  const selectTool = useCallback(
    (next: WhiteboardTool) => {
      if (next === "image") {
        // Gambar bukan alat yang "dipegang": langsung buka pemilih file.
        pickImage();
        return;
      }
      setTool(next);
      setHoverId(null);
      setHoverCursor(null);
    },
    [pickImage],
  );

  const activeCursor = spacePressed
    ? "grab"
    : tool === "select" && hoverCursor
      ? hoverCursor
      : TOOL_META[tool].cursor;

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

  // Saat peserta lain sedang menggeser objek, konektor yang menempel harus
  // mengikuti posisi pratinjaunya — bukan posisi tersimpan yang tertinggal.
  const renderLookup = useMemo(() => {
    if (remoteDraftOverrides.size === 0) return getElement;
    const map = new Map(renderElements.map((el) => [el.id, el]));
    return (id: string) => map.get(id);
  }, [remoteDraftOverrides, renderElements, getElement]);

  const renderContext = useMemo(
    () => ({ dark, getElement: renderLookup, editingId }),
    [dark, renderLookup, editingId],
  );

  const editingElement = editingId ? elements.get(editingId) : undefined;
  const hoverElement =
    hoverId && !selection.includes(hoverId) ? elements.get(hoverId) : undefined;
  const attachElement = attachTarget ? elements.get(attachTarget) : undefined;
  const lockedCount = useMemo(
    () => ordered.reduce((count, el) => count + (el.locked ? 1 : 0), 0),
    [ordered],
  );
  const laserPeers = sync.presence.filter(
    (peer) => peer.tool === "laser" && peer.cursor,
  );

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
      className="bg-muted/40 @container relative h-full w-full touch-none overflow-hidden outline-none select-none"
      tabIndex={0}
      aria-label={`Kanvas papan ${board.title}`}
      onDrop={onDrop}
      onDragOver={(e) => e.preventDefault()}
      onContextMenu={(event) => {
        event.preventDefault();
        const world = pointerWorld(event);
        const tolerance = 4 / viewport.zoom;
        // Klik kanan juga menjangkau objek terkunci — satu-satunya jalan
        // untuk membuka kuncinya, karena klik kiri sengaja menembusnya.
        let hit = pickElement(ordered, world, tolerance);
        if (!hit) {
          for (let i = ordered.length - 1; i >= 0; i -= 1) {
            const el = ordered[i]!;
            if (el.locked && hitTestElement(el, world, tolerance)) {
              hit = el;
              break;
            }
          }
        }
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
        onPointerLeave={() => {
          setHoverId(null);
          sendPresence({ cursor: null, selection: selectionRef.current, tool });
        }}
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

          {hoverElement && !preview ? (
            <OutlineBox element={hoverElement} dark={dark} subtle />
          ) : null}
          {attachElement ? (
            <OutlineBox element={attachElement} dark={dark} />
          ) : null}

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

          <LaserTrail
            points={laserTrail.points}
            now={laserTrail.now}
            color={LOCAL_LASER_COLOR}
          />
          {laserPeers.map((peer) => (
            <RemoteLaser
              key={peer.sessionId}
              cursor={peer.cursor}
              color={cursorColorFor(peer.userId)}
            />
          ))}
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
          onCommit={(text, next) => {
            const id = editingElement.id;
            commitText(id, text);
            setEditingId(null);
            if (next && editingElement.type === RoomWhiteboardElementType.STICKY) {
              createNextSticky(id);
            }
          }}
        />
      ) : null}

      {ordered.length === 0 && !preview && !editingId ? (
        <EmptyBoardHint />
      ) : null}

      {/* Panel & kontrol mengambang */}
      <div className="pointer-events-none absolute inset-0">
        {selectedElements.length > 0 && !editingId ? (
          <div className="pointer-events-auto absolute top-3 left-3 max-h-[calc(100%-6.5rem)] overflow-y-auto rounded-2xl">
            <WhiteboardStylePanel
              elements={selectedElements}
              dark={dark}
              onChange={updateSelectionProps}
              onReorder={reorderSelection}
              onAlign={alignSelection}
              onDuplicate={() => duplicateSelection()}
              onDelete={deleteSelection}
              onToggleLock={toggleLockSelection}
              onEditText={
                selectedElements.length === 1 &&
                TEXT_CAPABLE_TYPES.has(selectedElements[0]!.type)
                  ? () => startEditing(selectedElements[0]!.id)
                  : undefined
              }
            />
          </div>
        ) : null}

        <div className="pointer-events-auto absolute top-3 right-3">
          <WhiteboardPresenceBar
            presence={sync.presence}
            status={sync.status}
            unsaved={sync.unsaved}
            currentUser={currentUser}
            onExport={handleExport}
            exportScope={selectedElements.length > 0 ? "selection" : "board"}
          />
        </div>

        <div className="pointer-events-auto absolute bottom-3 left-1/2 max-w-[calc(100%-1.5rem)] -translate-x-1/2">
          <WhiteboardToolbar
            tool={tool}
            onToolChange={selectTool}
            toolLocked={toolLocked}
            onToggleToolLock={() => setToolLocked((locked) => !locked)}
            stickyColor={stickyColor}
            onStickyColorChange={(color) => {
              setStickyColor(color);
              setTool("sticky");
            }}
            dark={dark}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={doUndo}
            onRedo={doRedo}
          />
        </div>

        <div className="pointer-events-auto absolute right-3 bottom-[4.25rem] flex flex-col items-end gap-2 @min-[72rem]:bottom-3">
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
            hasSelection={selectedElements.length > 0}
            onZoomIn={() => zoomBy(1.2)}
            onZoomOut={() => zoomBy(1 / 1.2)}
            onZoomTo={zoomTo}
            onFit={() => zoomToFit()}
            onFitSelection={() => zoomToFit(selectedElements)}
            onShowShortcuts={() => setShortcutsOpen(true)}
          />
        </div>
      </div>

      {contextMenu ? (
        <WhiteboardContextMenu
          state={contextMenu}
          bounds={size}
          hasSelection={selectedElements.length > 0}
          multiple={selectedElements.length > 1}
          locked={selectedElements.some((el) => el.locked)}
          canEditText={
            selectedElements.length === 1 &&
            TEXT_CAPABLE_TYPES.has(selectedElements[0]!.type)
          }
          canPaste={hasClipboard}
          lockedCount={lockedCount}
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
              case "unlock-all":
                unlockAll();
                break;
              case "select-all":
                setSelection(
                  ordered.filter((el) => !el.locked).map((el) => el.id),
                );
                break;
              case "zoom-fit":
                zoomToFit();
                break;
              case "zoom-selection":
                zoomToFit(selectedElements);
                break;
              case "add-sticky": {
                const element = buildElement(
                  RoomWhiteboardElementType.STICKY,
                  centeredBox(
                    contextMenu.world,
                    defaultSizeForType(RoomWhiteboardElementType.STICKY),
                  ),
                );
                applyAndCommit({ ...emptyMutation(), create: [element] });
                startEditing(element.id);
                break;
              }
              case "edit-text": {
                const first = selectedElements[0];
                if (first) startEditing(first.id);
                break;
              }
            }
          }}
        />
      ) : null}

      <WhiteboardShortcutsDialog
        open={shortcutsOpen}
        onOpenChange={setShortcutsOpen}
      />
    </div>
  );
}

const LOCAL_LASER_COLOR = "#ef4444";

/**
 * Petunjuk di tengah papan yang masih kosong. Tidak menangkap klik, jadi
 * pengguna bisa langsung mulai menggambar di atasnya.
 */
function EmptyBoardHint() {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
      <div className="max-w-sm text-center">
        <p className="text-foreground text-base font-semibold">
          Papan ini masih kosong
        </p>
        <p className="text-muted-foreground mt-1.5 text-sm leading-relaxed">
          Klik dua kali di mana saja untuk menulis sticky note, atau pilih alat
          di bawah.
        </p>
        <dl className="text-muted-foreground mt-5 inline-grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-1.5 text-left text-xs">
          {EMPTY_HINTS.map(({ keys, label }) => (
            <Fragment key={label}>
              <dt className="flex justify-end gap-1">
                {keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dt>
              <dd>{label}</dd>
            </Fragment>
          ))}
        </dl>
      </div>
    </div>
  );
}

const EMPTY_HINTS = [
  { keys: ["N"], label: "Sticky note" },
  { keys: ["R"], label: "Persegi" },
  { keys: ["C"], label: "Konektor antar-objek" },
  { keys: ["Ctrl", "V"], label: "Tempel gambar atau teks" },
  { keys: ["?"], label: "Semua pintasan" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="border-border bg-card text-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-[10px] font-semibold shadow-[0_1px_0_var(--border)]">
      {children}
    </kbd>
  );
}

/** Garis tipis di sekeliling objek: sorotan hover, atau target tempelan. */
function OutlineBox({
  element,
  dark,
  subtle = false,
}: {
  element: WhiteboardElement;
  dark: boolean;
  subtle?: boolean;
}) {
  const accent = dark ? "#60a5fa" : "#2563eb";
  const center = boxCenter(element);
  const transform = element.rotation
    ? `rotate(${(element.rotation * 180) / Math.PI} ${center.x} ${center.y})`
    : undefined;
  const box = LINEAR_TYPES.has(element.type)
    ? elementAABB(element)
    : { x: element.x, y: element.y, width: element.width, height: element.height };
  const pad = subtle ? 0 : 4;
  return (
    <rect
      x={box.x - pad}
      y={box.y - pad}
      width={Math.max(0, box.width + pad * 2)}
      height={Math.max(0, box.height + pad * 2)}
      rx={subtle ? 2 : 6}
      fill={subtle ? "none" : dark ? "rgba(96,165,250,0.08)" : "rgba(37,99,235,0.06)"}
      stroke={accent}
      strokeOpacity={subtle ? 0.55 : 1}
      strokeWidth={subtle ? 1 : 2}
      vectorEffect="non-scaling-stroke"
      transform={transform}
      style={{ pointerEvents: "none" }}
    />
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

function isTypingTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  return Boolean(
    el &&
      (el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT" ||
        el.isContentEditable),
  );
}

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
  dx = 0,
  dy = 0,
): WhiteboardProps {
  if (!props.start && !props.end) return { ...props };
  const clone: WhiteboardProps = { ...props };
  for (const key of ["start", "end"] as const) {
    const endpoint = clone[key];
    if (!endpoint) continue;
    clone[key] = {
      ...endpoint,
      // Tempelan ke objek yang tidak ikut disalin dilepas — salinan tidak
      // boleh "menarik" garis dari objek aslinya.
      elementId: endpoint.elementId
        ? (idMap.get(endpoint.elementId) ?? null)
        : null,
      x: endpoint.x + dx,
      y: endpoint.y + dy,
    };
  }
  return clone;
}

/** Kotak area world yang sedang terlihat di layar. */
function visibleWorldBox(
  viewport: Viewport,
  size: { width: number; height: number },
): Box {
  const topLeft = screenToWorld({ x: 0, y: 0 }, viewport);
  return {
    x: topLeft.x,
    y: topLeft.y,
    width: size.width / viewport.zoom,
    height: size.height / viewport.zoom,
  };
}

function serializeClipboard(elements: WhiteboardElement[]): string {
  return JSON.stringify({ kind: CLIPBOARD_MARKER, elements });
}

/** Objek whiteboard dari teks clipboard, atau null kalau bukan milik kita. */
function parseClipboard(text: string): WhiteboardElement[] | null {
  if (!text.includes(CLIPBOARD_MARKER)) return null;
  try {
    const data = JSON.parse(text) as { kind?: string; elements?: unknown };
    if (data.kind !== CLIPBOARD_MARKER || !Array.isArray(data.elements)) {
      return null;
    }
    const out: WhiteboardElement[] = [];
    for (const raw of data.elements.slice(0, 2000)) {
      // Validasi ulang: isi clipboard bisa berasal dari mana saja.
      const parsed = whiteboardElementInputSchema.safeParse(raw);
      if (!parsed.success) continue;
      out.push({
        ...parsed.data,
        rev: 0,
        deleted: false,
        updatedById: null,
      });
    }
    return out;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Garis & konektor yang menempel
// ---------------------------------------------------------------------------

/** Alat garis yang ujungnya otomatis menempel ke objek. */
const ATTACHING_TOOLS = new Set<WhiteboardTool>(["connector", "arrow"]);

/** Geometri tersimpan garis setelah ujung-ujungnya diresolusi ke objek. */
function resolvedLinearGeometry(
  element: WhiteboardElement,
  map: Map<string, WhiteboardElement>,
): { x: number; y: number; width: number; height: number } {
  const points = connectorPoints(element, (id) => map.get(id));
  const a = points[0]!;
  const b = points[points.length - 1]!;
  return { x: a.x, y: a.y, width: b.x - a.x, height: b.y - a.y };
}

/**
 * Patch untuk garis yang menempel ke salah satu elemen di `changed` (atau
 * garis itu sendiri berubah), agar geometri tersimpannya sama dengan yang
 * tampil di layar.
 */
function connectorFollowUps(
  changed: Set<string>,
  map: Map<string, WhiteboardElement>,
): WhiteboardElementPatch[] {
  const out: WhiteboardElementPatch[] = [];
  for (const el of map.values()) {
    if (!LINEAR_TYPES.has(el.type)) continue;
    const start = el.props.start?.elementId ?? null;
    const end = el.props.end?.elementId ?? null;
    if (!start && !end) continue;
    if (
      !changed.has(el.id) &&
      !(start && changed.has(start)) &&
      !(end && changed.has(end))
    ) {
      continue;
    }
    const geometry = resolvedLinearGeometry(el, map);
    if (
      Math.abs(geometry.x - el.x) < 0.01 &&
      Math.abs(geometry.y - el.y) < 0.01 &&
      Math.abs(geometry.width - el.width) < 0.01 &&
      Math.abs(geometry.height - el.height) < 0.01
    ) {
      continue;
    }
    out.push({ id: el.id, ...geometry });
  }
  return out;
}

function hasEndpoints(element: WhiteboardElement): boolean {
  return (
    LINEAR_TYPES.has(element.type) &&
    Boolean(element.props.start || element.props.end)
  );
}

function geometryPatch(
  element: WhiteboardElement,
  withEnds: boolean,
): WhiteboardElementPatch {
  const patch: WhiteboardElementPatch = {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
  };
  if (withEnds) {
    const props: WhiteboardProps = {};
    // Ujung yang tidak pernah menempel ditulis sebagai titik bebas — nilai
    // `undefined` akan hilang saat dikirim sebagai JSON.
    props.start = element.props.start ?? {
      elementId: null,
      side: "auto",
      x: element.x,
      y: element.y,
    };
    props.end = element.props.end ?? {
      elementId: null,
      side: "auto",
      x: element.x + element.width,
      y: element.y + element.height,
    };
    patch.props = props;
  }
  return patch;
}

function sameGeometry(a: WhiteboardElement, b: WhiteboardElement): boolean {
  return (
    a.x === b.x &&
    a.y === b.y &&
    a.width === b.width &&
    a.height === b.height &&
    a.rotation === b.rotation &&
    JSON.stringify(a.props.start ?? null) === JSON.stringify(b.props.start ?? null) &&
    JSON.stringify(a.props.end ?? null) === JSON.stringify(b.props.end ?? null)
  );
}
