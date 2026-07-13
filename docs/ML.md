# OUTFT ML Integration Contract

**Status: CONTRACT — FROZEN v1**

Owner: ML integration workstream. Source of truth: master PRD §9.6, §9.7, §10, §15.4, §17.
Changes to any frozen artifact in this document require lead approval, a version bump, and regeneration of downstream consumers. No code in this document by design.

Frozen artifacts and their versions:

| Artifact | Version |
| --- | --- |
| Analysis output schema | `schemaVersion: "1.0"` (OutfitAnalysisV1) |
| Prompt | `promptVersion: "outft-analysis-v1"` |
| Aesthetic taxonomy | `aesthetic-taxonomy-v1` |
| Garment category taxonomy | `garment-taxonomy-v1` |
| Style DNA aggregation algorithm | `dna-agg-v1` |

---

## 1. Stable interface and output schema

### 1.1 AnalyzeOutfit interface (PRD §10.1)

```
type AnalyzeOutfit = (input: AnalyzeOutfitInput) => Promise<OutfitAnalysisV1>;
```

- The mobile app never knows the model provider. It creates an analysis job and consumes a versioned result.
- `AnalyzeOutfitInput` is server-internal: a short-lived signed reference to the owner's private image object plus job metadata (outfit ID, owner ID, request hash, correlation ID). The mobile client never passes image bytes to this interface; it uploads to private storage and requests a job (§10.4, pipeline in Section 4 below).
- The provider adapter is isolated behind this interface with contract tests (PRD §11.3). Swapping providers must not change `OutfitAnalysisV1`.

### 1.2 OutfitAnalysisV1 schema (PRD §10.2)

```json
{
  "schemaVersion": "1.0",
  "modelVersion": "provider-model-version",
  "promptVersion": "outft-analysis-v1",
  "garments": [{ "category": "outerwear", "label": "blazer", "confidence": 0.92 }],
  "colors": [{ "hex": "#D8C9B5", "label": "warm cream", "weight": 0.34 }],
  "styleTraits": [{ "label": "structured", "confidence": 0.88 }],
  "styleScores": { "Minimalist": 42, "Classic": 28, "Quiet luxury": 20, "Scandi": 10 },
  "confidence": 0.86,
  "insight": "Clean tailoring and a quiet palette give this look a refined, minimal rhythm."
}
```

Stored immutably in `style_analyses` (one row per completed job); never mutated after insert.

### 1.3 Field-by-field validation rules (PRD §10.3)

Validation runs in the worker after the provider responds and before any database write. A payload failing validation is `ANALYSIS_INVALID_OUTPUT`; it is never partially saved and never silently repaired beyond the explicitly allowed normalizations below.

| Field | Rules |
| --- | --- |
| `schemaVersion` | Required. Must equal `"1.0"` exactly. |
| `modelVersion` | Required, non-empty string. The worker stamps this from the adapter configuration; a provider-supplied value never overrides it. |
| `promptVersion` | Required. Must equal `"outft-analysis-v1"` exactly (stamped by the worker from the prompt registry). |
| `garments` | Required array, 1–8 items. Each item: `category` must be a canonical garment-taxonomy-v1 value (Section 2.2); `label` non-empty string ≤ 40 chars, lowercase, drawn from provider output after mapping (Section 2.3); `confidence` number in [0, 1]. Duplicate (category, label) pairs are rejected. |
| `colors` | Required array, 1–6 items. Each item: `hex` matches `#RRGGBB` uppercase-or-lowercase hex (normalized to uppercase on save); `label` non-empty plain-language color name ≤ 30 chars; `weight` number in [0, 1]. Weights should sum to ≤ 1.0 + 0.05 tolerance; ordering is descending by weight. |
| `styleTraits` | Required array, 2–6 items. Each item: `label` non-empty string ≤ 30 chars, lowercase descriptor (e.g. "structured", "wide leg", "neutral palette"); `confidence` number in [0, 1]. No duplicates. Trait labels must pass the banned-language screen (Section 3.4). |
| `styleScores` | Required object with exactly 4 keys. Every key must be a canonical aesthetic-taxonomy-v1 label (Section 2.1); unknown keys are mapped or the payload is rejected (Section 2.3). Values are integers (or fixed-precision numbers) in [0, 100]. Values must sum to 100 within a 0.5 tolerance before final normalization; after normalization the stored values sum to exactly 100. Zero-value entries are disallowed — the four keys are the top four. |
| `confidence` | Required number in [0, 1]. Overall analysis confidence. Drives the low-confidence UX rule (Section 5.3). |
| `insight` | Required string, 1–140 characters, single sentence, plain text (no markdown, emoji, or newlines). Must contain no disallowed evaluative language (Section 3.4) and be safe for direct display. |
| Raw model output | Omitted by default. May be stored only briefly under an explicit debugging policy; never in logs, analytics, or audit events (PRD §10.3, §15.1, §17.2). |

General rules:

- Schema and prompt versions are always required; a payload missing either is invalid.
- All confidences and weights are validated as finite numbers in range; NaN/Infinity/strings are rejected.
- List sizes are hard-bounded as above; oversized lists are rejected, not truncated (truncation would silently change meaning).
- Validation failure is a **non-retryable** failure class with unchanged input (Section 4.2): the worker may make its bounded in-attempt re-request per retry policy, but a schema failure does not consume media-error retries and the job terminates as `analysis_failed_terminal` with `ANALYSIS_INVALID_OUTPUT` if attempts are exhausted.

---

## 2. Versioned taxonomies (v1)

### 2.1 Aesthetic taxonomy — `aesthetic-taxonomy-v1`

Exactly ten canonical labels. Casing is canonical and case-sensitive in stored data (sentence case as shown, matching PRD §10.2 and the current prompt):

1. `Quiet luxury`
2. `Old money`
3. `Scandi`
4. `Coastal`
5. `Eclectic`
6. `Minimalist`
7. `Athleisure`
8. `Bold`
9. `Vintage`
10. `Classic`

`styleScores` keys, DNA snapshot score keys, and all UI aesthetic displays draw exclusively from this list. Adding, removing, or renaming a label creates `aesthetic-taxonomy-v2` and a new prompt version; historical analyses remain immutable under v1.

### 2.2 Garment category taxonomy — `garment-taxonomy-v1`

Exactly eight canonical categories, lowercase:

1. `outerwear`
2. `top`
3. `bottom`
4. `dress`
5. `footwear`
6. `accessory`
7. `bag`
8. `headwear`

`garments[].category` must be one of these. `garments[].label` is the free-text specific garment (e.g. "blazer", "wide-leg trousers") and is bounded but not enumerated in v1.

### 2.3 Provider-label mapping and rejection rules

Providers drift; the taxonomy does not. The worker applies this deterministic post-processing before validation:

1. **Exact match** (after trimming whitespace): accept.
2. **Case-insensitive match** to a canonical label: normalize to canonical casing and accept (e.g. `"quiet luxury"` → `Quiet luxury`, `"Footwear"` → `footwear`).
3. **Alias map** (versioned with the taxonomy): a maintained, reviewed table of known provider synonyms → canonical labels. v1 seed aliases:
   - Aesthetics: `Scandinavian`/`Nordic` → `Scandi`; `Minimal`/`Minimalism` → `Minimalist`; `Athletic`/`Sporty`/`Sportswear` → `Athleisure`; `Retro` → `Vintage`; `Timeless`/`Traditional` → `Classic`; `Stealth wealth` → `Quiet luxury`; `Preppy` → `Old money`; `Maximalist`/`Statement` → `Bold`; `Beachy`/`Nautical` → `Coastal`; `Bohemian`/`Boho`/`Mixed` → `Eclectic`.
   - Garment categories: `jacket`/`coat` (as category) → `outerwear`; `shirt`/`blouse`/`knitwear` (as category) → `top`; `pants`/`trousers`/`skirt` (as category) → `bottom`; `shoes` → `footwear`; `jewelry`/`belt`/`scarf`/`eyewear` (as category) → `accessory`; `purse`/`handbag`/`backpack` (as category) → `bag`; `hat`/`cap`/`beanie` (as category) → `headwear`.
4. **Rejection**: any label not resolved by steps 1–3 fails the payload with `ANALYSIS_INVALID_OUTPUT`. The unresolved label string (label text only — never image data or full raw output) is recorded in worker telemetry for alias-map review. The worker never invents a mapping at runtime; the alias map changes only through a reviewed release.

If mapping produces duplicate `styleScores` keys (two provider labels mapping to one canonical label), their values are summed, and if fewer than four distinct keys remain, the payload is rejected.

---

## 3. Production prompt spec — `outft-analysis-v1`

Evolves the prototype prompt in `/Users/sahanalydia/Documents/docs/outft-dna/server.js` (which outputs only `aesthetics`/`tags`/`insight`) to emit the full OutfitAnalysisV1 payload. This section specifies prompt content requirements, not literal prompt text; the frozen prompt text lives in the worker's prompt registry keyed by `outft-analysis-v1`.

### 3.1 Role and framing

- System role: OUTFT's style analysis engine. The task is personal style *reflection and description*, never judgment, scoring of the person, or trend rating (PRD §2, §15.4).
- Instruct the model to return ONLY a raw JSON object — no markdown fences, no preamble, no trailing text (carried over from the prototype prompt, which this behavior is proven on).
- One image, one wearer, one outfit is the expected input; the prompt must define the uncertain/unsupported escape hatch (Section 5).

### 3.2 Required output instructions

The prompt must instruct the model to produce every OutfitAnalysisV1 content field:

- **`garments`** — each visible garment as `{category, label, confidence}`; `category` restricted to the eight garment-taxonomy-v1 values, listed verbatim in the prompt; `label` a specific lowercase garment name; `confidence` 0–1 reflecting visual certainty; at most 8 garments, most prominent first.
- **`colors`** — 3–6 dominant outfit colors as `{hex, label, weight}`; `hex` a #RRGGBB value sampled from the garment surfaces (not background); `label` a plain-language name (e.g. "warm cream"); `weight` the approximate share of the outfit's visual area, weights descending.
- **`styleTraits`** — 2–6 concise lowercase descriptors of silhouette, texture, palette, or construction (e.g. "structured", "wide leg", "neutral palette"); each with `confidence` 0–1. Descriptors describe the clothes, never the person.
- **`styleScores`** — the top 4 aesthetics from the ten aesthetic-taxonomy-v1 labels, listed verbatim in the prompt exactly as in Section 2.1, with integer percentages summing to exactly 100.
- **`confidence`** — a single 0–1 value for the overall reading; explicitly instruct lower values for partial framing, occlusion, poor light, or ambiguous styling.
- **`insight`** — one sentence, maximum 140 characters, about the outfit's dominant aesthetic quality; warm, editorial, specific; describes the outfit, not the wearer's worth.

`schemaVersion`, `modelVersion`, and `promptVersion` are stamped by the worker, not requested from the model.

### 3.3 Uncertainty instructions

The prompt must instruct the model, when the image shows multiple people, no discernible outfit, or is otherwise unreadable as a single outfit, to return the sentinel classification defined in Section 5.1 instead of guessing a plausible analysis. Guessing is the failure mode; a truthful "can't read this" is the correct output.

### 3.4 Banned evaluative language (PRD §9.6, §15.4)

The prompt must prohibit — and the worker's post-validation language screen must reject in `insight` and `styleTraits` — language in these categories:

1. **Attractiveness / desirability** of the person (e.g. hot, sexy, ugly, flattering-to-the-body framing).
2. **Body quality, shape, size, or weight** (e.g. slimming, hides, figure-flattering, body-type commentary).
3. **Socioeconomic status or wealth judgment** of the wearer (describing the *aesthetic* "Quiet luxury"/"Old money" is allowed; stating the person is/looks rich or poor, cheap or expensive-looking as a person, is not).
4. **Gender correctness or conformity** (e.g. masculine/feminine "enough", appropriate-for-gender claims).
5. **Identity certainty / sensitive-attribute inference** — age, ethnicity, gender identity, religion, sexuality, pregnancy, or any protected attribute.
6. **Medical or physical conditions** inferred from appearance.
7. **Objective judgment / grading of the person** — verdicts like "you should", "wrong", "mistake", "unflattering"; the product explains patterns, it does not score people (PRD §2, "analysis provides language and reflection, not judgment").

The worker maintains a versioned blocklist/classifier implementing these categories; a hit is `ANALYSIS_INVALID_OUTPUT` (non-retryable without changed input) and is counted in the bias-language evaluation metric (Section 6).

### 3.5 Prompt versioning

Any change to prompt text, taxonomy lists embedded in it, output shape, or tone rules produces `outft-analysis-v2` and must pass the full evaluation gate (Section 6) before deployment. `promptVersion` is recorded on every analysis and every job (PRD §12.1, §17.1).

---

## 4. Analysis pipeline, retry, and cost policy

### 4.1 Pipeline steps (PRD §10.4)

1. Mobile normalizes the image (orient, resize ≤ 3072 px longest edge, compress ≤ 6 MB, strip EXIF/GPS) and requests an upload intent (`POST /v1/outfits/upload-intent`).
2. Server creates the outfit row with owner ID and client idempotency key (unique `(owner_id, client_idempotency_key)`).
3. Mobile uploads directly to a short-lived signed private storage destination.
4. Mobile requests an analysis job (`POST /v1/outfits/{outfitId}/analysis-jobs`).
5. Server verifies: JWT, ownership, object existence, quota, media type (magic bytes) and size, decoded dimensions, and active-job uniqueness (one active job per outfit).
6. A single transaction creates the `analysis_jobs` row and an outbox/queue record.
7. Worker leases a job, obtains a short-lived signed object URL, invokes the provider through the adapter, validates the result (Section 1.3), and applies sanity checks (Section 5).
8. One transaction inserts the immutable `style_analyses` row, marks the outfit `ready` (setting `latest_analysis_id`), and schedules Style DNA recomputation.
9. Mobile observes completion by polling `GET /v1/analysis-jobs/{jobId}` with exponential backoff; Realtime may accelerate updates but is never the only completion mechanism.

State machine (PRD §7.1): `local_draft → queued_offline → uploading → uploaded → analysis_queued → analyzing → ready`, with failure branches `upload_failed`, `analysis_failed_retryable`, `analysis_failed_terminal`. Retries are idempotent and never create duplicate outfit or analysis records. Production never substitutes a mock result (PRD §3, §8.3).

### 4.2 Retry policy (PRD §10.5, §8.3)

**Retryable** (up to **3 attempts total**, capped exponential backoff **with jitter**, `next_attempt_at` persisted on the job):

- Provider timeouts.
- Provider `429` rate-limit responses.
- Transient provider/network `5xx` responses.

**Non-retryable without changed input** (terminal — `analysis_failed_terminal`):

- Invalid media (unsupported type, corrupted, dimensions out of bounds) — `IMAGE_TYPE_UNSUPPORTED` / `IMAGE_DIMENSIONS_UNSUPPORTED` / `IMAGE_TOO_LARGE`.
- Ownership/authorization failure — `PERMISSION_DENIED`.
- Provider policy refusal on the content.
- Schema/validation failure of the provider output — `ANALYSIS_INVALID_OUTPUT`.

Manual user retry reuses the same outfit and request contract; it does not create duplicates. Exhausted retryable failures surface a non-blaming retry state; terminal failures prompt the user to choose another image.

### 4.3 Cost, quota, and abuse controls (PRD §10.5)

- Per-user, per-device, and per-IP rate limits (`ANALYSIS_RATE_LIMITED`).
- One active job per outfit, enforced at job creation.
- **Request-hash deduplication**: the job carries a `request_hash` (hash over image object + prompt version + model version); a duplicate hash with an existing completed/in-flight job reuses that job rather than invoking the provider again.
- Free-plan analysis quotas, server-authoritative (client is never the entitlement authority).
- Provider-cost telemetry per call with budget alerts (PRD §17.1: provider 429/5xx rate, latency, queue age).
- **Global analysis kill switch**: when engaged, job creation returns a truthful `ANALYSIS_TEMPORARILY_UNAVAILABLE` state — never a queued illusion, never a mock result.

---

## 5. Sanity checks and low-confidence handling

### 5.1 Multi-person, non-outfit, and unsupported inputs (PRD §15.4, §10.6)

The prompt instructs the model to classify before analyzing. The worker maps outcomes:

| Condition | Outcome |
| --- | --- |
| Multiple people, no single dominant outfit | **Unsupported/uncertain state** — terminal, user-facing message asks for a photo of one outfit. No analysis row is saved. |
| No outfit content (landscape, object, screenshot, text) | **Unsupported state** — terminal, choose-another-image prompt. No analysis saved. |
| Corrupted / undecodable / disallowed media | Rejected pre-provider at server validation (magic bytes, dimensions, size) — never reaches the model. |
| Single outfit but hard to read (occlusion, crop, low light) | Analysis proceeds; model returns a **low `confidence`** value; result is saved. |

Worker-side sanity checks, independent of the model's self-report: reject payloads where the model produced an analysis despite signaling non-outfit/multi-person; verify score-sum and bounds (Section 1.3); run the banned-language screen (Section 3.4). Multi-person/non-outfit outcomes are truthful unsupported states, never plausible fabricated analyses.

### 5.2 Provider policy refusals

A provider content-policy refusal is terminal (Section 4.2) and maps to the same choose-another-image user state. Refusal text is never shown raw to the user and never logged verbatim beyond a safe error code.

### 5.3 Low-confidence UX rule (PRD §9.6)

- `confidence` is always stored; it is shown in the UI only if research confirms it helps users.
- When overall `confidence` falls below the low-confidence threshold (**v1 default: 0.5**, tunable via config, not schema), the result screen shows the gentle state: *"This look was harder to read"*, with options to retry or provide feedback.
- Low-confidence results still save normally if the user confirms them; they count toward Style DNA like any other ready analysis (equal weighting in P0, §9.7).
- Result language never blames the user, and never uses the banned categories of Section 3.4.

---

## 6. Evaluation and release gates (PRD §10.6)

### 6.1 Fixture matrix

Maintain a consented, non-sensitive fixture set. Every model or prompt release runs the full matrix:

| Fixture class | Expected behavior |
| --- | --- |
| Full-body outfit | Valid OutfitAnalysisV1, normal confidence |
| Cropped / partial outfit | Valid result, appropriately reduced confidence |
| Layered outfit | Valid result; layers represented in `garments` (incl. `outerwear`) |
| Dark clothing / dark scene | Valid result; colors plausible; confidence honest |
| Bright / overexposed | Valid result; confidence honest |
| Patterned garments | Valid result; pattern reflected in traits/colors |
| Low-light | Valid result or low-confidence state; no fabricated detail |
| Multiple people | Unsupported/uncertain state, no saved analysis |
| Non-outfit (object/scene/screenshot) | Unsupported state, no saved analysis |
| Unsupported media type | Rejected pre-provider at validation |
| Corrupted file | Rejected pre-provider at validation |

### 6.2 Evaluation dimensions and release-gate thresholds

Each release candidate (new `modelVersion` or `promptVersion`) is measured on:

1. **Schema validity** — share of fixture runs producing a payload that passes Section 1.3 without repair. Gate: no regression vs. current production, and consistent with the product target that analysis success for valid supported images is ≥ 97% (PRD §5.3).
2. **Latency** — must support the product latency targets: p50 < 15 s, p95 < 45 s from upload completion (PRD §5.3). A candidate that regresses these on the fixture set does not ship.
3. **Stability** — repeated runs on the same fixture produce consistent taxonomy labels and score distributions within an agreed variance band; no flapping between unrelated aesthetics.
4. **Bias-language** — zero outputs containing Section 3.4 banned-category language across the fixture set. This gate is absolute.
5. **Human usefulness** — human review rates insights/traits as specific, accurate, and in product tone; must not regress vs. the incumbent.
6. **Unsupported handling** — 100% of multi-person and non-outfit fixtures resolve to unsupported/uncertain states, never plausible analyses.

**Gate rule (PRD §10.6): a model or prompt upgrade does not deploy if it regresses any required threshold.** Results are recorded per release with model/prompt versions; the mobile app is unaffected because it consumes only `OutfitAnalysisV1`.

---

## 7. Style DNA v1 aggregation — `dna-agg-v1` (PRD §9.7)

Style DNA is a versioned aggregate derived from the user's **ready, non-deleted** outfit analyses. A single result is an outfit analysis; it is not the full identity.

### 7.1 Evidence thresholds and states

- **0 traces** → No DNA ("no traces" state).
- **1 trace** → **Early DNA**, explicitly labeled as based on one outfit.
- **≥ 5 traces** → **Stable DNA** summary unlocked.
- **Trends** require ≥ 5 traces spanning **at least two distinct weeks**; otherwise "insufficient data for trend".
- Additional states: stale/recomputing, and calculation failure (surfaced honestly, never masked with stale data presented as fresh).

### 7.2 Aggregation algorithm (P0, exact)

Inputs: all eligible analyses in the evidence window (P0 window = all ready, non-deleted analyses for the user).

1. **Normalize per trace**: for each eligible analysis, normalize its four `styleScores` values to sum to exactly 100.
2. **Equal weights**: every trace weighs equally in P0 — no recency, category, or confidence weighting.
3. **Mean by label**: compute the arithmetic mean per aesthetic-taxonomy-v1 label across all eligible traces (labels absent from a trace contribute 0 for that trace).
4. **Top four**: retain the four labels with the highest means.
5. **Renormalize**: scale the retained four to sum to exactly 100.
6. **Signature colors**: clustered normalized color values with frequency and recency — adopted **only after the simple baseline is validated**; the P0 baseline ships without the clustering enhancement.
7. **Traits**: a trait appears in DNA only if it occurs in **at least 2 traces OR ≥ 25% of the evidence window**, whichever criterion is met.

### 7.3 Snapshot fields

Each computation writes a `style_dna_snapshots` row storing:

- `outfit_count` (number of eligible analyses used)
- `window_start`, `window_end` (evidence window dates)
- `algorithm_version` (`dna-agg-v1`)
- `generated_at`
- `scores`, `colors`, `traits` (the aggregated jsonb payloads)
- `user_id`, `id`

### 7.4 Versioning and recomputation rules

- Any new model, prompt, or aggregation behavior creates a **new snapshot** under the new `algorithm_version`; historical analyses remain **immutable** — they are never rewritten to fit a new algorithm.
- Outfit deletion triggers recomputation of the **current** DNA without the deleted outfit (PRD §8.4); prior snapshots are not retroactively edited.
- Re-analysis of an outfit after a model update creates a new analysis **version** and requires explicit user action or policy approval (PRD §9.8); DNA then recomputes from the latest eligible analyses.
- Do not silently rewrite historical results (PRD §9.7). The server alone writes analyses and DNA snapshots (PRD §15.1).

---

*End of frozen v1 contract. Supersession requires: lead approval, taxonomy/prompt/schema version bump as applicable, full Section 6 evaluation pass, and regeneration of shared types.*
