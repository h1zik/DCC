# REDESIGN HOMEPAGE DCC — ANIMASI + VISUAL + PEMBERSIHAN UI

## Konteks
Repo ini DCC (Dominatus Control Center): Next.js 16 App Router, React 19, Tailwind CSS 4,
komponen shadcn-style + Base UI, ikon lucide-react, dark mode via next-themes.
Target redesign: halaman **Home** (src/app/(dashboard)/ — halaman landing setelah login,
termasuk state per-role: CEO, Finance, Studio, dst.).

## Tujuan
1. Visual naik kelas: modern, bersih, terasa premium — bukan sekadar kartu-kartu kotak.
2. Animasi halus yang fungsional (bukan pamer): entrance stagger untuk kartu/section,
   transisi hover yang responsif, angka KPI yang count-up, skeleton loading yang mulus.
3. UI bersih: hilangkan tombol/aksi redundan.

## Cara kerja — WAJIB dua fase

### FASE 1 — Audit & proposal (jangan ubah kode dulu)
1. Inventarisasi semua elemen interaktif di Home: tombol, link, dropdown, kartu klik.
   Buat tabel: elemen → tujuan → duplikat/tumpang tindih dengan apa → rekomendasi
   (pertahankan / gabung / hapus).
   Definisi redundan: dua elemen menuju tujuan sama, aksi yang sudah ada di nav
   global, atau aksi yang tidak pernah relevan untuk role tersebut.
2. Usulkan arah visual: hierarki layout baru, spacing, tipografi, penggunaan warna
   (tetap pakai design token/tema yang ada — jangan buat palet baru).
3. Usulkan daftar animasi per elemen + durasinya.
4. STOP — tunggu approval sebelum implementasi.

### FASE 2 — Implementasi (setelah approve)
- Kerjakan bertahap per section (hero/KPI → cards → list), commit kecil-kecil.

## Batasan teknis
- **Server Components tetap server**: animasi hanya di client component terpisah
  ("use client") sekecil mungkin — jangan mengubah halaman utama jadi client component.
- **Jangan sentuh data fetching & logic** — ini redesign presentasi, bukan refactor
  data. Props dan struktur data masuk komponen tidak boleh berubah.
- **Role-based rendering tidak boleh rusak**: setiap role melihat konten yang sama
  seperti sebelumnya (minus elemen yang disepakati dihapus di Fase 1).
- Animasi: pakai CSS/Tailwind transitions dulu; framer-motion boleh HANYA jika
  benar-benar perlu (stagger kompleks) — jangan tambah library animasi lain.
- **Hormati `prefers-reduced-motion`** — semua animasi harus punya fallback diam.
- Dark mode harus tetap sempurna di kedua tema.
- Durasi animasi 150–400ms, easing standar (ease-out untuk entrance). Tidak ada
  animasi yang menghalangi interaksi atau menyebabkan layout shift (CLS = 0).
- Responsive: uji mental di 360px, 768px, 1280px.
- Aksesibilitas: fokus ring tetap ada, kontras teks minimal AA, tombol ikon punya
  aria-label.

## Definisi selesai
- `npm run lint && npm run build` lolos.
- Tidak ada perubahan pada API call / server actions.
- Screenshot/deskripsi before-after per section.
- Ringkasan elemen yang dihapus + alasannya (untuk changelog internal DCC).