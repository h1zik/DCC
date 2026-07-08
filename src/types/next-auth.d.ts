import type { DefaultSession } from "next-auth";
import type { EmploymentType, UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      role?: UserRole;
      /** Status kepegawaian — menentukan akses absensi. */
      employmentType?: EmploymentType;
      bio?: string | null;
      /** Nama label peran kustom (mis. "DevOps Engineer"). Null = pakai enum role. */
      customRoleName?: string | null;
    };
  }

  interface User {
    id: string;
    email: string;
    role: UserRole;
    employmentType?: EmploymentType;
    bio?: string | null;
    image?: string | null;
    customRoleName?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: UserRole;
    employmentType?: EmploymentType;
    bio?: string | null;
    customRoleName?: string | null;
  }
}
