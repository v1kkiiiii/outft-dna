# OUTFT Analysis Worker

Standalone TypeScript service that polls for queued outfit analysis jobs,
calls Claude vision, validates the result against the frozen `OutfitAnalysisV1`
contract (`docs/ML.md`), and writes the immutable analysis result.

## Why this exists

**This service is what moves the Anthropic API key off the phone and onto the
server.** Per `docs/SECURITY.md` release blocker R-01, `EXPO_PUBLIC_ANTHROPIC_API_KEY`
must be removed entirely from `app/.env` and `app/src/analyze.ts`, and the key
must be rotated (founder action, via the Anthropic console — agents do not
rotate production credentials). `ANTHROPIC_API_KEY` in this worker's
environment **replaces** that mobile-side variable. The mobile app never talks
to Anthropic directly again; it only creates analysis jobs and polls/reads
results via the API (see `docs/API.openapi.yaml`).

## Setup

```bash
cd worker
npm install
cp .env.example .env
# fill in .env with real, server-only values (never commit this file)
```

## Environment variables

| Variable | Required | Notes |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | yes | Server-only. Replaces the removed `EXPO_PUBLIC_ANTHROPIC_API_KEY`. |
| `SUPABASE_URL` | yes | Supabase project URL. |
| `SUPABASE_SERVICE_ROLE_KEY` | yes | Service role key. Server-only; never in mobile code or `EXPO_PUBLIC_*` vars (SECURITY.md §7). |
| `ANALYSIS_MODEL` | no | Defaults to `claude-sonnet-4-6`. Stamped into `OutfitAnalysisV1.modelVersion`. |
| `ANALYSIS_ENABLED` | no | Global kill switch (ML.md §4.3). Must be exactly `true` to let the worker lease/process jobs. |

## Running

```bash
npm run dev     # tsx watch, for local development
npm run build   # tsc -> dist/
npm start        # node dist/worker.js, for production
```

## Typecheck

```bash
npx tsc --noEmit
```

## What it does

1. Leases one queued `analysis_job` at a time (`analysis_queued -> analyzing`),
   respecting one-active-job-per-outfit, via the `lease_next_analysis_job`
   Postgres RPC (transactional, race-safe across worker instances).
2. Mints a short-lived signed URL for the outfit image in the private
   `outfits` storage bucket, downloads it, and base64-encodes it in memory.
   The signed URL and image bytes are never logged or persisted anywhere
   (SECURITY.md §5).
3. Calls `analyzeImage()` (`src/analyze.ts`), which invokes Claude vision with
   the `outft-analysis-v1` prompt (`src/prompt.ts`) and applies the retry
   policy from `docs/ML.md` §4.2: up to 3 attempts total, capped exponential
   backoff with jitter, only for provider timeouts / `429` / transient `5xx`.
   Invalid media, provider policy refusals, and schema-validation failures
   are never retried.
4. Validates the parsed model output against the frozen `OutfitAnalysisV1`
   schema (`src/schema.ts`): taxonomy enforcement (`aesthetic-taxonomy-v1`,
   `garment-taxonomy-v1`), provider-label alias mapping, score/weight sum
   tolerances, duplicate rejection, and the banned-evaluative-language screen
   (`docs/SECURITY.md` §6, `docs/ML.md` §3.4).
5. On success: atomically inserts the immutable `style_analyses` row, marks
   the outfit `ready`, and enqueues Style DNA recomputation via the
   `complete_analysis_job_success` RPC.
6. On an honest unsupported/uncertain classification (multi-person, no
   outfit) or a non-retryable/exhausted-retry failure: marks the job
   `analysis_failed_terminal` with the mapped error code via
   `fail_analysis_job_terminal`. No analysis row is ever saved for unsupported
   content (`docs/ML.md` §5.1).
7. Polls continuously with backoff when the queue is empty, and checks the
   `ANALYSIS_ENABLED` kill switch every loop iteration — when disabled, the
   worker leases nothing and never fabricates a mock result.

## Database contract

This worker assumes the following Postgres RPCs exist (defined in
`supabase/` migrations, out of scope for this directory):

- `lease_next_analysis_job()` — atomically selects and leases the next
  eligible job.
- `complete_analysis_job_success(p_job_id, p_outfit_id, p_analysis)` —
  transactionally inserts `style_analyses`, updates the outfit to `ready`,
  and enqueues DNA recomputation.
- `fail_analysis_job_terminal(p_job_id, p_outfit_id, p_error_code, p_error_message)`.
- `fail_analysis_job_retryable(p_job_id, p_outfit_id, p_error_code, p_error_message, p_next_attempt_at)`.

## Out of scope for this directory

This worker does not touch `app/`, `docs/`, `supabase/`, or the prototype
`server.js`. It is a new, standalone service intended to run on infrastructure
like Railway/Render/Fly per `docs/SECURITY.md` §7.
