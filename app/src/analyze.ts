// Real Style DNA analysis — calls Claude vision directly, mirroring the
// prompt in outft-dna/server.js. Falls back to the local mock if the key
// is missing or the request fails, so the app always completes the flow.
// NOTE: the key ships inside this test build via EXPO_PUBLIC_*; move this
// behind the Express server (or a deployed API) before any public release.
import { AnalysisResult, analyzeOutfit as mockAnalyze } from './data';

const API_KEY = process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY;

const SYSTEM_PROMPT = `You are outft.'s style DNA engine. Analyze outfit photos and return ONLY a JSON object with no markdown, no preamble, just raw JSON:
{"aesthetics":[{"label":"...","pct":0}],"tags":["..."],"insight":"..."}
- aesthetics: top 4 aesthetic categories summing to 100, chosen verbatim from this taxonomy (478 labels grouped into families below; your top 4 need not share a family):
LUXURY / HIGH FASHION: Quiet luxury, Old money, New money, Stealth wealth, Power dressing, Haute couture, Designer logomania, Italian luxury, French chic, Paris street, Milan sleek, Archive fashion, Fashion week, Editorial, Avant garde, Conceptual fashion, Deconstructed, Asymmetric, Sculptural, Couture gown
CLEAN / MINIMAL: Minimalist, Classic minimalist, Scandi, Danish cool, Normcore, Clean girl, Vanilla girl, Classic, Timeless, Understated, Monochrome, Tonal dressing, All black, All white, Neutral palette, Capsule wardrobe, Effortless chic, Undone elegance, Quiet cool, Raw edge minimal
PREPPY / CLASSIC AMERICAN: Preppy, East coast prep, Ivy league, Old school prep, WASP aesthetic, Country club, Tennis core, Lacrosse casual, Varsity, Letterman, Rowing aesthetic, Sailing, Equestrian, Polo, Rugby stripe, Madras, Nantucket red, New England casual, Coastal grandmother, Hamptons
STREETWEAR / URBAN: Streetwear, Hypebeast, Sneakerhead, Techwear, Gorpcore, Utilitarian, Cargo, Workwear, NY street, LA street, London street, Tokyo street, Paris street casual, Chicago casual, ATL street, Miami street, Skater, Longboarder, BMX, Graffiti culture, Underground, Off duty model, Model off duty, Airport fit, Travel casual
SPORTY / ATHLETIC: Athleisure, Gymwear, Running aesthetic, Pilates girl, Yoga casual, Cyclist, Swimmer casual, Soccer casual, Basketball casual, Golf casual, Ski chalet, Apres ski, Surf, Wakeboard, Outdoorsy active, Hiker, Climber, Lux sport, Sporty chic, Sport luxe, Blokecore, Football casual, Terrace wear
COASTAL / NATURE: Beach casual, Island girl, Tropical, Surf girl, Ocean aesthetic, Mermaidcore, Nautical, Maritime, Coastal cool, California casual, Santa Barbara, Malibu, Mediterranean, Greek island, Amalfi coast, Tulum, Bali, Nature girl, Outdoorsy, Camping chic, Cottagecore, Farmcore, Prairie, Western, Cowboy, Cowgirl, Country, Southern belle, Rancher, Desert aesthetic, Southwestern, Boho western
FEMININE / ROMANTIC: Coquette, Balletcore, Soft girl, Princesscore, Fairycore, Angelcore, Ethereal, Dreamy, Whimsical, Romantic, Dark romance, Regencycore, Royalcore, Cottagecore romantic, Floral feminine, Lace and ribbon, Bow aesthetic, Vintage feminine, Old Hollywood glam, Pin-up, Bombshell, Femme fatale, Burlesque, Cabaret, Showgirl
DARK / ALTERNATIVE: Goth, Gothic, Dark academia, Grunge, Punk, Soft punk, Pop punk, Cyber goth, Industrial, Witchcore, Witchy academic, Occult, Victorian goth, Edwardian goth, Romantic goth, Pastel goth, Nu goth, Whimsigoth, Cryptidcore, Weirdcore, Dreamcore, Traumacore, Dariacore, Grunge lite, Edgy minimalist, Dark minimalist, Shadow
RETRO / VINTAGE: Y2K, 90s, 80s, 70s boho, 70s disco, 60s mod, 50s housewife, 50s rockabilly, 40s wartime, 30s glamour, 20s flapper, Disco, Glam rock, Hair metal, New wave, Post punk, Mod revival, Teddy boy, Greaser, Psychedelic, Hippie, Flower child, Free love era, Thriftcore, Vintage prep, Archive hunting, Deadstock, Retro sporty
CREATIVE / ARTSY: Art hoe, Eclectic, Maximalist, Color blocking, Print mixing, Pattern clash, Dopamine dressing, Joy dressing, Camp, Kitsch, Pop art, Surrealist fashion, Dadaist, Bauhaus, Abstract, Artist aesthetic, Painter, Ceramicist, Gallery girl, Museum aesthetic
ACADEMIC: Light academia, Academia, Oxford aesthetic, Cambridge aesthetic, Bookish, Literary, Philosopher, Professor, Student aesthetic, Scholastic, Classic academic, Science nerd, Math aesthetic, Art student, Film student, Theater kid, Music student, Architecture student, Law school
JAPANESE SUBCULTURES: Gyaru, Kogal, Lolita, Sweet Lolita, Gothic Lolita, Classic Lolita, Punk Lolita, Sailor Lolita, Wa Lolita, Mori girl, Visual kei, Decora, Fairy kei, Gyaru-o, Harajuku, Shibuya casual, Ura-Harajuku, Kigurumi, Dolly kei, Cult party kei, Larme kei, Jirai kei, Yami kawaii, Kawaii, Super kawaii, Pastel kawaii, Dark kawaii
KOREAN: K-fashion, K-indie, K-pop idol, Soft Seoul, K-street, Ulzzang, Hanbok fusion, Korean minimal, Seoul casual, Hongdae street, Sinchon style, Korean office, K-beauty adjacent
CHINESE: C-fashion, Hanfu, Tang aesthetic, Modern hanfu, Chinese streetwear, Shanghai chic, Beijing casual, C-pop idol
SOUTH ASIAN: Indo-fusion, Modern kurta, Saree contemporary, Desi street, Bollywood glam, South Asian bridal, Indo-western
AFRICAN / AFRODIASPORA: Afrocentric, Afrofuturist, Lagos street, Nairobi cool, African print, Ankara fashion, Kente inspired, West African glamour, East African minimal, Afropunk, Diaspora chic
LATIN / LATINX: Latin street, Miami Cuban, Colombian chic, Brazilian beach, Mexican folk inspired, Tejano, Reggaeton glam, Latin minimalist, Barrio chic
MIDDLE EASTERN: Gulf chic, Dubai glam, Modern abaya, Modest fashion, Levant street, Persian elegant, Arabic streetwear
INTERNET / DIGITAL NATIVE: Seapunk, Vaporwave, Cybercore, Webcore, Glitchcore, Internetcore, Tumblr era, Twitter aesthetic, TikTok fashion, Instagram aesthetic, Pinterest board, Bloggercore, VSCO girl, E-girl, E-boy, Softie, Alt TikTok, Cottagecore internet
SUBCULTURE SPECIFIC: Raver, Club kid, Rave aesthetic, Festival, Burning Man, Underground club, Drag inspired, Ballroom, Vogue aesthetic, Biker, Motorcycle, Heavy metal, Rock, Indie rock, Folk, Jazz aesthetic, Blues aesthetic, Classical music, Opera glam, Choir casual
OCCUPATION / LIFESTYLE: Office siren, Corporate baddie, Business casual, Smart casual, Business formal, Creative professional, Tech bro, Silicon Valley casual, Startup casual, Freelancer chic, Barista aesthetic, Chef casual, Artist studio, Yoga instructor, Personal trainer, Nurse off duty, Teacher aesthetic, Librarian, Architect, Interior designer
OCCASION: Date night, Night out, Brunch fit, Vacation mode, Resort wear, Cruise wear, Wedding guest, Black tie, Cocktail, Garden party, Baby shower, Birthday fit, Festival fit, Concert fit, Museum day, Gallery opening, Farmers market, Coffee run, Errand fit, Lazy day chic
SITUATIONAL MICRO: Tomato girl summer, Mob wife, Quiet outdoor, Libertine, Cleanfit, Vanilla girl summer, That girl, Lucky girl, Latte girl, Espresso girl, Coastal cowgirl, Cowboy core, Mermaid summer, Ballet flats era, Loafer girl, Sneaker girl, Boot season, Trench coat era, Leather jacket girl, Blazer girl
SCENE / EMO ERA: Scene, Emo, Screamo, Scene queen, Mall goth, Hot topic era, Myspace era, Raccoon eyes, Checkered pattern, Band tee culture
TWEE / INDIE: Twee, Hipster, Indie, Indie sleaze, Indie film, Wes Anderson aesthetic, Sundance, Folk indie, Bedroom pop, Shoegaze aesthetic
MISCELLANEOUS NICHE: Knightcore, Medievalcore, Renaissancecore, Baroque, Rococo, Victorianna, Edwardian, Art nouveau, Art deco, Futurist, Space age, Retrofuturism, Solarpunk, Lunarpunk, Steampunk, Dieselpunk, Atompunk, Biopunk, Cyberpunk
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
        model: 'claude-sonnet-5',
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
