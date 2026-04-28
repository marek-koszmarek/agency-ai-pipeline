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
  // Extract clean visual direction from the concept
  const visualContext = extractVisualDirection(concept);
  const postContext = postContent ? extractVisualDirection(postContent) : "";

  const colorStr = brandColors?.length
    ? `Use these exact brand colors as dominant palette: ${brandColors.join(", ")}`
    : "Use a sophisticated, premium color palette appropriate to the brand mood";

  // Visual styles that work well for Polish/European brands
  const visualStyles = [
    "Editorial lifestyle photography with soft natural light, clean background, product hero shot",
    "Minimalist flat lay composition, top-down angle, carefully arranged props, matte textures",
    "Abstract geometric shapes on solid dark background, bold color blocks, Swiss design influence",
    "Atmospheric lifestyle scene, cinematic lighting, aspirational mood, no visible text",
  ];
  const style = visualStyles[iteration % visualStyles.length];

  // Build the actual image generation prompt
  // Key rule: describe WHAT TO SHOW visually, not what the brief says
  const brandHint = visualContext.slice(0, 150);
  const postHint = postContext ? `Post theme: ${postContext.slice(0, 100)}. ` : "";

  return `Professional social media advertising image for a Polish brand.

VISUAL STYLE: ${style}

${postHint}BRAND CONTEXT (use for mood/atmosphere only, do NOT render as text): ${brandHint}

TECHNICAL REQUIREMENTS:
- ${colorStr}
- Leave clear empty space at ${logoPosition} corner for logo overlay (approximately 20% of image area)
- ${textOnImage ? `Leave a clean horizontal band for text "${textOnImage}" - solid color or subtle gradient area` : "No text areas needed"}
- STRICTLY NO text, letters, words, numbers anywhere in the image
- STRICTLY NO watermarks, stamps, or labels
- High resolution, professional advertising quality
- Clean, uncluttered composition
- Image will be used for Facebook/Instagram ads

OUTPUT: A beautiful visual background image ready for logo and text compositing. Pure photography or illustration only.`;
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
