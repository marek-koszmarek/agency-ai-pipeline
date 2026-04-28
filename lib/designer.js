// ================================================================
// GRAPHIC DESIGNER AGENT
// Generuje obrazy przez Gemini Image API
// Komponuje logo + tekst + format przez Sharp
// ================================================================

// ── Prompt builder ───────────────────────────────────────────────
export function buildImagePrompt({ concept, brandColors, logoDescription, textOnImage, logoPosition, iteration = 0 }) {
  const colorStr = brandColors?.length
    ? `Brand colors (use these EXACTLY): ${brandColors.join(", ")}`
    : "Choose colors that feel premium and modern";

  const styles = [
    "Bold geometric composition with strong negative space",
    "Editorial photography-inspired layout with subtle texture",
    "Minimalist Scandinavian design aesthetic with clean typography space",
    "Dynamic diagonal composition inspired by Swiss graphic design",
  ];
  const style = styles[iteration % styles.length];

  return `Create a professional advertising visual for social media.

CREATIVE CONCEPT:
${concept}

VISUAL DIRECTION:
- Style: ${style}
- ${colorStr}
- Leave a clear area for logo placement at: ${logoPosition}
- Leave space for text overlay: "${textOnImage || "to be added"}"
- NO text in the image itself - only visual elements, shapes, photography, illustration
- NO watermarks, NO placeholder text
- Professional advertising quality, award-winning design aesthetic
- Inspired by Cannes Lions winning campaigns visual language

OUTPUT: Pure visual background ready for logo and text overlay.
Aspect ratio: square (will be cropped to required formats).`;
}

// ── Gemini Image API call ─────────────────────────────────────────
export async function generateImageWithGemini(prompt, apiKey) {
  // Try Gemini image generation
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-001:predict?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        instances: [{ prompt: prompt }],
        parameters: { sampleCount: 1, aspectRatio: "1:1" },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(`Gemini API error: ${err.error?.message || response.status}`);
  }

  const data = await response.json();
  if (data.error) throw new Error(`Imagen API error: ${data.error.message || JSON.stringify(data.error)}`);
  // Imagen 3 response format
  const predictions = data.predictions || [];
  if (predictions.length > 0 && predictions[0].bytesBase64Encoded) {
    return predictions[0].bytesBase64Encoded;
  }
  // Fallback: Gemini format
  const parts = data.candidates?.[0]?.content?.parts || [];
  const imagePart = parts.find((p) => p.inlineData);
  if (!imagePart) throw new Error(`Brak obrazu w odpowiedzi API. Response: ${JSON.stringify(data).slice(0, 200)}`);
  return imagePart.inlineData.data;
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
    center:       { x: Math.floor((canvasW - logoW) / 2), y: Math.floor((canvasH - logoH) / 2) },
    bottom_center:{ x: Math.floor((canvasW - logoW) / 2), y: canvasH - logoH - margin },
    bottom_right: { x: canvasW - logoW - margin,           y: canvasH - logoH - margin },
    bottom_left:  { x: margin,                             y: canvasH - logoH - margin },
    top_right:    { x: canvasW - logoW - margin,           y: margin },
    top_left:     { x: margin,                             y: margin },
    roman:        { x: Math.floor((canvasW - logoW) / 2), y: canvasH - logoH - margin },
  };
  return positions[position] || positions.bottom_right;
}

// ── Text position for SVG overlay ─────────────────────────────────
export function getTextY(logoPosition, canvasH, margin = 60) {
  if (logoPosition?.startsWith("top")) return canvasH - margin - 80;
  return margin + 80;
}
