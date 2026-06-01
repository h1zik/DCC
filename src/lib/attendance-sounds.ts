"use client";

/**
 * Efek suara ringan untuk modul absensi — dibangkitkan via Web Audio API
 * (tanpa file audio). Semua fungsi gagal-diam bila audio tidak tersedia.
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioCtx) {
    audioCtx = new AudioContext();
  }
  // Resume jika suspended (browser butuh interaksi user lebih dulu)
  if (audioCtx.state === "suspended") {
    void audioCtx.resume();
  }
  return audioCtx;
}

function playTone(
  frequency: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.3,
) {
  try {
    const ctx = getAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + duration);
  } catch {
    // audio tidak tersedia — abaikan
  }
}

/** Bip pendek saat wajah terdeteksi. */
export function playDetectedSound() {
  playTone(880, 0.15, "sine", 0.2);
}

/** Chime tiga nada untuk absensi berhasil. */
export function playSuccessSound() {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    const notes = [
      { freq: 523.25, start: 0, stop: 0.2 }, // C5
      { freq: 659.25, start: 0.15, stop: 0.45 }, // E5
      { freq: 783.99, start: 0.3, stop: 0.6 }, // G5
    ];

    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(note.freq, now + note.start);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.setValueAtTime(0.3, now + note.start);
      gain.gain.exponentialRampToValueAtTime(0.01, now + note.stop);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + note.start);
      osc.stop(now + note.stop);
    }
  } catch {
    // abaikan
  }
}

/** Nada rendah untuk error. */
export function playErrorSound() {
  playTone(220, 0.3, "square", 0.15);
}

/** Hangatkan AudioContext pada interaksi user pertama. */
export function warmupAudio() {
  try {
    getAudioContext();
  } catch {
    // abaikan
  }
}
