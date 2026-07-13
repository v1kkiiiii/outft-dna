# ADR-001: Working defaults pending founder decisions

Status: Accepted (defaults per PRD §22; each may be overridden by the founder before its dependent workstream starts)
Date: 2026-07-13

## Context

PRD §22 lists founder decisions. To avoid blocking Waves 0–2, the PRD supplies working defaults. This ADR freezes them so agents do not invent policy.

## Decisions (defaults)

1. Platform: iOS-first; Android excluded from first store release.
2. Authentication: email-based auth (Supabase Auth); Apple Sign In deferred unless required for beta.
3. Privacy: profiles and outfits private by default.
4. Style DNA v1: equal-weight aggregation per PRD §9.7; algorithm versioned.
5. Photos: saved normalized images retained until user deletion; EXIF/GPS stripped before upload.
6. Analysis: hosted server-side provider adapter (no on-device ML, no direct mobile→provider calls); production never silently substitutes mock.
7. Social and payments: strictly after P0 gates pass.
8. Taxonomy v1: aesthetic labels per docs/ML.md; insights avoid evaluative language per SECURITY.md §6.

## Consequences

- Wave 2 can build auth, storage, schema, and worker against these defaults.
- Any override by the founder triggers contract review by the lead before dependent code merges.
