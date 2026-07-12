import express from 'express';
import cors from 'cors';
import Anthropic from '@anthropic-ai/sdk';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(join(__dirname, 'public')));

app.post('/api/analyze', async (req, res) => {
  const { imageBase64, mediaType = 'image/jpeg' } = req.body;
  if (!imageBase64) return res.status(400).json({ error: 'imageBase64 required' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on server' });

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 700,
      system: `You are outft.'s style DNA engine. Analyze outfit photos and return ONLY a JSON object with no markdown, no preamble, just raw JSON:
{"aesthetics":[{"label":"...","pct":0}],"tags":["..."],"insight":"..."}
- aesthetics: top 4 aesthetic categories summing to 100. Labels from: Quiet luxury, Old money, Scandi, Coastal, Eclectic, Minimalist, Athleisure, Bold, Vintage, Classic
- tags: 4-6 concise style descriptors (e.g. "neutral palette", "wide leg", "structured")
- insight: one sentence max 16 words about the dominant aesthetic quality`,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Analyze the style DNA of this outfit.' }
        ]
      }]
    });

    const raw = message.content[0]?.text || '';
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return res.status(500).json({ error: 'Model returned unexpected format', raw });
    const result = JSON.parse(match[0]);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message || 'Analysis failed' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`outft. DNA server running on http://localhost:${PORT}`));