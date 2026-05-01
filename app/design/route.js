import { createRequire } from "module";
const _require = createRequire(import.meta.url);
import { FORMATS, getLogoPosition } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// GPT-image-1 /generations — generuje SCENĘ LIFESTYLOWĄ bez produktu
// Produkt klienta nakładany przez Sharp (100% dokładności koloru/kształtu)
async function generateWithGPT(prompt, apiKey) {
  const res = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "gpt-image-1",
      prompt,
      size: "1024x1536",
      quality: "medium",
      n: 1,
      output_format: "png",
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`GPT-image-1 error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.data[0].b64_json;
}

// Imagen 4 Ultra fallback
async function generateWithImagen(prompt, apiKey) {
  const { generateImageWithGemini } = await import("@/lib/designer");
  return generateImageWithGemini(prompt, apiKey);
}

// Claude Vision: opisuje produkt — kolor i kształt dla świadomości promptu sceny
async function describeProduct(productBase64, apiKey) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    messages: [{
      role: "user",
      content: [
        {
          type: "image",
          source: { type: "base64", media_type: "image/jpeg", data: productBase64 },
        },
        {
          type: "text",
          text: `Describe this product for image generation. FORMAT REQUIRED — start with color, then shape:
"[EXACT COLOR] [shape] [material] [size] [cap description] [surface finish]"

Rules:
- COLOR FIRST — be hyper-specific: "deep ocean blue", "matte slate grey", "coral red", NOT just "blue"
- Shape: cylindrical, tapered-waist, wide-mouth, flask-shaped, etc.
- Cap: exact material + color (e.g. "copper-toned metallic screw cap")
- Base: any accent ring or detail
- NO brand names, logos, or text

Example: "deep ocean blue matte stainless steel thermal bottle with tapered waist, copper-toned metallic screw cap at top, matching copper accent ring at base, smooth powder-coat finish, tall and slender"

Write ONLY the description in English, 25-40 words:`,
        },
      ],
    }],
  });
  return msg.content[0].text.trim();
}

// Claude: tłumaczy scenę na angielski zachowując PŁEĆ
async function translateSceneToEnglish(scenePolish, apiKey) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 120,
    messages: [{
      role: "user",
      content: `Translate this Polish scene to English for image generation AI.
CRITICAL rules:
1. START with gender explicitly: "A woman", "A man", "A young woman" — NEVER "person" or "someone"
2. kobieta=woman, mężczyzna=man, dziewczyna=young woman, chłopak=young man
3. Keep all actions, settings, objects EXCEPT remove any product/bottle references
4. Remove any brand names
5. Keep it concise (1-2 sentences max)

Scene: "${scenePolish}"

Write ONLY the English translation:`,
    }],
  });
  return msg.content[0].text.trim();
}

// Scrape — tylko tekst marki
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
      .replace(/\s+/g, " ").trim().slice(0, 1500);
  } catch { return ""; }
}

// ── TYPOGRAPHY ENGINE ─────────────────────────────────────────────
async function renderCreativeText(textOnImage, logoPosition, fmt, sharpLib, fontB64) {
  const _ot = _require("opentype.js");
  const fontBuf = Buffer.from(fontB64, "base64");
  const font = _ot.parse(fontBuf.buffer.slice(fontBuf.byteOffset, fontBuf.byteOffset + fontBuf.byteLength));

  const W = fmt.w;
  const H = fmt.h;
  const words = textOnImage.trim().split(/\s+/);
  const wordCount = words.length;
  const isLogoTop = logoPosition && logoPosition.includes("top");
  const composites = [];

  async function renderLine(text, fontSize, color = "white") {
    const path = font.getPath(text, 0, fontSize, fontSize);
    const b = path.getBoundingBox();
    const pw = Math.ceil(b.x2 - b.x1) + 40;
    const ph = Math.ceil(b.y2 - b.y1) + 20;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${pw}" height="${ph}">` +
      `<path d="${path.toPathData(2)}" fill="${color}" transform="translate(${Math.round(-b.x1 + 20)},${Math.round(-b.y1 + 10)})"/>` +
      `</svg>`;
    const img = await sharpLib(Buffer.from(svg)).png().toBuffer();
    const meta = await sharpLib(img).metadata();
    return { img, w: meta.width, h: meta.height };
  }

  function calcFontSizeForWidth(text, targetWidth) {
    let size = 40;
    for (let s = 200; s >= 30; s -= 2) {
      const path = font.getPath(text, 0, s, s);
      const b = path.getBoundingBox();
      if ((b.x2 - b.x1) <= targetWidth) { size = s; break; }
    }
    return size;
  }

  if (wordCount <= 3) {
    const targetW = Math.floor(W * 0.78);
    const fontSize = calcFontSizeForWidth(words.join(" "), targetW);
    const line = await renderLine(words.join(" "), fontSize);
    const yPos = isLogoTop ? Math.floor(H * 0.70) : Math.floor(H * 0.82);
    composites.push({
      input: line.img,
      top: Math.max(0, yPos - Math.floor(line.h / 2)),
      left: Math.floor((W - line.w) / 2),
    });

  } else if (wordCount <= 6) {
    const hookWords = words.slice(0, Math.ceil(wordCount / 2));
    const bodyWords = words.slice(Math.ceil(wordCount / 2));
    const hookText = hookWords.join(" ");
    const bodyText = bodyWords.join(" ");
    const hookTargetW = Math.floor(W * 0.72);
    const hookSize = calcFontSizeForWidth(hookText, hookTargetW);
    const bodySize = Math.floor(hookSize * 0.58);
    const hookLine = await renderLine(hookText, hookSize);
    const bodyLine = await renderLine(bodyText, bodySize);
    const totalH = hookLine.h + 12 + bodyLine.h;
    const startY = isLogoTop
      ? Math.floor(H * 0.65) - Math.floor(totalH / 2)
      : Math.floor(H * 0.80) - Math.floor(totalH / 2);
    composites.push({ input: hookLine.img, top: Math.max(0, startY), left: Math.floor((W - hookLine.w) / 2) });
    composites.push({ input: bodyLine.img, top: Math.max(0, startY + hookLine.h + 12), left: Math.floor((W - bodyLine.w) / 2) });

  } else {
    const mid = Math.ceil(wordCount / 2);
    const line1Text = words.slice(0, mid).join(" ");
    const line2Text = words.slice(mid).join(" ");
    const l1TargetW = Math.floor(W * 0.80);
    const l1Size = calcFontSizeForWidth(line1Text, l1TargetW);
    const l2Size = Math.floor(l1Size * 0.72);
    const l1 = await renderLine(line1Text, l1Size);
    const l2 = await renderLine(line2Text, l2Size);
    const totalH = l1.h + 8 + l2.h;
    const startY = isLogoTop
      ? Math.floor(H * 0.65) - Math.floor(totalH / 2)
      : Math.floor(H * 0.78) - Math.floor(totalH / 2);
    composites.push({ input: l1.img, top: Math.max(0, startY), left: Math.floor((W - l1.w) / 2) });
    composites.push({ input: l2.img, top: Math.max(0, startY + l1.h + 8), left: Math.floor((W - l2.w) / 2) });
  }

  return composites;
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

  if (!OPENAI_API_KEY && !GOOGLE_API_KEY) {
    throw new Error("Brak OPENAI_API_KEY i GOOGLE_API_KEY — potrzebny minimum jeden");
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        const sharp = (await import("sharp")).default;

        // KROK 1: Opisz produkt (Claude Vision) — kształt/kolor jako kontekst sceny
        let productDescription = "";
        if (productImageBase64 && ANTHROPIC_API_KEY) {
          send({ status: "scraping", message: "Analizuję kształt produktu..." });
          try {
            productDescription = await describeProduct(productImageBase64, ANTHROPIC_API_KEY);
            send({ status: "scraping", message: `Produkt: ${productDescription.slice(0, 70)}...` });
          } catch {
            productDescription = "";
          }
        }

        if (!productImageBase64) {
          send({ status: "scraping", message: "⚠️ Brak zdjęcia produktu — wgraj PNG by produkt był widoczny" });
        }

        // Scraping — kontekst marki
        let brandContext = concept || "";
        if (brandUrl && !brandContext) {
          brandContext = await scrapeBrandText(brandUrl);
        }

        // KROK 2: Tłumacz scenę — PŁEĆ ZACHOWANA
        const scenePolish = visualDirection
          .replace(/\broot7\b/gi, "")
          .replace(/\bbean\s*&?\s*buddies\b/gi, "")
          .replace(/\s+/g, " ").trim();

        let sceneEnglish = scenePolish;
        if (scenePolish && ANTHROPIC_API_KEY) {
          send({ status: "thinking", message: "Tłumaczę scenę z zachowaniem płci..." });
          try {
            sceneEnglish = await translateSceneToEnglish(scenePolish, ANTHROPIC_API_KEY);
          } catch {
            sceneEnglish = scenePolish
              .replace(/\bkobieta\b/gi, "a woman").replace(/\bkobiety\b/gi, "woman's")
              .replace(/\bmężczyzna\b/gi, "a man").replace(/\bdziewczyna\b/gi, "a young woman")
              .replace(/\bchłopak\b/gi, "a young man").replace(/\bpani\b/gi, "a woman")
              .replace(/\bodpoczywając[aą]?\b/gi, "relaxing").replace(/\bpracując[aą]?\b/gi, "working")
              .replace(/\bpo pracy\b/gi, "after work").replace(/\bw kawiarni\b/gi, "in a cafe")
              .replace(/z butelką termiczną/gi, "").replace(/z butelką/gi, "").replace(/z kubkiem/gi, "")
              .replace(/termiczn[ąa]/gi, "").replace(/butelk[ąi]/gi, "").replace(/w ręku/gi, "")
              .replace(/\s+/g, " ").trim();
          }
        }

        // KROK 3: Buduj prompt sceny
        // ARCHITEKTURA: GPT generuje TYLKO scenę lifestylową (osobę + otoczenie)
        // Produkt NIE jest generowany przez AI — Sharp composite nakłada oryginalny plik klienta
        // To jedyna metoda gwarantująca 100% dokładności koloru, kształtu i logo produktu
        const colorStr = brandColors.length ? ` Color palette hint: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");
        const useGPT = !!OPENAI_API_KEY;

        // Usuń wzmianki o butelce ze sceny — produkt będzie nakładany przez Sharp
        const sceneClean = sceneEnglish
          .replace(/\bholding\s+(?:a\s+)?(?:thermal\s+)?(?:bottle|cup|container)\b/gi, "relaxing")
          .replace(/\b(?:a\s+)?(?:thermal\s+)?bottle\b/gi, "")
          .replace(/\b(?:a\s+)?(?:thermal\s+)?cup\b/gi, "")
          .replace(/\s+/g, " ").trim();

        const basePrompt =
          // Scena — OSOBA bez produktu (produkt nałoży Sharp)
          `${sceneClean ? sceneClean + "." : "A woman in a professional lifestyle photograph."} ` +
          // Krytyczne: GPT NIE generuje produktu — Sharp composite nałoży oryginał
          `Her hands are relaxed and naturally positioned — NOT holding any bottle, cup or container. ` +
          `The lower center area of the frame has soft depth-of-field bokeh (space for product placement). ` +
          // Anatomia
          `The person has realistic human anatomy with exactly two hands and two arms — no extra limbs. ` +
          // Styl fotograficzny
          `Photorealistic advertising photography, 85mm f/1.4 lens, natural warm window light, ` +
          `Kinfolk magazine editorial style, muted warm tones, cinematic composition. ` +
          `${colorStr} Keep ${logoCorner} corner clear for logo placement. ` +
          `ABSOLUTELY NO text, letters, logos, watermarks, or text overlays in the generated image. ` +
          `Portrait orientation.`;

        const gptPrompt = basePrompt;
        const imagenPrompt = `STRICTLY NO text, letters, numbers, words, overlays anywhere in the image.\n\n` + basePrompt;

        send({ status: "brief_ready", brief: `${sceneClean} | produkt: Sharp composite (100% oryginalny)` });
        send({ status: "generating", message: `${useGPT ? "GPT-image-1" : "Imagen 4 Ultra"} generuje scenę...` });

        // KROK 4: Generuj 2 warianty sceny
        const variants = [];

        for (let i = 0; i < 2; i++) {
          let imageBase64;

          if (useGPT) {
            const variantPrompt = i === 0 ? gptPrompt
              : gptPrompt
                  .replace("natural warm window light", "soft diffused golden side light")
                  .replace("Portrait orientation", "Slightly different framing, Portrait orientation");
            try {
              imageBase64 = await generateWithGPT(variantPrompt, OPENAI_API_KEY);
            } catch (err) {
              if (GOOGLE_API_KEY) {
                send({ status: "generating", message: `GPT error, Imagen fallback... (${err.message.slice(0, 40)})` });
                imageBase64 = await generateWithImagen(
                  i === 0 ? imagenPrompt : imagenPrompt + " Alternative composition.",
                  GOOGLE_API_KEY
                );
              } else throw err;
            }
          } else {
            const iter = i === 0 ? imagenPrompt : imagenPrompt + " Alternative composition.";
            imageBase64 = await generateWithImagen(iter, GOOGLE_API_KEY);
          }

          const imageBuffer = Buffer.from(imageBase64, "base64");
          const formatResults = {};

          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;

            // Kolejność composites:
            // [0] produkt (unshift — najniższy w stosie ponad sceną)
            // [1..n] tekst (push)
            // [n+1] logo (push — najwyższy)
            const composites = [];

            // ── PRODUKT KLIENTA — Sharp composite ─────────────────
            // GWARANCJA: dokładnie ten plik który użytkownik wgrał — żaden model AI
            // nie może wiernie odtworzyć konkretnego koloru/kształtu/logo produktu
            if (productImageBase64) {
              const rawProdBuf = Buffer.from(productImageBase64, "base64");

              // Krok A: usuń białe tło produktowego zdjęcia (na białym tle)
              const { data: pd, info: pi } = await sharp(rawProdBuf)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

              const pa = new Uint8Array(pd);
              for (let p = 0; p < pa.length; p += 4) {
                const r = pa[p], g = pa[p + 1], b = pa[p + 2];
                if (r > 230 && g > 230 && b > 230) {
                  pa[p + 3] = 0; // całkowicie białe → transparentne
                } else if (r > 205 && g > 205 && b > 205) {
                  // miękkie krawędzie — wygładzenie
                  pa[p + 3] = Math.floor(((255 - Math.min(r, g, b)) / 50) * 255);
                }
              }

              const productNoBg = await sharp(Buffer.from(pa.buffer), {
                raw: { width: pi.width, height: pi.height, channels: 4 },
              }).png().toBuffer();

              // Krok B: skaluj produkt — 38% wysokości formatu (widoczny, nie przesłania osoby)
              const prodTargetH = Math.floor(fmt.h * 0.38);
              const productScaled = await sharp(productNoBg)
                .resize(null, prodTargetH, { fit: "inside" })
                .png()
                .toBuffer();

              const prodMeta = await sharp(productScaled).metadata();

              // Krok C: pozycja — środek poziomo, dolna 1/3 pionowo
              // Produkt w dolnej części tworzy klasyczny format reklamy:
              // osoba (tło/kontekst) + produkt (bohater, na pierwszym planie)
              const prodLeft = Math.max(0, Math.floor((fmt.w - prodMeta.width) / 2));
              const prodTopIdeal = Math.floor(fmt.h * 0.55);
              const prodTop = Math.max(0, Math.min(prodTopIdeal, fmt.h - prodMeta.height - 10));

              // unshift: produkt jest PIERWSZYM composite (nad sceną, pod tekstem i logo)
              composites.unshift({
                input: productScaled,
                top: prodTop,
                left: prodLeft,
              });
            }

            // ── Kreatywna typografia ──────────────────────────────
            if (textOnImage?.trim()) {
              const textComps = await renderCreativeText(textOnImage, logoPosition, fmt, sharp, POPPINS_BOLD_B64);
              composites.push(...textComps);
            }

            // ── Logo — usuń białe tło ─────────────────────────────
            if (logoBase64) {
              const logoBuf = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.10);

              let resizedLogo = await sharp(logoBuf)
                .resize(maxLogoW, maxLogoH, { fit: "inside" })
                .png()
                .toBuffer();

              const { data: ld, info: li } = await sharp(resizedLogo)
                .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
              const lp = new Uint8Array(ld);
              for (let p = 0; p < lp.length; p += 4) {
                const r = lp[p], g = lp[p + 1], b = lp[p + 2];
                if (r > 230 && g > 230 && b > 230) {
                  lp[p + 3] = 0;
                } else if (r > 200 && g > 200 && b > 200) {
                  lp[p + 3] = Math.floor(((255 - Math.min(r, g, b)) / 55) * 255);
                }
              }
              resizedLogo = await sharp(Buffer.from(lp.buffer), {
                raw: { width: li.width, height: li.height, channels: 4 },
              }).png().toBuffer();

              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, fmt.w, fmt.h, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            // ── Złóż na czarnym canvas — ZERO APLI ───────────────
            // .flatten() eliminuje ewentualne transparentne piksele z odpowiedzi GPT
            // (były przyczyną białej apli w poprzedniej wersji /edits)
            const resizedPhoto = await sharp(imageBuffer)
              .resize(fmt.w, fmt.h, { fit: "cover", position: "center" })
              .flatten({ background: { r: 20, g: 20, b: 20 } })
              .png()
              .toBuffer();

            const blackCanvas = await sharp({
              create: { width: fmt.w, height: fmt.h, channels: 3, background: { r: 0, g: 0, b: 0 } },
            }).png().toBuffer();

            // Stos renderowania (od dołu):
            // 1. czarny canvas (baza)
            // 2. resizedPhoto (scena lifestylowa)
            // 3. composites[0] = produkt klienta (Sharp composite)
            // 4. composites[1..n] = tekst
            // 5. composites[n+1] = logo (na wierzchu)
            const finalBuffer = await sharp(blackCanvas)
              .composite([{ input: resizedPhoto }, ...composites])
              .png()
              .toBuffer();

            formatResults[formatKey] = finalBuffer.toString("base64");
          }

          variants.push({ variant: i + 1, formats: formatResults });
          send({ status: "variant_done", variant: i + 1, data: variants[i] });
          if (i === 0) send({ status: "generating", message: "Generuję wariant 2..." });
        }

        send({
          status: "done",
          variants,
          visualBrief: gptPrompt,
          engine: useGPT ? "gpt-image-1 + sharp-composite" : "imagen-4 + sharp-composite",
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
