import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { DEFAULT_CEO_EMAIL } from "@/lib/default-ceo-credentials";
import { ensureDefaultCeoUserExists } from "@/lib/ensure-default-ceo-user";
import type { UserRole } from "@prisma/client";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET,
  trustHost: true,
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        if (
          parsed.data.email.toLowerCase() === DEFAULT_CEO_EMAIL.toLowerCase()
        ) {
          await ensureDefaultCeoUserExists();
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user) return null;

        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.name ?? undefined,
          image: user.image ?? undefined,
          role: user.role as UserRole,
          bio: user.bio ?? undefined,
        };
      },
    }),
  ],
  callbacks: {
    jwt: async ({ token, user, trigger, session }) => {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.role = user.role;
        token.name = user.name ?? undefined;
        token.picture = user.image ?? undefined;
        token.bio = user.bio ?? undefined;
      }
      if (trigger === "update" && session && typeof session === "object") {
        const u = (session as { user?: Partial<{ name: string | null; image: string | null; bio: string | null }> }).user;
        if (u?.name !== undefined) token.name = u.name ?? undefined;
        if (u?.image !== undefined) token.picture = u.image ?? undefined;
        if (u?.bio !== undefined) token.bio = u.bio ?? undefined;
      }
      if (token.id && token.role === undefined) {
        const row = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, name: true, image: true, bio: true },
        });
        if (row) {
          token.role = row.role;
          token.name = row.name ?? undefined;
          token.picture = row.image ?? undefined;
          token.bio = row.bio ?? undefined;
        }
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        if (token.id) session.user.id = token.id as string;
        if (token.role) session.user.role = token.role as UserRole;
        if (token.name !== undefined) session.user.name = token.name as string | null;
        if (token.picture !== undefined)
          session.user.image = (token.picture as string | null) ?? null;
        session.user.bio =
          (token.bio as string | null | undefined) ?? null;
      }
      return session;
    },
  },
});
