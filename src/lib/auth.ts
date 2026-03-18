import { AdminRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import type { AppRole } from "@/lib/auth-types";
import { normalizeCustomerLoginId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 60 * 60 * 8,
  },
  providers: [
    CredentialsProvider({
      id: "admin-credentials",
      name: "Admin Login",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials.password) {
          return null;
        }

        const admin = await prisma.adminUser.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!admin || !admin.active) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, admin.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: admin.id,
          email: admin.email,
          role: admin.role,
        };
      },
    }),
    CredentialsProvider({
      id: "customer-credentials",
      name: "Customer Login",
      credentials: {
        login: { label: "Email or Phone", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.login || !credentials.password) {
          return null;
        }

        let normalized;
        try {
          normalized = normalizeCustomerLoginId(credentials.login);
        } catch {
          return null;
        }

        const customer = await prisma.customerUser.findUnique({
          where: { loginId: normalized.loginId },
        });

        if (!customer) {
          return null;
        }

        const isValid = await bcrypt.compare(credentials.password, customer.passwordHash);
        if (!isValid) {
          return null;
        }

        return {
          id: customer.id,
          email: customer.email ?? customer.phone ?? customer.loginId,
          role: "CUSTOMER" as const,
        };
      },
    }),
  ],
  pages: {
    signIn: "/admin/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.role = token.role as AppRole;
      }
      return session;
    },
  },
};

export async function getAdminSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== AdminRole.ADMIN) {
    return null;
  }
  return session;
}

export async function getCustomerSession() {
  const session = await getServerSession(authOptions);
  if (!session?.user || session.user.role !== "CUSTOMER") {
    return null;
  }
  return session;
}

