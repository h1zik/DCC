import Link from "next/link";
import { Button } from "@/components/ui/button";

/** Dipakai saat `notFound()` dipanggil di halaman detail Research Hub. */
export default function ResearchHubNotFound() {
  return (
    <div className="flex max-w-xl flex-col gap-4 py-10">
      <h1 className="rh-title-detail">Data riset ini tidak ditemukan</h1>
      <p className="rh-lede">
        Mungkin sudah dihapus, atau link-nya salah. Buka modulnya dari
        navigasi di samping untuk melihat daftar yang masih ada.
      </p>
      <div>
        <Button variant="outline" render={<Link href="/research-hub" />}>
          Ke overview Research Hub
        </Button>
      </div>
    </div>
  );
}
