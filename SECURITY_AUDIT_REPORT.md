# Vizora-AI Security Audit Report

Date: 2026-07-10

## Scope

Reviewed the backend FastAPI application, Next.js frontend, Telegram bot, scraper pipeline, auth flows, admin panel, and AI/RAG integration. This audit was defensive/static-first; local security scanners were not available in the environment, so findings are based on code review and limited runtime checks.

## Executive Summary

The project has a functional security baseline, but several design choices create high-impact exposure paths. The main risks are browser-side admin authentication, browser-stored JWTs with non-rotating refresh tokens, unbounded trusted scraping/input ingestion, and vulnerable frontend dependencies reported by `npm audit`.

## Findings

### 1. High: Admin access is controlled by a shared secret stored in the browser

The admin UI stores the admin secret in `sessionStorage` and sends it as `X-Admin-Secret` on every request. The backend accepts that single shared secret for all admin routes.

Evidence:
- [frontend/components/admin/AdminShell.tsx](frontend/components/admin/AdminShell.tsx#L32)
- [frontend/lib/admin-api.ts](frontend/lib/admin-api.ts#L11)
- [backend/routers/admin.py](backend/routers/admin.py#L1)

Impact:
- Any XSS, browser extension compromise, shared-device exposure, or leaked secret gives full admin access.
- There is no per-user identity, session revocation, or role-based audit trail for admin actions.

Why this matters:
- This is not just a weak password problem; it is a trust-boundary problem. The browser becomes the bearer of the entire admin trust anchor.

Recommended fix:
- Replace the shared header secret with server-side admin authentication.
- Use an HttpOnly, Secure cookie session or signed admin JWT with server-side role checks.
- Add admin audit logging and the ability to revoke specific sessions.

Remediation status:
- Fixed in code during this audit stage.
- Backend admin routes now use JWT-backed RBAC via `Depends(require_admin)`.
- Frontend admin shell and admin API no longer store or send `X-Admin-Secret`.
- Regression tests passed for `401` without JWT, `403` for a non-admin JWT, admin success, forged body role ignored, and legacy `X-Admin-Secret` blocked.
- Frontend production build completed, and the generated bundle no longer contains `X-Admin-Secret` or `adminSecret`.

### 2. High: User sessions are stored in browser storage and refresh tokens are replayable

Access and refresh tokens are written to `localStorage`, and the refresh endpoint accepts a raw refresh token without rotation or revocation state.

Evidence:
- [frontend/hooks/useAuth.ts](frontend/hooks/useAuth.ts#L32)
- [frontend/lib/api.ts](frontend/lib/api.ts#L11)
- [backend/routers/auth.py](backend/routers/auth.py#L155)
- [backend/app/core/security.py](backend/app/core/security.py)

Impact:
- Any XSS or malicious browser script can steal long-lived session tokens.
- A stolen refresh token can be replayed until expiry; there is no jti-based revocation or token-family invalidation.

Recommended fix:
- Move auth tokens to HttpOnly cookies.
- Add refresh-token rotation with server-side revocation tracking.
- Add `jti`, `iss`, and `aud` claims and validate them consistently.

### 3. High: Scraper pipeline can reach arbitrary remote content without strong SSRF/IP-range defenses

The scraper follows redirects, fetches remote URLs, and depends on heuristic domain filtering rather than a hard network-layer allow/deny policy. The admin panel can trigger scraping in the background.

Evidence:
- [backend/scraper/web_scraper.py](backend/scraper/web_scraper.py)
- [backend/routers/admin.py](backend/routers/admin.py#L1)
- [backend/scraper/pipeline.py](backend/scraper/pipeline.py)

Impact:
- If a malicious URL reaches the pipeline, the application may fetch internal or sensitive network resources.
- The background scrape job can consume CPU, memory, outbound bandwidth, and model/API budget.

Recommended fix:
- Enforce a strict allowlist of approved domains.
- Block private, loopback, link-local, and metadata IP ranges before any fetch.
- Cap redirect depth, response size, and total crawl budget per run.
- Put scraping behind a queue with concurrency limits and cancellation.

### 4. Medium: Simulator upload/transcription path reads the full file into memory

The transcription endpoint loads the entire uploaded audio file into memory before processing it. There is no explicit upload size cap in the route.

Evidence:
- [backend/routers/simulator.py](backend/routers/simulator.py#L199)

Impact:
- A large upload can cause memory pressure or request-worker exhaustion.
- The endpoint is authenticated, but that does not prevent abuse by a valid user or a compromised token.

Recommended fix:
- Enforce a maximum upload size at the framework and reverse-proxy layers.
- Stream or chunk large media where possible.
- Reject oversized files before reading them fully into memory.

### 5. Medium: Telegram auth is signed correctly, but the client-side trust boundary is still broad

Telegram WebApp `initData` is verified on the backend, which is good. However, the client auto-authenticates on page load, stores tokens in `localStorage`, and trusts deep-link parameters for navigation/referral handling.

Evidence:
- [frontend/components/TelegramAuthHandler.tsx](frontend/components/TelegramAuthHandler.tsx#L19)
- [backend/routers/auth.py](backend/routers/auth.py#L191)

Impact:
- The signature check protects identity assertion, but post-login session storage remains exposed to XSS.
- Deep-link inputs need continued validation so they cannot become open-redirect or logic-abuse primitives.

Recommended fix:
- Keep backend signature verification as the source of truth.
- Move session storage away from `localStorage`.
- Validate Telegram deep-link parameters against a strict schema and allowed route set.

### 6. Medium: Untrusted content can be ingested into the KB and fed back into prompts

The scraper pipeline extracts and stores knowledge-base entries from external content, and the chat/simulator services place retrieved KB text into model prompts. There is trust labeling, but no strong content-sanitization or prompt-injection firewall.

Evidence:
- [backend/app/services/rag_service.py](backend/app/services/rag_service.py)
- [backend/app/services/ai_service.py](backend/app/services/ai_service.py)
- [backend/scraper/content_processor.py](backend/scraper/content_processor.py)

Impact:
- Malicious external pages can poison the knowledge base.
- Prompt injection can steer assistant behavior, leak context, or produce misleading guidance.

Recommended fix:
- Treat all scraped content as untrusted input.
- Add stronger source allowlists, content filtering, and human review gates for new KB entries.
- Separate trusted official guidance from community content in prompt construction.

### 7. Medium: Frontend dependency versions include known high-severity advisories

`npm audit` reported high-severity advisories affecting `next` and `eslint-config-next` in the current frontend dependency set.

Evidence:
- [frontend/package.json](frontend/package.json#L15)

Impact:
- Known framework-level advisories can affect build-time or runtime behavior, depending on the specific issue.
- Leaving these unpatched increases risk from already-published exploit classes.

Recommended fix:
- Upgrade `next` and `eslint-config-next` to a patched release line.
- Re-run `npm audit` and a production build after the upgrade.

## Notes

- I did not find a clear SQL injection or direct object-reference issue in the reviewed owner-scoped routes, but those paths should still be covered by targeted tests after auth hardening.
- No Dockerfiles or CI workflows were present in the repository snapshot I reviewed, so production hardening and automated security gates appear to be missing rather than misconfigured.
