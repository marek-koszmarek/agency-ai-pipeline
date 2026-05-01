import { createRequire } from "module";
const _require = createRequire(import.meta.url);
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

// ── Claude adds ONLY photography style — scene comes verbatim from user ──────
// Split responsibility:
//   - User's visualDirection → goes to Imagen literally, word for word, first
//   - Claude → adds ONLY: lighting, lens, mood, color grading, photographer ref
// This guarantees Imagen sees the exact scene first and cannot ignore it.
async function generateStyleDetails(userDirection, websiteContent, concept, feedbackNotes, apiKey) {
  const client = new Anthropic({ apiKey });

  const contextHint = [
    concept ? `Brand: ${concept.slice(0, 200)}` : "",
    websiteContent ? `Site context: ${websiteContent.slice(0, 200)}` : "",
    feedbackNotes ? `Revision notes: ${feedbackNotes}` : "",
  ].filter(Boolean).join(" | ");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    messages: [{
      role: "user",
      content: `The image scene is already decided: "${userDirection}"

Your job: add ONLY photography style descriptors that suit this scene.
Do NOT mention or rephrase the scene. Do NOT add subjects, objects or settings.
Output exactly 20-35 words describing: camera/lens, lighting quality, mood, color grading, photographer/magazine reference.

${contextHint ? `Context for style inspiration: ${contextHint}` : ""}

Example output: "Shot on 85mm f/1.4 lens, warm afternoon window light, Kinfolk magazine editorial style, muted warm tones, soft natural bokeh."

Write ONLY the style descriptors, nothing else:`
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

        // Step 2: Claude adds ONLY style details — scene goes to Imagen verbatim
        // FIX Błąd 1: Claude no longer describes the scene (it was reinterpreting it).
        // visualDirection is passed to Imagen literally as the first tokens.
        // Claude only contributes lighting/lens/mood so it cannot substitute the subject.
        send({ status: "thinking", message: "Roman przygotowuje styl fotografii..." });
        let styleDetails = "";
        if (ANTHROPIC_API_KEY) {
          try {
            styleDetails = await generateStyleDetails(
              visualDirection || "professional product lifestyle advertising photograph",
              websiteContent, concept, feedbackNotes, ANTHROPIC_API_KEY
            );
          } catch {
            styleDetails = "Professional advertising photography, natural window light, 85mm lens, clean composition.";
          }
        }

        // Brief shown in UI = scene + style
        const visualPrompt = visualDirection
          ? `${visualDirection}. ${styleDetails}`
          : styleDetails || "Professional product lifestyle advertising photograph. Natural light, premium quality.";
        send({ status: "brief_ready", brief: visualPrompt });

        // Step 3: Build final Imagen prompt
        // FIX Błąd 1: scene is FIRST and literal — Imagen weights first tokens most
        // FIX Błąd 2: no textBand — removed to prevent Imagen painting dark overlay
        const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");

        const sceneOpening = visualDirection ? `${visualDirection}. ` : "";

        const finalPrompt =
          `STRICTLY NO text, letters, numbers, words, overlays or dark bands anywhere in the image.\n\n` +
          `${sceneOpening}${styleDetails}${colorStr} ` +
          `Keep ${logoCorner} corner clear for logo. No watermarks.`;

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

            // Text overlay via opentype.js vector paths — no system fonts needed
            if (textOnImage?.trim()) {
              const fontBuf = Buffer.from(embeddedFontB64, "base64");
              const _ot = _require("opentype.js");
              const font = _ot.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

              const W = fmt.w;
              const H = fmt.h;
              const words = textOnImage.trim().split(/\s+/);
              const fontSize = words.length <= 3 ? Math.floor(W * 0.07) : Math.floor(W * 0.05);
              const isLogoTop = logoPosition && logoPosition.includes("top");
              const textY = isLogoTop ? Math.floor(H * 0.75) : Math.floor(H * 0.20);

              // Split long text into 2 lines
              let lines;
              if (words.length > 5) {
                const mid = Math.ceil(words.length / 2);
                lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
              } else {
                lines = [textOnImage.trim()];
              }

              // Render each line as SVG path
              const lineImgs = [];
              for (const line of lines) {
                const path = font.getPath(line, 0, fontSize, fontSize);
                const b = path.getBoundingBox();
                const pw = Math.ceil(b.x2 - b.x1) + 20;
                const ph = Math.ceil(b.y2 - b.y1) + 20;
                const pathSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">` +
                  `<path d="${path.toPathData(2)}" fill="white" transform="translate(${Math.round(-b.x1+10)},${Math.round(-b.y1+10)})"/>` +
                  `</svg>`;
                const img = await sharp(Buffer.from(pathSvg)).png().toBuffer();
                const meta = await sharp(img).metadata();
                lineImgs.push({ img, w: meta.width, h: meta.height });
              }

              // Place text lines centered, no dark band
              let curY = textY + 12;
              for (const { img, w: lw, h: lh } of lineImgs) {
                composites.push({ input: img, top: curY, left: Math.floor((W - lw) / 2) });
                curY += lh + 8;
              }
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
