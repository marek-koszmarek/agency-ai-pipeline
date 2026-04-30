// ================================================================
// GRAPHIC DESIGNER AGENT
// Generuje obrazy przez Imagen 4 API
// Komponuje logo + tekst + format przez Sharp
// ================================================================

// ── SKILL FILES — DESIGNER AGENT (pełna wiedza z 8 książek o designie) ──────────
// Źródła: Krause (Visual Design), Ambrose+Harris (Fundamentals of Graphic Design),
// Lupton (Graphic Design Thinking), Mahon (Art Direction), Baker (Advertising Layout),
// route1print (50 Design Tips), Heller+Anderson (Graphic Design Idea Book), Myers (Portfolio)
//
// KOMPOZYCJA I UKŁAD:
// - Hierarchia wizualna = pierwsza zasada: prowadź wzrok od najważniejszego do najmniej ważnego
// - Siatka (grid): spójność; świadome łamanie siatki = dynamika (defying the grid)
// - Złota proporcja i zasada trójpodziału = sprawdzone narzędzia kompozycji
// - Symetria = stabilność; asymetria = dynamika i nowoczesność — dobieraj świadomie
// - White space (biała przestrzeń) WZMACNIA przekaz — nie jest marnotrawieniem miejsca
// - Minimalizm: każdy element musi mieć uzasadnienie; mniej = silniejszy przekaz
// - Marginesy i kolumny = czytelność; nie oszczędzaj na przestrzeni
//
// KOLOR I TYPOGRAFIA:
// - Kolor = narzędzie strategiczne (kieruje uwagą, wywołuje emocje), NIE dekoracyjne
// - Spójna paleta barw = rozpoznawalność marki; max 3-5 kolorów w systemie
// - Typografia = głos marki w piśmie; dobierz krój do osobowości i kontekstu
// - Czytelność > ozdobność — NIGDY nie poświęcaj czytelności dla efektu wizualnego
// - Kontrast (kolor, rozmiar, waga) = podstawowe narzędzie hierarchii
// - Wielkie litery, tracking (spacing) i kerning = ton głosu typografii
//
// ART DIRECTION W REKLAMIE:
// - Uproszczenie: jedno mocne zdjęcie/obraz bije złożoną kompozycję
// - Dwuznaczność obrazu (ambiguous imagery) angażuje odbiorcę — skłania do interpretacji
// - Daj odbiorcy "coś do odkrycia" — reklama powinna nagradzać uwagę
// - Prosty, niedopowiedziany przekaz bywa silniejszy niż hałaśliwy
// - Spójny, rozpoznawalny look marki — każda kreacja = ta sama rodzina wizualna
// - Planuj storyboard przed produkcją: oszczędza czas i pieniądze
// - "Czy odbiorca rozumie przekaz w 5 sekund?" — test każdego projektu
//
// TECHNIKI I MEDIA:
// - Zdjęcie > ilustracja dla realizmu; ilustracja > zdjęcie dla abstrakcji i charakteru
// - Blur, distortion, layering, collage, paper art, motion design = budowanie nastroju
// - Ironia, pun wizualny, trompe l'oeil = angażowanie uwagi
// - Skala i perspektywa mogą dramatycznie zmienić przekaz
// - Online design: myśl o UX i dostępności (accessibility), nie tylko estetyce
// - Fotograficzna jakość: 300 DPI print; 72 DPI web (ale rozmiar pikseli się liczy)
//
// PROCES TWÓRCZY:
// - Design thinking: definiuj problem → research → brainstorm → prototyp → testuj
// - Każdy projekt zaczyna się od briefu — bez jasnego briefu nie ma dobrego projektu
// - Zbieraj inspiracje, research wizualny, brand matrix zanim zaczniesz rysować
// - Mind mapping i forced connections (łączenie niezwiązanych idei) = oryginalne koncepty
// - Prototypuj szybko i tanio zanim przejdziesz do finalnej produkcji
// - Czerp z historii designu: Bauhaus, Modernizm, Swiss Style, retro — adaptuj do dziś
//
// PRACA Z KLIENTEM:
// - Prezentuj logo zawsze w: kolorze + B&W + jednokolorowej + na kolorowym tle
// - Pokaż logo "in-situ": wizytówka, social media, billboard — klient musi to zobaczyć w kontekście
// - Ustal od początku kto zatwierdza projekt — stakeholderzy poza briefingiem → dostają notatkę
// - Autorskie korekty po zatwierdzeniu = dodatkowy koszt — ustal to z góry pisemnie
// - Nigdy Getty/Google Images bez licencji — zawsze własne prawa lub stock z licencją
//
// ROUTE1PRINT — 50 PRAKTYCZNYCH TIPÓW (skrót kluczowych):
// - Typografia = najszybsza droga do profesjonalizmu lub amatorstwa
// - Nie używaj więcej niż 2 kroje pisma w jednym projekcie (wyjątek: typograficzne projekty)
// - Alignment (wyrównanie) jest ważniejszy niż większość sądzi — wszystko do siatki
// - Zawsze pracuj w CMYK dla druku, RGB dla web
// - Proof przed drukiem: wydrukuj i sprawdź na papierze — monitor kłamie
// - Bleed i crop marks: zawsze dla projektów drukowanych (min 3mm bleed)
// - Białe tło ≠ "puste" — białe tło jest aktywnym elementem designu
//
// PORTFOLIO (dla prezentacji klientom):
// - Pokaż PROCES, nie tylko finalny efekt — klienci kupują myślenie
// - 10 mocnych prac > 30 przeciętnych — selekcja jest sztuką
// - Dostosuj portfolio do klienta/briefu do którego aplikujesz

// ── Visual direction extractor ────────────────────────────────────
// Converts creative concept / brief into a clean visual prompt
// Strips all brief boilerplate so it doesn't render as text on image

export function extractVisualDirection(rawConcept) {
  if (!rawConcept) return "";

  // Extract brand name and product type FIRST - these are critical for image relevance
  const brandMatch = rawConcept.match(/Marka:\s*(.+)/i);
  const productMatch = rawConcept.match(/Produkt(?:[^:]*)?:\s*(.+)/i);
  const brandName = brandMatch ? brandMatch[1].trim().split("\n")[0].slice(0, 40) : "";
  const productType = productMatch ? productMatch[1].trim().split("\n")[0].slice(0, 60) : "";

  // Strip boilerplate structure labels (keep the values, remove the keys)
  let cleaned = rawConcept
    .replace(/^(Marka|Produkt[^:]*|Cel[^:]*|Grupa[^:]*|Budżet|Rynek|Target|KPI|Brief)[^\n]*:\s*/gim, "")
    .replace(/^---.*---$/gim, "")
    .replace(/^\*\*\d+\./gim, "")
    .replace(/^#+\s/gim, "")
    .replace(/\*\*/g, "");

  // Take meaningful lines (skip very short ones)
  const lines = cleaned.split("\n")
    .filter(l => l.trim().length > 15)
    .slice(0, 8);

  const meaningful = lines.join(" ").replace(/\s+/g, " ").trim().slice(0, 250);

  // Prepend brand + product for image relevance
  const prefix = [brandName, productType].filter(Boolean).join(" — ");
  return prefix ? prefix + ". " + meaningful : meaningful;
}

// ── Prompt builder ─────────────────────────────────────────────────
// Creates a proper visual generation prompt for Imagen 4
// The prompt must be a visual description, NOT a marketing brief

export function buildImagePrompt({ concept, postContent, brandColors, textOnImage, logoPosition, iteration = 0 }) {
  const visualContext = extractVisualDirection(concept);
  const postContext = postContent ? extractVisualDirection(postContent) : "";

  const colorStr = brandColors && brandColors.length
    ? "Use this exact brand color palette: " + brandColors.join(", ") + ". These are non-negotiable."
    : "Choose a cohesive, premium color palette that matches the brand mood extracted from context.";

  // ── VISUAL STYLES LIBRARY ─────────────────────────────────────────
  // Based on: Cannes Lions Grand Prix winners 2022-2024, top D&AD campaigns,
  // Effie winners, and 2024-2025 visual trends from It's Nice That,
  // Depositphotos Creative Trends, The Drum visual reports.
  //
  // Cannes-winning visual references used for inspiration:
  // - Hornbach "The Square Metre" (Film Craft GP): single-space transformation, dramatic yet intimate
  // - Magnum outdoor (Outdoor Lions): finding light in unexpected moments, cinematic quality
  // - Coca-Cola "Recycle Me" (Print GP): iconic simplicity, single bold visual idea
  // - CeraVe "Michael CeraVe" (Social GP): authentic, unpolished, human-first
  // - Vaseline "Transition Body Lotion": soft intimate photography, skin texture, warmth
  // - Pedigree AI adoption (Outdoor): high-quality studio look applied to authentic subjects
  //
  // 2024-2025 visual trends incorporated:
  // - Cinematic narration (story-in-one-frame, emotional resonance)
  // - Hyperreal macro and product detail photography
  // - Monochrome high-contrast with single brand color accent
  // - Analog echoes: warm grain, diffused light, authentic imperfection
  // - Negative space maximalism: message clarity in visual noise era
  // - Flat lay editorial: luxury still life, matte surfaces, art direction
  // - Bold geometric graphic: Swiss design revival, strong color blocks
  // - Sustainability aesthetics: organic textures, natural materials, warmth

  const visualStyles = [
    // Style 0: Cinematic hero — Cannes Film Craft / Hornbach influence
    "Cinematic single-frame story. One decisive moment, dramatic side lighting from a single source, deep shadows, rich contrast. 35mm film aesthetic with slight grain. Subject matter should feel emotionally weighted. Shot as if by a Magnum Photos photojournalist commissioned for luxury advertising. Warm amber tones if no brand colors specified.",

    // Style 1: Editorial flat lay — luxury still life tradition
    "High-end editorial flat lay photography. Overhead shot, perfectly composed objects on a matte stone or linen surface. Reminiscent of Kinfolk magazine and Wallpaper* photoshoots. Extreme attention to shadow quality — soft, directional. Objects chosen for texture contrast: matte vs glossy, organic vs geometric. Color palette is restrained and deliberate. Leaves generous negative space for brand elements.",

    // Style 2: Lifestyle authenticity — CeraVe / Pedigree authentic direction
    "Authentic lifestyle moment photography. Real light, real environment, slight documentary feel. NOT stock photography aesthetic — feels genuinely candid but beautifully lit. Shallow depth of field pulling focus to the emotional core. Warm skin tones if people present. Texture and grain add authenticity. Think Nan Goldin meets commercial photography.",

    // Style 3: Graphic minimalism — Coca-Cola Recycle Me / Swiss design
    "Bold graphic design composition. Pure geometric shapes, strong color blocking, maximum negative space. Inspired by Swiss International Typographic Style and Bauhaus. Single dominant visual element against a clean ground. No gradients — flat colors with precise edges. The visual idea is simple and immediately readable at any scale. Think Sagmeister & Walsh meets Muller-Brockmann.",

    // Style 4: Hyperreal product macro — 2025 product photography trend
    "Hyperreal macro product photography. Extreme close-up revealing micro-textures, surfaces, materials. High-end post-processing: perfect color grading, HDR detail, immaculate shadows. Feels more real than reality. Inspired by luxury watch and perfume advertising. Dark or deeply saturated background makes product texture glow. Reminiscent of Nick Knight or Rankin product work.",

    // Style 5: Analog warmth — retro authenticity trend 2024-2025
    "Film photography aesthetic with analog warmth. Slightly faded colors, grain texture, diffused edges. Reminiscent of late 70s lifestyle magazines — warm amber and terracotta tones, organic compositions. Authentic human energy without perfection. Shot on medium format film quality. Inspired by advertising from Levi's and Patagonia heritage campaigns.",

    // Style 6: Negative space hero — clarity in noise era
    "Extreme negative space composition. 70-80% of the frame is clean, breathing, empty space in a single premium color. One small, perfectly lit hero subject — product or symbol — placed off-center using golden ratio. Inspired by luxury brand outdoor advertising: Loewe, The Row, Bottega Veneta. Whisper-quiet luxury aesthetic. Space IS the message.",

    // Style 7: Abstract expressionist — art direction trend
    "Abstract atmospheric image inspired by impressionist painting. Blurred planes of color, light bokeh, soft undefined edges. Feels like a Turner or Monet painting rendered photographically. Warm and cool tones in dialogue. No sharp edges — everything dissolves into atmosphere. Beautiful, emotional, non-literal. Could work as a museum-quality art print.",
  ];
  const style = visualStyles[iteration % visualStyles.length];

  const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");

  const textInstruction = textOnImage && textOnImage.trim()
    ? "Reserve a clean band (" + (logoPosition.startsWith("top") ? "bottom" : "top") + " 15% of image) with a dark semi-transparent overlay area for text compositing later."
    : "Full bleed image composition. No reserved text areas needed.";

  const postHint = postContext
    ? "\n\nTHEME TO SUPPORT VISUALLY: " + postContext.slice(0, 150)
    : "";

  const brandHint = visualContext.slice(0, 250);

  // CRITICAL: Put NO TEXT rule FIRST - Imagen respects first instructions most
  return "IMPORTANT: This image must contain absolutely NO text, NO words, NO letters, NO numbers anywhere. Pure visual only." +
    "\n\nCreate a world-class advertising background image for: " + brandHint +
    "\n\nART DIRECTION: " + style +
    (postHint) +
    "\n\nCOLOR: " + colorStr +
    "\n\nCOMPOSITION:" +
    "\n- Keep " + logoCorner + " corner clear for logo placement" +
    "\n- " + textInstruction +
    "\n- NO text, letters, numbers, watermarks, labels, or typography of any kind anywhere in the image" +
    "\n- NO UI elements, frames, borders" +
    "\n- Professional advertising quality for Vogue Poland or Forbes full-page ad" +
    "\n- Square 1:1 composition" +
    "\n\nOUTPUT: Pure visual advertising background. No text whatsoever.";
}

// ── Gemini Image API call ─────────────────────────────────────────
export async function generateImageWithGemini(prompt, apiKey) {
  const model = "imagen-4.0-ultra-generate-001";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: {
          sampleCount: 1,
          aspectRatio: "1:1",
          safetyFilterLevel: "block_few",
          personGeneration: "allow_adult",
        },
      }),
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(`Imagen API error: ${data.error.message || JSON.stringify(data.error)}`);

  const predictions = data.predictions || [];
  if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
    return predictions[0].bytesBase64Encoded;
  }
  throw new Error(`Brak obrazu w odpowiedzi Imagen. Pelna odpowiedz: ${JSON.stringify(data).slice(0, 400)}`);
}

// ── Format definitions ────────────────────────────────────────────
export const FORMATS = {
  instagram_feed:    { w: 1080, h: 1350, label: "Instagram Feed (4:5)" },
  instagram_story:   { w: 1080, h: 1920, label: "Instagram Story (9:16)" },
  instagram_square:  { w: 1080, h: 1080, label: "Instagram Square (1:1)" },
  facebook_feed:     { w: 1080, h: 1350, label: "Facebook Feed (4:5)" },
};

// ── Logo position coordinates ─────────────────────────────────────
export function getLogoPosition(position, canvasW, canvasH, logoW, logoH, margin = 60) {
  const positions = {
    center:        { x: Math.floor((canvasW - logoW) / 2), y: Math.floor((canvasH - logoH) / 2) },
    bottom_center: { x: Math.floor((canvasW - logoW) / 2), y: canvasH - logoH - margin },
    bottom_right:  { x: canvasW - logoW - margin,           y: canvasH - logoH - margin },
    bottom_left:   { x: margin,                             y: canvasH - logoH - margin },
    top_right:     { x: canvasW - logoW - margin,           y: margin },
    top_left:      { x: margin,                             y: margin },
    roman:         { x: Math.floor((canvasW - logoW) / 2), y: canvasH - logoH - margin },
  };
  return positions[position] || positions.bottom_right;
}

// ── Text Y position for SVG overlay ──────────────────────────────
export function getTextY(logoPosition, canvasH, margin = 60) {
  if (logoPosition?.startsWith("top")) return canvasH - margin - 80;
  return margin + 80;
}
