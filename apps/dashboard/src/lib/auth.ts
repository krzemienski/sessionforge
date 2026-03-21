import { betterAuth } from "better-auth";
import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import * as schema from "@sessionforge/db";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.BETTER_AUTH_URL
) {
  console.warn(
    "[auth] WARNING: BETTER_AUTH_URL is not set in production. " +
      "Falling back to NEXT_PUBLIC_APP_URL. Set BETTER_AUTH_URL to the canonical server-side URL."
  );
}

export const auth = betterAuth({
  baseURL:
    process.env.BETTER_AUTH_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "http://localhost:3000",
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      user: schema.users,
      session: schema.authSessions,
      account: schema.accounts,
      verification: schema.verifications,
    },
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: true,
  },
  ...(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET
    ? {
        socialProviders: {
          github: {
            clientId: process.env.GITHUB_CLIENT_ID,
            clientSecret: process.env.GITHUB_CLIENT_SECRET,
          },
        },
      }
    : {}),
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [nextCookies()],
});

export type Session = typeof auth.$Infer.Session;
