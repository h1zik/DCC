import { RoomViewType } from "@prisma/client";

export type RoomViewTypeMeta = {
  type: RoomViewType;
  label: string;
  description: string;
  /** Default judul saat manager membuat view tipe ini. */
  defaultTitle: string;
  /** Slug ikon Lucide React (dinormalisasi di komponen). */
  iconKey: string;
};

export const ROOM_VIEW_TYPE_META: Record<RoomViewType, RoomViewTypeMeta> = {
  [RoomViewType.CALENDAR]: {
    type: RoomViewType.CALENDAR,
    label: "Kalender",
    description:
      "Acara internal ruangan (shoot, sampling, kirim ke maklon) yang terpisah dari kalender pribadi.",
    defaultTitle: "Kalender",
    iconKey: "calendar-days",
  },
  [RoomViewType.TIMELINE]: {
    type: RoomViewType.TIMELINE,
    label: "Linimasa",
    description:
      "Milestone bertanggal — H-QC, H-launch, tahap pengiriman — agar timeline mudah dibaca.",
    defaultTitle: "Linimasa",
    iconKey: "milestone",
  },
  [RoomViewType.WIKI]: {
    type: RoomViewType.WIKI,
    label: "Wiki / Keputusan",
    description:
      "Catatan rapat, keputusan, dan source of truth singkat yang tidak cocok ditaruh di Documents.",
    defaultTitle: "Wiki & Keputusan",
    iconKey: "book-open",
  },
  [RoomViewType.LINKS]: {
    type: RoomViewType.LINKS,
    label: "Hub Tautan",
    description:
      "Kumpulan tautan penting (Shopify, Figma, brief, sheet budget) agar tidak hilang di chat.",
    defaultTitle: "Hub Tautan",
    iconKey: "link",
  },
  [RoomViewType.LIST]: {
    type: RoomViewType.LIST,
    label: "List Generik",
    description:
      "Tabel sederhana dengan kolom yang dapat Anda atur sendiri untuk berbagai keperluan.",
    defaultTitle: "List",
    iconKey: "table",
  },
  [RoomViewType.GLOSSARY]: {
    type: RoomViewType.GLOSSARY,
    label: "Glosarium / Guideline",
    description:
      "Istilah brand, tone, pantangan klaim — referensi cepat untuk tim konten & legal.",
    defaultTitle: "Glosarium",
    iconKey: "book-marked",
  },
};

export const ROOM_VIEW_TYPE_ORDER: RoomViewType[] = [
  RoomViewType.CALENDAR,
  RoomViewType.TIMELINE,
  RoomViewType.WIKI,
  RoomViewType.LINKS,
  RoomViewType.LIST,
  RoomViewType.GLOSSARY,
];
