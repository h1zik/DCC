import { z } from "zod";
import { nonNegativeMoneyString, positiveMoneyString } from "@/lib/finance-money";

const optionalText = (max: number) =>
  z
    .string()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v?.trim() ? v.trim() : null));

const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Format tanggal harus YYYY-MM-DD.");

const optionalIsoDate = z
  .union([isoDate, z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

const optionalMoney = z
  .union([nonNegativeMoneyString, z.literal("")])
  .optional()
  .nullable()
  .transform((v) => (v ? v : null));

export const platformSchema = z.enum(["INSTAGRAM", "TIKTOK"]);

export const socialAccountInputSchema = z.object({
  /** Terisi bila mengedit akun yang sudah ada. */
  id: z.string().optional().nullable(),
  platform: platformSchema,
  /** Username atau link profil. */
  handle: z.string().trim().min(1, "Username wajib diisi.").max(200),
  rateCard: optionalMoney,
});

export const kolProfileInputSchema = z.object({
  fullName: z.string().trim().min(2, "Nama lengkap minimal 2 huruf.").max(120),
  email: z
    .union([z.string().trim().email("Email tidak valid."), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v.toLowerCase() : null)),
  phone: optionalText(30),
  birthDate: optionalIsoDate,
  notes: optionalText(2000),
  addressLine: optionalText(300),
  district: optionalText(120),
  city: optionalText(120),
  province: optionalText(120),
  postalCode: optionalText(10),
  bankCode: optionalText(20),
  bankBranch: optionalText(120),
  accountHolder: optionalText(120),
  accountNumber: optionalText(40),
  categoryIds: z.array(z.string().min(1)).max(10).default([]),
  socialAccounts: z
    .array(socialAccountInputSchema)
    .min(1, "Tambahkan minimal satu akun Instagram atau TikTok.")
    .max(8),
});

export type KolProfileInput = z.input<typeof kolProfileInputSchema>;
export type KolProfileData = z.output<typeof kolProfileInputSchema>;

export const placementSchema = z.enum([
  "FEED",
  "REELS",
  "STORY",
  "CAROUSEL",
  "VIDEO",
  "LIVE",
]);

export const objectiveSchema = z.enum(["AWARENESS", "CONSIDERATION", "CONVERSION"]);

export const scheduleSlotInputSchema = z.object({
  socialAccountId: z.string().min(1, "Pilih akun sosmed untuk slot ini."),
  placement: placementSchema,
  endorseTypeId: z.string().min(1, "Pilih jenis endorse."),
  objective: objectiveSchema,
  /** `datetime-local` dalam WIB, mis. "2026-10-02T19:00". */
  scheduledAt: z
    .union([
      z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Tanggal tayang tidak valid."),
      z.literal(""),
    ])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  briefId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  picUserId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  productIds: z.array(z.string().min(1)).max(20).default([]),
  rate: nonNegativeMoneyString,
  additionalCost: z
    .union([nonNegativeMoneyString, z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : "0")),
});

export const scheduleOrderInputSchema = z.object({
  brandId: z.string().min(1, "Pilih brand."),
  campaignId: z.string().min(1, "Pilih campaign."),
  kolId: z.string().min(1, "Pilih KOL."),
  note: optionalText(2000),
  /** true = langsung diajukan; false = disimpan sebagai draf. */
  submit: z.boolean(),
  slots: z
    .array(scheduleSlotInputSchema)
    .min(1, "Tambahkan minimal satu slot konten.")
    .max(20, "Maksimal 20 slot per pengajuan."),
});

export type ScheduleOrderInput = z.input<typeof scheduleOrderInputSchema>;

export const categoryInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: optionalText(300),
});

export const endorseTypeInputSchema = z.object({
  name: z.string().trim().min(2).max(60),
  description: optionalText(300),
  isBarter: z.boolean().default(false),
});

export const briefInputSchema = z.object({
  brandId: z.string().min(1, "Pilih brand."),
  categoryId: z
    .string()
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  title: z.string().trim().min(2).max(160),
  linkUrl: z
    .union([z.string().trim().url("Link brief harus URL lengkap (https://…)."), z.literal("")])
    .optional()
    .nullable()
    .transform((v) => (v ? v : null)),
  description: optionalText(5000),
});

export const budgetInputSchema = z.object({
  brandId: z.string().min(1, "Pilih brand."),
  name: z.string().trim().min(2).max(120),
  beginningBalance: positiveMoneyString,
  notes: optionalText(1000),
});

export const campaignInputSchema = z
  .object({
    brandId: z.string().min(1, "Pilih brand."),
    budgetId: z.string().min(1, "Pilih budget."),
    title: z.string().trim().min(2).max(160),
    description: optionalText(5000),
    startDate: optionalIsoDate,
    endDate: optionalIsoDate,
    picUserId: z
      .string()
      .optional()
      .nullable()
      .transform((v) => (v ? v : null)),
  })
  .refine((v) => !v.startDate || !v.endDate || v.startDate <= v.endDate, {
    message: "Tanggal selesai tidak boleh sebelum tanggal mulai.",
    path: ["endDate"],
  });

export const productPriceInputSchema = z.object({
  productId: z.string().min(1),
  retailPrice: optionalMoney,
});
