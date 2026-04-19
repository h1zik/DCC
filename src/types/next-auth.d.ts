import type { DefaultSession } from "next-auth";
import type { UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: UserRole;
      bio?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    role: UserRole;
    bio?: string | null;
    image?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    bio?: string | null;
  }
}
