/**
 * analyzeImage — calls Claude vision with the outft-analysis-v1 prompt,
 * parses and validates the result against OutfitAnalysisV1 (schema.ts), and
 * applies the retry policy from ML.md §4.2 / §10.5.
 *
 * Retryable (max 3 attempts total, capped exponential backoff + jitter):
 *   - provider timeouts
 *   - provider 429 rate-limit responses
 *   - transient provider/network 5xx responses
 * Non-retryable (fails immediately, no retry consumed for schema issues):
 *   - invalid media / policy refusal / schema-validation failures
 *
 * ANTHROPIC_API_KEY is read from process.env only. This key must never be
 * bundled into the mobile app (SECURITY.md R-01) — it lives here, server-side,
 * exclusively.
 */

import Anthropic from '@anthropic-ai/sdk';
import { APIError, APIConnectionError, APIConnectionTimeoutError } from '@anthropic-ai/sdk';
import {
  OUTFT_ANALYSIS_V1_SYSTEM_PROMPT,
  PROMPT_VERSION,
} from './prompt.js';
import { validate, ValidationError, type ValidationOutcome } from './schema.js';

export type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 8_000;

function getModel(): string {
  return process.env.ANALYSIS_MODEL || 'claude-sonnet-4-6';
}

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set in the worker environment');
  }
  // 90s per-request cap (SDK default is 10 min): a slow vision call fails
  // fast into the retry/backoff loop instead of stalling the job lease.
  return new Anthropic({ apiKey, timeout: 90_000 });
}

/** Classifies whether a thrown error is retryable per ML.md §4.2. */
function isRetryableProviderError(err: unknown): boolean {
  if (err instanceof APIConnectionTimeoutError) return true;
  if (err instanceof APIConnectionError) return true;
  if (err instanceof APIError) {
    const status = err.status;
    if (status === 429) return true;
    if (typeof status === 'number' && status >= 500 && status < 600) return true;
    return false;
  }
  return false;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Capped exponential backoff with full jitter. */
function backoffDelayMs(attempt: number): number {
  const cap = Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** (attempt - 1));
  return Math.random() * cap;
}

function extractJson(text: string): unknown {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'Model response contained no JSON object');
  }
  try {
    return JSON.parse(match[0]);
  } catch (e) {
    throw new ValidationError(
      'ANALYSIS_INVALID_OUTPUT',
      `Model JSON failed to parse: ${(e as Error).message}`,
    );
  }
}

/**
 * Calls the vision model once (no retry) and returns the raw parsed+validated
 * outcome. Throws ValidationError for non-retryable failures, or the
 * underlying Anthropic error for retryable transport/provider failures.
 */
async function attemptOnce(
  client: Anthropic,
  base64: string,
  mediaType: SupportedMediaType,
  model: string,
): Promise<ValidationOutcome> {
  let message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: 1200,
      system: OUTFT_ANALYSIS_V1_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
            { type: 'text', text: 'Analyze the style DNA of this outfit.' },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof APIError && err.status && err.status >= 400 && err.status < 500 && err.status !== 429) {
      // Policy refusal / bad request class — treat as terminal, non-retryable.
      throw new ValidationError(
        'ANALYSIS_POLICY_REFUSAL',
        `Provider rejected the request (status ${err.status})`,
      );
    }
    // Timeouts / connection errors / 429 / 5xx propagate for the retry loop
    // in analyzeImage to classify and handle.
    throw err;
  }

  const block = message.content.find((c) => c.type === 'text');
  const raw = block && block.type === 'text' ? block.text : '';
  const parsed = extractJson(raw);
  return validate(parsed, { modelVersion: model, promptVersion: PROMPT_VERSION });
}

/**
 * analyzeImage(base64, mediaType) -> ValidationOutcome
 *
 * Either { unsupported: true, reason } for a truthful unsupported/uncertain
 * classification (ML.md §5.1 — caller must not save an analysis row), or
 * { unsupported: false, analysis } with a fully validated OutfitAnalysisV1.
 *
 * Throws ValidationError for terminal, non-retryable failures
 * (ANALYSIS_INVALID_OUTPUT / ANALYSIS_POLICY_REFUSAL). Throws the last
 * underlying provider error if retryable attempts are exhausted — the caller
 * (worker.ts) maps that to analysis_failed_retryable / analysis_failed_terminal
 * per the job's attempt count.
 */
export async function analyzeImage(
  base64: string,
  mediaType: SupportedMediaType,
): Promise<ValidationOutcome> {
  const client = getClient();
  const model = getModel();

  let lastErr: unknown;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await attemptOnce(client, base64, mediaType, model);
    } catch (err) {
      if (err instanceof ValidationError) {
        // Non-retryable: invalid media / policy / schema failures never
        // consume further attempts.
        throw err;
      }
      lastErr = err;
      if (!isRetryableProviderError(err)) {
        throw err;
      }
      if (attempt < MAX_ATTEMPTS) {
        await sleep(backoffDelayMs(attempt));
        continue;
      }
    }
  }
  throw lastErr;
}
