import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";

import { prisma } from "@/infrastructure/database/prisma";
import { signInSchema } from "@/modules/auth/auth.schemas";
import { verifyPassword } from "@/modules/auth/password";

export const {
  handlers,
  auth,
  signIn,
  signOut,
} = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60,
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      name: "Email and password",

      credentials: {
        email: {
          label: "Email",
          type: "email",
        },

        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const parsed =
          signInSchema.safeParse(credentials);

        if (!parsed.success) {
          return null;
        }

        const user =
          await prisma.user.findUnique({
            where: {
              email: parsed.data.email,
            },

            select: {
              id: true,
              email: true,
              name: true,
              passwordHash: true,
            },
          });

        const passwordIsValid =
          await verifyPassword(
            parsed.data.password,
            user?.passwordHash,
          );

        if (!user || !passwordIsValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
        };
      },
    }),
  ],

  callbacks: {
    jwt({ token, user }) {
      if (user?.id) {
        token.sub = user.id;
      }

      return token;
    },

    session({ session, token }) {
      if (
        session.user &&
        typeof token.sub === "string"
      ) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
});