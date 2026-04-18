# Better Auth Integration

> **Category:** External Interface
> **Service:** Better Auth
> **Last Updated:** 2026-04-18
> **Status:** Active

## Overview

**Service:** Better Auth Authentication Framework
**Provider:** Better Auth
**Purpose:** User authentication, session management, OAuth integration
**Documentation:** https://better-auth.com/docs

## Architecture

Better Auth provides both server-side (`auth`) and client-side (`authClient`) APIs:

- **Server:** `apps/dashboard/src/lib/auth.ts` — betterAuth() instance with Drizzle adapter
- **Client:** `apps/dashboard/src/lib/auth-client.ts` — createAuthClient() for React

## Authentication

### Method

Email/Password (primary) + GitHub OAuth (optional)

### Server Configuration

**Location:** `apps/dashboard/src/lib/auth.ts`

```typescript
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL,
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
  // GitHub OAuth (conditional on env vars)
  socialProviders: {
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 5 * 60, // 5 minutes
    },
  },
  plugins: [nextCookies()],
});
```

### Environment Variables

**Server:**
```bash
BETTER_AUTH_URL=https://example.com                    # Canonical server URL
NEXT_PUBLIC_APP_URL=https://example.com                # Client-side app URL (fallback)
GITHUB_CLIENT_ID=...                                   # OAuth (optional)
GITHUB_CLIENT_SECRET=...                               # OAuth (optional)
```

**Database Tables (Drizzle):**
- `users` — User accounts
- `authSessions` — Active sessions
- `accounts` — OAuth account links
- `verifications` — Email verification tokens

### Client Configuration

**Location:** `apps/dashboard/src/lib/auth-client.ts`

```typescript
export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
});

export const { signIn, signUp, signOut, useSession } = authClient;
```

## API Endpoints

### Server-Side Routes (auto-generated)

Better Auth generates these routes automatically under `/api/auth/*`:

```
POST   /api/auth/sign-up          — Register new user
POST   /api/auth/sign-in          — Login with email/password
POST   /api/auth/sign-out         — Logout and clear session
GET    /api/auth/session          — Get current session
POST   /api/auth/sign-in/github   — GitHub OAuth redirect
GET    /api/auth/callback/github  — OAuth callback handler
```

## Session Management

### Session Type

```typescript
export type Session = typeof auth.$Infer.Session;

// Structure:
{
  user: {
    id: string,
    email: string,
    name?: string,
    image?: string,
  },
  session: {
    id: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string,
  },
}
```

### Cookie Cache

- **Enabled:** true
- **Max Age:** 5 minutes
- **Invalidation:** On sign-out or expiration

## Client-Side Usage

### useSession Hook

```typescript
import { useSession } from "@/lib/auth-client";

export function MyComponent() {
  const { data: session, isPending, error } = useSession();
  
  if (!session) return <p>Not logged in</p>;
  return <p>Welcome, {session.user.email}</p>;
}
```

### Sign In

```typescript
const { data, error } = await signIn.email({
  email: "user@example.com",
  password: "password123",
  callbackURL: "/dashboard",
});
```

### Sign Up

```typescript
const { data, error } = await signUp.email({
  email: "user@example.com",
  password: "password123",
  name: "John Doe",
  callbackURL: "/dashboard",
});
```

### Sign Out

```typescript
await signOut({
  fetchOptions: {
    onSuccess: () => router.push("/login"),
  },
});
```

## OAuth Integration (GitHub)

### Enable GitHub OAuth

1. Create GitHub OAuth App: https://github.com/settings/developers
2. Set env vars:
   ```bash
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```
3. Restart dev server

### OAuth Flow

```typescript
// Redirect to GitHub
window.location.href = "/api/auth/sign-in/github";

// After user authenticates, GitHub redirects to /api/auth/callback/github
// Better Auth handles callback and creates session
```

## Error Handling

### Common Errors

**Error 1: Invalid Credentials**
- **Cause:** Wrong email/password combination
- **Recovery:** Show "Invalid email or password" error
- **Retry:** Yes

**Error 2: User Already Exists**
- **Cause:** Email already registered
- **Recovery:** Redirect to sign-in
- **Retry:** No

**Error 3: Session Expired**
- **Cause:** Cookie max age exceeded
- **Recovery:** Redirect to login
- **Retry:** No (requires re-auth)

### Validation

```typescript
// Client validates input before submission
if (!email.includes("@")) {
  setError("Invalid email");
}

// Server validates and returns typed errors
try {
  await signIn.email({ email, password });
} catch (err) {
  // Better Auth error handling
}
```

## Security Considerations

- **Password Hashing:** Bcrypt (automatically by Better Auth)
- **Session Cookies:** Secure, HttpOnly, SameSite=Lax
- **CSRF Protection:** Token-based (Next.js built-in)
- **Rate Limiting:** Not included; implement at API level if needed

## Data Mapping

### Sign-Up Input → User Table

| Input | Database Field | Type |
|-------|---|---|
| `email` | `email` | string (unique) |
| `password` | `password` (hashed) | string |
| `name` | `name` | string |

### GitHub OAuth → Account Link

| GitHub Field | Database | Linking |
|---|---|---|
| `id` | `accounts.providerAccountId` | Unique per provider |
| `email` | `users.email` | Used for signup if new |
| `name` | `users.name` | Fallback if not set |

## Testing

### Test Credentials

```bash
# Development
Email: test@example.com
Password: password123
```

### Sign-In Test

```typescript
test("sign in with email/password", async () => {
  const { data, error } = await signIn.email({
    email: "test@example.com",
    password: "password123",
  });
  
  expect(data.user).toBeTruthy();
  expect(data.session).toBeTruthy();
});
```

### OAuth Test

GitHub OAuth requires a real account and OAuth app credentials. Integration tests should use test GitHub account.

## Monitoring

### Health Checks

**Endpoint:** `GET /api/auth/session`
**Frequency:** On app load, before protected routes

### Metrics to Track

- Sign-up success rate
- Sign-in success rate
- Session cookie validity
- OAuth callback success rate
- Average auth latency

### Alerts

- **Critical:** Auth database unreachable
- **Critical:** Session validation failures
- **Warning:** Repeated failed login attempts (rate limiting needed)
- **Warning:** High sign-up error rate (>10% in 1h)

## Compliance

**Data Handling:**
- PII fields: Email stored unhashed; password hashed (Bcrypt)
- Retention: User accounts retained until deletion
- Geographic restrictions: Better Auth available globally

**Regulations:**
- GDPR: User can request account deletion
- CCPA: Password hashing meets privacy requirements
- SOC2: Better Auth SOC2 compliant

## Cost Considerations

**Pricing Model:** Better Auth is open-source; no usage fees

**Cost Estimate:** $0 (no cost to use or scale)

## Migration/Upgrade Path

**Current Version:** better-auth 1.2

**Upgrading:** Follow better-auth changelog; test OAuth callback URLs after upgrades.

## Related Documentation

- [Patterns: Workspace Authorization](../patterns/workspace-auth.md) — how auth gates workspace access
- [Patterns: Error Handling](../patterns/error-handling.md) — auth error response format

## External Resources

- [Better Auth Docs](https://better-auth.com/docs)
- [Better Auth GitHub](https://github.com/better-auth/better-auth)
- [Drizzle Adapter Docs](https://better-auth.com/docs/integrations/drizzle)

## Version History

| Date | Change | Author |
|------|--------|--------|
| 2026-04-18 | Initial integration | capture-docs |
