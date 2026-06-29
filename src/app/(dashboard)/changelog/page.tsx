import type { Metadata } from "next";
import { ChangelogClient } from "./changelog-client";

export const metadata: Metadata = {
  title: "Apa yang Baru",
  description: "Riwayat fitur & perbaikan terbaru di Dominatus Control Center.",
};

export default function ChangelogPage() {
  return <ChangelogClient />;
}
