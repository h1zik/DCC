/** Nilai awal & tipe form KOL — modul murni (bukan "use client") supaya
 * bisa dipakai server component. */
import type { KolPlatformValue } from "@/lib/kol/labels";

export type KolFormAccount = {
  id?: string;
  platform: KolPlatformValue;
  handle: string;
  rateCard: string;
};

export type KolFormValues = {
  fullName: string;
  email: string;
  phone: string;
  birthDate: string;
  notes: string;
  addressLine: string;
  district: string;
  city: string;
  province: string;
  postalCode: string;
  bankCode: string;
  bankBranch: string;
  accountHolder: string;
  accountNumber: string;
  categoryIds: string[];
  socialAccounts: KolFormAccount[];
};

export const EMPTY_KOL_FORM: KolFormValues = {
  fullName: "",
  email: "",
  phone: "",
  birthDate: "",
  notes: "",
  addressLine: "",
  district: "",
  city: "",
  province: "",
  postalCode: "",
  bankCode: "",
  bankBranch: "",
  accountHolder: "",
  accountNumber: "",
  categoryIds: [],
  socialAccounts: [{ platform: "INSTAGRAM", handle: "", rateCard: "" }],
};
