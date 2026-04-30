import { generateImageWithGemini, FORMATS, getLogoPosition, getTextY } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";

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
              const fontFamily = fontBase64 ? "BrandFont" : "Arial, Helvetica, sans-serif";
              const fontFaceCSS = fontBase64
                ? `@font-face { font-family: 'BrandFont'; src: url('data:font/truetype;base64,${fontBase64}'); }`
                : "";
              const textY = getTextY(logoPosition, fmt.h);
              const fontSize = Math.floor(fmt.w * 0.052);
              const safeText = textOnImage
                .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

              const svgOverlay = `<svg width="${fmt.w}" height="${fmt.h}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <style>${fontFaceCSS}</style>
                  <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-opacity="0.55"/></filter>
                </defs>
                <rect x="0" y="${textY - fontSize - 20}" width="${fmt.w}" height="${fontSize + 48}"
                  fill="black" fill-opacity="0.42" rx="0"/>
                <text x="${fmt.w / 2}" y="${textY + 4}"
                  font-family="${fontFamily}" font-size="${fontSize}" font-weight="700"
                  fill="white" text-anchor="middle" filter="url(#sh)">${safeText}</text>
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
