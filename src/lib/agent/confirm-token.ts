import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Guard server-side untuk aksi destruktif agent (hapus tugas).
 *
 * `confirmed: true` dari model TIDAK dipercaya begitu saja:
 * 1. Eksekusi wajib membawa `confirmToken` dari hasil preview, dan token
 *    diikat ke scope hapus (user + room + set task) — jika set task berubah
 *    di antara preview dan eksekusi, token tidak cocok dan preview diulang.
 * 2. Pesan user TERAKHIR harus berupa konfirmasi eksplisit pendek ("ya",
 *    "hapus saja", …) — permintaan awal seperti "hapus task A di room B"
 *    sengaja tidak lolos supaya model tidak bisa preview + eksekusi
 *    dalam satu giliran tanpa jawaban user.
 */

function confirmSecret(): string {
  return (
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "dcc-agent-confirm-fallback"
  );
}

export function buildDeleteConfirmToken(
  userId: string,
  roomId: string,
  taskIds: string[],
): string {
  const scope = `${userId}|${roomId}|${[...taskIds].sort().join(",")}`;
  return createHmac("sha256", confirmSecret())
    .update(scope)
    .digest("hex")
    .slice(0, 16);
}

export function deleteConfirmTokenMatches(
  provided: string | null | undefined,
  userId: string,
  roomId: string,
  taskIds: string[],
): boolean {
  const raw = provided?.trim();
  if (!raw) return false;
  const expected = buildDeleteConfirmToken(userId, roomId, taskIds);
  const a = Buffer.from(raw, "utf8");
  const b = Buffer.from(expected, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Ucapan konfirmasi eksplisit yang berdiri sendiri — bukan permintaan hapus
 * awal. Sengaja ketat: kalimat panjang ("hapus semua task todo di room X")
 * tidak lolos; jawaban pendek ("ya", "gas", "hapus saja") lolos.
 */
const CONFIRM_UTTERANCE =
  /^(ya+|iya+|y|yes|yup|ok(e|ay)?|sip|gas(keun)?|lanjut(kan)?|setuju|yakin|betul|benar|konfirmasi|confirm(ed)?|do it|delete it|sikat|hapus (saja|aja)|ya,? hapus( saja| aja)?|iya,? hapus( saja| aja)?)[.!\s]*$/i;

export function isExplicitDeleteConfirmation(
  latestUserMessage: string | null | undefined,
): boolean {
  const msg = latestUserMessage?.trim() ?? "";
  if (!msg || msg.length > 60) return false;
  return CONFIRM_UTTERANCE.test(msg);
}
