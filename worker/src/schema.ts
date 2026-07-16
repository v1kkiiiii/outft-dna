/**
 * OutfitAnalysisV1 schema, taxonomy, alias mapping, and validation.
 *
 * Frozen contract: docs/ML.md §1 (schema + field rules), §2 (taxonomies +
 * provider-label mapping), §3.4 (banned evaluative language).
 *
 * This module is the single source of truth for what a valid analysis
 * payload looks like. Nothing downstream (worker.ts) may write to
 * style_analyses without passing `validate()` here.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Taxonomies (ML.md §2)
// ---------------------------------------------------------------------------

/** aesthetic-taxonomy-v1 — exactly ten canonical labels, sentence case, case-sensitive in storage. */
export const AESTHETIC_TAXONOMY_V1 = [
  'Quiet luxury',
  'Old money',
  'Scandi',
  'Coastal',
  'Eclectic',
  'Minimalist',
  'Athleisure',
  'Bold',
  'Vintage',
  'Classic',
] as const;

export type AestheticLabel = (typeof AESTHETIC_TAXONOMY_V1)[number];

const AESTHETIC_SET = new Set<string>(AESTHETIC_TAXONOMY_V1);
const AESTHETIC_LOWER_MAP = new Map<string, AestheticLabel>(
  AESTHETIC_TAXONOMY_V1.map((label) => [label.toLowerCase(), label]),
);

/** garment-taxonomy-v1 — exactly eight canonical categories, lowercase. */
export const GARMENT_TAXONOMY_V1 = [
  'outerwear',
  'top',
  'bottom',
  'dress',
  'footwear',
  'accessory',
  'bag',
  'headwear',
] as const;

export type GarmentCategory = (typeof GARMENT_TAXONOMY_V1)[number];

const GARMENT_SET = new Set<string>(GARMENT_TAXONOMY_V1);
const GARMENT_LOWER_MAP = new Map<string, GarmentCategory>(
  GARMENT_TAXONOMY_V1.map((label) => [label.toLowerCase(), label]),
);

/** v1 seed alias map — aesthetics. Provider synonym (lowercased) -> canonical label. */
const AESTHETIC_ALIASES: Record<string, AestheticLabel> = {
  scandinavian: 'Scandi',
  nordic: 'Scandi',
  minimal: 'Minimalist',
  minimalism: 'Minimalist',
  athletic: 'Athleisure',
  sporty: 'Athleisure',
  sportswear: 'Athleisure',
  retro: 'Vintage',
  timeless: 'Classic',
  traditional: 'Classic',
  'stealth wealth': 'Quiet luxury',
  preppy: 'Old money',
  maximalist: 'Bold',
  statement: 'Bold',
  beachy: 'Coastal',
  nautical: 'Coastal',
  bohemian: 'Eclectic',
  boho: 'Eclectic',
  mixed: 'Eclectic',
};

/** v1 seed alias map — garment categories. Provider synonym (lowercased) -> canonical category. */
const GARMENT_ALIASES: Record<string, GarmentCategory> = {
  jacket: 'outerwear',
  coat: 'outerwear',
  shirt: 'top',
  blouse: 'top',
  knitwear: 'top',
  pants: 'bottom',
  trousers: 'bottom',
  skirt: 'bottom',
  shoes: 'footwear',
  jewelry: 'accessory',
  belt: 'accessory',
  scarf: 'accessory',
  eyewear: 'accessory',
  purse: 'bag',
  handbag: 'bag',
  backpack: 'bag',
  hat: 'headwear',
  cap: 'headwear',
  beanie: 'headwear',
};

/**
 * Resolve a raw provider aesthetic label to a canonical aesthetic-taxonomy-v1
 * label per ML.md §2.3, or return null if unresolved (caller must reject).
 */
export function resolveAestheticLabel(raw: string): AestheticLabel | null {
  const trimmed = raw.trim();
  if (AESTHETIC_SET.has(trimmed)) return trimmed as AestheticLabel;
  const lower = trimmed.toLowerCase();
  const caseInsensitive = AESTHETIC_LOWER_MAP.get(lower);
  if (caseInsensitive) return caseInsensitive;
  const alias = AESTHETIC_ALIASES[lower];
  if (alias) return alias;
  return null;
}

/**
 * Resolve a raw provider garment category to a canonical garment-taxonomy-v1
 * category per ML.md §2.3, or return null if unresolved (caller must reject).
 */
export function resolveGarmentCategory(raw: string): GarmentCategory | null {
  const trimmed = raw.trim();
  if (GARMENT_SET.has(trimmed)) return trimmed as GarmentCategory;
  const lower = trimmed.toLowerCase();
  const caseInsensitive = GARMENT_LOWER_MAP.get(lower);
  if (caseInsensitive) return caseInsensitive;
  const alias = GARMENT_ALIASES[lower];
  if (alias) return alias;
  return null;
}

// ---------------------------------------------------------------------------
// Banned evaluative language screen (ML.md §3.4, SECURITY.md §6)
// ---------------------------------------------------------------------------

/**
 * Conservative keyword/phrase screen for the seven banned categories.
 * This is a blocklist, not an exhaustive classifier; it is versioned here
 * and reviewed alongside the taxonomy/prompt release process (ML.md §3.5).
 */
const BANNED_LANGUAGE_PATTERNS: RegExp[] = [
  // 1. Attractiveness / desirability of the person
  /\b(hot|sexy|sexiest|ugly|gorgeous|beautiful person|attractive|unattractive|hottie)\b/i,
  // 2. Body quality, shape, size, or weight
  /\b(slimming|flattering|unflattering|hides (your|her|his|their) (body|figure)|figure[- ]flattering|body[- ]?type|fat|overweight|skinny|curvy|petite frame|plus[- ]size)\b/i,
  // 3. Socioeconomic status or wealth judgment of the wearer
  /\b(you (look|seem) (rich|poor|wealthy)|cheap[- ]looking|expensive[- ]looking|looks? (rich|poor|cheap|expensive)|budget person|low[- ]budget)\b/i,
  // 4. Gender correctness or conformity
  /\b(masculine enough|feminine enough|appropriate for (a )?(man|woman|boy|girl)|too (masculine|feminine) for)\b/i,
  // 5. Identity certainty / sensitive-attribute inference
  /\b(you are (a|an) \w+|clearly (male|female|non-?binary|pregnant|elderly|young)|looks? (pregnant|gay|straight|trans))\b/i,
  // 6. Medical or physical conditions
  /\b(disab(led|ility)|medical condition|illness|diagnos(is|ed))\b/i,
  // 7. Objective judgment / grading of the person
  /\b(you should (not|never)?|this is (wrong|a mistake)|major mistake|fashion mistake|don'?t wear this)\b/i,
];

export function containsBannedLanguage(text: string): boolean {
  return BANNED_LANGUAGE_PATTERNS.some((pattern) => pattern.test(text));
}

// ---------------------------------------------------------------------------
// Raw (pre-mapping) provider output shape — what we expect Claude to emit
// ---------------------------------------------------------------------------

/** Shape requested from the model, before taxonomy mapping/normalization. */
export const RawAnalysisSchema = z.object({
  unsupported: z.boolean().optional(),
  unsupportedReason: z.enum(['multi_person', 'no_outfit']).optional(),
  garments: z
    .array(
      z.object({
        category: z.string().min(1),
        label: z.preprocess((v) => (typeof v === 'string' ? v.trim().slice(0, 40) : v), z.string().min(1).max(40)),
        confidence: z.number(),
      }),
    )
    .max(16)
    .optional()
    .default([]),
  colors: z
    .array(
      z.object({
        hex: z.string(),
        label: z.string().min(1).max(30),
        weight: z.number(),
      }),
    )
    .max(12)
    .optional()
    .default([]),
  styleTraits: z
    .array(
      z.preprocess(
        // The model sometimes emits traits as bare strings ("relaxed") rather
        // than {label, confidence} objects. Coerce instead of rejecting a
        // perfectly good analysis (observed in production 2026-07-16).
        (v) =>
          typeof v === 'string'
            ? { label: v.trim().slice(0, 30), confidence: 0.7 }
            : v,
        z.object({
          label: z.string().min(1).max(30),
          confidence: z.number(),
        }),
      ),
    )
    .max(16)
    .optional()
    .default([]),
  styleScores: z.record(z.string(), z.number()).optional().default({}),
  // Optional at parse time so a valid unsupported response
  // ({"unsupported": true, ...}) — which omits these — passes shape
  // validation and is handled gracefully. The supported path below
  // requires them explicitly.
  confidence: z.number().optional(),
  insight: z.preprocess(
    (v) => (typeof v === 'string' ? v.trim().replace(/[\r\n]+/g, ' ').slice(0, 140) : v),
    z.string().min(1).max(140),
  ).optional(),
});

export type RawAnalysis = z.infer<typeof RawAnalysisSchema>;

// ---------------------------------------------------------------------------
// OutfitAnalysisV1 — final, validated, storage-ready shape (ML.md §1.2)
// ---------------------------------------------------------------------------

export const GarmentDetectionSchema = z.object({
  category: z.enum(GARMENT_TAXONOMY_V1),
  label: z.string().min(1).max(40),
  confidence: z.number().min(0).max(1),
});

export const ColorDetectionSchema = z.object({
  hex: z
    .string()
    .regex(/^#[0-9A-F]{6}$/, 'hex must be normalized to uppercase #RRGGBB'),
  label: z.string().min(1).max(30),
  weight: z.number().min(0).max(1),
});

export const StyleTraitSchema = z.object({
  label: z.string().min(1).max(30),
  confidence: z.number().min(0).max(1),
});

export const StyleScoresSchema = z
  .record(z.enum(AESTHETIC_TAXONOMY_V1), z.number().min(0).max(100))
  .refine((scores) => Object.keys(scores).length === 4, {
    message: 'styleScores must have exactly 4 keys',
  });

export const OutfitAnalysisV1Schema = z.object({
  schemaVersion: z.literal('1.0'),
  modelVersion: z.string().min(1),
  promptVersion: z.literal('outft-analysis-v1'),
  garments: z.array(GarmentDetectionSchema).min(1).max(8),
  colors: z.array(ColorDetectionSchema).min(1).max(6),
  styleTraits: z.array(StyleTraitSchema).min(2).max(6),
  styleScores: StyleScoresSchema,
  confidence: z.number().min(0).max(1),
  insight: z.string().min(1).max(140),
});

export type OutfitAnalysisV1 = z.infer<typeof OutfitAnalysisV1Schema>;

// ---------------------------------------------------------------------------
// Error taxonomy for validation / analysis failures (docs/API.openapi.yaml,
// ML.md §4.2)
// ---------------------------------------------------------------------------

export type TerminalErrorCode =
  | 'ANALYSIS_INVALID_OUTPUT'
  | 'ANALYSIS_UNSUPPORTED_CONTENT'
  | 'ANALYSIS_POLICY_REFUSAL';

export class ValidationError extends Error {
  code: TerminalErrorCode;
  constructor(code: TerminalErrorCode, message: string) {
    super(message);
    this.name = 'ValidationError';
    this.code = code;
  }
}

/** Result of unsupported-content classification, if the model signaled it. */
export interface UnsupportedResult {
  unsupported: true;
  reason: 'multi_person' | 'no_outfit';
}

export interface ValidationSuccess {
  unsupported: false;
  analysis: OutfitAnalysisV1;
}

export type ValidationOutcome = UnsupportedResult | ValidationSuccess;

interface StampParams {
  modelVersion: string;
  promptVersion: 'outft-analysis-v1';
}

const SCORE_SUM_TOLERANCE = 0.5;
const WEIGHT_SUM_TOLERANCE = 0.05;

/**
 * Validates and normalizes a raw provider payload into OutfitAnalysisV1, or
 * throws ValidationError (non-retryable, ML.md §1.3/§4.2). `schemaVersion`,
 * `modelVersion`, and `promptVersion` are always stamped by the worker, never
 * trusted from the provider.
 */
export function validate(raw: unknown, stamp: StampParams): ValidationOutcome {
  const parsedRaw = RawAnalysisSchema.safeParse(raw);
  if (!parsedRaw.success) {
    throw new ValidationError(
      'ANALYSIS_INVALID_OUTPUT',
      `Raw provider payload failed shape validation: ${parsedRaw.error.message}`,
    );
  }
  const data = parsedRaw.data;

  if (data.unsupported) {
    const reason = data.unsupportedReason ?? 'no_outfit';
    return { unsupported: true, reason };
  }

  // Supported path: confidence + insight are required here (they were optional
  // at parse time only to let the unsupported branch through). A supported
  // response that omits them is genuinely invalid.
  if (data.confidence === undefined || data.insight === undefined) {
    throw new ValidationError(
      'ANALYSIS_INVALID_OUTPUT',
      'Supported analysis is missing confidence or insight',
    );
  }

  // --- garments: map categories, dedupe (category,label), bound size ---
  const seenGarments = new Set<string>();
  const garments = data.garments.flatMap((g) => {
    const category = resolveGarmentCategory(g.category);
    if (!category) {
      throw new ValidationError(
        'ANALYSIS_INVALID_OUTPUT',
        `Unresolved garment category label: "${g.category}"`,
      );
    }
    const label = g.label.trim().toLowerCase();
    const key = `${category}::${label}`;
    if (seenGarments.has(key)) return [];
    seenGarments.add(key);
    if (!Number.isFinite(g.confidence) || g.confidence < 0 || g.confidence > 1) {
      throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'Garment confidence out of range');
    }
    return [{ category, label, confidence: g.confidence }];
  });
  if (garments.length < 1) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'garments must have at least 1 item');
  }
  garments.sort((a, b) => b.confidence - a.confidence);
  garments.splice(8);

  // --- colors: normalize hex to uppercase, bound size, weight sum tolerance ---
  const colors = data.colors.map((c) => {
    if (!/^#[0-9A-Fa-f]{6}$/.test(c.hex)) {
      throw new ValidationError('ANALYSIS_INVALID_OUTPUT', `Invalid hex color: "${c.hex}"`);
    }
    if (!Number.isFinite(c.weight) || c.weight < 0 || c.weight > 1) {
      throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'Color weight out of range');
    }
    return { hex: c.hex.toUpperCase(), label: c.label.trim(), weight: c.weight };
  });
  if (colors.length < 1) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'colors must have at least 1 item');
  }
  const weightSum = colors.reduce((sum, c) => sum + c.weight, 0);
  if (weightSum > 1 + WEIGHT_SUM_TOLERANCE) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'colors weights exceed tolerance');
  }
  const sortedColors = [...colors].sort((a, b) => b.weight - a.weight).slice(0, 6);

  // --- styleTraits: dedupe, bound size, banned-language screen ---
  const seenTraits = new Set<string>();
  const styleTraits = data.styleTraits.flatMap((t) => {
    const label = t.label.trim().toLowerCase();
    if (seenTraits.has(label)) return [];
    seenTraits.add(label);
    if (containsBannedLanguage(label)) {
      throw new ValidationError(
        'ANALYSIS_INVALID_OUTPUT',
        `styleTrait failed banned-language screen: "${label}"`,
      );
    }
    if (!Number.isFinite(t.confidence) || t.confidence < 0 || t.confidence > 1) {
      throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'Style trait confidence out of range');
    }
    return [{ label, confidence: t.confidence }];
  });
  if (styleTraits.length < 2) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'styleTraits must have at least 2 items');
  }
  styleTraits.sort((a, b) => b.confidence - a.confidence);
  styleTraits.splice(6);

  // --- styleScores: map aesthetic labels, sum duplicates, validate & renormalize ---
  const mapped = new Map<AestheticLabel, number>();
  for (const [rawLabel, rawValue] of Object.entries(data.styleScores)) {
    const canonical = resolveAestheticLabel(rawLabel);
    if (!canonical) {
      throw new ValidationError(
        'ANALYSIS_INVALID_OUTPUT',
        `Unresolved aesthetic label in styleScores: "${rawLabel}"`,
      );
    }
    if (!Number.isFinite(rawValue) || rawValue < 0 || rawValue > 100) {
      throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'styleScores value out of range');
    }
    mapped.set(canonical, (mapped.get(canonical) ?? 0) + rawValue);
  }
  if (mapped.size !== 4) {
    throw new ValidationError(
      'ANALYSIS_INVALID_OUTPUT',
      `styleScores must resolve to exactly 4 distinct canonical labels, got ${mapped.size}`,
    );
  }
  const rawSum = [...mapped.values()].reduce((sum, v) => sum + v, 0);
  if (Math.abs(rawSum - 100) > SCORE_SUM_TOLERANCE) {
    throw new ValidationError(
      'ANALYSIS_INVALID_OUTPUT',
      `styleScores must sum to 100 within tolerance, got ${rawSum}`,
    );
  }
  if ([...mapped.values()].some((v) => v <= 0)) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'styleScores entries must be non-zero');
  }
  // Renormalize to sum exactly 100.
  const scale = 100 / rawSum;
  const styleScores: Record<string, number> = {};
  let runningTotal = 0;
  const entries = [...mapped.entries()];
  entries.forEach(([label, value], idx) => {
    if (idx === entries.length - 1) {
      // last entry absorbs rounding remainder so the total is exactly 100
      styleScores[label] = Math.round((100 - runningTotal) * 100) / 100;
    } else {
      const scaled = Math.round(value * scale * 100) / 100;
      styleScores[label] = scaled;
      runningTotal += scaled;
    }
  });

  // --- confidence ---
  if (!Number.isFinite(data.confidence) || data.confidence < 0 || data.confidence > 1) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'confidence out of range');
  }

  // --- insight: length + banned-language screen ---
  const insight = data.insight.trim();
  if (insight.length < 1 || insight.length > 140) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'insight must be 1-140 characters');
  }
  if (/\n|\r/.test(insight)) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'insight must not contain newlines');
  }
  if (containsBannedLanguage(insight)) {
    throw new ValidationError('ANALYSIS_INVALID_OUTPUT', 'insight failed banned-language screen');
  }

  const analysis: OutfitAnalysisV1 = OutfitAnalysisV1Schema.parse({
    schemaVersion: '1.0',
    modelVersion: stamp.modelVersion,
    promptVersion: stamp.promptVersion,
    garments,
    colors: sortedColors,
    styleTraits,
    styleScores,
    confidence: data.confidence,
    insight,
  });

  return { unsupported: false, analysis };
}
