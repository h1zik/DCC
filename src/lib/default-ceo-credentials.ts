import bcrypt from "bcryptjs";

/** Email akun CEO yang selalu dijamin ada (bootstrap + seed). */
export const DEFAULT_CEO_EMAIL = "ceo@dominatus.id";

export function getDefaultCeoBootstrapPassword() {
  const fromEnv = process.env.DEFAULT_CEO_PASSWORD?.trim();
  if (fromEnv) return fromEnv;
  return "Zrz12345!";
}

export async function hashDefaultCeoPassword() {
  return bcrypt.hash(getDefaultCeoBootstrapPassword(), 10);
}
