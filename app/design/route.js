import { createRequire } from "module";
const _require = createRequire(import.meta.url);
import { FORMATS, getLogoPosition } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// ─────────────────────────────────────────────────────────────────
// BACKEND 1: GPT-image-1 /images/edits
// Używany gdy user wgrał zdjęcie produktu LUB pobrano je ze strony.
// Przyjmuje zdjęcie produktu jako input → generuje scenę z tym produktem.
// To jest architektura Photoroom ("lifestyle shots from a single product photo").
// ─────────────────────────────────────────────────────────────────
async function generateWithProductReference(productPngBuf, prompt, apiKey) {
  // Node 20 (Vercel/Next.js 15) natywne FormData + File — brak zewnętrznych zależności
  const form = new FormData();
  const productBlob = new Blob([productPngBuf], { type: "image/png" });
  form.append("image[]", new File([productBlob], "product.png", { type: "image/png" }));
  form.append("model", "gpt-image-1");
  form.append("prompt", prompt);
  form.append("size", "1024x1024");
  form.append("quality", "medium");
  form.append("n", "1");

  const res = await fetch("https://api.openai.com/v1/images/edits", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      // Content-Type jest ustawiany automatycznie przez fetch z boundary
    },
    body: form,
    signal: AbortSignal.timeout(90000),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-image-1 error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data[0].b64_json;
}

// ─────────────────────────────────────────────────────────────────
// BACKEND 2: Imagen 4 Ultra (fallback — brak zdjęcia produktu)
// Używany tylko gdy nie ma zdjęcia produktu do referencji.
// ─────────────────────────────────────────────────────────────────
async function generateWithImagen(prompt, apiKey) {
  const { generateImageWithGemini } = await import("@/lib/designer");
  return generateImageWithGemini(prompt, apiKey);
}

// ─────────────────────────────────────────────────────────────────
// Claude Vision: opisuje produkt ze zdjęcia słowami
// Wynik trafia do prompta jako opis tego co jest na obrazie.
// ─────────────────────────────────────────────────────────────────
async function describeProduct(productBase64, apiKey) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 80,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: productBase64 },
        },
        {
          type: "text",
          text: `Describe this product visually in 20-30 words for an image generation prompt.
Only: shape, color, material, distinctive features. No brand names, no logos.
Example: "matte black cylindrical stainless steel thermal bottle, 25cm, smooth brushed finish, silver cap"
Write ONLY the description:`,
        },
      ],
    }]
  });
  return msg.content[0].text.trim();
}

// ─────────────────────────────────────────────────────────────────
// Scrape — tylko tekst, bez pobierania obrazów
// (obrazy dostarcza user przez upload — scraping był problemem)
// ─────────────────────────────────────────────────────────────────
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
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 1500);
  } catch { return ""; }
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

  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;

  // Musimy mieć co najmniej jeden backend do generowania
  if (!OPENAI_API_KEY && !GOOGLE_API_KEY) {
    throw new Error("Brak OPENAI_API_KEY i GOOGLE_API_KEY — potrzebny minimum jeden");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        const sharp = (await import("sharp")).default;
        const embeddedFontB64 = POPPINS_BOLD_B64;

        // ── KROK 1: Przygotuj zdjęcie produktu ────────────────────
        let productPngBuf = null;
        let productDescription = "";

        if (productImageBase64) {
          send({ status: "scraping", message: "Przygotowuję zdjęcie produktu..." });
          const rawBuf = Buffer.from(productImageBase64, "base64");
          productPngBuf = await sharp(rawBuf).png().toBuffer();

          // Claude Vision opisuje produkt — opis trafi też do Imagena jako fallback
          if (ANTHROPIC_API_KEY) {
            try {
              productDescription = await describeProduct(productImageBase64, ANTHROPIC_API_KEY);
              send({ status: "scraping", message: `Produkt rozpoznany: ${productDescription.slice(0, 60)}...` });
            } catch {
              productDescription = "thermal bottle product";
            }
          }
        }

        // Scraping — tylko jako kontekst marki, nie do pobierania zdjęć
        let brandContext = concept || "";
        if (brandUrl && !brandContext) {
          send({ status: "scraping", message: `Skanuję kontekst marki z ${brandUrl}...` });
          brandContext = await scrapeBrandText(brandUrl);
        }

        // ── KROK 2: Buduj prompt ───────────────────────────────────
        // Scena pochodzi dosłownie od usera — usuwamy tylko nazwę marki
        // (GPT-image-1 widzi produkt ze zdjęcia — nie musi go odgadywać)
        const sceneBase = visualDirection
          .replace(/\broot7\b/gi, "")
          .replace(/\bbean\s*&?\s*buddies\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");

        let imagenPrompt, gptPrompt;

        if (productPngBuf && OPENAI_API_KEY) {
          // GPT-image-1: widzi produkt ze zdjęcia — prompt opisuje SCENĘ i OSOBĘ
          // Produkt jest przekazany jako obraz — model sam go wkomponuje naturalnie
          gptPrompt =
            `Professional advertising lifestyle photograph. ` +
            `${sceneBase ? sceneBase + ". " : ""}` +
            `The product shown in the reference image is held or used naturally in this scene. ` +
            `Photorealistic, 85mm lens, natural warm light, editorial quality.` +
            `${colorStr} Keep ${logoCorner} corner clear for logo. No text, no logos, no watermarks in image.`;

          send({ status: "brief_ready", brief: gptPrompt });
          send({ status: "generating", message: "GPT-image-1 generuje scenę z produktem..." });

        } else {
          // Fallback: Imagen bez referencji produktu
          // Jeśli mamy opis produktu z Claude Vision, dodajemy go do promptu
          const productHint = productDescription
            ? `The person is naturally holding or using: ${productDescription}.`
            : "";

          imagenPrompt =
            `STRICTLY NO text, letters, numbers, words, overlays or dark bands anywhere.\n\n` +
            `${sceneBase ? sceneBase + ". " : "Professional lifestyle advertising photograph. "}` +
            `${productHint} ` +
            `Professional advertising photography, 85mm f/1.4, natural warm light, editorial quality.` +
            `${colorStr} Keep ${logoCorner} corner clear. No watermarks.`;

          send({ status: "brief_ready", brief: imagenPrompt });
          send({ status: "generating", message: "Imagen 4 Ultra generuje scenę..." });
        }

        // ── KROK 3: Generuj 2 warianty ────────────────────────────
        const variants = [];
        const useGPT = !!(productPngBuf && OPENAI_API_KEY);

        for (let i = 0; i < 2; i++) {
          let imageBase64;

          if (useGPT) {
            // Wariant 2: lekko zmieniony prompt dla alternatywnego ujęcia
            const variantPrompt = i === 0
              ? gptPrompt
              : gptPrompt.replace(
                  "natural warm light",
                  i % 2 === 1 ? "soft studio light, slightly different angle" : "golden hour light"
                );

            try {
              imageBase64 = await generateWithProductReference(productPngBuf, variantPrompt, OPENAI_API_KEY);
            } catch (err) {
              // Fallback na Imagen jeśli GPT-image-1 zawiedzie
              if (GOOGLE_API_KEY) {
                send({ status: "generating", message: `GPT-image-1 error, używam Imagena... (${err.message.slice(0,50)})` });
                imageBase64 = await generateWithImagen(imagenPrompt || gptPrompt, GOOGLE_API_KEY);
              } else {
                throw err;
              }
            }
          } else {
            // Imagen fallback
            const iterPrompt = i === 0
              ? imagenPrompt
              : imagenPrompt + " Alternative angle, different lighting.";
            imageBase64 = await generateWithImagen(iterPrompt, GOOGLE_API_KEY);
          }

          const imageBuffer = Buffer.from(imageBase64, "base64");
          const formatResults = {};

          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;

            const composites = [];

            // ── Tekst (opentype.js — no system fonts) ─────────────
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

            // ── Logo ───────────────────────────────────────────────
            if (logoBase64) {
              const logoBuf = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.10);
              const resizedLogo = await sharp(logoBuf)
                .resize(maxLogoW, maxLogoH, { fit: "inside" })
                .toBuffer();
              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, fmt.w, fmt.h, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            // ── Złóż wszystko ──────────────────────────────────────
            const resized = sharp(imageBuffer).resize(fmt.w, fmt.h, { fit: "cover", position: "center" });
            const finalBuffer = composites.length > 0
              ? await resized.composite(composites).png().toBuffer()
              : await resized.png().toBuffer();

            formatResults[formatKey] = finalBuffer.toString("base64");
          }

          variants.push({ variant: i + 1, formats: formatResults });
          send({ status: "variant_done", variant: i + 1, data: variants[i] });
          if (i === 0) send({ status: "generating", message: "Generuję wariant 2..." });
        }

        send({
          status: "done",
          variants,
          visualBrief: useGPT ? gptPrompt : imagenPrompt,
          engine: useGPT ? "gpt-image-1" : "imagen-4-ultra",
        });

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
