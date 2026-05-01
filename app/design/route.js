import { createRequire } from "module";
const _require = createRequire(import.meta.url);
import { generateImageWithGemini, FORMATS, getLogoPosition } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// Scrape — tylko tekst o marce, bez pobierania obrazow
async function scrapeBrandText(url) {
  if (!url || !url.startsWith("http")) return "";
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return "";
    const html = await res.text();
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 2000);
  } catch { return ""; }
}

// KROK 1: Claude Vision opisuje produkt ze zdjecia
// Zwraca precyzyjny opis wizualny — kolor, ksztalt, material, szczegoly
// Ten opis zastepuje zdjecie — trafia do promptu Imagena jako opis produktu
async function describeProductFromImage(productBase64, productName, apiKey) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 150,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: productBase64 },
        },
        {
          type: "text",
          text: `Describe this product visually for an image generation AI prompt.
Focus ONLY on: shape, color, material, surface texture, distinctive features, approximate size.
Do NOT mention brand names, logos, text on packaging.
Maximum 40 words. Be specific and visual.
Example: "matte black cylindrical stainless steel thermal bottle, approximately 25cm tall, smooth brushed surface, silver metallic threaded cap with rounded top"
Write ONLY the visual product description:`,
        },
      ],
    }]
  });
  return msg.content[0].text.trim();
}

// KROK 2: Claude buduje kompletny prompt dla Imagena
// Laczy: scene usera + opis produktu + styl fotograficzny
// Imagen generuje CALA scene — osoba + produkt + otoczenie — wszystko naraz
async function buildImagenPrompt(visualDirection, productDescription, brandContext, feedbackNotes, apiKey) {
  const client = new Anthropic({ apiKey });

  const productHint = productDescription
    ? `The person is holding or has nearby: ${productDescription}`
    : "";

  const contextBlock = [
    brandContext ? `Brand context: ${brandContext.slice(0, 200)}` : "",
    feedbackNotes ? `Revision notes: ${feedbackNotes}` : "",
  ].filter(Boolean).join(" | ");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 180,
    messages: [{
      role: "user",
      content: `Write a single Imagen 4 Ultra image generation prompt. The entire image — person, product, setting — must be generated together in one shot. No compositing.

SCENE: "${visualDirection}"
${productHint ? `PRODUCT IN SCENE: ${productHint}` : ""}
${contextBlock ? `CONTEXT: ${contextBlock}` : ""}

Rules:
- Start with the scene description verbatim, keep the gender/person exactly as stated
- Integrate the product naturally into the scene (held, on table nearby, etc.)
- Add: photography style, lens, lighting, color grading, mood reference (photographer/magazine)
- 60-90 words total
- STRICTLY NO text, letters, logos, watermarks, overlays, dark bands in image

Write ONLY the prompt, no explanation:`,
    }]
  });
  return msg.content[0].text.trim();
}

// Fallback prompt gdy brak visualDirection i brak produktu
function buildNeutralPrompt(concept, brandColors) {
  const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
  return `Professional lifestyle advertising photograph, premium product in elegant modern setting, natural light, 85mm f/1.4, Kinfolk magazine editorial style, muted tones, clean composition.${colorStr}`;
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
    productImageBase64 = null,
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

        // KROK 1: Opisz produkt slowami (Claude Vision)
        // Jezeli user wgral zdjecie produktu — Claude opisuje go precyzyjnie
        // Ten opis trafi do promptu Imagena — produkt bedzie naturalnie w scenie
        let productDescription = "";
        if (productImageBase64 && ANTHROPIC_API_KEY) {
          send({ status: "scraping", message: "Analizuję zdjęcie produktu..." });
          try {
            productDescription = await describeProductFromImage(
              productImageBase64, concept, ANTHROPIC_API_KEY
            );
            send({ status: "scraping", message: `Produkt opisany: ${productDescription.slice(0, 60)}...` });
          } catch {
            send({ status: "scraping", message: "Nie udało się opisać produktu — generuję bez opisu" });
          }
        }

        // Pobierz tekst ze strony (tylko jako kontekst marki, nie obrazy)
        let brandContext = concept;
        if (brandUrl && !brandContext) {
          send({ status: "scraping", message: `Skanuję ${brandUrl}...` });
          brandContext = await scrapeBrandText(brandUrl);
        }

        // KROK 2: Zbuduj prompt dla Imagena
        // Cala logika: scena + produkt + styl — w jednym prompcie
        send({ status: "thinking", message: "Buduję prompt dla Imagena..." });
        let imagenScenePrompt = "";

        if (visualDirection && ANTHROPIC_API_KEY) {
          try {
            imagenScenePrompt = await buildImagenPrompt(
              visualDirection, productDescription, brandContext, feedbackNotes, ANTHROPIC_API_KEY
            );
          } catch {
            // Fallback: manualnie polacz scene + opis produktu
            const cleanScene = visualDirection.replace(/\broot7\b/gi, "").replace(/\bbean\s*&?\s*buddies\b/gi, "").trim();
            imagenScenePrompt = `${cleanScene}${productDescription ? `, holding ${productDescription}` : ""}. Professional advertising photography, 85mm f/1.4, warm natural light, Kinfolk editorial style.`;
          }
        } else {
          imagenScenePrompt = buildNeutralPrompt(brandContext, brandColors);
        }

        send({ status: "brief_ready", brief: imagenScenePrompt });

        // KROK 3: Finalny prompt — dodaj globalne zakazy i miejsce na logo
        const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");

        const imagenPrompt =
          `STRICTLY NO text, letters, numbers, words, overlays or dark bands anywhere in the image.\n\n` +
          `${imagenScenePrompt}${colorStr} ` +
          `Keep ${logoCorner} corner clear for logo placement. No watermarks.`;

        send({ status: "generating", message: "Imagen 4 Ultra generuje scenę z produktem..." });

        // KROK 4: Generuj 2 warianty
        // Imagen generuje CALA scene — Sharp TYLKO tekst + logo (brak composite produktu)
        const variants = [];

        for (let i = 0; i < 2; i++) {
          const iterPrompt = i === 0
            ? imagenPrompt
            : imagenPrompt + " Alternative composition, different angle or lighting direction.";

          const imageBase64 = await generateImageWithGemini(iterPrompt, GOOGLE_API_KEY);
          const imageBuffer = Buffer.from(imageBase64, "base64");

          const formatResults = {};
          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;
            const composites = [];

            // Tekst (opentype.js — no system fonts)
            if (textOnImage?.trim()) {
              const fontBuf = Buffer.from(embeddedFontB64, "base64");
              const _ot = _require("opentype.js");
              const font = _ot.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));
              const W = fmt.w, H = fmt.h;
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
                  `<path d="${path.toPathData(2)}" fill="white" transform="translate(${Math.round(-b.x1+10)},${Math.round(-b.y1+10)})"/>` +
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

            // Logo
            if (logoBase64) {
              const logoBuf = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.10);
              const resizedLogo = await sharp(logoBuf).resize(maxLogoW, maxLogoH, { fit: "inside" }).toBuffer();
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

        send({ status: "done", variants, visualBrief: imagenScenePrompt });

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
