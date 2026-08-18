/**
 * analyze-image — Edge Function (Deno). Stateless, synchronous outfit analysis.
 *
 * This is the app's equivalent of the marketing site's /api/analyze route:
 * POST an image, get the analysis straight back. No auth, no storage upload,
 * no job queue, no polling.
 *
 * Why it exists: the app's only real analysis path used to be
 * upload -> insert outfit -> queue analysis_job -> poll for a worker to pick
 * it up. Every one of those steps had to succeed before the user saw
 * anything, so a signed-out user (or any failure along the way) silently got
 * CameraScreen's canned demo analysis instead. The website never had that
 * problem precisely because it does the simple thing. This gives the app the
 * same simple thing.
 *
 * The queued pipeline (analyze-outfit + the RPCs) is still the path of record
 * for signed-in users: it persists an immutable style_analyses row and feeds
 * Style DNA. This endpoint is for showing the user their result immediately,
 * and for the guest/demo case where there is nothing to persist to.
 *
 * Runs with verify_jwt disabled so guest captures work, mirroring the
 * website's already-public /api/analyze. Requests are size-capped and the
 * model is pinned; ANTHROPIC_API_KEY stays server-side either way.
 *
 * Request:  POST { imageBase64: string, mediaType?: string }
 * Response: { insight, aesthetics: [{label, pct}], tags: [] }   (AnalysisResult)
 */

const MODEL = Deno.env.get('ANALYSIS_MODEL') || 'claude-sonnet-5';
const ALLOWED_MEDIA = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
const MAX_BASE64 = 12_000_000;

const AESTHETIC_TAXONOMY = [
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
  'Cyberpunk'
];
const AESTHETIC_SET = new Set(AESTHETIC_TAXONOMY);
const AESTHETIC_LOWER = new Map(AESTHETIC_TAXONOMY.map((l) => [l.toLowerCase(), l]));

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const SYSTEM = `You are OUTFT's style analysis engine. Analyze the outfit photo and return ONLY a raw JSON object — no markdown fences, no preamble:
{"aesthetics":[{"label":"...","pct":0}],"tags":["..."],"insight":"..."}

- aesthetics: the top 4 aesthetics for this outfit, verbatim (exact spelling and case) from the taxonomy below, with integer percentages summing to exactly 100.

  HOW TO CHOOSE — the step most likely to go wrong, so follow it exactly:
  1. Ground every label in concrete visual evidence in THIS photo — the specific garments, colors, silhouette and styling you can actually see — never a vague overall impression like "looks put-together" or "looks casual".
  2. Search narrow before you search broad. The taxonomy is grouped into 26 families so you can scan a FULL family for a precise match before settling on a generic one. These are broad umbrella labels that superficially fit almost any outfit: Eclectic, Classic, Coastal cool, Streetwear, Minimalist, Business casual, Romantic, Understated, Preppy, Vintage prep. They are not banned, but they are LAST RESORTS — before choosing one, scan the other labels in its family and adjacent families and ask "is there a more specific label that actually matches what I see?" A relaxed outfit near water is "Coastal cool" only if nothing narrower fits — check "Nautical", "California casual", "Mediterranean", "Coastal grandmother", "Coastal cowgirl", "Surf girl" first. A mixed-pattern outfit is "Eclectic" only after ruling out "Print mixing", "Color blocking", "Maximalist", "Art hoe", "Thriftcore". An expensive-looking neutral outfit is "Quiet luxury" only after ruling out "Stealth wealth", "Old money", "Minimalist", "Classic minimalist".
  3. Do not respond to uncertainty by picking a vaguer, safer-sounding label.
  4. A genuinely plain outfit may legitimately be "Minimalist" — accuracy, not novelty. But most real outfits carry specific signals (a silhouette, a color story, a cultural reference, an occasion) that map to one of the hundreds of specific labels below.

  Your top 4 need not come from the same family.

Aesthetic taxonomy, by family (label — definition):
LUXURY / HIGH FASHION:
  Quiet luxury — Unlogoed, expensive-quality basics — cashmere, fine wool, subtle tailoring — that signal wealth through fabric and fit, not branding.
  Old money — Inherited-wealth dressing rooted in decades-old heritage brands, tweed, boat shoes, and understated tailoring rather than trends.
  New money — Visibly expensive, brand-forward looks — logos, flashy jewelry, latest designer drops — worn to signal recently acquired wealth.
  Stealth wealth — Deliberately plain, unbranded pieces whose cost is only recognizable to insiders who know the maker or fabric.
  Power dressing — Sharp-shouldered blazers, structured suiting, and commanding silhouettes worn to project authority in professional settings.
  Haute couture — One-of-a-kind, hand-constructed garments built to exact measurements, showcasing extreme craftsmanship over everyday wearability.
  Designer logomania — Head-to-toe monogram or logo-print pieces from a single luxury house, maximizing visible branding.
  Italian luxury — Rich leather, bold tailoring, sun-warmed color, and confident glamour associated with Milan's fashion houses.
  French chic — Effortless, unfussy Parisian dressing — trench coats, striped tees, tailored basics worn with deliberate nonchalance.
  Paris street — High-fashion pieces styled down for the sidewalk — designer outerwear over casual basics, seen outside Paris fashion week shows.
  Milan sleek — Polished, body-conscious Italian tailoring with rich leather and confident, glossy finishing.
  Archive fashion — Rare, out-of-production designer pieces sourced from past runway seasons and worn as collectible statement items.
  Fashion week — Editorial, photo-ready outfits — bold silhouettes and statement accessories — dressed for being seen outside shows.
  Editorial — Dramatic, magazine-shoot styling with striking proportions and color, built for the camera over everyday wear.
  Avant garde — Experimental, rule-breaking silhouettes that prioritize artistic concept over conventional fit or wearability.
  Conceptual fashion — Garments built around an idea or narrative, often abstract in shape and intended to provoke thought.
  Deconstructed — Garments left with raw seams, exposed linings, or asymmetric cuts that expose their own construction.
  Asymmetric — Silhouettes with deliberately uneven hemlines, necklines, or closures that break bodily symmetry.
  Sculptural — Structured, architectural shapes — exaggerated volume or rigid forms — that hold form independent of the body.
  Couture gown — Elaborate, floor-length eveningwear with dramatic construction, built for formal or red-carpet occasions.
CLEAN / MINIMAL:
  Minimalist — Pared-back silhouettes in a restrained palette, valuing clean lines and the absence of ornamentation.
  Classic minimalist — Timeless, simply cut staples — straight trousers, crisp shirting — with no trend-driven detailing.
  Scandi — Nordic-inflected minimalism — soft neutrals, relaxed tailoring, and functional layering with a cool, understated palette.
  Danish cool — Effortless Copenhagen-style layering mixing oversized basics with one considered statement piece.
  Normcore — Deliberately unremarkable, mainstream basics — plain jeans, sneakers, logo-free tees — worn without irony.
  Clean girl — Slicked hair, minimal makeup, and simple fitted basics in neutral tones for a polished, low-effort look.
  Vanilla girl — Soft cream and beige tones, cozy knitwear, and delicate gold jewelry for a gentle, sun-kissed aesthetic.
  Classic — Enduring, non-trend-driven pieces — button-downs, trench coats, tailored trousers — that read as timelessly appropriate.
  Timeless — Silhouettes and fabrics chosen specifically to resist dating, favoring longevity over seasonal trends.
  Understated — Deliberately low-key styling that avoids drawing attention through color, logo, or silhouette.
  Monochrome — A full outfit built from a single color across different tones and textures.
  Tonal dressing — Layered pieces in closely related shades of one color family for a cohesive, blended look.
  All black — An entirely black outfit, valued for its graphic, slimming, and effortlessly coordinated effect.
  All white — An entirely white or off-white outfit prized for crisp, clean visual impact.
  Neutral palette — Beige, cream, taupe, and grey pieces combined for a calm, versatile base wardrobe.
  Capsule wardrobe — A small set of interchangeable, coordinating basics designed to mix into many outfits.
  Effortless chic — Casually thrown-together looking pieces that are in fact carefully selected for quality and fit.
  Undone elegance — Polished garments worn slightly loose or rumpled — untucked shirt, half-done buttons — for relaxed refinement.
  Quiet cool — Understated, confident dressing that reads stylish without any single attention-grabbing element.
  Raw edge minimal — Spare silhouettes finished with unhemmed or raw-cut edges for subtle textural interest.
PREPPY / CLASSIC AMERICAN:
  Preppy — Polo shirts, cable knits, and pleated skirts drawing on East Coast prep school uniforms.
  East coast prep — Boat shoes, quilted vests, and collared shirts associated with New England private schools.
  Ivy league — Tweed jackets, oxford shirts, and campus-classic tailoring rooted in mid-century collegiate style.
  Old school prep — Traditional blazer-and-tie preppy dressing without modern streetwear crossover.
  WASP aesthetic — Understated, heritage-brand preppy dressing signaling old Anglo-American upper-class taste.
  Country club — Polished golf- and tennis-adjacent leisurewear — polos, pleated shorts — worn for country club settings.
  Tennis core — Pleated tennis skirts, polos, and crisp white sportswear inspired by on-court style.
  Lacrosse casual — Athletic shorts, team pullovers, and sporty prep pieces tied to lacrosse team culture.
  Varsity — Letterman jackets and team-branded pieces referencing high school and college athletics.
  Letterman — A varsity jacket-centered look, paired with jeans and sneakers for a classic American campus feel.
  Rowing aesthetic — Quarter-zips, team singlets, and boat shoes drawing on collegiate crew culture.
  Sailing — Striped breton tops, deck shoes, and navy-and-white nautical pieces for on-the-water style.
  Equestrian — Riding boots, fitted blazers, and jodhpur-inspired trousers referencing horseback riding attire.
  Polo — Collared polo shirts paired with chinos or shorts for a clean, sport-casual base.
  Rugby stripe — Bold horizontal-striped rugby shirts paired with casual bottoms.
  Madras — Plaid madras-cotton shirts and shorts in bright, summery colorways.
  Nantucket red — Faded salmon-pink trousers or shorts paired with navy or white, a New England summer signature.
  New England casual — Relaxed layering of quilted vests, flannel, and duck boots for coastal Northeast weather.
  Coastal grandmother — Breezy linen, oversized cardigans, and neutral tones evoking a relaxed seaside older-generation wardrobe.
  Hamptons — Breezy white linen and pastel resort-prep pieces for affluent Long Island summer style.
STREETWEAR / URBAN:
  Streetwear — Graphic tees, sneakers, and casual layering rooted in skate and hip-hop culture.
  Hypebeast — Limited-drop sneakers and hyped streetwear brands worn to signal insider trend knowledge.
  Sneakerhead — An outfit built around a standout, collectible sneaker as the focal piece.
  Techwear — Technical, weatherproof fabrics in black with utility straps and pockets for a futurist-functional look.
  Gorpcore — Hiking and outdoor-gear brands worn as everyday fashion rather than for actual trail use.
  Utilitarian — Multi-pocket, functional garments — cargo pants, work jackets — prioritizing storage and durability.
  Cargo — Pants or shorts defined by large stitched-on utility pockets along the legs.
  Workwear — Durable canvas and denim pieces derived from manual-labor uniforms — coveralls, chore coats.
  NY street — Layered basics with a standout sneaker or outerwear piece, reflecting New York's mix of prep and street.
  LA street — Relaxed, sun-worn streetwear mixing vintage tees, denim, and skate influence.
  London street — Dark, tailored streetwear blending sportswear with sharp British tailoring references.
  Tokyo street — Boldly layered, detail-heavy streetwear mixing Japanese designer pieces with vintage Americana.
  Paris street casual — Designer streetwear pieces styled down with sneakers for daily Parisian wear.
  Chicago casual — Heavy layering of hoodies, puffers, and denim suited to Midwest cold-weather streetwear.
  ATL street — Flashy, brand-forward streetwear with bold color tied to Atlanta hip-hop style.
  Miami street — Bright colors, fitted basics, and warm-weather streetwear reflecting Miami's club and heat culture.
  Skater — Loose graphic tees, baggy pants, and skate shoes built for board sports and its culture.
  Longboarder — Relaxed, beach-adjacent skate style with looser fits than street skateboarding.
  BMX — Fitted athletic streetwear with reinforced knees suited to bike-trick culture.
  Graffiti culture — Paint-marked or graffiti-print pieces referencing street art and writer culture.
  Underground — Raw, DIY-leaning streetwear outside mainstream hype brands.
  Off duty model — Casual basics — oversized coat, sunglasses, sneakers — evoking a model's between-shows look.
  Model off duty — A near-identical read to off duty model — effortless, camera-ready casual dressing.
  Airport fit — Comfortable-but-put-together travel dressing — joggers or leggings with a structured coat.
  Travel casual — Easy, breathable layering chosen for comfort across long transit days.
SPORTY / ATHLETIC:
  Athleisure — Performance fabrics like leggings and sneakers worn as everyday outfits rather than for exercise.
  Gymwear — Fitted performance tops and leggings or shorts specifically for training sessions.
  Running aesthetic — Lightweight, moisture-wicking layers and running shoes built for pace and breathability.
  Pilates girl — Matching sculpted leggings-and-bra sets paired with a light zip-up, associated with studio Pilates culture.
  Yoga casual — Soft, stretchy layers — bike shorts, wrap tops — for yoga practice and errands after.
  Cyclist — Fitted jerseys and padded shorts built for aerodynamics on a bike.
  Swimmer casual — Swimsuit paired with an easy cover-up or joggers for pool- or beach-adjacent downtime.
  Soccer casual — Team jerseys or track jackets paired with joggers, tied to football-fan culture.
  Basketball casual — Jerseys, shorts, and high-top sneakers referencing basketball courtside style.
  Golf casual — Polos, lightweight trousers, and visors in a clean, country-club-adjacent sporty palette.
  Ski chalet — Cozy knitwear and shearling worn indoors at a mountain lodge after skiing.
  Apres ski — Puffer jackets, snow boots, and knitwear for socializing at a resort post-slopes.
  Surf — Board shorts, rash guards, and salt-worn casuals tied to surf culture.
  Wakeboard — Athletic swim and board shorts built for watersport movement.
  Outdoorsy active — Performance fleece and hiking layers worn for active time outside.
  Hiker — Trail boots, technical layers, and a backpack built for walking rough terrain.
  Climber — Stretch-fabric layers and a harness-ready fit suited to rock climbing.
  Lux sport — High-end athletic fabrics elevated with designer branding and polished tailoring.
  Sporty chic — Athletic pieces like track pants or sneakers styled with more polished basics.
  Sport luxe — Premium sportswear fabrics cut in elevated, fashion-forward silhouettes.
  Blokecore — Vintage football (soccer) jerseys paired with jeans and casual sneakers, football-fan-inspired.
  Football casual — Terrace-inspired sportswear brands paired with jeans, tied to UK football fan culture.
  Terrace wear — Classic sportswear brand jackets and polos historically worn by football terrace crowds.
COASTAL / NATURE:
  Beach casual — Swimwear, shorts, and sandals for a relaxed day at the beach.
  Island girl — Bright tropical prints, sarongs, and sun-warmed tones for island vacation style.
  Tropical — Bold palm or floral prints in saturated color for warm-climate dressing.
  Surf girl — Bikini tops, denim shorts, and salt-tousled surf-adjacent beach style.
  Ocean aesthetic — Blue-and-white palettes and flowing fabrics evoking open water.
  Mermaidcore — Iridescent, scaled textures and sea-green and blue tones for a fantastical ocean look.
  Nautical — Navy and white stripes, anchor motifs, and sailor-inspired tailoring.
  Maritime — Utility-driven navy pieces referencing ship-worker and boating uniforms.
  Coastal cool — Relaxed linen and faded denim in a breezy, sun-bleached beach-town palette.
  California casual — Laid-back denim, tees, and sneakers with an easy West Coast sensibility.
  Santa Barbara — Polished coastal-California pieces — linen, espadrilles — with understated wealth.
  Malibu — Sun-bleached, relaxed beachwear with a high-end Southern California edge.
  Mediterranean — Linen shirting, espadrilles, and sun-faded neutrals evoking southern European coastlines.
  Greek island — White linen and cobalt-blue accents referencing whitewashed island architecture.
  Amalfi coast — Citrus-print linen and relaxed tailoring evoking Italy's southern coast.
  Tulum — Boho-beach linen and woven textures tied to Mexican coastal resort style.
  Bali — Flowy woven fabrics and rattan-adjacent accessories tied to Indonesian resort style.
  Nature girl — Earthy tones, floral prints, and flowing fabrics evoking time spent outdoors.
  Outdoorsy — Practical layers — fleece, hiking boots — worn for general time in nature.
  Camping chic — Flannel, utility vests, and boots styled for a stylish take on campsite dressing.
  Cottagecore — Puff-sleeve dresses, floral prints, and handmade-feeling pieces evoking rural cottage life.
  Farmcore — Overalls, plaid, and sturdy workwear referencing farm labor and rural life.
  Prairie — Long floral dresses with high necks and puffed sleeves referencing pioneer-era clothing.
  Western — Fringe, denim, and cowboy boots drawing on American ranch and rodeo style.
  Cowboy — Cowboy hat, boots, and denim built around ranch-hand western dressing.
  Cowgirl — Fringed skirts, boots, and a hat for a feminine take on western style.
  Country — Plaid shirts, denim, and boots for a rural, small-town American look.
  Southern belle — Soft florals and feminine silhouettes evoking genteel American South style.
  Rancher — Durable denim and utility jackets suited to actual ranch labor.
  Desert aesthetic — Sun-bleached earth tones and flowing layers suited to arid landscapes.
  Southwestern — Turquoise accents, suede fringe, and Native-inspired prints tied to the American Southwest.
  Boho western — Flowing boho silhouettes layered with cowboy boots and fringe for a mixed western-bohemian look.
FEMININE / ROMANTIC:
  Coquette — Bows, lace, and pastel pinks styled for a hyper-feminine, flirtatious look.
  Balletcore — Wrap tops, leg warmers, and satin ribbon detailing referencing ballet rehearsal wear.
  Soft girl — Pastel colors, plaid skirts, and cute accessories for a sweet, youthful look.
  Princesscore — Tulle, corseted bodices, and tiara-adjacent accessories evoking fairy-tale royalty.
  Fairycore — Sheer fabrics, floral crowns, and woodland tones evoking a whimsical forest fairy.
  Angelcore — White flowing fabrics, feathers, and halo-adjacent accessories for an ethereal angelic look.
  Ethereal — Sheer, flowing fabrics in soft light tones for a dreamlike, weightless effect.
  Dreamy — Soft pastel colors and flowing silhouettes evoking a hazy, romantic mood.
  Whimsical — Playful, storybook-like details — unusual prints, puffed sleeves — for a fanciful look.
  Romantic — Ruffles, florals, and soft fabrics for a classically feminine, sentimental look.
  Dark romance — Black lace, velvet, and Victorian-inflected silhouettes for a moody romantic look.
  Regencycore — Empire-waist gowns and gloves referencing Jane Austen-era Regency fashion.
  Royalcore — Regal fabrics like velvet and brocade with tiara-adjacent styling for a monarchic look.
  Cottagecore romantic — Puff-sleeve floral dresses styled with an emphasis on soft romance over rural utility.
  Floral feminine — Botanical print dresses and soft silhouettes for classic feminine dressing.
  Lace and ribbon — Delicate lace trims and ribbon ties as the defining decorative element.
  Bow aesthetic — Prominent bow details on hair, tops, or shoes as the outfit's focal point.
  Vintage feminine — Tea-length dresses and gloves referencing mid-century feminine silhouettes.
  Old Hollywood glam — Bias-cut satin gowns and finger-waved styling evoking 1930s-40s film stars.
  Pin-up — Fitted high-waisted dresses and victory rolls referencing 1940s-50s pin-up illustration style.
  Bombshell — Curve-hugging, glamorous silhouettes designed for maximum va-va-voom impact.
  Femme fatale — Sultry black tailoring and red lips evoking a classic film-noir seductress.
  Burlesque — Corsets, feathers, and fishnets referencing stage burlesque performance costuming.
  Cabaret — Sequined, theatrical eveningwear evoking cabaret stage performance.
  Showgirl — Feathered, rhinestone-heavy costuming built for maximum stage sparkle.
DARK / ALTERNATIVE:
  Goth — All-black clothing, dark makeup, and dramatic silhouettes rooted in gothic subculture.
  Gothic — Victorian-inflected dark tailoring, lace, and black as the defining palette.
  Dark academia — Tweed blazers, dark plaid, and vintage-scholarly pieces evoking old European libraries.
  Grunge — Flannel, ripped denim, and combat boots referencing 90s Seattle grunge music scenes.
  Punk — Studded leather, safety pins, and DIY-altered pieces rooted in punk rock rebellion.
  Soft punk — Punk staples like plaid and boots softened with pastel colors or feminine cuts.
  Pop punk — Skinny jeans, band tees, and studded belts tied to 2000s pop-punk music culture.
  Cyber goth — Neon accents, PVC, and platform boots layered over classic gothic black.
  Industrial — Utilitarian black clothing with hardware detailing evoking industrial and EBM music scenes.
  Witchcore — Flowing black layers, pentacle jewelry, and moon motifs evoking witchcraft aesthetics.
  Witchy academic — Dark academic tailoring layered with witchcore mysticism and occult jewelry.
  Occult — Symbolic jewelry and dark ritualistic motifs referencing esoteric or occult practice.
  Victorian goth — High-necked black lace and corsetry referencing 19th-century mourning dress.
  Edwardian goth — Structured, high-collared dark tailoring referencing early 20th-century silhouettes.
  Romantic goth — Flowing black lace and velvet softened with romantic, poetic detailing.
  Pastel goth — Gothic silhouettes — fishnets, crosses — rendered in soft pastel colors instead of black.
  Nu goth — Minimal, modern gothic dressing in matte black with clean, understated cuts.
  Whimsigoth — Flowing gothic layers mixed with witchy, boho, and celestial motifs.
  Cryptidcore — Eerie, folklore-inspired pieces referencing cryptids and unexplained creatures.
  Weirdcore — Deliberately uncanny, mismatched pieces evoking unsettling internet-nostalgia visuals.
  Dreamcore — Hazy, surreal styling referencing the disorienting visual logic of dreams.
  Traumacore — Raw, unsettling styling referencing themes of distress and vulnerability.
  Dariacore — Chaotic, ironic 90s-2000s mashup styling referencing internet meme-collage culture.
  Grunge lite — Softened grunge staples — flannel, boots — without the full distressed edge.
  Edgy minimalist — Minimalist black basics sharpened with hardware or asymmetric detailing.
  Dark minimalist — An all-black, stripped-back palette with minimalist silhouettes and no color.
  Shadow — Deep monochrome black-on-black layering with minimal visible texture contrast.
RETRO / VINTAGE:
  Y2K — Low-rise jeans, baby tees, and metallic accents referencing late 90s-early 2000s fashion.
  90s — Slip dresses, mom jeans, and grunge-adjacent basics referencing 1990s style.
  80s — Bold shoulders, neon color, and statement accessories referencing 1980s maximalism.
  70s boho — Flowing fringe, suede, and earth tones referencing 1970s bohemian style.
  70s disco — Metallic fabrics and flared silhouettes referencing 1970s disco club culture.
  60s mod — Mini skirts, bold geometric prints, and clean lines referencing 1960s mod style.
  50s housewife — Fitted bodices and full skirts referencing 1950s domestic feminine dress.
  50s rockabilly — Polka dots, cat-eye glasses, and full skirts referencing 1950s rockabilly culture.
  40s wartime — Structured shoulders and practical tailoring referencing 1940s wartime rationing style.
  30s glamour — Bias-cut satin gowns referencing 1930s Hollywood glamour.
  20s flapper — Fringe, drop-waist dresses, and beading referencing 1920s flapper style.
  Disco — Sequins and flared silhouettes built for dancing under club lights.
  Glam rock — Platform boots and metallic, androgynous glamour referencing 1970s glam rock.
  Hair metal — Leather, spandex, and big-hair-era styling referencing 1980s hair metal bands.
  New wave — Angular silhouettes and bold color referencing 1980s new wave music style.
  Post punk — Stark black minimalism referencing late-70s post-punk music aesthetics.
  Mod revival — Slim mod-era tailoring reinterpreted with a modern cut.
  Teddy boy — Drape jackets and drainpipe trousers referencing 1950s British teddy boy style.
  Greaser — Leather jackets and slicked hair referencing 1950s greaser subculture.
  Psychedelic — Swirling, saturated prints referencing 1960s-70s psychedelic art and music.
  Hippie — Flowing tie-dye and fringe referencing 1960s-70s counterculture dress.
  Flower child — Floral crowns and loose peasant blouses referencing 1960s flower-power style.
  Free love era — Loose, unstructured layers referencing 1960s counterculture ideals.
  Thriftcore — Mismatched secondhand pieces worn together for an eclectic, budget-conscious look.
  Vintage prep — Genuinely aged preppy pieces sourced secondhand rather than newly made.
  Archive hunting — Rare vintage or past-season designer pieces sourced specifically for collecting.
  Deadstock — Never-worn vintage clothing with original tags, prized for pristine condition.
  Retro sporty — Vintage-cut tracksuits and sneakers referencing past decades of sportswear design.
CREATIVE / ARTSY:
  Art hoe — Paint-splattered pieces and beret-adjacent accessories evoking a creative, art-student persona.
  Eclectic — A deliberate mix of clashing patterns, eras, and styles combined into one look.
  Maximalist — Layered patterns, colors, and accessories piled on for maximum visual density.
  Color blocking — Solid blocks of contrasting colors placed deliberately against each other.
  Print mixing — Multiple distinct patterns combined within a single outfit.
  Pattern clash — Intentionally jarring pattern combinations for bold visual friction.
  Dopamine dressing — Bright, saturated colors chosen specifically to boost mood.
  Joy dressing — Playful, colorful pieces chosen for how they make the wearer feel.
  Camp — Deliberately theatrical, exaggerated style that celebrates artifice and excess.
  Kitsch — Tacky-on-purpose, novelty-driven pieces embraced for ironic charm.
  Pop art — Bold graphic prints and primary colors referencing pop-art visual language.
  Surrealist fashion — Dreamlike, illogical silhouettes referencing surrealist art.
  Dadaist — Absurdist, collage-like combinations referencing Dada art's rejection of convention.
  Bauhaus — Geometric shapes and primary colors referencing Bauhaus design principles.
  Abstract — Non-representational prints and asymmetric shapes for an artistic, form-first look.
  Artist aesthetic — Paint-marked overalls and loose layers evoking a working studio artist.
  Painter — Splattered or utility overalls specifically referencing a painter's studio wear.
  Ceramicist — Earthy, clay-toned aprons and simple layers evoking a pottery studio.
  Gallery girl — Sleek all-black minimalism suited to working or attending art gallery openings.
  Museum aesthetic — Quiet, structured neutrals suited to a day spent in museums.
ACADEMIC:
  Light academia — Cream and beige tones with airy, soft scholarly styling — a lighter counterpart to dark academia.
  Academia — General scholarly-inspired dressing — blazers, knits, loafers — without committing to dark or light academia specifically.
  Oxford aesthetic — Formal collegiate tailoring referencing Oxford University's traditional academic dress.
  Cambridge aesthetic — Formal collegiate tailoring referencing Cambridge University's traditional academic dress.
  Bookish — Cardigans, glasses, and cozy layers evoking someone perpetually reading.
  Literary — Vintage-inspired, text-and-book-referencing pieces evoking a writer's or reader's persona.
  Philosopher — Heavy wool coats and turtlenecks evoking contemplative, old-world academic thought.
  Professor — Elbow-patch blazers and corduroy referencing a classic university lecturer's wardrobe.
  Student aesthetic — Practical backpack-and-layers dressing suited to daily campus life.
  Scholastic — Uniform-inspired pleated skirts and knee socks referencing school dress codes.
  Classic academic — Traditional blazer-and-tie scholarly dressing without heavy stylization.
  Science nerd — Practical, function-first layering with a slightly geeky, lab-adjacent sensibility.
  Math aesthetic — Understated, logic-driven minimal dressing with a quietly nerdy sensibility.
  Art student — Paint-marked layers and thrifted eclecticism evoking an art-school wardrobe.
  Film student — Vintage band tees and utility jackets evoking an indie film-school persona.
  Theater kid — Expressive, character-driven layering evoking backstage theater energy.
  Music student — Band tees or formal concert black depending on genre, evoking a conservatory student.
  Architecture student — Structured black basics and technical bags evoking an architecture studio uniform.
  Law school — Sharp, formal blazer-and-slacks dressing evoking law school and moot court.
JAPANESE SUBCULTURES:
  Gyaru — Tanned skin, bleached hair, and glam heavy makeup-adjacent styling from Japanese gyaru subculture.
  Kogal — Loose socks, mini skirts, and school-uniform-inspired pieces from 1990s Japanese kogal style.
  Lolita — Victorian-doll-inspired dresses with petticoats, lace, and bonnets from Japanese Lolita fashion.
  Sweet Lolita — Pastel Lolita dressing with candy and bow motifs for a cute, childlike sweetness.
  Gothic Lolita — Black lace Lolita dressing combining doll-like silhouettes with gothic darkness.
  Classic Lolita — Muted, refined Lolita dressing inspired by antique European dolls and paintings.
  Punk Lolita — Lolita silhouettes roughened with plaid, safety pins, and punk hardware.
  Sailor Lolita — Lolita dressing styled with nautical stripes and sailor-collar details.
  Wa Lolita — Lolita silhouettes fused with traditional Japanese kimono elements.
  Mori girl — Loose, layered natural-fiber clothing evoking a woodland-forest dweller.
  Visual kei — Dramatic, androgynous glam styling referencing Japanese visual-kei rock musicians.
  Decora — Maximalist, colorful accessory-piled looks from Japanese Decora street style.
  Fairy kei — Pastel, toy-and-candy-motif dressing referencing 1980s-toy-inspired Japanese street style.
  Gyaru-o — The male counterpart to gyaru — tanned skin and flashy, bleached-hair glam styling.
  Harajuku — Boldly experimental, mixed-subculture street style from Tokyo's Harajuku district.
  Shibuya casual — Trend-driven, polished Tokyo street style from the Shibuya shopping district.
  Ura-Harajuku — Underground, designer-streetwear-driven style from Harajuku's back streets.
  Kigurumi — Full-body animal-shaped onesie costuming worn as everyday loungewear.
  Dolly kei — Layered, antique European folk-costume-inspired Japanese street style.
  Cult party kei — Dreamy, mismatched vintage-doll styling from Japanese cult party kei subculture.
  Larme kei — Girlish pastel styling mixing kawaii cuteness with a hint of gyaru glam.
  Jirai kei — Dark, sweet-but-unsettling pastel-and-black Japanese street style ("landmine style").
  Yami kawaii — Cute pastel pieces paired with unsettling medical or dark motifs ("sick-cute").
  Kawaii — Cute, pastel, and playful pieces centered on an overall adorable effect.
  Super kawaii — Maximalist kawaii styling with piled-on cute accessories and bright color.
  Pastel kawaii — Soft pastel-toned cute dressing without heavy accessory layering.
  Dark kawaii — Cute silhouettes rendered in black or unsettling motifs instead of pastels.
KOREAN:
  K-fashion — Clean, trend-forward Korean street style mixing minimalism with playful accents.
  K-indie — Understated, artsy Korean style favoring muted tones and relaxed silhouettes.
  K-pop idol — Polished, stage-ready styling referencing Korean pop idol performance looks.
  Soft Seoul — Gentle pastel-and-neutral Korean street style with soft, rounded silhouettes.
  K-street — Bold, layered Korean streetwear mixing oversized fits with statement accessories.
  Ulzzang — Polished, doll-like Korean beauty-adjacent styling emphasizing a flawless, cute look.
  Hanbok fusion — Traditional Korean hanbok elements reworked into modern silhouettes.
  Korean minimal — Clean-lined, muted Korean streetwear with minimal branding.
  Seoul casual — Everyday relaxed Korean street style mixing basics with one trend piece.
  Hongdae street — Youthful, trend-driven street style from Seoul's Hongdae district.
  Sinchon style — University-adjacent casual Korean street style from the Sinchon district.
  Korean office — Polished, feminine-tailored workwear typical of Korean corporate dress codes.
  K-beauty adjacent — Dewy, minimal styling that centers glowing skin over elaborate clothing.
CHINESE:
  C-fashion — Trend-forward Chinese street style blending Western streetwear with local design.
  Hanfu — Traditional flowing Han-Chinese robes with wide sleeves and sashes.
  Tang aesthetic — Rich, structured robes referencing Tang dynasty Chinese fashion.
  Modern hanfu — Traditional hanfu silhouettes reworked with contemporary fabrics and cuts.
  Chinese streetwear — Bold graphic streetwear blending Chinese cultural motifs with global street style.
  Shanghai chic — Polished, cosmopolitan Chinese city style mixing East and West influences.
  Beijing casual — Relaxed, layered everyday Chinese street style.
  C-pop idol — Polished, stage-ready styling referencing Chinese pop idol performance looks.
SOUTH ASIAN:
  Indo-fusion — Traditional South Asian silhouettes reworked with Western cuts and fabrics.
  Modern kurta — Contemporary, streamlined kurtas paired with modern bottoms.
  Saree contemporary — Traditional sarees styled with modern blouses or draping techniques.
  Desi street — South Asian street style mixing traditional prints with global streetwear.
  Bollywood glam — Sequined, dramatic eveningwear referencing Bollywood film glamour.
  South Asian bridal — Heavily embellished, richly colored garments for South Asian wedding ceremonies.
  Indo-western — Traditional South Asian garments deliberately paired with Western pieces.
AFRICAN / AFRODIASPORA:
  Afrocentric — Bold African prints and silhouettes celebrating African cultural heritage.
  Afrofuturist — African motifs reimagined with futuristic, sci-fi-inflected silhouettes and materials.
  Lagos street — Bold, trend-forward Nigerian street style mixing prints with global fashion.
  Nairobi cool — Relaxed, print-mixed East African street style.
  African print — Vibrant wax-print or Ankara-style patterned fabric as the outfit's centerpiece.
  Ankara fashion — Garments made from bold Ankara wax-print fabric in structured Western silhouettes.
  Kente inspired — Garments referencing Ghanaian kente cloth's bold woven geometric patterns.
  West African glamour — Richly embellished, structured garments for formal West African occasions.
  East African minimal — Understated, clean-lined East African style with subtle print accents.
  Afropunk — Punk styling fused with bold African prints and Afrocentric identity.
  Diaspora chic — Global Black-diaspora style blending heritage prints with contemporary streetwear.
LATIN / LATINX:
  Latin street — Bold, fitted streetwear reflecting Latin American urban style.
  Miami Cuban — Bright, body-conscious, sun-ready style tied to Miami's Cuban-American community.
  Colombian chic — Polished, curve-conscious tailoring typical of Colombian fashion sensibility.
  Brazilian beach — Tiny, vibrant swimwear and sarongs tied to Brazilian beach culture.
  Mexican folk inspired — Embroidered textiles and bold color referencing traditional Mexican folk dress.
  Tejano — Western-influenced Tex-Mex style mixing cowboy boots with vibrant prints.
  Reggaeton glam — Flashy, body-conscious club-ready style tied to reggaeton music culture.
  Latin minimalist — Clean, fitted basics with a Latin-American sensibility for silhouette and color.
  Barrio chic — Streetwear rooted in Latino neighborhood culture — fitted tees, gold jewelry, crisp sneakers.
MIDDLE EASTERN:
  Gulf chic — Luxurious, structured abayas and gowns typical of Gulf-region formal style.
  Dubai glam — Opulent, statement-heavy eveningwear associated with Dubai's luxury social scene.
  Modern abaya — Streamlined, contemporary-cut abayas in updated fabrics and silhouettes.
  Modest fashion — Fully covering, loose-fitting garments designed around modesty principles.
  Levant street — Trend-forward streetwear from the Levant region blending Western and local style.
  Persian elegant — Rich fabrics and refined tailoring referencing Persian formal dress traditions.
  Arabic streetwear — Calligraphy or regional-motif graphic streetwear blending Arab identity with global street style.
INTERNET / DIGITAL NATIVE:
  Seapunk — Neon aqua tones and 90s internet-graphic motifs referencing early-2010s seapunk microtrend.
  Vaporwave — Pastel-and-neon retro-digital aesthetic referencing glitchy 80s-90s computer graphics.
  Cybercore — Metallic, tech-inspired pieces evoking a digital or cyberspace persona.
  Webcore — Nostalgic early-internet graphics and Y2K-adjacent digital motifs on clothing.
  Glitchcore — Distorted, glitch-print graphics referencing digital visual errors.
  Internetcore — General early-internet-nostalgia styling mixing Y2K, webcore, and meme references.
  Tumblr era — Grunge-and-pastel mashup styling referencing mid-2010s Tumblr aesthetic culture.
  Twitter aesthetic — Ironic, meme-referencing casual pieces tied to Twitter/X internet humor culture.
  TikTok fashion — Trend-of-the-moment pieces popularized rapidly through TikTok virality.
  Instagram aesthetic — Curated, photogenic outfits chosen specifically for how they read in a feed grid.
  Pinterest board — Aspirational, mood-board-coordinated outfits assembled to match a curated color story.
  Bloggercore — Polished, outfit-of-the-day styling associated with 2010s fashion blogger culture.
  VSCO girl — Scrunchies, oversized tees, and shell jewelry referencing 2019 VSCO-girl internet trend.
  E-girl — Dark eyeliner, plaid, and chain accessories referencing internet e-girl alt style.
  E-boy — Layered chains, ripped jeans, and skater-adjacent pieces referencing internet e-boy alt style.
  Softie — Pastel, plush, and cute internet-alt styling softer than e-girl's darker edge.
  Alt TikTok — Grunge-and-alt mashup styling associated with TikTok's alternative-culture side.
  Cottagecore internet — Cottagecore's floral rural aesthetic as expressed through online mood-board culture.
SUBCULTURE SPECIFIC:
  Raver — Bright, futuristic pieces — mesh, holographic fabric — built for all-night dancing.
  Club kid — Maximalist, theatrical club-scene styling built to stand out on a dance floor.
  Rave aesthetic — Neon, reflective, and body-baring pieces suited to rave environments.
  Festival — Boho-meets-bold pieces — fringe, denim shorts, sunglasses — for outdoor music festivals.
  Burning Man — Desert-ready, maximalist costume-adjacent pieces built for Burning Man's playa environment.
  Underground club — Dark, minimal club-ready pieces suited to underground techno scenes.
  Drag inspired — Exaggerated, theatrical glamour referencing drag performance styling.
  Ballroom — Extravagant, category-specific costuming referencing ballroom voguing culture.
  Vogue aesthetic — Sharp, editorial-glamour styling referencing voguing and ballroom runway categories.
  Biker — Leather jackets and heavy boots referencing motorcycle-riding culture.
  Motorcycle — Protective leather and reinforced denim built for actual motorcycle riding.
  Heavy metal — Black band tees, leather, and studs referencing metal music culture.
  Rock — Leather jackets and band tees referencing general rock music culture.
  Indie rock — Skinny jeans and vintage band tees referencing 2000s indie rock scenes.
  Folk — Earthy, handmade-feeling layers referencing folk music culture.
  Jazz aesthetic — Sharp, vintage-inflected tailoring referencing jazz club culture.
  Blues aesthetic — Worn denim and understated soulful styling referencing blues music culture.
  Classical music — Formal, refined concert black referencing orchestral performance dress.
  Opera glam — Floor-length gowns and formal tailoring for attending the opera.
  Choir casual — Coordinated, modest group-friendly basics suited to choir rehearsal.
OCCUPATION / LIFESTYLE:
  Office siren — Body-conscious, sharply tailored office wear with a seductive, confident edge.
  Corporate baddie — Sleek, figure-fitting suiting worn with bold confidence in corporate settings.
  Business casual — Relaxed blazers and chinos suited to a non-formal office dress code.
  Smart casual — Polished-but-relaxed pieces — blazer with jeans — between casual and formal.
  Business formal — Full matching suiting for the most formal professional settings.
  Creative professional — Polished but expressive workwear suited to creative-industry offices.
  Tech bro — Casual hoodie-and-sneaker uniform associated with tech-industry workers.
  Silicon Valley casual — Minimal, function-first basics — fleece vest, sneakers — typical of tech campuses.
  Startup casual — Relaxed, unstructured basics suited to informal startup office culture.
  Freelancer chic — Comfortable-but-presentable pieces suited to remote or cafe-based independent work.
  Barista aesthetic — Apron-ready basics — denim, canvas — suited to coffee-shop service work.
  Chef casual — Practical, easy-clean basics suited to kitchen work outside chef whites.
  Artist studio — Paint-safe, loose layers suited to working in a studio environment.
  Yoga instructor — Polished performance leggings and wraps suited to teaching a yoga class.
  Personal trainer — Durable, mobile athletic wear suited to coaching clients through workouts.
  Nurse off duty — Comfortable, easy-care basics worn by nurses outside their scrubs.
  Teacher aesthetic — Practical, approachable basics — cardigans, flats — suited to classroom teaching.
  Librarian — Cardigans, glasses, and quiet, bookish tailoring evoking library work.
  Architect — Structured all-black basics with a design-forward, minimalist sensibility.
  Interior designer — Polished, texture-conscious layering reflecting a design-trained eye for detail.
OCCASION:
  Date night — Polished, flattering pieces chosen specifically to impress on a romantic date.
  Night out — Statement pieces — going-out top, heels — dressed for evening socializing.
  Brunch fit — Relaxed-but-put-together daytime pieces suited to a weekend brunch outing.
  Vacation mode — Easy, breathable pieces packed and worn specifically for travel and leisure.
  Resort wear — Polished vacation pieces — linen sets, kaftans — for upscale resort settings.
  Cruise wear — Breezy, easy-care pieces suited to on-ship cruise vacationing.
  Wedding guest — Formal-but-not-overshadowing pieces chosen specifically for attending a wedding.
  Black tie — Formal gowns or tuxedo-level suiting for the most formal evening events.
  Cocktail — Knee-length dressy pieces suited to semi-formal evening cocktail parties.
  Garden party — Floral, breathable dressy pieces suited to outdoor daytime formal events.
  Baby shower — Soft, pastel-toned dressy-casual pieces suited to a baby shower.
  Birthday fit — A standout, celebratory outfit chosen specifically to mark one's own birthday.
  Festival fit — Bold, layerable pieces built for a day at an outdoor music festival.
  Concert fit — Statement pieces — band tee, boots — dressed for attending a concert.
  Museum day — Comfortable, quietly polished pieces suited to a day of walking museum galleries.
  Gallery opening — Sleek, art-crowd-appropriate pieces suited to an evening gallery opening.
  Farmers market — Casual, sun-ready basics suited to a relaxed weekend market outing.
  Coffee run — A thrown-on, minimal-effort outfit for a quick errand to get coffee.
  Errand fit — Comfortable, practical basics with no particular styling effort, for daily errands.
  Lazy day chic — Loungewear elevated just enough to still look intentional.
SITUATIONAL MICRO:
  Tomato girl summer — Red-and-white striped, sun-ripened Mediterranean-inspired summer dressing.
  Mob wife — Fur coats, gold jewelry, and glamorous excess referencing a 1980s-90s mafia-wife persona.
  Quiet outdoor — Understated, neutral-toned pieces for time spent calmly outside.
  Libertine — Loose, unstructured layers worn with a free-spirited, unbothered attitude.
  Cleanfit — A crisp, freshly-pressed, no-wrinkle look emphasizing tidiness.
  Vanilla girl summer — Cream and beige summer pieces continuing the vanilla girl palette into warm weather.
  That girl — Aspirational, put-together wellness-adjacent basics associated with an idealized productive lifestyle.
  Lucky girl — Bright, confident pieces worn with an optimistic, manifestation-adjacent attitude.
  Latte girl — Cozy neutral-toned layers evoking a cafe-going, coffee-in-hand persona.
  Espresso girl — Rich brown and cream tones referencing the espresso-girl coffee-adjacent color trend.
  Coastal cowgirl — Western boots and fringe softened with breezy beach-toned fabrics.
  Cowboy core — Denim, fringe, and cowboy boots as the full defining silhouette of an outfit.
  Mermaid summer — Iridescent, sea-toned pieces worn specifically for summer mermaidcore styling.
  Ballet flats era — An outfit built around ballet flats as the defining, trend-driven footwear choice.
  Loafer girl — An outfit built around loafers as the defining, polished footwear choice.
  Sneaker girl — An outfit built around a standout sneaker as the defining footwear choice.
  Boot season — Layered autumn/winter dressing built around boots as the seasonal footwear centerpiece.
  Trench coat era — An outfit built around a trench coat as the defining outerwear statement.
  Leather jacket girl — An outfit built around a leather jacket as the defining outerwear statement.
  Blazer girl — An outfit built around a blazer worn as a styled, everyday statement piece.
SCENE / EMO ERA:
  Scene — Bright-colored skinny jeans and teased, multicolor hair-adjacent styling from mid-2000s scene subculture.
  Emo — Black skinny jeans, band tees, and side-swept styling from 2000s emo subculture.
  Screamo — Emo staples intensified with heavier band merch and darker styling.
  Scene queen — Maximalist scene styling with bold hair color, bows, and layered accessories.
  Mall goth — Hot Topic-sourced black basics — fishnets, studded belts — for a mainstream-goth mall look.
  Hot topic era — Band merch and accessory-heavy pieces referencing 2000s Hot Topic mall-goth shopping culture.
  Myspace era — Flash-photographed, scene/emo-adjacent styling referencing mid-2000s Myspace photo culture.
  Raccoon eyes — Heavy black eyeliner as the defining beauty signature of an emo/scene look.
  Checkered pattern — Black-and-white checkerboard print as the outfit's defining graphic element.
  Band tee culture — An outfit built around a band tee as its defining, identity-signaling piece.
TWEE / INDIE:
  Twee — Whimsical, doily-and-cardigan preciousness referencing 2000s-2010s twee indie style.
  Hipster — Ironic thrifted pieces, thick-framed glasses, and skinny jeans from 2010s hipster culture.
  Indie — Vintage-thrifted basics with a deliberately uncommercial, understated sensibility.
  Indie sleaze — Messy, party-worn 2000s-2010s indie styling — smudged makeup, skinny jeans, flash photos.
  Indie film — Vintage cardigans and understated basics evoking an indie-movie character's wardrobe.
  Wes Anderson aesthetic — Symmetrical, saturated-color vintage tailoring referencing Wes Anderson's film costuming.
  Sundance — Relaxed, artsy-outdoorsy layering evoking indie film festival attendee style.
  Folk indie — Earthy, handmade-feeling layers referencing folk-influenced indie music style.
  Bedroom pop — Soft, lo-fi cozy basics referencing bedroom-pop musician aesthetics.
  Shoegaze aesthetic — Hazy, oversized layering in muted tones referencing shoegaze music's dreamy sound.
MISCELLANEOUS NICHE:
  Knightcore — Armor-inspired structured pieces referencing medieval knight silhouettes.
  Medievalcore — Flowing tunics and laced bodices referencing medieval-era dress.
  Renaissancecore — Rich brocade and structured sleeves referencing Renaissance-era fashion.
  Baroque — Ornate, heavily embellished garments referencing Baroque-era opulence.
  Rococo — Pastel, frilly, heavily ornamented pieces referencing Rococo-era French excess.
  Victorianna — High-necked, corseted silhouettes referencing Victorian-era formal dress.
  Edwardian — Structured, high-collared tailoring referencing early 20th-century Edwardian dress.
  Art nouveau — Flowing, organic-line silhouettes referencing Art Nouveau's natural motifs.
  Art deco — Geometric, metallic-accented pieces referencing 1920s-30s Art Deco design.
  Futurist — Sleek, structured silhouettes in metallic or synthetic fabrics evoking a forward-looking future.
  Space age — Metallic, geometric 1960s-inspired pieces referencing space-race-era futurism.
  Retrofuturism — Futuristic silhouettes styled with a nostalgic, past-imagined-future sensibility.
  Solarpunk — Bright, plant-motif pieces evoking an optimistic green-future aesthetic.
  Lunarpunk — Dark, celestial-toned pieces evoking a mystical nighttime counterpart to solarpunk.
  Steampunk — Brass hardware, corsets, and Victorian-industrial mashup styling.
  Dieselpunk — Utilitarian, WWII-industrial-inspired pieces with a retro-mechanical edge.
  Atompunk — Retro-futuristic 1950s atomic-age styling with clean, optimistic lines.
  Biopunk — Organic, biomechanical-looking textures evoking a synthetic-biology futurism.
  Cyberpunk — Neon-accented technical black pieces evoking a dystopian high-tech-low-life future.

- tags: 4-6 concise lowercase descriptors of silhouette, texture, palette, or construction (e.g. "neutral palette", "wide leg", "structured"). Describe the CLOTHES ONLY.

- insight: exactly one sentence, max 140 characters, plain text, about the outfit's dominant aesthetic quality. Warm, editorial, specific. Describe the OUTFIT, never the wearer's body, worth, or attractiveness.

If the image shows no discernible outfit (a landscape, an object, a screenshot, text), say so truthfully in "insight" and give your best-effort reading rather than inventing detail.

Never comment on attractiveness, body shape/size, the wearer's wealth, gender conformity, age, ethnicity, or any protected attribute.

Respond with the JSON object only.`;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'content-type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD_NOT_ALLOWED' }, 405);

  let body: { imageBase64?: unknown; mediaType?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'invalid request' }, 400); }

  const imageBase64 = body.imageBase64;
  const mediaType = typeof body.mediaType === 'string' ? body.mediaType : 'image/jpeg';
  if (!imageBase64 || typeof imageBase64 !== 'string') return json({ error: 'imageBase64 required' }, 400);
  if (!ALLOWED_MEDIA.has(mediaType)) return json({ error: 'Unsupported image type' }, 400);
  if (imageBase64.length > MAX_BASE64) return json({ error: 'Image is too large' }, 413);

  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) return json({ error: 'ANTHROPIC_API_KEY not set' }, 500);

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1000,
        system: SYSTEM,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
          { type: 'text', text: 'Analyze the style DNA of this outfit.' },
        ]}],
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      console.error('[analyze-image] provider error', res.status, data?.error?.message);
      const detail = data?.error?.message || '';
      return json({ error: detail ? 'We could not analyze this outfit: ' + detail : 'We could not analyze this outfit. Please try again.' }, res.status);
    }

    const text = (data?.content ?? []).find((c: any) => c?.type === 'text')?.text ?? '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return json({ error: 'The style analysis was incomplete. Please try again.' }, 502);
    const raw = JSON.parse(match[0]);

    // Map to canonical taxonomy labels; drop anything unrecognized so the UI
    // can never render an off-taxonomy label like the old "Bold".
    const seen = new Set<string>();
    const aesthetics: { label: string; pct: number }[] = [];
    for (const a of Array.isArray(raw?.aesthetics) ? raw.aesthetics : []) {
      const rawLabel = String(a?.label ?? '').trim();
      const label = AESTHETIC_SET.has(rawLabel) ? rawLabel : AESTHETIC_LOWER.get(rawLabel.toLowerCase());
      const pct = Math.round(Number(a?.pct));
      if (!label || seen.has(label) || !isFinite(pct) || pct <= 0) continue;
      seen.add(label);
      aesthetics.push({ label, pct });
    }
    if (aesthetics.length === 0) return json({ error: 'The style analysis was incomplete. Please try again.' }, 502);

    // Normalize to exactly 100 so the UI bars always add up.
    aesthetics.sort((a, b) => b.pct - a.pct);
    aesthetics.splice(4);
    const total = aesthetics.reduce((s, a) => s + a.pct, 0);
    let running = 0;
    aesthetics.forEach((a, i) => {
      if (i === aesthetics.length - 1) a.pct = 100 - running;
      else { a.pct = Math.round((a.pct / total) * 100); running += a.pct; }
    });

    const tags = (Array.isArray(raw?.tags) ? raw.tags : [])
      .map((t: unknown) => String(t).trim().toLowerCase().slice(0, 30))
      .filter(Boolean).slice(0, 6);
    const insight = String(raw?.insight ?? '').trim().replace(/[\r\n]+/g, ' ').slice(0, 140)
      || 'Your style trace is ready.';

    return json({ insight, aesthetics, tags });
  } catch (err) {
    console.error('[analyze-image] failed', err);
    return json({ error: 'We could not analyze this outfit. Please try again.' }, 500);
  }
});
