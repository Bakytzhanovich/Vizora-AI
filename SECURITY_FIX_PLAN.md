# Vizora-AI Security Fix Plan

## Phase 1: Close the biggest trust-boundary failures

1. Replace browser-stored admin secrets with real admin authentication.
2. Move user sessions from `localStorage` to HttpOnly cookies.
3. Add refresh-token rotation and revocation tracking.
4. Add defensive checks for scraper destination IP ranges and redirect targets.

## Phase 2: Reduce abuse and blast radius

1. Add upload size limits and streaming safeguards for simulator media.
2. Add queue-based execution, per-run budgets, and kill-switches for scraping.
3. Separate trusted KB sources from community/external sources in prompt assembly.
4. Upgrade vulnerable frontend dependencies and re-run the dependency audit.

## Phase 3: Improve visibility and assurance

1. Add admin and auth audit logs.
2. Add security regression tests for auth, refresh, scraper restrictions, and Telegram verification.
3. Add CI checks for dependency and secret scanning.
4. Add production security headers and a documented deployment baseline.

## Implementation order

1. Admin auth redesign.
2. Cookie-based session migration.
3. Refresh token rotation.
4. Scraper network guardrails.
5. Dependency upgrades.
6. Abuse-prevention limits and CI hardening.
