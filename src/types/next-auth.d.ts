import { AppRole } from "@/lib/auth-types";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      role: AppRole;
    };
  }

  interface User {
    id: string;
    role: AppRole;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    role?: AppRole;
  }
}

