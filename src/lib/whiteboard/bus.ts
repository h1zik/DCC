import "server-only";

/**
 * Bus realtime dalam proses untuk whiteboard.
 *
 * Dipakai untuk dua jenis pesan:
 *  - **Ephemeral** (kursor, seleksi, pratinjau geser): tidak pernah masuk
 *    database. Hilang begitu peserta menutup papan.
 *  - **Sinyal revisi**: pemberitahuan "papan X sudah naik ke rev N" supaya
 *    klien lain langsung menarik delta tanpa menunggu polling.
 *
 * Aplikasi berjalan sebagai satu proses Node persisten (`next start`), jadi
 * bus in-memory sudah cukup untuk broadcast instan. Agar tetap benar kalau
 * suatu saat dijalankan lebih dari satu instance, stream SSE **juga**
 * menelusuri `rev` papan langsung dari database secara berkala — bus hanya
 * mempercepat, bukan satu-satunya sumber kebenaran untuk data tersimpan.
 */

export type WhiteboardPresence = {
  /** Id sesi unik per tab, bukan user id — satu user bisa buka 2 tab. */
  sessionId: string;
  userId: string;
  name: string;
  image: string | null;
  /** Posisi kursor di koordinat world. Null saat kursor keluar dari kanvas. */
  cursor: { x: number; y: number } | null;
  /** Id elemen yang sedang dipilih peserta ini. */
  selection: string[];
  /** Alat yang sedang dipakai — ditampilkan di label kursor. */
  tool: string;
  updatedAt: number;
};

export type WhiteboardEphemeralMessage =
  | { kind: "presence"; boardId: string; presence: WhiteboardPresence }
  | { kind: "leave"; boardId: string; sessionId: string }
  /**
   * Pratinjau perubahan yang belum di-commit (sedang digeser/diubah ukuran).
   * Klien penerima menampilkannya sebagai overlay sementara.
   */
  | {
      kind: "draft";
      boardId: string;
      sessionId: string;
      elements: Array<{
        id: string;
        x?: number;
        y?: number;
        width?: number;
        height?: number;
        rotation?: number;
        points?: [number, number, number][];
      }>;
    }
  | { kind: "draft-end"; boardId: string; sessionId: string }
  /** Papan naik revisi — penerima menarik delta `rev > since`. */
  | { kind: "rev"; boardId: string; rev: number; sessionId: string | null };

type Listener = (message: WhiteboardEphemeralMessage) => void;

type BusState = {
  listeners: Map<string, Set<Listener>>;
  presence: Map<string, Map<string, WhiteboardPresence>>;
};

/**
 * Simpan di global supaya bertahan melewati hot-reload modul saat dev
 * (Next.js membuang cache modul, tetapi `globalThis` tetap).
 */
const globalForBus = globalThis as unknown as {
  __dccWhiteboardBus?: BusState;
};

function bus(): BusState {
  if (!globalForBus.__dccWhiteboardBus) {
    globalForBus.__dccWhiteboardBus = {
      listeners: new Map(),
      presence: new Map(),
    };
  }
  return globalForBus.__dccWhiteboardBus;
}

export function subscribeBoard(boardId: string, listener: Listener): () => void {
  const state = bus();
  let set = state.listeners.get(boardId);
  if (!set) {
    set = new Set();
    state.listeners.set(boardId, set);
  }
  set.add(listener);

  return () => {
    const current = state.listeners.get(boardId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) state.listeners.delete(boardId);
  };
}

export function publish(message: WhiteboardEphemeralMessage): void {
  const state = bus();

  if (message.kind === "presence") {
    let room = state.presence.get(message.boardId);
    if (!room) {
      room = new Map();
      state.presence.set(message.boardId, room);
    }
    room.set(message.presence.sessionId, message.presence);
  } else if (message.kind === "leave") {
    const room = state.presence.get(message.boardId);
    room?.delete(message.sessionId);
    if (room && room.size === 0) state.presence.delete(message.boardId);
  }

  const listeners = state.listeners.get(message.boardId);
  if (!listeners) return;
  for (const listener of listeners) {
    try {
      listener(message);
    } catch {
      // Satu listener yang error tidak boleh menghentikan broadcast ke yang lain.
    }
  }
}

const PRESENCE_TTL_MS = 30_000;

/** Peserta yang masih aktif di sebuah papan (yang basi otomatis dibuang). */
export function listPresence(boardId: string): WhiteboardPresence[] {
  const state = bus();
  const room = state.presence.get(boardId);
  if (!room) return [];
  const now = Date.now();
  const alive: WhiteboardPresence[] = [];
  for (const [sessionId, presence] of room) {
    if (now - presence.updatedAt > PRESENCE_TTL_MS) {
      room.delete(sessionId);
      continue;
    }
    alive.push(presence);
  }
  if (room.size === 0) state.presence.delete(boardId);
  return alive;
}
