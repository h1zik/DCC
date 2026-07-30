"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import type { WhiteboardPresence } from "@/lib/whiteboard/bus";
import type { SerializedElement } from "@/lib/whiteboard/serialize";
import type { WhiteboardMutation } from "@/lib/whiteboard/types";

/**
 * Mesin sinkronisasi papan di sisi klien.
 *
 * Alur singkatnya:
 *  1. Perubahan lokal langsung tampil (optimistik) lalu dikirim ke `/sync`.
 *  2. Peserta lain menerima sinyal `rev` lewat SSE, lalu menarik delta.
 *  3. Elemen yang sedang disentuh pengguna ditandai *dirty* dan dilindungi
 *     dari penimpaan delta — kalau tidak, geseran yang sedang berjalan akan
 *     tersentak balik ke posisi lama saat delta miliknya sendiri kembali.
 *
 * Yang efemeral (kursor, pratinjau geser) tidak pernah lewat database.
 */

export type DraftPatch = {
  id: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  rotation?: number;
  points?: [number, number, number][];
};

export type RemoteDraft = {
  sessionId: string;
  elements: Map<string, DraftPatch>;
};

type SyncOptions = {
  roomId: string;
  boardId: string;
  /** Revisi awal yang sudah dimiliki klien dari render server. */
  initialRev: number;
  onRemoteElements: (elements: SerializedElement[]) => void;
  onBoardGone?: () => void;
};

export type SyncStatus = "connecting" | "live" | "offline" | "saving";

const PRESENCE_THROTTLE_MS = 45;
const RETRY_BASE_MS = 1000;
const RETRY_MAX_MS = 15_000;

export function useWhiteboardSync(options: SyncOptions) {
  const { roomId, boardId, initialRev, onRemoteElements, onBoardGone } = options;

  /**
   * Id sesi per tab. `useId` dipakai (bukan `crypto.randomUUID`) karena harus
   * stabil dan deterministik saat render — memanggil generator acak ketika
   * render melanggar aturan kemurnian React.
   */
  const reactId = useId();
  const sessionId = `${boardId}:${reactId}`;

  const base = `/api/rooms/${roomId}/whiteboards/${boardId}`;

  const [status, setStatus] = useState<SyncStatus>("connecting");
  const [presence, setPresence] = useState<WhiteboardPresence[]>([]);
  const [drafts, setDrafts] = useState<Map<string, RemoteDraft>>(new Map());

  const revRef = useRef(initialRev);
  /** Elemen yang sedang disunting lokal — dilindungi dari delta. */
  const dirtyRef = useRef<Set<string>>(new Set());
  const fetchingRef = useRef(false);
  const pendingFetchRef = useRef(false);
  const inflightRef = useRef(0);

  /**
   * Callback pemanggil disimpan di ref supaya koneksi SSE tidak perlu dibuka
   * ulang hanya karena komponen induk membuat fungsi baru saat render.
   */
  const onRemoteRef = useRef(onRemoteElements);
  const onGoneRef = useRef(onBoardGone);
  useEffect(() => {
    onRemoteRef.current = onRemoteElements;
    onGoneRef.current = onBoardGone;
  });

  // -------------------------------------------------------------------------
  // Penarikan delta
  // -------------------------------------------------------------------------

  const pullDelta = useCallback(async () => {
    if (fetchingRef.current) {
      // Permintaan yang datang saat fetch berjalan tidak menambah round-trip;
      // cukup ditandai, lalu diproses oleh putaran berikutnya di bawah.
      pendingFetchRef.current = true;
      return;
    }
    fetchingRef.current = true;
    try {
      do {
        pendingFetchRef.current = false;
        const res = await fetch(`${base}/sync?since=${revRef.current}`, {
          cache: "no-store",
        });
        if (!res.ok) {
          if (res.status === 404) onGoneRef.current?.();
          return;
        }
        const data = (await res.json()) as {
          rev: number;
          elements: SerializedElement[];
        };
        if (data.rev > revRef.current) revRef.current = data.rev;
        if (data.elements.length > 0) {
          const dirty = dirtyRef.current;
          const applicable = data.elements.filter((el) => !dirty.has(el.id));
          if (applicable.length > 0) onRemoteRef.current(applicable);
        }
      } while (pendingFetchRef.current);
    } catch {
      // Jaringan sedang bermasalah; SSE akan memicu penarikan ulang.
    } finally {
      fetchingRef.current = false;
    }
  }, [base]);

  // -------------------------------------------------------------------------
  // Stream SSE
  // -------------------------------------------------------------------------

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;
    let attempt = 0;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      setStatus((s) => (s === "live" ? s : "connecting"));
      source = new EventSource(`${base}/stream?sessionId=${sessionId}`);

      source.addEventListener("ready", (event) => {
        attempt = 0;
        setStatus("live");
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            rev: number;
            presence: WhiteboardPresence[];
          };
          setPresence(data.presence.filter((p) => p.sessionId !== sessionId));
          if (data.rev > revRef.current) void pullDelta();
        } catch {
          void pullDelta();
        }
      });

      source.addEventListener("rev", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            rev: number;
            origin: string | null;
          };
          if (data.rev > revRef.current) void pullDelta();
        } catch {
          void pullDelta();
        }
      });

      source.addEventListener("presence", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            presence: WhiteboardPresence;
          };
          if (data.presence.sessionId === sessionId) return;
          setPresence((prev) => {
            const next = prev.filter(
              (p) => p.sessionId !== data.presence.sessionId,
            );
            next.push(data.presence);
            return next;
          });
        } catch {
          // Abaikan pesan yang rusak.
        }
      });

      source.addEventListener("draft", (event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            sessionId: string;
            elements: DraftPatch[];
          };
          if (data.sessionId === sessionId) return;
          setDrafts((prev) => {
            const next = new Map(prev);
            next.set(data.sessionId, {
              sessionId: data.sessionId,
              elements: new Map(data.elements.map((e) => [e.id, e])),
            });
            return next;
          });
        } catch {
          // Abaikan.
        }
      });

      const dropDraft = (event: Event) => {
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            sessionId: string;
          };
          setDrafts((prev) => {
            if (!prev.has(data.sessionId)) return prev;
            const next = new Map(prev);
            next.delete(data.sessionId);
            return next;
          });
        } catch {
          // Abaikan.
        }
      };
      source.addEventListener("draft-end", dropDraft);

      source.addEventListener("leave", (event) => {
        dropDraft(event);
        try {
          const data = JSON.parse((event as MessageEvent).data) as {
            sessionId: string;
          };
          setPresence((prev) => prev.filter((p) => p.sessionId !== data.sessionId));
        } catch {
          // Abaikan.
        }
      });

      source.addEventListener("gone", () => {
        disposed = true;
        source?.close();
        onGoneRef.current?.();
      });

      // Server menutup koneksi panjang secara sengaja; sambung ulang segera.
      source.addEventListener("reconnect", () => {
        source?.close();
        if (!disposed) connect();
      });

      source.onerror = () => {
        source?.close();
        source = null;
        if (disposed) return;
        setStatus("offline");
        attempt += 1;
        const delay = Math.min(RETRY_MAX_MS, RETRY_BASE_MS * 2 ** (attempt - 1));
        retryTimer = setTimeout(connect, delay);
      };
    };

    connect();

    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
      // Beri tahu peserta lain bahwa kursor ini pergi.
      const body = JSON.stringify({ kind: "leave", sessionId });
      if (typeof navigator !== "undefined" && "sendBeacon" in navigator) {
        navigator.sendBeacon(
          `${base}/presence`,
          new Blob([body], { type: "application/json" }),
        );
      } else {
        void fetch(`${base}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => undefined);
      }
    };
  }, [base, sessionId, pullDelta, onGoneRef]);

  // Buang peserta yang tidak mengirim kabar lagi (mis. tab-nya crash).
  useEffect(() => {
    const id = window.setInterval(() => {
      const cutoff = Date.now() - 30_000;
      setPresence((prev) => {
        const next = prev.filter((p) => p.updatedAt > cutoff);
        return next.length === prev.length ? prev : next;
      });
    }, 10_000);
    return () => window.clearInterval(id);
  }, []);

  // -------------------------------------------------------------------------
  // Antrean commit
  // -------------------------------------------------------------------------

  const queueRef = useRef<WhiteboardMutation[]>([]);
  const flushingRef = useRef(false);

  const flush = useCallback(async () => {
    if (flushingRef.current) return;
    flushingRef.current = true;
    try {
      while (queueRef.current.length > 0) {
        // Gabungkan seluruh antrean jadi satu permintaan supaya rentetan
        // perubahan cepat tidak jadi puluhan round-trip.
        const batch = queueRef.current;
        queueRef.current = [];
        const merged: WhiteboardMutation = {
          create: batch.flatMap((m) => m.create),
          update: batch.flatMap((m) => m.update),
          delete: batch.flatMap((m) => m.delete),
        };

        inflightRef.current += 1;
        setStatus((s) => (s === "offline" ? s : "saving"));
        try {
          const res = await fetch(`${base}/sync`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mutation: merged, sessionId }),
          });
          if (!res.ok) {
            const detail = (await res.json().catch(() => null)) as
              | { error?: string }
              | null;
            throw new Error(detail?.error ?? "Gagal menyimpan perubahan.");
          }
          const data = (await res.json()) as { rev: number };
          if (data.rev > revRef.current) {
            // Tarik delta agar perubahan peserta lain di antara revisi ini
            // ikut masuk — perubahan sendiri idempoten saat diterapkan ulang.
            void pullDelta();
          }
        } finally {
          inflightRef.current -= 1;
        }
      }
      setStatus((s) => (s === "offline" ? s : "live"));
    } finally {
      flushingRef.current = false;
    }
  }, [base, sessionId, pullDelta]);

  const commit = useCallback(
    (mutation: WhiteboardMutation) => {
      if (
        mutation.create.length === 0 &&
        mutation.update.length === 0 &&
        mutation.delete.length === 0
      ) {
        return Promise.resolve();
      }
      queueRef.current.push(mutation);
      return flush();
    },
    [flush],
  );

  // -------------------------------------------------------------------------
  // Kanal efemeral
  // -------------------------------------------------------------------------

  const lastPresenceSentRef = useRef(0);
  const presenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPresenceRef = useRef<{
    cursor: { x: number; y: number } | null;
    selection: string[];
    tool: string;
  } | null>(null);

  const postEphemeral = useCallback(
    (body: unknown) => {
      void fetch(`${base}/presence`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).catch(() => undefined);
    },
    [base],
  );

  const sendPresence = useCallback(
    (payload: {
      cursor: { x: number; y: number } | null;
      selection: string[];
      tool: string;
    }) => {
      pendingPresenceRef.current = payload;
      const now = Date.now();
      const elapsed = now - lastPresenceSentRef.current;
      const send = () => {
        const next = pendingPresenceRef.current;
        pendingPresenceRef.current = null;
        presenceTimerRef.current = null;
        if (!next) return;
        lastPresenceSentRef.current = Date.now();
        postEphemeral({ kind: "presence", sessionId, ...next });
      };
      if (elapsed >= PRESENCE_THROTTLE_MS) {
        send();
      } else if (!presenceTimerRef.current) {
        presenceTimerRef.current = setTimeout(send, PRESENCE_THROTTLE_MS - elapsed);
      }
    },
    [postEphemeral, sessionId],
  );

  const lastDraftSentRef = useRef(0);

  const sendDraft = useCallback(
    (elements: DraftPatch[]) => {
      const now = Date.now();
      if (now - lastDraftSentRef.current < PRESENCE_THROTTLE_MS) return;
      lastDraftSentRef.current = now;
      postEphemeral({ kind: "draft", sessionId, elements });
    },
    [postEphemeral, sessionId],
  );

  const endDraft = useCallback(() => {
    lastDraftSentRef.current = 0;
    postEphemeral({ kind: "draft-end", sessionId });
  }, [postEphemeral, sessionId]);

  useEffect(
    () => () => {
      if (presenceTimerRef.current) clearTimeout(presenceTimerRef.current);
    },
    [],
  );

  // -------------------------------------------------------------------------
  // Penanda elemen yang sedang disunting lokal
  // -------------------------------------------------------------------------

  const markDirty = useCallback((ids: Iterable<string>) => {
    for (const id of ids) dirtyRef.current.add(id);
  }, []);

  const clearDirty = useCallback((ids: Iterable<string>) => {
    // Tunggu sebentar agar delta hasil commit sendiri (yang isinya sama)
    // sudah lewat sebelum elemen kembali menerima pembaruan dari peserta lain.
    const list = [...ids];
    setTimeout(() => {
      for (const id of list) dirtyRef.current.delete(id);
    }, 600);
  }, []);

  const setRev = useCallback((rev: number) => {
    if (rev > revRef.current) revRef.current = rev;
  }, []);

  return {
    sessionId,
    status,
    presence,
    drafts,
    commit,
    pullDelta,
    sendPresence,
    sendDraft,
    endDraft,
    markDirty,
    clearDirty,
    setRev,
  };
}
