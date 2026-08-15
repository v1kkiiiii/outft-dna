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

/** aesthetic-taxonomy-v2 — 478 canonical labels grouped into style families (see prompt.ts), sentence case, case-sensitive in storage. */
export const AESTHETIC_TAXONOMY_V1 = [
  'Quiet luxury',
  'Old money',
  'New money',
  'Stealth wealth',
  'Power dressing',
  'Haute couture',
  'Designer logomania',
  'Italian luxury',
  'French chic',
  'Paris street',
  'Milan sleek',
  'Archive fashion',
  'Fashion week',
  'Editorial',
  'Avant garde',
  'Conceptual fashion',
  'Deconstructed',
  'Asymmetric',
  'Sculptural',
  'Couture gown',
  'Minimalist',
  'Classic minimalist',
  'Scandi',
  'Danish cool',
  'Normcore',
  'Clean girl',
  'Vanilla girl',
  'Classic',
  'Timeless',
  'Understated',
  'Monochrome',
  'Tonal dressing',
  'All black',
  'All white',
  'Neutral palette',
  'Capsule wardrobe',
  'Effortless chic',
  'Undone elegance',
  'Quiet cool',
  'Raw edge minimal',
  'Preppy',
  'East coast prep',
  'Ivy league',
  'Old school prep',
  'WASP aesthetic',
  'Country club',
  'Tennis core',
  'Lacrosse casual',
  'Varsity',
  'Letterman',
  'Rowing aesthetic',
  'Sailing',
  'Equestrian',
  'Polo',
  'Rugby stripe',
  'Madras',
  'Nantucket red',
  'New England casual',
  'Coastal grandmother',
  'Hamptons',
  'Streetwear',
  'Hypebeast',
  'Sneakerhead',
  'Techwear',
  'Gorpcore',
  'Utilitarian',
  'Cargo',
  'Workwear',
  'NY street',
  'LA street',
  'London street',
  'Tokyo street',
  'Paris street casual',
  'Chicago casual',
  'ATL street',
  'Miami street',
  'Skater',
  'Longboarder',
  'BMX',
  'Graffiti culture',
  'Underground',
  'Off duty model',
  'Model off duty',
  'Airport fit',
  'Travel casual',
  'Athleisure',
  'Gymwear',
  'Running aesthetic',
  'Pilates girl',
  'Yoga casual',
  'Cyclist',
  'Swimmer casual',
  'Soccer casual',
  'Basketball casual',
  'Golf casual',
  'Ski chalet',
  'Apres ski',
  'Surf',
  'Wakeboard',
  'Outdoorsy active',
  'Hiker',
  'Climber',
  'Lux sport',
  'Sporty chic',
  'Sport luxe',
  'Blokecore',
  'Football casual',
  'Terrace wear',
  'Beach casual',
  'Island girl',
  'Tropical',
  'Surf girl',
  'Ocean aesthetic',
  'Mermaidcore',
  'Nautical',
  'Maritime',
  'Coastal cool',
  'California casual',
  'Santa Barbara',
  'Malibu',
  'Mediterranean',
  'Greek island',
  'Amalfi coast',
  'Tulum',
  'Bali',
  'Nature girl',
  'Outdoorsy',
  'Camping chic',
  'Cottagecore',
  'Farmcore',
  'Prairie',
  'Western',
  'Cowboy',
  'Cowgirl',
  'Country',
  'Southern belle',
  'Rancher',
  'Desert aesthetic',
  'Southwestern',
  'Boho western',
  'Coquette',
  'Balletcore',
  'Soft girl',
  'Princesscore',
  'Fairycore',
  'Angelcore',
  'Ethereal',
  'Dreamy',
  'Whimsical',
  'Romantic',
  'Dark romance',
  'Regencycore',
  'Royalcore',
  'Cottagecore romantic',
  'Floral feminine',
  'Lace and ribbon',
  'Bow aesthetic',
  'Vintage feminine',
  'Old Hollywood glam',
  'Pin-up',
  'Bombshell',
  'Femme fatale',
  'Burlesque',
  'Cabaret',
  'Showgirl',
  'Goth',
  'Gothic',
  'Dark academia',
  'Grunge',
  'Punk',
  'Soft punk',
  'Pop punk',
  'Cyber goth',
  'Industrial',
  'Witchcore',
  'Witchy academic',
  'Occult',
  'Victorian goth',
  'Edwardian goth',
  'Romantic goth',
  'Pastel goth',
  'Nu goth',
  'Whimsigoth',
  'Cryptidcore',
  'Weirdcore',
  'Dreamcore',
  'Traumacore',
  'Dariacore',
  'Grunge lite',
  'Edgy minimalist',
  'Dark minimalist',
  'Shadow',
  'Y2K',
  '90s',
  '80s',
  '70s boho',
  '70s disco',
  '60s mod',
  '50s housewife',
  '50s rockabilly',
  '40s wartime',
  '30s glamour',
  '20s flapper',
  'Disco',
  'Glam rock',
  'Hair metal',
  'New wave',
  'Post punk',
  'Mod revival',
  'Teddy boy',
  'Greaser',
  'Psychedelic',
  'Hippie',
  'Flower child',
  'Free love era',
  'Thriftcore',
  'Vintage prep',
  'Archive hunting',
  'Deadstock',
  'Retro sporty',
  'Art hoe',
  'Eclectic',
  'Maximalist',
  'Color blocking',
  'Print mixing',
  'Pattern clash',
  'Dopamine dressing',
  'Joy dressing',
  'Camp',
  'Kitsch',
  'Pop art',
  'Surrealist fashion',
  'Dadaist',
  'Bauhaus',
  'Abstract',
  'Artist aesthetic',
  'Painter',
  'Ceramicist',
  'Gallery girl',
  'Museum aesthetic',
  'Light academia',
  'Academia',
  'Oxford aesthetic',
  'Cambridge aesthetic',
  'Bookish',
  'Literary',
  'Philosopher',
  'Professor',
  'Student aesthetic',
  'Scholastic',
  'Classic academic',
  'Science nerd',
  'Math aesthetic',
  'Art student',
  'Film student',
  'Theater kid',
  'Music student',
  'Architecture student',
  'Law school',
  'Gyaru',
  'Kogal',
  'Lolita',
  'Sweet Lolita',
  'Gothic Lolita',
  'Classic Lolita',
  'Punk Lolita',
  'Sailor Lolita',
  'Wa Lolita',
  'Mori girl',
  'Visual kei',
  'Decora',
  'Fairy kei',
  'Gyaru-o',
  'Harajuku',
  'Shibuya casual',
  'Ura-Harajuku',
  'Kigurumi',
  'Dolly kei',
  'Cult party kei',
  'Larme kei',
  'Jirai kei',
  'Yami kawaii',
  'Kawaii',
  'Super kawaii',
  'Pastel kawaii',
  'Dark kawaii',
  'K-fashion',
  'K-indie',
  'K-pop idol',
  'Soft Seoul',
  'K-street',
  'Ulzzang',
  'Hanbok fusion',
  'Korean minimal',
  'Seoul casual',
  'Hongdae street',
  'Sinchon style',
  'Korean office',
  'K-beauty adjacent',
  'C-fashion',
  'Hanfu',
  'Tang aesthetic',
  'Modern hanfu',
  'Chinese streetwear',
  'Shanghai chic',
  'Beijing casual',
  'C-pop idol',
  'Indo-fusion',
  'Modern kurta',
  'Saree contemporary',
  'Desi street',
  'Bollywood glam',
  'South Asian bridal',
  'Indo-western',
  'Afrocentric',
  'Afrofuturist',
  'Lagos street',
  'Nairobi cool',
  'African print',
  'Ankara fashion',
  'Kente inspired',
  'West African glamour',
  'East African minimal',
  'Afropunk',
  'Diaspora chic',
  'Latin street',
  'Miami Cuban',
  'Colombian chic',
  'Brazilian beach',
  'Mexican folk inspired',
  'Tejano',
  'Reggaeton glam',
  'Latin minimalist',
  'Barrio chic',
  'Gulf chic',
  'Dubai glam',
  'Modern abaya',
  'Modest fashion',
  'Levant street',
  'Persian elegant',
  'Arabic streetwear',
  'Seapunk',
  'Vaporwave',
  'Cybercore',
  'Webcore',
  'Glitchcore',
  'Internetcore',
  'Tumblr era',
  'Twitter aesthetic',
  'TikTok fashion',
  'Instagram aesthetic',
  'Pinterest board',
  'Bloggercore',
  'VSCO girl',
  'E-girl',
  'E-boy',
  'Softie',
  'Alt TikTok',
  'Cottagecore internet',
  'Raver',
  'Club kid',
  'Rave aesthetic',
  'Festival',
  'Burning Man',
  'Underground club',
  'Drag inspired',
  'Ballroom',
  'Vogue aesthetic',
  'Biker',
  'Motorcycle',
  'Heavy metal',
  'Rock',
  'Indie rock',
  'Folk',
  'Jazz aesthetic',
  'Blues aesthetic',
  'Classical music',
  'Opera glam',
  'Choir casual',
  'Office siren',
  'Corporate baddie',
  'Business casual',
  'Smart casual',
  'Business formal',
  'Creative professional',
  'Tech bro',
  'Silicon Valley casual',
  'Startup casual',
  'Freelancer chic',
  'Barista aesthetic',
  'Chef casual',
  'Artist studio',
  'Yoga instructor',
  'Personal trainer',
  'Nurse off duty',
  'Teacher aesthetic',
  'Librarian',
  'Architect',
  'Interior designer',
  'Date night',
  'Night out',
  'Brunch fit',
  'Vacation mode',
  'Resort wear',
  'Cruise wear',
  'Wedding guest',
  'Black tie',
  'Cocktail',
  'Garden party',
  'Baby shower',
  'Birthday fit',
  'Festival fit',
  'Concert fit',
  'Museum day',
  'Gallery opening',
  'Farmers market',
  'Coffee run',
  'Errand fit',
  'Lazy day chic',
  'Tomato girl summer',
  'Mob wife',
  'Quiet outdoor',
  'Libertine',
  'Cleanfit',
  'Vanilla girl summer',
  'That girl',
  'Lucky girl',
  'Latte girl',
  'Espresso girl',
  'Coastal cowgirl',
  'Cowboy core',
  'Mermaid summer',
  'Ballet flats era',
  'Loafer girl',
  'Sneaker girl',
  'Boot season',
  'Trench coat era',
  'Leather jacket girl',
  'Blazer girl',
  'Scene',
  'Emo',
  'Screamo',
  'Scene queen',
  'Mall goth',
  'Hot topic era',
  'Myspace era',
  'Raccoon eyes',
  'Checkered pattern',
  'Band tee culture',
  'Twee',
  'Hipster',
  'Indie',
  'Indie sleaze',
  'Indie film',
  'Wes Anderson aesthetic',
  'Sundance',
  'Folk indie',
  'Bedroom pop',
  'Shoegaze aesthetic',
  'Knightcore',
  'Medievalcore',
  'Renaissancecore',
  'Baroque',
  'Rococo',
  'Victorianna',
  'Edwardian',
  'Art nouveau',
  'Art deco',
  'Futurist',
  'Space age',
  'Retrofuturism',
  'Solarpunk',
  'Lunarpunk',
  'Steampunk',
  'Dieselpunk',
  'Atompunk',
  'Biopunk',
  'Cyberpunk',
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

/**
 * v2 seed alias map — aesthetics. Provider synonym (lowercased) -> canonical
 * label. Left empty at launch of aesthetic-taxonomy-v2 (478 labels are
 * already specific enough that guessing synonyms risks silently mapping to
 * the wrong family); add entries here only for confirmed provider-output
 * variants observed in production.
 */
const AESTHETIC_ALIASES: Record<string, AestheticLabel> = {};

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
  /\b(hot(?![- ]?pink)|sexy|sexiest|ugly|gorgeous|beautiful person|attractive|unattractive|hottie)\b/i,
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
  promptVersion: z.literal('outft-analysis-v2'),
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
  promptVersion: 'outft-analysis-v2';
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
