/**
 * Daftar bank & e-wallet untuk data pembayaran KOL. Statis (bukan tabel):
 * daftar ini jarang berubah dan tidak perlu dikelola user. Profil KOL
 * menyimpan `bankCode` plus salinan `bankName`, jadi menghapus entri di sini
 * tidak merusak data lama.
 *
 * `code` = kode bank BI (3 digit) untuk bank; e-wallet memakai prefiks `EW-`.
 */
export type KolBank = { code: string; name: string; kind: "bank" | "ewallet" };

export const KOL_BANKS: KolBank[] = [
  { code: "014", name: "BCA", kind: "bank" },
  { code: "008", name: "Bank Mandiri", kind: "bank" },
  { code: "002", name: "BRI", kind: "bank" },
  { code: "009", name: "BNI", kind: "bank" },
  { code: "451", name: "Bank Syariah Indonesia (BSI)", kind: "bank" },
  { code: "022", name: "CIMB Niaga", kind: "bank" },
  { code: "011", name: "Bank Danamon", kind: "bank" },
  { code: "013", name: "Bank Permata", kind: "bank" },
  { code: "200", name: "Bank BTN", kind: "bank" },
  { code: "016", name: "Maybank Indonesia", kind: "bank" },
  { code: "019", name: "Panin Bank", kind: "bank" },
  { code: "028", name: "OCBC Indonesia", kind: "bank" },
  { code: "023", name: "UOB Indonesia", kind: "bank" },
  { code: "426", name: "Bank Mega", kind: "bank" },
  { code: "153", name: "Bank Sinarmas", kind: "bank" },
  { code: "441", name: "KB Bank", kind: "bank" },
  { code: "147", name: "Bank Muamalat", kind: "bank" },
  { code: "213", name: "Bank SMBC Indonesia (Jenius)", kind: "bank" },
  { code: "542", name: "Bank Jago", kind: "bank" },
  { code: "535", name: "SeaBank", kind: "bank" },
  { code: "501", name: "blu by BCA Digital", kind: "bank" },
  { code: "567", name: "Allo Bank", kind: "bank" },
  { code: "490", name: "Bank Neo Commerce", kind: "bank" },
  { code: "484", name: "Bank KEB Hana (LINE Bank)", kind: "bank" },
  { code: "947", name: "Bank Aladin Syariah", kind: "bank" },
  { code: "111", name: "Bank DKI", kind: "bank" },
  { code: "110", name: "Bank BJB", kind: "bank" },
  { code: "113", name: "Bank Jateng", kind: "bank" },
  { code: "114", name: "Bank Jatim", kind: "bank" },
  { code: "129", name: "Bank BPD Bali", kind: "bank" },
  { code: "031", name: "Citibank", kind: "bank" },
  { code: "087", name: "HSBC Indonesia", kind: "bank" },
  { code: "EW-GOPAY", name: "GoPay", kind: "ewallet" },
  { code: "EW-OVO", name: "OVO", kind: "ewallet" },
  { code: "EW-DANA", name: "DANA", kind: "ewallet" },
  { code: "EW-SHOPEEPAY", name: "ShopeePay", kind: "ewallet" },
  { code: "EW-LINKAJA", name: "LinkAja", kind: "ewallet" },
];

export function findKolBank(code: string | null | undefined): KolBank | null {
  if (!code) return null;
  return KOL_BANKS.find((b) => b.code === code) ?? null;
}

/** "1234567890" → "••••7890". Untuk user tanpa hak approver. */
export function maskAccountNumber(value: string | null | undefined): string | null {
  if (!value) return null;
  const tail = value.replace(/\s+/g, "").slice(-4);
  return `••••${tail}`;
}

/** "081234567890" → "0812••••890". */
export function maskPhone(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value.replace(/\s+/g, "");
  if (v.length <= 7) return "••••";
  return `${v.slice(0, 4)}••••${v.slice(-3)}`;
}
