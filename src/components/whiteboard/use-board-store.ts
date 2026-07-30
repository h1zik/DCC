"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { SerializedElement } from "@/lib/whiteboard/serialize";
import { sortByZ } from "@/lib/whiteboard/serialize";
import type {
  WhiteboardElement,
  WhiteboardElementInput,
  WhiteboardElementPatch,
  WhiteboardMutation,
} from "@/lib/whiteboard/types";

/**
 * Penyimpanan elemen papan di klien + riwayat undo/redo.
 *
 * Setiap mutasi disimpan berpasangan dengan kebalikannya, sehingga undo cukup
 * menerapkan (dan mengirim) mutasi kebalikan itu — tidak perlu menyimpan
 * snapshot seluruh papan.
 */

export type BoardCommand = {
  forward: WhiteboardMutation;
  backward: WhiteboardMutation;
  /**
   * Aksi berturut-turut dengan kunci yang sama digabung jadi satu langkah
   * undo (mis. mengetik di sticky yang sama).
   */
  coalesceKey?: string;
};

const EMPTY_MUTATION: WhiteboardMutation = { create: [], update: [], delete: [] };

export function emptyMutation(): WhiteboardMutation {
  return { create: [], update: [], delete: [] };
}

export function isEmptyMutation(m: WhiteboardMutation): boolean {
  return m.create.length === 0 && m.update.length === 0 && m.delete.length === 0;
}

const MAX_HISTORY = 120;

function toElement(input: WhiteboardElementInput): WhiteboardElement {
  return {
    id: input.id,
    type: input.type,
    zIndex: input.zIndex,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation,
    props: input.props,
    locked: input.locked,
    frameId: input.frameId,
    rev: 0,
    deleted: false,
    updatedById: null,
  };
}

function elementToInput(element: WhiteboardElement): WhiteboardElementInput {
  return {
    id: element.id,
    type: element.type,
    zIndex: element.zIndex,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    props: element.props,
    locked: element.locked,
    frameId: element.frameId,
  };
}

export function useBoardStore(initial: SerializedElement[]) {
  const [elements, setElements] = useState<Map<string, WhiteboardElement>>(() => {
    const map = new Map<string, WhiteboardElement>();
    for (const el of initial) {
      if (el.deleted) continue;
      map.set(el.id, el);
    }
    return map;
  });

  const undoStack = useRef<BoardCommand[]>([]);
  const redoStack = useRef<BoardCommand[]>([]);
  /**
   * Ketersediaan undo/redo disimpan sebagai state, bukan dibaca dari panjang
   * tumpukan saat render — membaca ref ketika render tidak dijamin memicu
   * pembaruan UI.
   */
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const syncHistoryFlags = useCallback(() => {
    setCanUndo(undoStack.current.length > 0);
    setCanRedo(redoStack.current.length > 0);
  }, []);

  /**
   * Selalu mencerminkan state terbaru, termasuk di dalam event handler.
   * Semua penulisannya terjadi di dalam callback (bukan saat render), jadi
   * aman terhadap React Compiler.
   */
  const elementsRef = useRef(elements);

  const ordered = useMemo(() => sortByZ([...elements.values()]), [elements]);

  // -------------------------------------------------------------------------
  // Menerapkan mutasi
  // -------------------------------------------------------------------------

  const applyToMap = useCallback(
    (map: Map<string, WhiteboardElement>, mutation: WhiteboardMutation) => {
      for (const input of mutation.create) {
        map.set(input.id, toElement(input));
      }
      for (const patch of mutation.update) {
        const current = map.get(patch.id);
        if (!current) continue;
        map.set(patch.id, {
          ...current,
          ...(patch.x !== undefined ? { x: patch.x } : null),
          ...(patch.y !== undefined ? { y: patch.y } : null),
          ...(patch.width !== undefined ? { width: patch.width } : null),
          ...(patch.height !== undefined ? { height: patch.height } : null),
          ...(patch.rotation !== undefined ? { rotation: patch.rotation } : null),
          ...(patch.zIndex !== undefined ? { zIndex: patch.zIndex } : null),
          ...(patch.locked !== undefined ? { locked: patch.locked } : null),
          ...(patch.frameId !== undefined ? { frameId: patch.frameId } : null),
          // `props` di-merge dangkal, sama seperti perilaku server.
          ...(patch.props ? { props: { ...current.props, ...patch.props } } : null),
        });
      }
      for (const id of mutation.delete) {
        map.delete(id);
      }
      return map;
    },
    [],
  );

  /** Bangun mutasi kebalikan berdasarkan state saat ini. */
  const invert = useCallback(
    (
      mutation: WhiteboardMutation,
      snapshot: Map<string, WhiteboardElement>,
    ): WhiteboardMutation => {
      const backward = emptyMutation();

      for (const input of mutation.create) {
        const existing = snapshot.get(input.id);
        // Elemen yang sudah ada berarti ini "create" ulang (mis. redo delete).
        if (existing) backward.update.push(fullPatch(existing));
        else backward.delete.push(input.id);
      }

      for (const patch of mutation.update) {
        const current = snapshot.get(patch.id);
        if (!current) continue;
        const inverse: WhiteboardElementPatch = { id: patch.id };
        if (patch.x !== undefined) inverse.x = current.x;
        if (patch.y !== undefined) inverse.y = current.y;
        if (patch.width !== undefined) inverse.width = current.width;
        if (patch.height !== undefined) inverse.height = current.height;
        if (patch.rotation !== undefined) inverse.rotation = current.rotation;
        if (patch.zIndex !== undefined) inverse.zIndex = current.zIndex;
        if (patch.locked !== undefined) inverse.locked = current.locked;
        if (patch.frameId !== undefined) inverse.frameId = current.frameId;
        if (patch.props) {
          // Kembalikan hanya kunci yang benar-benar diubah.
          const restored: Record<string, unknown> = {};
          for (const key of Object.keys(patch.props)) {
            restored[key] = (current.props as Record<string, unknown>)[key];
          }
          inverse.props = restored;
        }
        backward.update.push(inverse);
      }

      for (const id of mutation.delete) {
        const current = snapshot.get(id);
        if (current) backward.create.push(elementToInput(current));
      }

      return backward;
    },
    [],
  );

  /**
   * Terapkan mutasi lokal. Mengembalikan mutasi yang benar-benar diterapkan
   * (siap dikirim ke server) atau `null` kalau tidak ada yang berubah.
   */
  const apply = useCallback(
    (
      mutation: WhiteboardMutation,
      options: { history?: boolean; coalesceKey?: string } = {},
    ): WhiteboardMutation | null => {
      if (isEmptyMutation(mutation)) return null;
      const { history = true, coalesceKey } = options;

      const snapshot = elementsRef.current;
      const backward = invert(mutation, snapshot);

      const next = applyToMap(new Map(snapshot), mutation);
      elementsRef.current = next;
      setElements(next);

      if (history) {
        const stack = undoStack.current;
        const last = stack[stack.length - 1];
        // Gabungkan aksi berturut-turut yang sejenis (mis. mengetik huruf
        // demi huruf) agar satu Ctrl+Z tidak hanya membatalkan satu karakter.
        if (coalesceKey && last && last.coalesceKey === coalesceKey) {
          last.forward = mergeMutations(last.forward, mutation);
          last.backward = mergeMutations(backward, last.backward);
        } else {
          stack.push({ forward: mutation, backward, coalesceKey });
          if (stack.length > MAX_HISTORY) stack.shift();
        }
        redoStack.current = [];
        syncHistoryFlags();
      }

      return mutation;
    },
    [applyToMap, invert, syncHistoryFlags],
  );

  /** Terapkan tanpa menyentuh riwayat — dipakai selama interaksi berjalan. */
  const applyTransient = useCallback(
    (mutation: WhiteboardMutation) => {
      if (isEmptyMutation(mutation)) return;
      const next = applyToMap(new Map(elementsRef.current), mutation);
      elementsRef.current = next;
      setElements(next);
    },
    [applyToMap],
  );

  /** Perubahan dari peserta lain: tidak masuk riwayat undo lokal. */
  const applyRemote = useCallback((incoming: SerializedElement[]) => {
    if (incoming.length === 0) return;
    const next = new Map(elementsRef.current);
    let changed = false;
    for (const el of incoming) {
      if (el.deleted) {
        if (next.delete(el.id)) changed = true;
        continue;
      }
      const current = next.get(el.id);
      // Revisi lama tidak boleh menimpa yang lebih baru (bisa terjadi saat
      // delta dan snapshot penuh berpapasan).
      if (current && current.rev > el.rev) continue;
      next.set(el.id, el);
      changed = true;
    }
    if (!changed) return;
    elementsRef.current = next;
    setElements(next);
  }, []);

  /** Ganti seluruh isi papan (mis. saat berpindah papan). */
  const reset = useCallback((incoming: SerializedElement[]) => {
    const map = new Map<string, WhiteboardElement>();
    for (const el of incoming) {
      if (el.deleted) continue;
      map.set(el.id, el);
    }
    elementsRef.current = map;
    setElements(map);
    undoStack.current = [];
    redoStack.current = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  // -------------------------------------------------------------------------
  // Undo / redo
  // -------------------------------------------------------------------------

  const undo = useCallback((): WhiteboardMutation | null => {
    const command = undoStack.current.pop();
    if (!command) return null;
    const snapshot = elementsRef.current;
    // Hitung ulang "forward" dari state sekarang supaya redo tetap akurat
    // walaupun ada perubahan peserta lain di antaranya.
    const refreshedForward = invert(command.backward, snapshot);
    const next = applyToMap(new Map(snapshot), command.backward);
    elementsRef.current = next;
    setElements(next);
    redoStack.current.push({
      forward: refreshedForward,
      backward: command.backward,
    });
    syncHistoryFlags();
    return command.backward;
  }, [applyToMap, invert, syncHistoryFlags]);

  const redo = useCallback((): WhiteboardMutation | null => {
    const command = redoStack.current.pop();
    if (!command) return null;
    const snapshot = elementsRef.current;
    const refreshedBackward = invert(command.forward, snapshot);
    const next = applyToMap(new Map(snapshot), command.forward);
    elementsRef.current = next;
    setElements(next);
    undoStack.current.push({
      forward: command.forward,
      backward: refreshedBackward,
    });
    syncHistoryFlags();
    return command.forward;
  }, [applyToMap, invert, syncHistoryFlags]);

  const clearHistory = useCallback(() => {
    undoStack.current = [];
    redoStack.current = [];
    syncHistoryFlags();
  }, [syncHistoryFlags]);

  /**
   * Catat satu langkah riwayat secara manual.
   *
   * Dipakai interaksi bertahap (geser/ubah ukuran/putar): selama gerakan
   * berlangsung state diubah lewat `applyTransient`, jadi saat dilepas nilai
   * "sebelum" sudah tidak ada lagi di store. Pemanggil yang menyimpannya
   * sendiri lalu mendaftarkan pasangan maju/mundurnya di sini.
   */
  const pushHistory = useCallback(
    (forward: WhiteboardMutation, backward: WhiteboardMutation) => {
      if (isEmptyMutation(forward)) return;
      undoStack.current.push({ forward, backward });
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
      redoStack.current = [];
      syncHistoryFlags();
    },
    [syncHistoryFlags],
  );

  return {
    elements,
    elementsRef,
    ordered,
    apply,
    applyTransient,
    applyRemote,
    reset,
    undo,
    redo,
    clearHistory,
    pushHistory,
    canUndo,
    canRedo,
  };
}

/** Patch yang memuat seluruh atribut sebuah elemen. */
function fullPatch(element: WhiteboardElement): WhiteboardElementPatch {
  return {
    id: element.id,
    x: element.x,
    y: element.y,
    width: element.width,
    height: element.height,
    rotation: element.rotation,
    zIndex: element.zIndex,
    locked: element.locked,
    frameId: element.frameId,
    props: element.props,
  };
}

function mergeMutations(
  a: WhiteboardMutation,
  b: WhiteboardMutation,
): WhiteboardMutation {
  const updates = new Map<string, WhiteboardElementPatch>();
  for (const patch of [...a.update, ...b.update]) {
    const existing = updates.get(patch.id);
    updates.set(
      patch.id,
      existing
        ? {
            ...existing,
            ...patch,
            props: { ...existing.props, ...patch.props },
          }
        : patch,
    );
  }
  return {
    create: [...a.create, ...b.create],
    update: [...updates.values()],
    delete: [...a.delete, ...b.delete],
  };
}

export { EMPTY_MUTATION };
