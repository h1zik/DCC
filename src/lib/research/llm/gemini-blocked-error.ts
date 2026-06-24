/** Gemini menolak/membedahkan respons karena filter keamanan (gambar/teks sensitif). */
export class GeminiResponseBlockedError extends Error {
  readonly blockReason: string;

  constructor(blockReason: string) {
    super(`Gemini response blocked: ${blockReason}`);
    this.name = "GeminiResponseBlockedError";
    this.blockReason = blockReason;
  }
}

export function isGeminiResponseBlockedError(
  err: unknown,
): err is GeminiResponseBlockedError {
  if (err instanceof GeminiResponseBlockedError) return true;
  if (!(err instanceof Error)) return false;
  const msg = err.message.toLowerCase();
  return (
    msg.includes("response was blocked") ||
    msg.includes("text not available") ||
    msg.includes("blocked due to")
  );
}
