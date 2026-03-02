# E2E Validation Plan — SessionForge

**Platform:** fullstack (Next.js 15 + Neon Postgres + better-auth)
**Date:** 2026-03-02
**Validation order:** Database → Backend API → Frontend → Integration

---

## Layer 1: Database Connectivity
> No remote DB configured locally — healthcheck confirms `db: false`. Skip direct DB queries. Validate DB-dependent routes return proper error handling (not 500s).

| # | Check | PASS Criteria |
|---|-------|---------------|
| L1.1 | Healthcheck reports DB status | Returns JSON with `db` field (true/false), no crash |

## Layer 2: Backend API (20 journeys)

### J1: Healthcheck
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 1.1 | GET | /api/healthcheck | Returns JSON `{status, db, redis, timestamp}`, HTTP 200 or 503 |

### J2: Auth — Session Check
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 2.1 | GET | /api/auth/get-session | HTTP 200, body `null` (unauthenticated) |
| 2.2 | POST | /api/auth/sign-in/email | HTTP 200/4xx, valid JSON response (not 500) |
| 2.3 | POST | /api/auth/sign-up/email | HTTP 200/4xx, valid JSON response (not 500) |

### J3: Sessions — Auth Guard
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 3.1 | GET | /api/sessions | 401 `{"error":"Unauthorized"}` |
| 3.2 | POST | /api/sessions/scan | 401 `{"error":"Unauthorized"}` |
| 3.3 | GET | /api/sessions/:id | 401 `{"error":"Unauthorized"}` |
| 3.4 | GET | /api/sessions/:id/messages | 401 `{"error":"Unauthorized"}` |

### J4: Workspace — Auth Guard
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 4.1 | GET | /api/workspace | 401 `{"error":"Unauthorized"}` |
| 4.2 | POST | /api/workspace | 401 `{"error":"Unauthorized"}` |
| 4.3 | GET | /api/workspace/:slug | 401 `{"error":"Unauthorized"}` |
| 4.4 | PUT | /api/workspace/:slug/style | 401 `{"error":"Unauthorized"}` |

### J5: Insights — Auth Guard
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 5.1 | GET | /api/insights | 401 `{"error":"Unauthorized"}` |
| 5.2 | POST | /api/insights/extract | 401 `{"error":"Unauthorized"}` |
| 5.3 | GET | /api/insights/:id | 401 `{"error":"Unauthorized"}` |

### J6: Content — Auth Guard
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 6.1 | GET | /api/content | 401 `{"error":"Unauthorized"}` |
| 6.2 | POST | /api/content | 401 `{"error":"Unauthorized"}` |
| 6.3 | GET | /api/content/:id | 401 `{"error":"Unauthorized"}` |
| 6.4 | PUT | /api/content/:id | 401 `{"error":"Unauthorized"}` |
| 6.5 | DELETE | /api/content/:id | 401 `{"error":"Unauthorized"}` |

### J7: AI Agents — Auth Guard
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 7.1 | POST | /api/agents/blog | 401 `{"error":"Unauthorized"}` |
| 7.2 | POST | /api/agents/social | 401 `{"error":"Unauthorized"}` |
| 7.3 | POST | /api/agents/changelog | 401 `{"error":"Unauthorized"}` |
| 7.4 | POST | /api/agents/chat | 401 `{"error":"Unauthorized"}` |

### J8: Invalid Method Handling
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 8.1 | DELETE | /api/healthcheck | 405 Method Not Allowed |
| 8.2 | PUT | /api/sessions | 405 Method Not Allowed |
| 8.3 | PATCH | /api/insights | 405 Method Not Allowed |
| 8.4 | GET | /api/agents/blog | 405 Method Not Allowed |

### J9: 404 Handling
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 9.1 | GET | /api/nonexistent | 404 Not Found |

### J10: Input Validation
| Step | Method | Endpoint | Body | PASS Criteria |
|------|--------|----------|------|---------------|
| 10.1 | POST | /api/auth/sign-in/email | `{}` (empty) | 4xx, not 500 |
| 10.2 | POST | /api/auth/sign-up/email | `{"email":"bad"}` | 4xx, not 500 |
| 10.3 | POST | /api/content | `{}` (empty, unauthed) | 401 |

### J11: Response Time (Performance)
| Step | Method | Endpoint | PASS Criteria |
|------|--------|----------|---------------|
| 11.1 | GET | /api/healthcheck | < 500ms |
| 11.2 | GET | /api/sessions (unauthed) | < 500ms |
| 11.3 | POST | /api/agents/blog (unauthed) | < 500ms |

## Layer 3: Frontend (4 journeys)

### J12: Login Page Render
| Step | Action | PASS Criteria |
|------|--------|---------------|
| 12.1 | Navigate to / | Redirects to /login |
| 12.2 | Screenshot login | Shows "SessionForge" heading, email field, password field, "Sign in" button, GitHub OAuth, "Sign up" link |
| 12.3 | Snapshot interactive | Finds email input, password input, submit button |

### J13: Signup Page Render
| Step | Action | PASS Criteria |
|------|--------|---------------|
| 13.1 | Navigate to /signup | Page loads, shows signup form |
| 13.2 | Screenshot signup | Shows name, email, password fields, "Create account" button |

### J14: 404 Page
| Step | Action | PASS Criteria |
|------|--------|---------------|
| 14.1 | Navigate to /nonexistent | Shows 404 page or redirect |

### J15: Login Form Interaction
| Step | Action | PASS Criteria |
|------|--------|---------------|
| 15.1 | Fill email + password | Fields accept input |
| 15.2 | Click Sign In | Form submits (error expected without DB, but no crash) |
| 15.3 | Screenshot result | Shows error message or stays on login — not a blank page or 500 |

## Layer 4: Integration

> Limited without real DB. Validate that frontend-to-API communication works correctly.

### J16: Auth Flow Integration
| Step | Action | PASS Criteria |
|------|--------|---------------|
| 16.1 | Submit login form via UI | Network request hits /api/auth/sign-in/email |
| 16.2 | Verify error handling | UI shows meaningful error, not blank screen |

---

## Summary
- **Platform:** fullstack
- **Journeys:** 16
- **Steps:** 42
- **Estimated time:** ~3 minutes
