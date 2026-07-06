/**
 * Deteksi tipe file dari magic bytes — `File.type` dikirim klien dan mudah
 * dipalsukan, jadi tipe yang dipercaya adalah hasil sniff isi file.
 * Cakupan: format yang diizinkan untuk lampiran finance (JPG/PNG/WebP/
 * HEIC/HEIF/PDF). Murni tanpa dependensi agar mudah diuji.
 */

function ascii(bytes: Uint8Array, from: number, to: number): string {
  let s = "";
  for (let i = from; i < to && i < bytes.length; i++) {
    s += String.fromCharCode(bytes[i]);
  }
  return s;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "heim", "heis"]);
const HEIF_BRANDS = new Set(["mif1", "msf1", "heif"]);

export function sniffMimeFromBytes(bytes: Uint8Array): string | null {
  if (bytes.length < 12) return null;

  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "image/jpeg";
  }
  if (PNG_SIGNATURE.every((b, i) => bytes[i] === b)) {
    return "image/png";
  }
  if (ascii(bytes, 0, 4) === "RIFF" && ascii(bytes, 8, 12) === "WEBP") {
    return "image/webp";
  }
  if (ascii(bytes, 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  // ISO-BMFF: kotak "ftyp" di offset 4, brand di offset 8.
  if (ascii(bytes, 4, 8) === "ftyp") {
    const brand = ascii(bytes, 8, 12).toLowerCase();
    if (HEIC_BRANDS.has(brand)) return "image/heic";
    if (HEIF_BRANDS.has(brand)) return "image/heif";
  }
  return null;
}
