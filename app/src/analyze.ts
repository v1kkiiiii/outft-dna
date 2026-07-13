// Real Style DNA analysis — calls the vision model directly, mirroring the
// prompt in outft-dna/server.js. Falls back to the local mock if the key
// is missing or the request fails, so the app always completes the flow.
// NOTE: the key ships inside this test build via EXPO_PUBLIC_*; move this
// behind the Express server (or a deployed API) before any public release.
import { AnalysisResult, analyzeOutfit as mockAnalyze } from './data';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are outft.'s style DNA engine. Analyze outfit photos and return ONLY a JSON object with no markdown, no preamble, just raw JSON:
{"aesthetics":[{"label":"...","pct":0}],"tags":["..."],"insight":"..."}
- aesthetics: top 4 aesthetic categories summing to 100. Labels from: Quiet luxury, Old money, Scandi, Coastal, Eclectic, Minimalist, Athleisure, Bold, Vintage, Classic
- tags: 4-6 concise style descriptors (e.g. "neutral palette", "wide leg", "structured")
- insight: one sentence max 16 words about the dominant aesthetic quality`;

export interface AnalyzeInput {
  uri: string;
  base64?: string | null;
  mediaType?: string;
}

export async function analyzeOutfitReal(input: AnalyzeInput): Promise<AnalysisResult> {
  if (!API_KEY || !input.base64) {
    return mockAnalyze(input.uri);
  }
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 700,
        system: SYSTEM_PROMPT,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: input.mediaType ?? 'image/jpeg',
                data: input.base64,
              },
            },
            { type: 'text', text: 'Analyze the style DNA of this outfit.' },
          ],
        }],
      }),
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const message = await res.json();
    const raw: string = message.content?.[0]?.text ?? '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('unexpected format');
    const result = JSON.parse(match[0]) as AnalysisResult;
    if (!Array.isArray(result.aesthetics) || !Array.isArray(result.tags) || typeof result.insight !== 'string') {
      throw new Error('incomplete result');
    }
    return result;
  } catch (e) {
    console.warn('analyze failed, using mock:', e);
    return mockAnalyze(input.uri);
  }
}
