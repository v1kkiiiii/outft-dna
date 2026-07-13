# OUTFT — Project Status

Source of truth for wave progress. Owned by the lead orchestrator. PRD: `deliverables/OUTFT_Master_PRD_v1.0.docx` (v1.0, 2026-07-13, baseline commit daa7ad0).

## Wave status

| Wave | Scope | Status |
|---|---|---|
| 0 | Orchestrator foundation: contracts, conventions, status tracking | IN PROGRESS |
| 1 | Parallel specification (PRODUCT_SPEC, ARCHITECTURE, DATABASE_SCHEMA, API, ML, SECURITY, ACCEPTANCE_TESTS, AGENTS) | IN PROGRESS |
| 2 | Parallel foundation: mobile restructure, supabase/ migrations+RLS, worker/, CI | IN PROGRESS — DB migrations + RLS done, analysis worker done; mobile data-layer rewrite + CI not started (paused: budget) |
| 3 | Verified vertical slices: auth/profile → capture/upload → analysis/result → history/offline → deletion | NOT STARTED |
| 4 | Adversarial verification: security, physical-device QA, performance/cost | NOT STARTED |
| 5 | P1: social, premium, Wrapped | GATED on P0 green |
| 6 | Release prep: staging, TestFlight, clean-machine | GATED — needs Apple Developer ($99/yr) |

## Founder inputs needed (see PRD §22)

- [ ] Supabase account created (free tier) — unblocks Wave 2 integration
- [ ] Anthropic API key ROTATED (R-01: current key entered a distributed test build) — console.anthropic.com
- [ ] Confirm working defaults or override (ADR-001)
- [ ] Apple Developer Program ($99/yr) — Wave 6 only

## Prototype disposition (PRD §21)

- Preserved as reference: `public/index.html` (PWA demo), `app/` (Expo prototype, 16 screens, visual system).
- To be replaced in Wave 2+: direct mobile→Anthropic call and EXPO_PUBLIC key, silent mock fallback, AsyncStorage-blob persistence, mock seed data in production paths, local isPremium, hand-built navigation.

## Log

- 2026-07-13: Wave 0 started. PRD extracted and read in full. Six Wave-1 spec agents dispatched (PRODUCT_SPEC, ARCHITECTURE+DATABASE_SCHEMA, API.openapi, ML, SECURITY, ACCEPTANCE_TESTS+AGENTS). ADR-001 recorded.
