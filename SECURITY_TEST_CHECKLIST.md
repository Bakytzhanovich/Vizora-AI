# Vizora-AI Security Test Checklist

## Auth and Session Tests

- Verify admin routes reject any request without a valid server-side admin session.
- Verify admin access is not granted by a reusable browser-stored secret.
- Verify access tokens are not stored in `localStorage` after the fix.
- Verify refresh tokens rotate and old refresh tokens stop working after use.
- Verify logout revokes the active session.

## Telegram Tests

- Verify `initData` signature validation rejects tampered payloads.
- Verify mismatched signed Telegram IDs are rejected.
- Verify deep-link parameters cannot navigate to arbitrary routes.
- Verify Telegram login still works after session-storage changes.

## Scraper and AI Safety Tests

- Verify scraper rejects loopback, private, and link-local destinations.
- Verify scraper blocks redirect chains into disallowed hosts.
- Verify scraper enforces maximum response size and crawl budget.
- Verify KB ingestion does not accept malformed or oversized inputs.
- Verify prompt construction keeps untrusted content clearly separated from trusted system guidance.

## Upload and Abuse-Resistance Tests

- Verify simulator upload rejects oversized files before reading them fully.
- Verify repeated upload attempts are rate-limited.
- Verify background scraping cannot be spawned unboundedly.

## Dependency and Deployment Tests

- Verify `npm audit` is clean after dependency upgrades.
- Verify production builds pass after framework upgrades.
- Verify CI blocks secrets in commits.
- Verify security headers are present in production responses.
