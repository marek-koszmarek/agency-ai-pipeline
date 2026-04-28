import { generateImageWithGemini, FORMATS, getLogoPosition, getTextY } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// ── Scrape brand website ──────────────────────────────────────────
async function scrapeBrandWebsite(url) {
  if (!url || !url.startsWith("http")) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return "";
    const html = await res.text();

    // Extract meaningful text: remove scripts, styles, nav, footer
    const cleaned = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, "")
      .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, "")
      .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 3000);

    return cleaned;
  } catch {
    return "";
  }
}

// ── Claude writes proper visual brief ────────────────────────────
async function generateVisualBrief(concept, postContent, brandUrl, websiteContent, userDirection, feedbackNotes, apiKey) {
  const client = new Anthropic({ apiKey });

  const contextParts = [
    concept ? `BRAND/PRODUCT INFO:\n${concept.slice(0, 1000)}` : "",
    websiteContent ? `BRAND WEBSITE CONTENT:\n${websiteContent.slice(0, 1500)}` : "",
    postContent ? `POST THEME:\n${postContent.slice(0, 300)}` : "",
    userDirection ? `USER VISUAL DIRECTION:\n${userDirection}` : "",
    feedbackNotes ? `REVISION FEEDBACK:\n${feedbackNotes}` : "",
  ].filter(Boolean).join("\n\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 500,
    messages: [{
      role: "user",
      content: `You are a senior art director at a top advertising agency. Write an image generation prompt for Imagen 4 Ultra (Google's best AI image model).

IMPORTANT CONSTRAINTS:
- Imagen 4 cannot render specific branded products it hasn't seen — so describe ATMOSPHERE, LIFESTYLE, MOOD, SCENE that fits the brand
- The prompt must result in a background image a designer will composite the real product onto
- Be extremely specific about: lighting, composition, color palette, photography style, mood, setting
- Reference real photographers or visual styles (e.g. "shot by Annie Leibovitz", "Kinfolk magazine editorial", "Wallpaper* magazine aesthetic")
- NO text, logos, labels, or brand names in the scene

BRAND CONTEXT:
${contextParts}

Based on the brand context, write ONE precise image prompt (90-130 words) describing a SCENE that perfectly matches this brand's world. Think: where do the brand's customers use this product? What emotion does it evoke? What time of day, what setting, what materials, what light?

Write ONLY the prompt text, no explanation.`
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

        // Step 1: Scrape brand website
        let websiteContent = "";
        if (brandUrl) {
          send({ status: "scraping", message: `Skanuję stronę ${brandUrl}...` });
          websiteContent = await scrapeBrandWebsite(brandUrl);
        }

        // Step 2: Claude writes visual brief
        send({ status: "thinking", message: "Roman pisze brief wizualny dla Imagen..." });

        let visualPrompt;
        try {
          visualPrompt = await generateVisualBrief(
            concept, postContent, brandUrl, websiteContent,
            visualDirection, feedbackNotes, ANTHROPIC_API_KEY
          );
        } catch (e) {
          // Fallback: basic prompt
          visualPrompt = `Professional lifestyle advertising photograph. ${visualDirection || "Clean, modern aesthetic"}. Natural light, premium quality. No text or logos.`;
        }

        // Send brief to client so user can see it
        send({ status: "brief_ready", brief: visualPrompt });

        // Step 3: Build final Imagen prompt
        const colorStr = brandColors.length
          ? ` Use color palette: ${brandColors.join(", ")}.`
          : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");
        const textBand = textOnImage?.trim()
          ? ` Reserve a clean band at the ${logoPosition.startsWith("top") ? "bottom" : "top"} of the frame (15% height) with subtle dark overlay for text overlay.`
          : "";

        const finalPrompt =
          `IMPORTANT: ZERO text, letters, numbers, or words anywhere in the image. Pure visual only.\n\n` +
          `${visualPrompt}${colorStr}${textBand} ` +
          `Keep the ${logoCorner} corner area clear and uncluttered for logo placement. ` +
          `Square 1:1 composition. No watermarks, no UI elements.`;

        send({ status: "generating", message: "Generuję 2 warianty w Imagen 4 Ultra..." });

        const variants = [];
        for (let i = 0; i < 2; i++) {
          const iterPrompt = i === 0
            ? finalPrompt
            : finalPrompt + " Alternative angle, different depth of field and light direction.";

          const imageBase64 = await generateImageWithGemini(iterPrompt, GOOGLE_API_KEY);
          const imageBuffer = Buffer.from(imageBase64, "base64");

          const formatResults = {};
          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;

            const composites = [];

            // Only add text overlay SVG when text is actually provided
            if (textOnImage?.trim()) {
              let fontFaceCSS = "";
              if (fontBase64) {
                fontFaceCSS = `@font-face { font-family: 'BrandFont'; src: url('data:font/truetype;base64,${fontBase64}'); }`;
              }
              const fontFamily = fontBase64 ? "BrandFont" : "Arial, Helvetica, sans-serif";
              const textY = getTextY(logoPosition, fmt.h);
              const fontSize = Math.floor(fmt.w * 0.05);
              const safeText = textOnImage
                .replace(/&/g, "&amp;").replace(/</g, "&lt;")
                .replace(/>/g, "&gt;").replace(/"/g, "&quot;");

              composites.push({
                input: Buffer.from(
                  `<svg width="${fmt.w}" height="${fmt.h}" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <style>${fontFaceCSS}</style>
                      <filter id="sh"><feDropShadow dx="0" dy="2" stdDeviation="5" flood-opacity="0.5"/></filter>
                    </defs>
                    <rect x="40" y="${textY - fontSize - 14}" width="${fmt.w - 80}" height="${fontSize + 32}"
                      fill="black" fill-opacity="0.38" rx="8"/>
                    <text x="${fmt.w / 2}" y="${textY}"
                      font-family="${fontFamily}" font-size="${fontSize}" font-weight="600"
                      fill="white" text-anchor="middle" filter="url(#sh)">${safeText}</text>
                  </svg>`
                ),
                top: 0, left: 0,
              });
            }

            // Add logo
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
