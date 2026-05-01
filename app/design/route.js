import { createRequire } from "module";
const _require = createRequire(import.meta.url);
import { generateImageWithGemini, FORMATS, getLogoPosition } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// Scrape brand website
async function scrapeBrandWebsite(url) {
  if (!url || !url.startsWith("http")) return { text: "", imageUrls: [] };
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { text: "", imageUrls: [] };
    const html = await res.text();
    const baseUrl = new URL(url);
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    const imageUrls = imgMatches
      .map(m => m[1])
      .filter(src => {
        const lower = src.toLowerCase();
        return !lower.includes("icon") && !lower.includes("logo") &&
               !lower.includes("placeholder") && !lower.includes("sprite") &&
               !lower.includes("pixel") && !lower.includes("tracking") &&
               (lower.includes(".jpg") || lower.includes(".jpeg") ||
                lower.includes(".png") || lower.includes(".webp"));
      })
      .map(src => {
        try { return src.startsWith("http") ? src : new URL(src, baseUrl.origin).href; }
        catch { return null; }
      })
      .filter(Boolean)
      .slice(0, 8);
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

// Download first working product image, return as PNG Buffer
// Forces PNG output so it can be embedded in SVG with correct MIME type
async function downloadProductImage(imageUrls, sharpLib) {
  for (const url of imageUrls.slice(0, 6)) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const pngBuf = await sharpLib(buf).png().toBuffer();
      return pngBuf;
    } catch { continue; }
  }
  return null;
}

// Claude writes the Imagen scene prompt WITHOUT the product.
// The product will be added by Sharp — Imagen must not hallucinate it.
async function generateScenePrompt(visualDirection, websiteContent, concept, feedbackNotes, apiKey) {
  const client = new Anthropic({ apiKey });
  const contextHint = [
    concept ? `Brand: ${concept.slice(0, 200)}` : "",
    websiteContent ? `Site: ${websiteContent.slice(0, 200)}` : "",
    feedbackNotes ? `Feedback: ${feedbackNotes}` : "",
  ].filter(Boolean).join(" | ");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [{
      role: "user",
      content: `Write an Imagen 4 Ultra prompt for a background/scene. The product will be composited separately by Sharp — do NOT include any specific product object in the prompt.

Scene: "${visualDirection}"

Rules:
- Describe ONLY the setting, person, environment, mood, atmosphere
- If the person holds something, write "holds an object naturally" — do not name the product
- Add camera lens, lighting style, color grading, photographer/magazine reference
- 40-70 words max
- STRICTLY NO text, logos, watermarks, dark overlays in image
${contextHint ? `Style context: ${contextHint}` : ""}

Write ONLY the prompt:`
    }]
  });
  return msg.content[0].text.trim();
}

// Composite product PNG onto the composites array with drop shadow.
// CRITICAL: uses xlink:href (SVG 1.1) not href (SVG 2.0).
// librsvg < 2.52 on Vercel silently ignores href — image renders transparent.
// Also: resizedProduct must be PNG before embedding (Sharp inherits input format).
async function addProductComposite(composites, productPngBuf, fmt, sharpLib) {
  const targetW = Math.floor(fmt.w * 0.50);
  const resizedProduct = await sharpLib(productPngBuf)
    .resize(targetW, null, { fit: "inside" })
    .png()
    .toBuffer();
  const prodMeta = await sharpLib(resizedProduct).metadata();
  const prodW = prodMeta.width;
  const prodH = prodMeta.height;
  const blur = 28;
  const shadowOpacity = 0.32;
  const svgShadow = `<svg width="${prodW + blur * 2}" height="${prodH + blur * 2}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <filter id="ds">
        <feDropShadow dx="0" dy="${Math.floor(blur * 0.3)}" stdDeviation="${Math.floor(blur * 0.5)}" flood-color="rgba(0,0,0,${shadowOpacity})"/>
      </filter>
    </defs>
    <image xlink:href="data:image/png;base64,${resizedProduct.toString("base64")}"
      x="${blur}" y="${blur}" width="${prodW}" height="${prodH}" filter="url(#ds)"/>
  </svg>`;
  const shadowBuf = await sharpLib(Buffer.from(svgShadow)).png().toBuffer();
  const shadowMeta = await sharpLib(shadowBuf).metadata();
  const sW = shadowMeta.width;
  const sH = shadowMeta.height;
  const left = Math.floor((fmt.w - sW) / 2);
  const top = Math.floor((fmt.h - sH) / 2) + Math.floor(fmt.h * 0.04);
  composites.push({ input: shadowBuf, left: Math.max(0, left), top: Math.max(0, top) });
}

export async function POST(req) {
  const body = await req.json();
  const {
    concept = "",
    brandColors = [],
    brandUrl = "",
    logoBase64,
    textOnImage,
    logoPosition = "bottom_right",
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
        const embeddedFontB64 = POPPINS_BOLD_B64;

        // KROK 1: Scrape strony + pobierz zdjecie produktu
        let websiteContent = "";
        let productPngBuf = null;

        if (brandUrl) {
          send({ status: "scraping", message: `Skanuję ${brandUrl}...` });
          const scraped = await scrapeBrandWebsite(brandUrl);
          websiteContent = scraped.text;

          if (scraped.imageUrls.length > 0) {
            send({ status: "scraping", message: `Pobieram zdjęcie produktu...` });
            productPngBuf = await downloadProductImage(scraped.imageUrls, sharp);
            send({
              status: "scraping",
              message: productPngBuf
                ? "Zdjęcie produktu pobrane ✓"
                : "Nie udało się pobrać zdjęcia produktu",
            });
          }
        }

        // KROK 2: Claude pisze prompt dla SCENY (bez produktu)
        // Produkt bedzie dodany przez Sharp - Imagen nie moze go halucynowac
        send({ status: "thinking", message: "Przygotowuję scenę dla Imagena (bez produktu)..." });
        let scenePrompt = "";
        try {
          if (ANTHROPIC_API_KEY && visualDirection) {
            scenePrompt = await generateScenePrompt(
              visualDirection, websiteContent, concept, feedbackNotes, ANTHROPIC_API_KEY
            );
          } else {
            scenePrompt = visualDirection
              ? `${visualDirection}. Professional advertising photography, 85mm lens, natural light.`
              : "Professional lifestyle advertising photograph. Clean, modern aesthetic. Natural light.";
          }
        } catch {
          scenePrompt = visualDirection
            ? `${visualDirection}. Professional advertising photography, natural light.`
            : "Professional lifestyle advertising photograph. Natural light, premium quality.";
        }

        send({ status: "brief_ready", brief: scenePrompt });

        // KROK 3: Buduj prompt Imagena (tylko scena, bez produktu)
        const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");

        const imagenPrompt =
          `STRICTLY NO text, letters, numbers, words, overlays or dark bands anywhere in the image.\n\n` +
          `${scenePrompt}${colorStr} ` +
          `Keep ${logoCorner} corner clear for logo. No watermarks.`;

        send({ status: "generating", message: "Imagen 4 Ultra generuje scenę..." });

        // KROK 4: Generuj 2 warianty
        const variants = [];

        for (let i = 0; i < 2; i++) {
          const iterPrompt = i === 0
            ? imagenPrompt
            : imagenPrompt + " Alternative angle, different lighting direction.";

          const imageBase64 = await generateImageWithGemini(iterPrompt, GOOGLE_API_KEY);
          const imageBuffer = Buffer.from(imageBase64, "base64");

          const formatResults = {};

          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;

            const composites = [];

            // 4a: Produkt (Sharp composite — prawdziwe zdjecie ze strony, nie halucynacja)
            if (productPngBuf) {
              await addProductComposite(composites, productPngBuf, fmt, sharp);
            }

            // 4b: Tekst (opentype.js paths — bez system fonts)
            if (textOnImage?.trim()) {
              const fontBuf = Buffer.from(embeddedFontB64, "base64");
              const _ot = _require("opentype.js");
              const font = _ot.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
              const W = fmt.w;
              const H = fmt.h;
              const words = textOnImage.trim().split(/\s+/);
              const fontSize = words.length <= 3 ? Math.floor(W * 0.07) : Math.floor(W * 0.05);
              const isLogoTop = logoPosition && logoPosition.includes("top");
              const textY = isLogoTop ? Math.floor(H * 0.75) : Math.floor(H * 0.12);
              let lines;
              if (words.length > 5) {
                const mid = Math.ceil(words.length / 2);
                lines = [words.slice(0, mid).join(" "), words.slice(mid).join(" ")];
              } else {
                lines = [textOnImage.trim()];
              }
              const lineImgs = [];
              for (const line of lines) {
                const path = font.getPath(line, 0, fontSize, fontSize);
                const b = path.getBoundingBox();
                const pw = Math.ceil(b.x2 - b.x1) + 20;
                const ph = Math.ceil(b.y2 - b.y1) + 20;
                const pathSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">` +
                  `<path d="${path.toPathData(2)}" fill="white" transform="translate(${Math.round(-b.x1 + 10)},${Math.round(-b.y1 + 10)})"/>` +
                  `</svg>`;
                const img = await sharp(Buffer.from(pathSvg)).png().toBuffer();
                const meta = await sharp(img).metadata();
                lineImgs.push({ img, w: meta.width, h: meta.height });
              }
              let curY = textY + 12;
              for (const { img, w: lw, h: lh } of lineImgs) {
                composites.push({ input: img, top: curY, left: Math.floor((W - lw) / 2) });
                curY += lh + 8;
              }
            }

            // 4c: Logo
            if (logoBase64) {
              const logoBuffer = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.10);
              const resizedLogo = await sharp(logoBuffer)
                .resize(maxLogoW, maxLogoH, { fit: "inside" })
                .toBuffer();
              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, fmt.w, fmt.h, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            // 4d: Zloz wszystko na obrazie Imagena
            const resized = sharp(imageBuffer).resize(fmt.w, fmt.h, { fit: "cover", position: "center" });
            const finalBuffer = composites.length > 0
              ? await resized.composite(composites).png().toBuffer()
              : await resized.png().toBuffer();

            formatResults[formatKey] = finalBuffer.toString("base64");
          }

          variants.push({ variant: i + 1, formats: formatResults });
          send({ status: "variant_done", variant: i + 1, data: variants[i] });
        }

        send({ status: "done", variants, visualBrief: scenePrompt });

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
