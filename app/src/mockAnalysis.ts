// Mock Style DNA analysis. Replace this file with a call to the real
// algorithm later — the rest of the app only depends on StyleAnalysis.
export interface StyleAnalysis {
  style: string;
  colors: string[];
  confidence: number;
  traits: string[];
}

export interface OutfitRecord {
  id: string;
  imageUri: string;
  createdAt: string;
  analysis: StyleAnalysis;
}

const RESULTS: StyleAnalysis[] = [
  {
    style: 'Minimal Streetwear',
    colors: ['Black', 'White', 'Grey'],
    confidence: 87,
    traits: ['Clean', 'Structured', 'Neutral', 'Modern'],
  },
  {
    style: 'Quiet Luxury',
    colors: ['Cream', 'Camel', 'Ivory'],
    confidence: 91,
    traits: ['Refined', 'Tonal', 'Tailored', 'Understated'],
  },
  {
    style: 'Minimal Scandi',
    colors: ['Black', 'Cream', 'Stone'],
    confidence: 84,
    traits: ['Soft', 'Functional', 'Airy', 'Considered'],
  },
  {
    style: 'Modern Classic',
    colors: ['Navy', 'White', 'Charcoal'],
    confidence: 89,
    traits: ['Polished', 'Timeless', 'Sharp', 'Composed'],
  },
];

export function analyzeOutfit(imageUri: string): Promise<StyleAnalysis> {
  // Deterministic pick based on the image uri so re-analyzing the same
  // photo gives the same result, like a real model would.
  let hash = 0;
  for (let i = 0; i < imageUri.length; i++) hash = (hash * 31 + imageUri.charCodeAt(i)) >>> 0;
  const result = RESULTS[hash % RESULTS.length];
  return new Promise((resolve) => setTimeout(() => resolve(result), 1800));
}
