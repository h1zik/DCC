import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CEO_EMAIL } from "@/lib/default-ceo-credentials";
import { ensureDefaultCeoUserExists } from "@/lib/ensure-default-ceo-user";
import {
  isLoginAllowed,
  loginKey,
  registerLoginFailure,
  resetLogin,
} from "@/lib/auth-rate-limit";
import type { UserRole } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials, request) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const ip =
          request?.headers?.get("x-forwarded-for")?.split(",")[0]?.trim() ||
          request?.headers?.get("x-real-ip") ||
          "unknown";
        const key = loginKey(parsed.data.email, ip);

        const gate = isLoginAllowed(key);
        if (!gate.allowed) {
          console.warn(
            `[auth] login diblokir (rate limit) untuk ${parsed.data.email} dari ${ip}`,
          );
          return null;
        }

        if (
          parsed.data.email.toLowerCase() === DEFAULT_CEO_EMAIL.toLowerCase()
        ) {
          // Bootstrap akun CEO hanya bila DEFAULT_CEO_PASSWORD di-set.
          // Tanpa env, ensureDefaultCeoUserExists melempar — perlakukan
          // sebagai "tidak ada auto-create" (login gagal wajar), bukan crash.
          try {
            await ensureDefaultCeoUserExists();
          } catch (err) {
            console.error("[auth] bootstrap CEO dilewati:", err);
          }
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
          include: { customRole: { select: { name: true } } },
        });
        if (!user) {
          registerLoginFailure(key);
          return null;
        }

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          registerLoginFailure(key);
          return null;
        }

        resetLogin(key);

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role as UserRole,
          employmentType: user.employmentType,
          bio: user.bio ?? undefined,
          customRoleName: user.customRole?.name ?? null,
        };
      },
    }),
  ],
  callbacks: {
    ...authConfig.callbacks,
    jwt: async (params) => {
      const token = await authConfig.callbacks.jwt(params);
      if (!token) return token;

      // Backfill token lama (dibuat sebelum field role/employmentType ada) —
      // butuh Prisma, jadi HANYA di config penuh ini, bukan di authConfig
      // yang dipakai proxy.
      if (token.id && token.role === undefined) {
        const row = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: {
            role: true,
            name: true,
            image: true,
            bio: true,
            customRole: { select: { name: true } },
          },
        });
        if (row) {
          token.role = row.role;
          token.name = row.name ?? undefined;
          token.picture = row.image ?? undefined;
          token.bio = row.bio ?? undefined;
          token.customRoleName = row.customRole?.name ?? null;
        }
      }
      if (token.id && token.employmentType === undefined) {
        const row = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { employmentType: true },
        });
        if (row) token.employmentType = row.employmentType;
      }
      return token;
    },
  },
});
