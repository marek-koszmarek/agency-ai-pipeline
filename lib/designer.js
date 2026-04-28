// ================================================================
// GRAPHIC DESIGNER AGENT
// Generuje obrazy przez Imagen 4 API
// Komponuje logo + tekst + format przez Sharp
// ================================================================

// ── Visual direction extractor ────────────────────────────────────
// Converts creative concept / brief into a clean visual prompt
// Strips all brief boilerplate so it doesn't render as text on image

export function extractVisualDirection(rawConcept) {
  if (!rawConcept) return "";

  // Strip brief boilerplate lines that would render as text on image
  const stripPatterns = [
    /^Marka:.*$/gim,
    /^Produkt.*?:.*$/gim,
    /^Cel.*?:.*$/gim,
    /^Grupa.*?:.*$/gim,
    /^Budżet.*?:.*$/gim,
    /^Rynek.*?:.*$/gim,
    /^Target.*?:.*$/gim,
    /^KPI.*?:.*$/gim,
    /^Brief.*?:.*$/gim,
    /^---.*?---/gim,
    /^\*\*\d+\./gim,
  ];

  let cleaned = rawConcept;
  for (const p of stripPatterns) {
    cleaned = cleaned.replace(p, "");
  }

  // Extract key visual signals: brand name, mood words, colors mentioned
  const lines = cleaned.split("\n").filter(l => l.trim().length > 10);

  // Take max 300 chars of meaningful content
  const meaningful = lines
    .filter(l => !l.match(/^(Marka|Produkt|Cel|Budżet|Rynek|Brief|Target|KPI)/i))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 300);

  return meaningful;
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

  return "Create a world-class advertising background image. Reference quality: Cannes Lions Grand Prix, D&AD Black Pencil, Effie Award-winning campaigns." +
    "\n\nBRAND VISUAL DIRECTION: " + brandHint +
    "\n\nART DIRECTION STYLE: " + style +
    (postHint) +
    "\n\nCOLOR DIRECTION: " + colorStr +
    "\n\nTECHNICAL REQUIREMENTS:" +
    "\n- Keep " + logoCorner + " corner area completely clear and uncluttered (logo will be composited here — minimum 22% of image width)" +
    "\n- " + textInstruction +
    "\n- ABSOLUTE RULE: ZERO text, letters, numbers, words, or typography anywhere in the image. Not even partial text on objects." +
    "\n- ABSOLUTE RULE: ZERO watermarks, signatures, UI elements, frames, or artificial borders." +
    "\n- ABSOLUTE RULE: ZERO obvious AI artifacts, uncanny valley faces, anatomically incorrect elements." +
    "\n- Professional advertising quality. This image will appear in Vogue Poland, Elle, or Forbes as a full-page ad." +
    "\n- Square crop (1:1 aspect ratio). Composition should work when center-cropped to 4:5 and 9:16 as well." +
    "\n\nOUTPUT: Single clean advertising background image. Photography or high-quality illustration. Compositing-ready.";
}

// ── Gemini Image API call ─────────────────────────────────────────
export async function generateImageWithGemini(prompt, apiKey) {
  const model = "imagen-4.0-fast-generate-001";
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
