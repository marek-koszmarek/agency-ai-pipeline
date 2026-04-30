import { generateImageWithGemini, FORMATS, getLogoPosition, getTextY } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// ── Scrape brand website + extract product images ─────────────────
async function scrapeBrandWebsite(url) {
  if (!url || !url.startsWith("http")) return { text: "", imageUrls: [] };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { text: "", imageUrls: [] };
    const html = await res.text();

    // Extract product image URLs from img tags
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    const baseUrl = new URL(url);
    const imageUrls = imgMatches
      .map(m => m[1])
      .filter(src => {
        const lower = src.toLowerCase();
        // Keep product-like images, skip icons/logos/placeholders
        return !lower.includes("icon") && !lower.includes("logo") &&
               !lower.includes("placeholder") && !lower.includes("sprite") &&
               !lower.includes("pixel") && !lower.includes("tracking") &&
               (lower.includes(".jpg") || lower.includes(".jpeg") ||
                lower.includes(".png") || lower.includes(".webp"));
      })
      .map(src => {
        try {
          return src.startsWith("http") ? src : new URL(src, baseUrl.origin).href;
        } catch { return null; }
      })
      .filter(Boolean)
      .slice(0, 6); // Max 6 product images

    // Extract text content
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    return { text: cleaned, imageUrls };
  } catch {
    return { text: "", imageUrls: [] };
  }
}

// ── Download product image as base64 ─────────────────────────────
async function fetchImageAsBase64(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const b64 = Buffer.from(buffer).toString("base64");
    const ct = res.headers.get("content-type") || "image/jpeg";
    return { b64, mimeType: ct.split(";")[0] };
  } catch { return null; }
}

// ── Claude writes visual brief ────────────────────────────────────
async function generateVisualBrief(concept, postContent, brandUrl, websiteContent, imageUrls, userDirection, feedbackNotes, apiKey) {
  const client = new Anthropic({ apiKey });

  const hasImages = imageUrls && imageUrls.length > 0;
  const imageContext = hasImages
    ? `\nPRODUCT IMAGES FOUND ON WEBSITE: ${imageUrls.join(", ")}\n(These are real product images from the brand's website)`
    : "";

  const contextParts = [
    concept ? `BRAND/PRODUCT INFO:\n${concept.slice(0, 800)}` : "",
    websiteContent ? `BRAND WEBSITE CONTENT:\n${websiteContent.slice(0, 1200)}` : "",
    imageContext,
    postContent ? `POST THEME:\n${postContent.slice(0, 300)}` : "",
    userDirection ? `USER VISUAL DIRECTION:\n${userDirection}` : "",
    feedbackNotes ? `REVISION FEEDBACK:\n${feedbackNotes}` : "",
  ].filter(Boolean).join("\n\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `You are a senior art director. Write an Imagen 4 Ultra image generation prompt.

CONTEXT:
${contextParts}

RULES:
- Describe a SCENE or ATMOSPHERE that fits this brand — Imagen cannot render specific branded products from URLs
- Be very specific: lighting, composition, colors, photography style, mood, materials
- Reference real photographers/styles (e.g. "Kinfolk magazine", "shot by Annie Leibovitz")
- NO text, logos, or labels in the image
- 90-130 words maximum

Write ONLY the prompt, no explanation.`
    }]
  });
  return msg.content[0].text.trim();
}

export async function POST(req) {
  const body = await req.json();
  const {
    concept = "",
    postContent = "",
    brandColors = [],
    brandUrl = "",
    logoBase64,
    fontBase64,
    textOnImage,
    logoPosition = "bottom_right",
    feedbackIteration = 0,
    feedbackNotes = "",
    visualDirection = "",
    selectedFormats = ["instagram_feed", "instagram_story", "instagram_square", "facebook_feed"],
  } = body;

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!GOOGLE_API_KEY) throw new Error("Brak GOOGLE_API_KEY");

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        const sharp = (await import("sharp")).default;
        const fs = (await import("fs")).default;
        const path = (await import("path")).default;

        // Load embedded Poppins font — deployed in public/fonts/
        // Falls back gracefully if file not found
        // Use pre-bundled Poppins Bold — guaranteed available on Vercel serverless
        const embeddedFontB64 = POPPINS_BOLD_B64;

        // Step 1: Scrape brand website + get product images
        let websiteContent = "";
        let productImageUrls = [];
        if (brandUrl) {
          send({ status: "scraping", message: `Skanuję ${brandUrl}...` });
          const scraped = await scrapeBrandWebsite(brandUrl);
          websiteContent = scraped.text;
          productImageUrls = scraped.imageUrls;
          if (productImageUrls.length > 0) {
            send({ status: "scraping", message: `Znalazłem ${productImageUrls.length} zdjęć produktów` });
          }
        }

        // Step 2: Claude writes visual brief
        send({ status: "thinking", message: "Roman pisze brief wizualny..." });
        let visualPrompt;
        try {
          visualPrompt = await generateVisualBrief(
            concept, postContent, brandUrl, websiteContent,
            productImageUrls, visualDirection, feedbackNotes, ANTHROPIC_API_KEY
          );
        } catch {
          visualPrompt = `Professional lifestyle advertising photograph. ${visualDirection || "Clean, modern aesthetic"}. Natural light, premium quality. No text or logos.`;
        }
        send({ status: "brief_ready", brief: visualPrompt });

        // Step 3: Build final Imagen prompt
        const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");
        const textBand = textOnImage?.trim()
          ? ` Reserve a clean band at ${logoPosition.startsWith("top") ? "bottom" : "top"} (15% height) with dark overlay for text.`
          : "";

        const finalPrompt =
          `STRICTLY NO text, letters, numbers or words anywhere in the image.\n\n` +
          `${visualPrompt}${colorStr}${textBand} ` +
          `Keep ${logoCorner} corner clear for logo. Square 1:1. No watermarks.`;

        send({ status: "generating", message: "Imagen 4 Ultra generuje..." });

        const variants = [];
        for (let i = 0; i < 2; i++) {
          const iterPrompt = i === 0 ? finalPrompt
            : finalPrompt + " Alternative angle, different lighting direction.";

          const imageBase64 = await generateImageWithGemini(iterPrompt, GOOGLE_API_KEY);
          const imageBuffer = Buffer.from(imageBase64, "base64");

          const formatResults = {};
          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;

            const composites = [];

            // FIX 2: Text overlay — works even WITHOUT font (uses system Arial)
            if (textOnImage?.trim()) {
              // Encode ALL chars as XML numeric entities — handles Polish and special chars on Linux
              const enc = (str) => str.split("").map(c => {
                const code = c.charCodeAt(0);
                return (code > 127 || c === "&" || c === "<" || c === ">" || c === '"') ? `&#${code};` : c;
              }).join("");

              // Use user font if provided, else embedded Poppins, else system fallback
              const activeFont = fontBase64 || embeddedFontB64;
              const fontFaceCSS = activeFont
                ? `@font-face { font-family: 'BrandFont'; src: url('data:font/truetype;base64,${activeFont}'); }`
                : "";
              const fontFamily = activeFont
                ? "BrandFont, sans-serif"
                : "DejaVu Sans, Liberation Sans, Arial, sans-serif";

              // ── DESIGN-DRIVEN TEXT LAYOUT ─────────────────────────────────
              // Based on: Ambrose+Harris hierarchy, Lupton composition principles,
              // Mahon (Art Direction), golden ratio, rule of thirds
              const words = textOnImage.trim().split(/\s+/);
              const charCount = textOnImage.trim().length;
              const W = fmt.w;
              const H = fmt.h;

              let svgContent = "";

              if (words.length <= 2 && charCount <= 20) {
                // SHORT TEXT (1-2 words): Large, centred, dominant typographic element
                // Inspired by Bottega Veneta / Loewe outdoor advertising — luxury whisper
                const fs = Math.floor(W * 0.11);
                const y = Math.floor(H * 0.618); // golden ratio from top
                svgContent = `
                  <filter id="sh"><feDropShadow dx="0" dy="3" stdDeviation="8" flood-opacity="0.45"/></filter>
                  <text x="${W/2}" y="${y}"
                    font-family="${fontFamily}" font-size="${fs}" font-weight="300"
                    letter-spacing="${Math.floor(fs * 0.18)}"
                    fill="white" text-anchor="middle" filter="url(#sh)"
                    opacity="0.95">${enc(textOnImage.trim().toUpperCase())}</text>`;

              } else if (words.length <= 5 && charCount <= 40) {
                // MEDIUM TEXT (3-5 words): Bold statement, rule of thirds placement
                // Inspired by editorial magazine art direction — confident, clean
                const fs = Math.floor(W * 0.072);
                // Rule of thirds: lower third unless logo is there
                const y = logoPosition.includes("bottom")
                  ? Math.floor(H * 0.30) // place upper third if logo is bottom
                  : Math.floor(H * 0.72); // lower third otherwise
                const overlayH = fs + 52;
                const overlayY = y - fs - 16;
                svgContent = `
                  <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="6" flood-opacity="0.5"/></filter>
                  <rect x="0" y="${overlayY}" width="${W}" height="${overlayH}"
                    fill="black" fill-opacity="0.38"/>
                  <text x="${W/2}" y="${y}"
                    font-family="${fontFamily}" font-size="${fs}" font-weight="700"
                    fill="white" text-anchor="middle" filter="url(#sh)">${enc(textOnImage.trim())}</text>`;

              } else {
                // LONG TEXT (6+ words): Split into two lines, smaller size, breathing room
                // Based on Bly/Sugarman headline principles — legibility over decoration
                const midWord = Math.ceil(words.length / 2);
                const line1 = enc(words.slice(0, midWord).join(" "));
                const line2 = enc(words.slice(midWord).join(" "));
                const fs = Math.floor(W * 0.053);
                const lineH = Math.floor(fs * 1.45);
                const blockH = lineH * 2 + 60;
                // Position: lower third, full-width band
                const bandY = logoPosition.includes("top")
                  ? Math.floor(H * 0.68)
                  : Math.floor(H * 0.72);
                svgContent = `
                  <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-opacity="0.5"/></filter>
                  <rect x="0" y="${bandY - fs - 20}" width="${W}" height="${blockH}"
                    fill="black" fill-opacity="0.44"/>
                  <text x="${W/2}" y="${bandY}"
                    font-family="${fontFamily}" font-size="${fs}" font-weight="600"
                    fill="white" text-anchor="middle" filter="url(#sh)">${line1}</text>
                  <text x="${W/2}" y="${bandY + lineH}"
                    font-family="${fontFamily}" font-size="${fs}" font-weight="400"
                    fill="white" text-anchor="middle" filter="url(#sh)" opacity="0.9">${line2}</text>`;
              }

              const svgOverlay = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
                <defs><style>${fontFaceCSS}</style></defs>
                ${svgContent}
              </svg>`;
              composites.push({ input: Buffer.from(svgOverlay), top: 0, left: 0 });
            }

            // Logo overlay
            if (logoBase64) {
              const logoBuffer = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.1);
              const resizedLogo = await sharp(logoBuffer)
                .resize(maxLogoW, maxLogoH, { fit: "inside" }).toBuffer();
              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, fmt.w, fmt.h, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            const resized = sharp(imageBuffer).resize(fmt.w, fmt.h, { fit: "cover", position: "center" });
            const finalBuffer = composites.length > 0
              ? await resized.composite(composites).png().toBuffer()
              : await resized.png().toBuffer();

            formatResults[formatKey] = finalBuffer.toString("base64");
          }

          variants.push({ variant: i + 1, formats: formatResults });
          send({ status: "variant_done", variant: i + 1, data: variants[i] });
        }

        send({ status: "done", variants, visualBrief: visualPrompt });
      } catch (err) {
        send({ status: "error", message: err.message || "Blad generowania" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
