"use client";

/**
 * Mesin suara voice call: satu AudioContext (lazy) untuk soundboard & nada
 * isyarat. Suara bawaan DISINTESIS (tanpa berkas audio); suara kustom ruangan
 * di-fetch + decode sekali lalu di-cache. Tiap klien memutar lokal — volume,
 * bisu, dan Tuli sepenuhnya keputusan pendengar.
 */
import {
  ROOM_SOUND_MAX_DURATION_MS,
  builtinSoundById,
  type BuiltinSoundId,
  type RoomSoundView,
} from "@/lib/voice-sounds";

export type VoiceCue =
  | "join"
  | "leave"
  | "mic-on"
  | "mic-off"
  | "deafen"
  | "undeafen"
  | "hand";

type Engine = {
  ctx: AudioContext;
  soundboard: GainNode;
  cues: GainNode;
};

let engine: Engine | null = null;
let noiseCache: AudioBuffer | null = null;
const customBuffers = new Map<string, Promise<AudioBuffer>>();
/** Bus per pemutaran soundboard — diputus untuk menghentikan seketika. */
const activeBuses = new Set<GainNode>();
let sinkId = "";
let soundboardVolume = 0.6;

function getEngine(): Engine | null {
  if (typeof window === "undefined") return null;
  if (!engine) {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    const ctx = new Ctor();
    const soundboard = ctx.createGain();
    soundboard.gain.value = soundboardVolume;
    const cues = ctx.createGain();
    cues.gain.value = 0.5;
    // Limiter ringan supaya pad yang ditumpuk tidak memekakkan.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.ratio.value = 12;
    soundboard.connect(limiter);
    cues.connect(limiter);
    limiter.connect(ctx.destination);
    engine = { ctx, soundboard, cues };
    applySink();
  }
  // Autoplay policy: konteks dibuat/di-resume setelah gesture (klik gabung/pad).
  if (engine.ctx.state === "suspended") void engine.ctx.resume().catch(() => {});
  return engine;
}

function applySink() {
  if (!engine) return;
  const ctx = engine.ctx as AudioContext & {
    setSinkId?: (id: string) => Promise<void>;
  };
  if (typeof ctx.setSinkId !== "function") return;
  void ctx.setSinkId(sinkId).catch(() => {});
}

/** Terapkan preferensi pendengar (dipanggil saat settings berubah). */
export function configureSoundEngine(options: {
  soundboardVolume: number;
  speakerDeviceId: string;
}): void {
  if (options.speakerDeviceId !== sinkId) {
    sinkId = options.speakerDeviceId;
    applySink();
  }
  soundboardVolume = clamp01(options.soundboardVolume);
  if (engine) engine.soundboard.gain.value = soundboardVolume;
}

function clamp01(n: number): number {
  return Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0;
}

/* ───────────────────────── primitif sintesis ───────────────────────── */

type ToneOptions = {
  type: OscillatorType;
  freq: number;
  start: number;
  dur: number;
  gain: number;
  attack?: number;
  /** Frekuensi akhir (glide eksponensial sepanjang nada). */
  freqEnd?: number;
  detune?: number;
  /** Peluruhan eksponensial (bel/pluck) alih-alih sustain + release. */
  decay?: boolean;
};

function tone(ctx: AudioContext, dest: AudioNode, o: ToneOptions): OscillatorNode {
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.freq, o.start);
  if (o.freqEnd) {
    osc.frequency.exponentialRampToValueAtTime(o.freqEnd, o.start + o.dur);
  }
  if (o.detune) osc.detune.value = o.detune;
  const attack = o.attack ?? 0.01;
  amp.gain.setValueAtTime(0.0001, o.start);
  amp.gain.exponentialRampToValueAtTime(o.gain, o.start + attack);
  if (o.decay) {
    amp.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
  } else {
    amp.gain.setValueAtTime(o.gain, o.start + Math.max(attack, o.dur - 0.06));
    amp.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
  }
  osc.connect(amp).connect(dest);
  osc.start(o.start);
  osc.stop(o.start + o.dur + 0.05);
  return osc;
}

function noiseBuffer(ctx: AudioContext): AudioBuffer {
  if (!noiseCache || noiseCache.sampleRate !== ctx.sampleRate) {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache = buffer;
  }
  return noiseCache;
}

function noiseBurst(
  ctx: AudioContext,
  dest: AudioNode,
  o: {
    start: number;
    dur: number;
    gain: number;
    filter: BiquadFilterType;
    freq: number;
    q?: number;
  },
): void {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = o.filter;
  filter.frequency.value = o.freq;
  filter.Q.value = o.q ?? 1;
  const amp = ctx.createGain();
  amp.gain.setValueAtTime(o.gain, o.start);
  amp.gain.exponentialRampToValueAtTime(0.0001, o.start + o.dur);
  src.connect(filter).connect(amp).connect(dest);
  // Offset acak supaya burst berurutan tidak terdengar identik.
  src.start(o.start, Math.random() * 1.5);
  src.stop(o.start + o.dur + 0.05);
}

function lowpass(ctx: AudioContext, dest: AudioNode, freq: number): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = freq;
  filter.connect(dest);
  return filter;
}

/* ───────────────────────── suara bawaan ───────────────────────── */

const BUILTIN_SYNTHS: Record<
  BuiltinSoundId,
  (ctx: AudioContext, dest: AudioNode, t: number) => void
> = {
  airhorn(ctx, dest, t) {
    const out = lowpass(ctx, dest, 2400);
    const blasts: Array<[number, number]> = [
      [0, 0.22],
      [0.3, 0.22],
      [0.6, 0.85],
    ];
    for (const [offset, dur] of blasts) {
      for (const [freq, detune] of [
        [415, -8],
        [415, 9],
        [523, -6],
        [523, 7],
      ]) {
        tone(ctx, out, {
          type: "sawtooth",
          freq,
          freqEnd: freq * 0.96,
          detune,
          start: t + offset,
          dur,
          gain: 0.16,
          attack: 0.015,
        });
      }
    }
  },

  rimshot(ctx, dest, t) {
    for (const offset of [0, 0.2]) {
      tone(ctx, dest, {
        type: "sine",
        freq: 190,
        freqEnd: 70,
        start: t + offset,
        dur: 0.16,
        gain: 0.7,
        attack: 0.003,
        decay: true,
      });
      noiseBurst(ctx, dest, {
        start: t + offset,
        dur: 0.08,
        gain: 0.25,
        filter: "bandpass",
        freq: 1800,
      });
    }
    // "tss": simbal
    noiseBurst(ctx, dest, {
      start: t + 0.55,
      dur: 0.8,
      gain: 0.4,
      filter: "highpass",
      freq: 6500,
    });
    tone(ctx, dest, {
      type: "sine",
      freq: 160,
      freqEnd: 60,
      start: t + 0.55,
      dur: 0.2,
      gain: 0.6,
      attack: 0.003,
      decay: true,
    });
  },

  trombone(ctx, dest, t) {
    const out = lowpass(ctx, dest, 950);
    const notes: Array<[number, number, number]> = [
      [233, 0, 0.4],
      [220, 0.45, 0.4],
      [208, 0.9, 0.4],
      [196, 1.35, 1.15],
    ];
    notes.forEach(([freq, offset, dur], index) => {
      const last = index === notes.length - 1;
      const osc = tone(ctx, out, {
        type: "sawtooth",
        freq,
        freqEnd: last ? freq * 0.9 : undefined,
        start: t + offset,
        dur,
        gain: 0.32,
        attack: 0.04,
      });
      if (last) {
        // Vibrato "wah-wah" di nada terakhir.
        const lfo = ctx.createOscillator();
        const depth = ctx.createGain();
        lfo.frequency.value = 6;
        depth.gain.value = 7;
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(t + offset);
        lfo.stop(t + offset + dur);
      }
    });
  },

  tada(ctx, dest, t) {
    const out = lowpass(ctx, dest, 4200);
    tone(ctx, out, {
      type: "sawtooth",
      freq: 392,
      start: t,
      dur: 0.13,
      gain: 0.2,
    });
    for (const freq of [523.25, 659.25, 783.99, 1046.5]) {
      tone(ctx, out, {
        type: "sawtooth",
        freq,
        start: t + 0.16,
        dur: 1.25,
        gain: 0.13,
        attack: 0.02,
        decay: true,
      });
      tone(ctx, out, {
        type: "triangle",
        freq: freq * 2,
        start: t + 0.16,
        dur: 0.9,
        gain: 0.05,
        decay: true,
      });
    }
  },

  applause(ctx, dest, t) {
    const total = 2.6;
    for (let i = 0; i < 90; i++) {
      const at = Math.random() * total;
      // Ramai di awal, menipis di akhir.
      const fade = 1 - (at / total) ** 2;
      noiseBurst(ctx, dest, {
        start: t + at,
        dur: 0.035 + Math.random() * 0.03,
        gain: (0.18 + Math.random() * 0.22) * fade + 0.02,
        filter: "bandpass",
        freq: 900 + Math.random() * 1800,
        q: 0.8,
      });
    }
  },

  cricket(ctx, dest, t) {
    for (const group of [0, 0.75, 1.5]) {
      for (let pulse = 0; pulse < 5; pulse++) {
        tone(ctx, dest, {
          type: "sine",
          freq: 4300,
          start: t + group + pulse * 0.06,
          dur: 0.035,
          gain: 0.16,
          attack: 0.004,
        });
      }
    }
  },

  ding(ctx, dest, t) {
    const partials: Array<[number, number, number]> = [
      [1318.5, 0.35, 1.25],
      [2637, 0.12, 0.8],
      [3955, 0.06, 0.5],
    ];
    for (const [freq, gain, dur] of partials) {
      tone(ctx, dest, {
        type: "sine",
        freq,
        start: t,
        dur,
        gain,
        attack: 0.003,
        decay: true,
      });
    }
  },

  buzzer(ctx, dest, t) {
    const out = lowpass(ctx, dest, 1400);
    for (const freq of [116, 119.5]) {
      tone(ctx, out, { type: "square", freq, start: t, dur: 0.8, gain: 0.22 });
    }
  },

  boing(ctx, dest, t) {
    const osc = tone(ctx, dest, {
      type: "triangle",
      freq: 520,
      freqEnd: 110,
      start: t,
      dur: 0.85,
      gain: 0.5,
      attack: 0.005,
      decay: true,
    });
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.setValueAtTime(28, t);
    lfo.frequency.exponentialRampToValueAtTime(9, t + 0.85);
    depth.gain.value = 70;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(t + 0.9);
  },
};

/* ───────────────────────── soundboard ───────────────────────── */

function openBus(e: Engine, lifetimeMs: number): GainNode {
  const bus = e.ctx.createGain();
  bus.connect(e.soundboard);
  activeBuses.add(bus);
  window.setTimeout(() => {
    activeBuses.delete(bus);
    bus.disconnect();
  }, lifetimeMs + 400);
  return bus;
}

function loadCustomBuffer(ctx: AudioContext, sound: RoomSoundView): Promise<AudioBuffer> {
  let pending = customBuffers.get(sound.id);
  if (!pending) {
    pending = fetch(sound.url)
      .then((res) => {
        if (!res.ok) throw new Error("fetch gagal");
        return res.arrayBuffer();
      })
      .then((data) => ctx.decodeAudioData(data));
    // Gagal = jangan cache, supaya percobaan berikutnya bisa mengulang.
    pending.catch(() => customBuffers.delete(sound.id));
    customBuffers.set(sound.id, pending);
  }
  return pending;
}

/**
 * Putar satu suara soundboard secara lokal. `soundId` = `builtin:<id>` atau id
 * RoomSound yang ada di `roomSounds`. Mengembalikan info suara yang diputar,
 * atau null bila id tak dikenal / audio tak tersedia.
 */
export function playSoundboardSound(
  soundId: string,
  roomSounds: readonly RoomSoundView[],
): { name: string; emoji: string; durationMs: number } | null {
  const e = getEngine();
  if (!e) return null;

  const builtin = builtinSoundById(soundId);
  if (builtin) {
    const bus = openBus(e, builtin.durationMs);
    BUILTIN_SYNTHS[builtin.id](e.ctx, bus, e.ctx.currentTime + 0.02);
    return {
      name: builtin.name,
      emoji: builtin.emoji,
      durationMs: builtin.durationMs,
    };
  }

  const custom = roomSounds.find((s) => s.id === soundId);
  if (!custom) return null;
  const durationMs = Math.min(custom.durationMs, ROOM_SOUND_MAX_DURATION_MS);
  const bus = openBus(e, durationMs + 1500);
  void loadCustomBuffer(e.ctx, custom)
    .then((buffer) => {
      if (!activeBuses.has(bus)) return; // sudah dihentikan saat memuat
      const src = e.ctx.createBufferSource();
      src.buffer = buffer;
      src.connect(bus);
      src.start();
      src.stop(e.ctx.currentTime + ROOM_SOUND_MAX_DURATION_MS / 1000);
    })
    .catch(() => undefined);
  return { name: custom.name, emoji: custom.emoji ?? "🔊", durationMs };
}

/** Hentikan semua suara soundboard yang sedang berbunyi (Tuli / bisukan). */
export function stopSoundboard(): void {
  for (const bus of activeBuses) bus.disconnect();
  activeBuses.clear();
}

/** Lupakan buffer suara kustom yang sudah dihapus dari ruangan. */
export function pruneCustomSoundCache(keepIds: readonly string[]): void {
  for (const id of customBuffers.keys()) {
    if (!keepIds.includes(id)) customBuffers.delete(id);
  }
}

/** Durasi berkas audio (ms) — validasi sebelum upload. Melempar bila tak terbaca. */
export async function measureAudioDurationMs(file: File): Promise<number> {
  const e = getEngine();
  if (!e) throw new Error("Audio tidak didukung browser ini.");
  const buffer = await e.ctx.decodeAudioData(await file.arrayBuffer());
  return Math.round(buffer.duration * 1000);
}

/* ───────────────────────── nada isyarat ───────────────────────── */

const CUE_NOTES: Record<VoiceCue, Array<[freq: number, offset: number]>> = {
  join: [
    [523.25, 0],
    [783.99, 0.09],
  ],
  leave: [
    [659.25, 0],
    [440, 0.09],
  ],
  "mic-on": [[587.33, 0]],
  "mic-off": [[392, 0]],
  deafen: [
    [392, 0],
    [293.66, 0.08],
  ],
  undeafen: [
    [293.66, 0],
    [392, 0.08],
  ],
  hand: [
    [880, 0],
    [1174.66, 0.07],
  ],
};

export function playVoiceCue(cue: VoiceCue): void {
  const e = getEngine();
  if (!e) return;
  const t = e.ctx.currentTime + 0.01;
  for (const [freq, offset] of CUE_NOTES[cue]) {
    tone(e.ctx, e.cues, {
      type: "sine",
      freq,
      start: t + offset,
      dur: 0.16,
      gain: 0.22,
      attack: 0.005,
      decay: true,
    });
  }
}
