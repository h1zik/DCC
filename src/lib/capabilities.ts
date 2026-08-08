import type { UserRole } from "@/lib/user-role";
import {
  canAccessLab,
  canAccessLabBrandHub,
  canAccessLabContentStudio,
  canAccessLabResearchHub,
  canAccessLabSeo,
} from "@/lib/roles";

/**
 * Katalog kapabilitas — akses per-fitur yang bisa diberikan lepas dari tier
 * peran (`UserRole`).
 *
 * Kenapa ada: tier peran menentukan *seluruh* profil akses seseorang sekaligus,
 * jadi memberi satu orang satu modul berarti mengubah perannya — ikut menyeret
 * default home, sidebar, hak assign PIC, dan seterusnya. Kapabilitas memisahkan
 * "apa yang boleh dibuka" dari "peran apa dia".
 *
 * Kunci sengaja bernamespace dengan titik supaya bisa didalamkan tanpa migrasi
 * DB (mis. nanti `lab.seo.rank_tracker`). Nilainya disimpan sebagai string di
 * `CustomRole.capabilities` dan `UserCapability.capability`, bukan enum Prisma,
 * justru agar penambahan kunci baru cukup di kode.
 *
 * File ini murni (tanpa Prisma / `server-only`) supaya bisa dipakai juga oleh
 * komponen klien di UI admin.
 */
export const LAB_MODULE_CAPABILITIES = [
  "lab.brand_hub",
  "lab.research_hub",
  "lab.seo",
  "lab.content_studio",
] as const;

export type LabModuleCapability = (typeof LAB_MODULE_CAPABILITIES)[number];

/** Kunci shell Lab — memberi akses beranda launcher tanpa modul apa pun. */
export const LAB_SHELL_CAPABILITY = "lab";

export const CAPABILITIES = [
  LAB_SHELL_CAPABILITY,
  ...LAB_MODULE_CAPABILITIES,
] as const;

export type Capability = (typeof CAPABILITIES)[number];

export function isCapability(value: string): value is Capability {
  return (CAPABILITIES as readonly string[]).includes(value);
}

type CapabilityMeta = {
  label: string;
  description: string;
  /** Rute utama modul — dipakai UI admin & penentuan halaman tujuan login. */
  href: string;
};

export const CAPABILITY_META: Record<Capability, CapabilityMeta> = {
  lab: {
    label: "Beranda Lab",
    description:
      "Masuk ke shell Dominatus Lab. Otomatis terbuka bila punya minimal satu modul.",
    href: "/dominatus-lab",
  },
  "lab.brand_hub": {
    label: "Brand & Creative Hub",
    description:
      "Strategi brand, audience research, creative guideline, visual library, ad library, audit influencer.",
    href: "/brand-hub",
  },
  "lab.research_hub": {
    label: "Research Hub",
    description:
      "Product discovery, competitor tracker, review intelligence, keyword intel, trend radar, laporan riset.",
    href: "/research-hub",
  },
  "lab.seo": {
    label: "SEO Toolkit",
    description:
      "Keyword research, domain overview, rank tracker, on-page audit, crawler, content optimizer, laporan SEO.",
    href: "/seo",
  },
  "lab.content_studio": {
    label: "Content Studio",
    description: "Idea generation & content planning level ruang kerja.",
    href: "/content-studio",
  },
};

export function capabilityLabel(capability: string): string {
  return isCapability(capability)
    ? CAPABILITY_META[capability].label
    : capability;
}

/**
 * Matriks akses Lab historis — apa yang didapat sebuah tier peran sebelum
 * kapabilitas ada.
 *
 * Dipakai dua tempat: (1) mengisi `CustomRole.capabilities` saat seed/backfill
 * dan saat peran kustom baru dibuat, (2) sebagai cadangan untuk user yang belum
 * punya `customRoleId` sama sekali. Setelah sebuah peran punya kapabilitas
 * eksplisit, peran itulah yang menentukan — bukan fungsi ini — supaya mencentang
 * dan *mencabut* centang di UI admin sama-sama berpengaruh.
 */
export function baselineCapabilitiesForRole(
  role: UserRole | undefined,
): Capability[] {
  const caps: Capability[] = [];
  if (canAccessLab(role)) caps.push(LAB_SHELL_CAPABILITY);
  if (canAccessLabBrandHub(role)) caps.push("lab.brand_hub");
  if (canAccessLabResearchHub(role)) caps.push("lab.research_hub");
  if (canAccessLabSeo(role)) caps.push("lab.seo");
  if (canAccessLabContentStudio(role)) caps.push("lab.content_studio");
  return caps;
}

export type CapabilityInputs = {
  role: UserRole | undefined;
  /** Peran kustom user, bila ada. `capabilities`-nya jadi basis. */
  customRole: { capabilities: string[] } | null;
  /** Pengecualian per-user (ALLOW/DENY). */
  capabilities: {
    capability: string;
    effect: "ALLOW" | "DENY";
    expiresAt: Date | null;
  }[];
};

/**
 * Hitung himpunan kapabilitas efektif seorang user.
 *
 * Basisnya kapabilitas peran — bukan gabungan peran DAN matriks tier. Kalau
 * matriks tier ikut diunion, mencabut centang di UI admin tidak akan pernah
 * berpengaruh untuk peran yang tier-nya memang punya modul itu. Matriks tier
 * hanya dipakai sebagai cadangan untuk user yang belum punya peran kustom.
 *
 * DENY tidak perlu diurutkan setelah ALLOW: `@@unique([userId, capability])`
 * menjamin satu kapabilitas hanya punya satu baris per user.
 */
export function resolveCapabilities(
  inputs: CapabilityInputs,
  now: Date = new Date(),
): Set<string> {
  const base = inputs.customRole
    ? inputs.customRole.capabilities
    : baselineCapabilitiesForRole(inputs.role);
  const effective = new Set<string>(base);

  for (const grant of inputs.capabilities) {
    // Baris kedaluwarsa tidak dihapus dari DB — jejak auditnya tetap berguna.
    if (grant.expiresAt && grant.expiresAt.getTime() <= now.getTime()) continue;
    if (grant.effect === "DENY") effective.delete(grant.capability);
    else effective.add(grant.capability);
  }
  return effective;
}

/** Akses per modul — bentuk yang dikonsumsi sidebar, header, dan launcher. */
export type LabModuleAccess = {
  brandHub: boolean;
  researchHub: boolean;
  seo: boolean;
  contentStudio: boolean;
};

/** Akses modul + izin masuk shell Lab-nya. */
export type LabAccess = LabModuleAccess & { shell: boolean };

export const NO_LAB_ACCESS: LabAccess = {
  shell: false,
  brandHub: false,
  researchHub: false,
  seo: false,
  contentStudio: false,
};

/**
 * Terjemahkan himpunan kapabilitas jadi flag akses Lab.
 *
 * Punya satu modul otomatis membuka shell-nya — tanpa ini, admin yang memberi
 * "SEO Toolkit" saja akan menghasilkan orang yang punya modul tapi tidak bisa
 * masuk pintunya.
 */
export function toLabAccess(capabilities: Iterable<string>): LabAccess {
  const set = capabilities instanceof Set ? capabilities : new Set(capabilities);
  const modules = {
    brandHub: set.has("lab.brand_hub"),
    researchHub: set.has("lab.research_hub"),
    seo: set.has("lab.seo"),
    contentStudio: set.has("lab.content_studio"),
  };
  return {
    shell:
      set.has(LAB_SHELL_CAPABILITY) || Object.values(modules).some(Boolean),
    ...modules,
  };
}

/** Kapabilitas yang mengunci sebuah modul, untuk pesan error/tooltip. */
export const LAB_MODULE_BY_ACCESS_KEY: Record<
  keyof LabModuleAccess,
  LabModuleCapability
> = {
  brandHub: "lab.brand_hub",
  researchHub: "lab.research_hub",
  seo: "lab.seo",
  contentStudio: "lab.content_studio",
};
