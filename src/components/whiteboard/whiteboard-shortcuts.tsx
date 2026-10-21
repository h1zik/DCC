"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Daftar pintasan papan tik, dibuka lewat tombol keyboard di pojok kanan
 * bawah atau tombol `?`. Dikelompokkan menurut apa yang sedang dikerjakan
 * pengguna, bukan menurut tombolnya.
 */

type Shortcut = { keys: string[]; label: string };

const SECTIONS: Array<{ title: string; items: Shortcut[] }> = [
  {
    title: "Alat",
    items: [
      { keys: ["V"], label: "Pilih" },
      { keys: ["H"], label: "Geser kanvas (atau tahan Spasi)" },
      { keys: ["N"], label: "Sticky note" },
      { keys: ["T"], label: "Teks" },
      { keys: ["R"], label: "Persegi" },
      { keys: ["O"], label: "Elips" },
      { keys: ["A"], label: "Panah" },
      { keys: ["C"], label: "Konektor" },
      { keys: ["P"], label: "Pena" },
      { keys: ["S"], label: "Stabilo" },
      { keys: ["E"], label: "Penghapus" },
      { keys: ["F"], label: "Frame" },
      { keys: ["K"], label: "Laser pointer" },
      { keys: ["Q"], label: "Tetap di alat setelah membuat objek" },
    ],
  },
  {
    title: "Menulis",
    items: [
      { keys: ["Klik ganda"], label: "Sticky baru di area kosong, atau edit teks objek" },
      { keys: ["Enter"], label: "Edit teks objek terpilih" },
      { keys: ["Tab"], label: "Simpan sticky dan buat sticky berikutnya" },
      { keys: ["Ctrl", "Enter"], label: "Selesai mengedit" },
      { keys: ["Esc"], label: "Selesai mengedit" },
    ],
  },
  {
    title: "Mengatur objek",
    items: [
      { keys: ["Ctrl", "C"], label: "Salin (bisa ditempel ke papan lain)" },
      { keys: ["Ctrl", "X"], label: "Potong" },
      { keys: ["Ctrl", "V"], label: "Tempel objek, gambar, atau teks" },
      { keys: ["Ctrl", "D"], label: "Duplikat" },
      { keys: ["Del"], label: "Hapus" },
      { keys: ["Ctrl", "A"], label: "Pilih semua" },
      { keys: ["Ctrl", "]"], label: "Maju satu lapis" },
      { keys: ["Ctrl", "["], label: "Mundur satu lapis" },
      { keys: ["Panah"], label: "Geser 1 px (Shift: 10 px)" },
      { keys: ["Shift", "seret"], label: "Kunci ke sumbu / jaga proporsi" },
      { keys: ["Alt", "seret"], label: "Matikan snap / ubah ukuran dari tengah" },
      { keys: ["Esc"], label: "Batalkan gerakan atau lepas pilihan" },
    ],
  },
  {
    title: "Tampilan",
    items: [
      { keys: ["Ctrl", "Z"], label: "Urungkan" },
      { keys: ["Ctrl", "Shift", "Z"], label: "Ulangi" },
      { keys: ["Ctrl", "scroll"], label: "Zoom (atau cubit di trackpad/layar)" },
      { keys: ["Ctrl", "0"], label: "Zoom 100%" },
      { keys: ["1"], label: "Muat seluruh papan" },
      { keys: ["2"], label: "Perbesar ke pilihan" },
    ],
  },
];

export function WhiteboardShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Pintasan papan tik</DialogTitle>
          <DialogDescription>
            Di Mac, pakai Cmd sebagai pengganti Ctrl.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-x-8 gap-y-6 sm:grid-cols-2">
          {SECTIONS.map((section) => (
            <section key={section.title}>
              <h3 className="text-foreground mb-2 text-sm font-semibold">
                {section.title}
              </h3>
              <dl className="space-y-1.5">
                {section.items.map((item) => (
                  <div
                    key={`${section.title}-${item.label}-${item.keys.join("+")}`}
                    className="flex items-start justify-between gap-3 text-sm"
                  >
                    <dt className="text-muted-foreground">{item.label}</dt>
                    <dd className="flex shrink-0 gap-1">
                      {item.keys.map((key) => (
                        <kbd
                          key={key}
                          className="border-border bg-muted text-foreground inline-flex h-5 min-w-5 items-center justify-center rounded border px-1 font-sans text-[11px] font-semibold"
                        >
                          {key}
                        </kbd>
                      ))}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
