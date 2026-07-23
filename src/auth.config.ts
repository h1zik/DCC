import type { NextAuthConfig } from "next-auth";
import type { EmploymentType, UserRole } from "@prisma/client";

/**
 * Config NextAuth ringan — TANPA import Prisma/bcrypt — supaya `proxy.ts`
 * bisa memverifikasi JWT tanpa menyeret Prisma engine ke bundle proxy yang
 * dievaluasi di setiap request. Config penuh (Credentials provider + backfill
 * token lama dari DB) ada di `src/lib/auth.ts` yang men-spread config ini.
 */
export const authConfig = {
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  // Provider diisi di src/lib/auth.ts (Credentials butuh Prisma + bcrypt).
  providers: [],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
        token.employmentType = user.employmentType;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        token.bio = user.bio ?? undefined;
        token.customRoleName = user.customRoleName ?? null;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const u = (session as {
          user?: Partial<{
            name: string | null;
            image: string | null;
            bio: string | null;
            customRoleName: string | null;
          }>;
        }).user;
        if (u?.name !== undefined) token.name = u.name ?? undefined;
        if (u?.image !== undefined) token.picture = u.image ?? undefined;
        if (u?.bio !== undefined) token.bio = u.bio ?? undefined;
        if (u?.customRoleName !== undefined)
          token.customRoleName = u.customRoleName ?? null;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        if (token.role) session.user.role = token.role as UserRole;
        session.user.employmentType =
          (token.employmentType as EmploymentType | undefined) ?? "EMPLOYEE";
        if (token.name !== undefined) session.user.name = token.name as string | null;
        if (token.picture !== undefined)
          session.user.image = (token.picture as string | null) ?? null;
        session.user.bio =
          (token.bio as string | null | undefined) ?? null;
        session.user.customRoleName =
          (token.customRoleName as string | null | undefined) ?? null;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
