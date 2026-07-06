import { describe, expect, it } from "vitest";
import { sniffMimeFromBytes } from "./file-signature";

function bytes(...vals: (number | string)[]): Uint8Array {
  const out: number[] = [];
  for (const v of vals) {
    if (typeof v === "number") out.push(v);
    else for (const ch of v) out.push(ch.charCodeAt(0));
  }
  while (out.length < 16) out.push(0);
  return Uint8Array.from(out);
}

describe("sniffMimeFromBytes (M-18)", () => {
  it("mendeteksi format yang diizinkan dari magic bytes", () => {
    expect(sniffMimeFromBytes(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(
      sniffMimeFromBytes(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)),
    ).toBe("image/png");
    expect(sniffMimeFromBytes(bytes("RIFF", 0, 0, 0, 0, "WEBP"))).toBe("image/webp");
    expect(sniffMimeFromBytes(bytes("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMimeFromBytes(bytes(0, 0, 0, 0x18, "ftypheic"))).toBe("image/heic");
    expect(sniffMimeFromBytes(bytes(0, 0, 0, 0x18, "ftypmif1"))).toBe("image/heif");
  });

  it("menolak konten yang tidak dikenali — label MIME palsu dari klien tidak berpengaruh", () => {
    // File HTML/JS berlabel image/png tetap tertolak karena isinya bukan PNG.
    expect(sniffMimeFromBytes(bytes("<html><script>"))).toBeNull();
    expect(sniffMimeFromBytes(bytes("MZ\x90\x00"))).toBeNull(); // executable
    expect(sniffMimeFromBytes(Uint8Array.from([1, 2, 3]))).toBeNull(); // terlalu pendek
  });
});
