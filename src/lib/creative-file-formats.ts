/**
 * Format berkas kreatif/desain (source file) yang perlu didukung untuk unggah.
 *
 * Latar: browser/OS sering melaporkan MIME yang tidak konsisten untuk file
 * desain — kadang `application/octet-stream`, kadang kosong, kadang MIME
 * spesifik yang tidak baku (mis. `.ai` → `application/postscript`, `.psd` →
 * `image/vnd.adobe.photoshop`). Karena itu allowlist berbasis **ekstensi**
 * jauh lebih andal daripada MIME untuk kategori ini. Modul ini menjadi sumber
 * kebenaran tunggal yang dipakai seluruh validator unggah + atribut `accept`.
 *
 * Cakupan: Adobe (Illustrator/Photoshop/InDesign/XD/Premiere Pro/After
 * Effects), penyunting video (Final Cut/DaVinci/Vegas), audio (Audacity/FL
 * Studio/Ableton/Pro Tools/Logic), 3D (Blender/Cinema 4D/Maya/3ds Max/ZBrush/
 * Substance), serta alat desain lain (Figma/Sketch/Affinity/CorelDRAW/
 * Procreate/Clip Studio/Krita/GIMP/CAD).
 */

/** Ekstensi (tanpa titik, lowercase) berkas kreatif yang diizinkan. */
export const CREATIVE_FILE_EXTENSIONS: readonly string[] = [
  // Adobe Illustrator / vektor & cetak
  "ai", "eps", "ps", "svg",
  // Adobe Photoshop
  "psd", "psb",
  // Adobe InDesign
  "indd", "indt", "idml",
  // Adobe XD
  "xd",
  // Adobe Premiere Pro
  "prproj", "prel", "prtl",
  // Adobe After Effects
  "aep", "aepx", "aet",
  // Adobe lain
  "aca", "abr", "ase", "acv",
  // Penyunting video lain
  "veg", "vf", // Vegas
  "fcpxml", "fcpbundle", // Final Cut Pro
  "drp", "drfx", // DaVinci Resolve
  "kdenlive", "mlt", // Kdenlive
  "camproj", "trec", // Camtasia
  // Audio / DAW
  "aup", "aup3", // Audacity
  "flp", // FL Studio
  "als", "alp", // Ableton Live
  "logicx", // Logic Pro
  "ptx", "ptf", // Pro Tools
  "band", // GarageBand
  "rpp", // Reaper
  "sesx", // Adobe Audition
  // 3D / motion
  "blend", "blend1", // Blender
  "c4d", // Cinema 4D
  "ma", "mb", // Maya
  "max", // 3ds Max
  "fbx", "obj", "dae", "stl", "3ds", "glb", "gltf", "abc", "usd", "usdz",
  "ztl", "zpr", "zbr", // ZBrush
  "spp", "sbs", "sbsar", // Substance
  "hip", "hipnc", // Houdini
  // Alat desain lain
  "fig", // Figma (ekspor lokal)
  "sketch", // Sketch
  "afdesign", "afphoto", "afpub", // Affinity
  "cdr", "cpt", // CorelDRAW
  "procreate", // Procreate
  "clip", // Clip Studio Paint
  "kra", // Krita
  "xcf", // GIMP
  // CAD
  "dwg", "dxf",
];

const CREATIVE_EXTENSION_SET = new Set(CREATIVE_FILE_EXTENSIONS);

/**
 * MIME spesifik non-baku yang kadang dilaporkan browser untuk file desain.
 * Dipakai sebagai jaring pengaman tambahan bila nama file tidak tersedia.
 */
export const CREATIVE_FILE_MIME_TYPES: readonly string[] = [
  "application/postscript", // .ai / .eps / .ps
  "application/illustrator",
  "image/vnd.adobe.photoshop",
  "application/x-photoshop",
  "image/x-photoshop",
  "application/photoshop",
  "application/x-indesign",
  "application/x-blender",
  "model/gltf-binary",
  "model/gltf+json",
  "model/obj",
  "model/stl",
  "application/x-cinema4d",
  "image/x-coreldraw",
  "application/x-coreldraw",
];

const CREATIVE_MIME_SET = new Set(CREATIVE_FILE_MIME_TYPES);

/** Ambil ekstensi lowercase tanpa titik dari nama file (mis. "foo.PSD" → "psd"). */
export function fileExtension(fileName: string | null | undefined): string {
  if (!fileName) return "";
  const dot = fileName.lastIndexOf(".");
  if (dot < 0 || dot === fileName.length - 1) return "";
  return fileName.slice(dot + 1).toLowerCase();
}

/**
 * True bila file merupakan berkas kreatif/desain yang diizinkan — dinilai dari
 * ekstensi (utama, paling andal) atau MIME spesifik (cadangan).
 */
export function isCreativeFile(
  mime: string | null | undefined,
  fileName: string | null | undefined,
): boolean {
  const ext = fileExtension(fileName);
  if (ext && CREATIVE_EXTENSION_SET.has(ext)) return true;
  const m = (mime || "").toLowerCase();
  return m !== "" && CREATIVE_MIME_SET.has(m);
}

/**
 * Potongan atribut `accept` (`.ai,.psd,...`) untuk dilampirkan ke `<input
 * type="file">` sehingga file desain bisa dipilih di file picker.
 */
export const CREATIVE_ACCEPT_EXTENSIONS: string = CREATIVE_FILE_EXTENSIONS.map(
  (ext) => `.${ext}`,
).join(",");
