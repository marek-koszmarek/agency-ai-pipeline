import { createRequire } from "module";
const _require = createRequire(import.meta.url);
import { generateImageWithGemini, FORMATS, getLogoPosition } from "@/lib/designer";
import Anthropic from "@anthropic-ai/sdk";
import { POPPINS_BOLD_B64 } from "@/lib/font-data";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

// Scrape — fallback gdy brak uploadu produktu
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
    const BAD = [
      "flag","lang","language","country","locale",
      "facebook","instagram","twitter","youtube","social",
      "avatar","author","team","banner","hero","header","footer",
      "icon","logo","sprite","placeholder","pixel","tracking",
      "arrow","chevron","close","menu","search","cart",
      "_pl.","_en.","_de.","-pl.","-en.","/flags/","/lang/",
      "1x1","spacer","blank",
    ];
    const imgMatches = [...html.matchAll(/<img[^>]+src=["']([^"']+)["'][^>]*>/gi)];
    const imageUrls = imgMatches
      .map(m => m[1])
      .filter(src => {
        const lower = src.toLowerCase();
        if (BAD.some(p => lower.includes(p))) return false;
        return lower.includes(".jpg") || lower.includes(".jpeg") ||
               lower.includes(".png") || lower.includes(".webp");
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
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ").trim().slice(0, 2000);
    return { text: cleaned, imageUrls };
  } catch { return { text: "", imageUrls: [] }; }
}

// Pobierz produkt — HEAD check rozmiar + wymiary minimum 150x150
async function downloadProductImage(imageUrls, sharpLib) {
  for (const url of imageUrls.slice(0, 6)) {
    try {
      const head = await fetch(url, {
        method: "HEAD",
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
        signal: AbortSignal.timeout(3000),
      });
      if (!head.ok) continue;
      const cl = parseInt(head.headers.get("content-length") || "0");
      if (cl > 0 && cl < 5000) continue;
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; RomanAI/1.0)" },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const meta = await sharpLib(buf).metadata();
      if ((meta.width || 0) < 150 || (meta.height || 0) < 150) continue;
      return await sharpLib(buf).png().toBuffer();
    } catch { continue; }
  }
  return null;
}

// Usun biale tlo z obrazu produktu — raw pixel processing
// Dzialanie: piksele blizsze bialemu (>235) staja sie transparentne,
// piksele posrednie (200-235) staja sie polprzezroczyste (antyaliasing krawedzi).
// Wynik: produkt wyglada jak wyciety z tla, bez bialego prostokata.
async function removeWhiteBackground(pngBuf, sharpLib) {
  const { data, info } = await sharpLib(pngBuf)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixels = new Uint8Array(data);
  for (let i = 0; i < pixels.length; i += 4) {
    const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
    if (r > 235 && g > 235 && b > 235) {
      pixels[i + 3] = 0;
    } else if (r > 200 && g > 200 && b > 200) {
      const brightness = Math.min(r, g, b);
      pixels[i + 3] = Math.floor(((255 - brightness) / 55) * 255);
    }
  }

  return sharpLib(Buffer.from(pixels.buffer), {
    raw: { width: info.width, height: info.height, channels: 4 },
  }).png().toBuffer();
}

// Claude dodaje TYLKO styl fotografii — scena pochodzi dosłownie od usera
// Wywoluj TYLKO gdy visualDirection jest ustawiony
// Gdy brak visualDirection — uzywaj hardcoded neutral prompt (unikamy halucynacji)
async function generateStyleDetails(scene, apiKey) {
  const client = new Anthropic({ apiKey });
  const msg = await client.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 80,
    messages: [{
      role: "user",
      content: `Scene: "${scene}"
Add 20-25 words of photography style ONLY. Do NOT describe/rephrase the scene.
Example: "85mm f/1.4, warm window light, Kinfolk editorial, muted tones, soft bokeh."
Write ONLY the style descriptors:`,
    }]
  });
  return msg.content[0].text.trim();
}

// Composite produkt (bez bialego tla) z drop shadow
// xlink:href wymagany przez librsvg < 2.52 na Vercelu
async function addProductComposite(composites, productPngBuf, fmt, sharpLib) {
  const targetW = Math.floor(fmt.w * 0.48);
  const resized = await sharpLib(productPngBuf)
    .resize(targetW, null, { fit: "inside" })
    .png()
    .toBuffer();
  const meta = await sharpLib(resized).metadata();
  const prodW = meta.width, prodH = meta.height;
  const blur = 25;
  const svgShadow = `<svg width="${prodW + blur * 2}" height="${prodH + blur * 2}" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <filter id="ds">
        <feDropShadow dx="0" dy="${Math.floor(blur * 0.3)}" stdDeviation="${Math.floor(blur * 0.5)}" flood-color="rgba(0,0,0,0.35)"/>
      </filter>
    </defs>
    <image xlink:href="data:image/png;base64,${resized.toString("base64")}"
      x="${blur}" y="${blur}" width="${prodW}" height="${prodH}" filter="url(#ds)"/>
  </svg>`;
  const shadowBuf = await sharpLib(Buffer.from(svgShadow)).png().toBuffer();
  const sM = await sharpLib(shadowBuf).metadata();
  const left = Math.floor((fmt.w - sM.width) / 2);
  const top = Math.floor((fmt.h - sM.height) / 2) + Math.floor(fmt.h * 0.04);
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

        // KROK 1: Zdjecie produktu — upload > scraping
        let productPngBuf = null;
        let websiteText = "";

        if (productImageBase64) {
          send({ status: "scraping", message: "Przygotowuję zdjęcie produktu..." });
          const rawBuf = Buffer.from(productImageBase64, "base64");
          const rawPng = await sharp(rawBuf).png().toBuffer();
          productPngBuf = await removeWhiteBackground(rawPng, sharp);
          send({ status: "scraping", message: "Zdjęcie produktu gotowe ✓" });
        } else if (brandUrl) {
          send({ status: "scraping", message: `Skanuję ${brandUrl}...` });
          const scraped = await scrapeBrandWebsite(brandUrl);
          websiteText = scraped.text;
          if (scraped.imageUrls.length > 0) {
            send({ status: "scraping", message: "Pobieram zdjęcie produktu..." });
            const downloaded = await downloadProductImage(scraped.imageUrls, sharp);
            if (downloaded) {
              productPngBuf = await removeWhiteBackground(downloaded, sharp);
              send({ status: "scraping", message: "Zdjęcie produktu gotowe ✓" });
            } else {
              send({ status: "scraping", message: "Nie udało się pobrać zdjęcia produktu" });
            }
          }
        }

        // KROK 2: Prompt dla Imagena
        // REGULA: scena = visualDirection dosłownie (tylko marka usunięta)
        //         styl = Claude TYLKO gdy visualDirection ustawiony
        //         brak visualDirection = neutral hardcoded (NIE pytaj Claude — dostaje kontekst marki i halucynuje jedzenie/napoje)
        const sceneBase = visualDirection
          .replace(/\broot7\b/gi, "")
          .replace(/\bbean\s*&?\s*buddies\b/gi, "")
          .replace(/\s+/g, " ")
          .trim();

        send({ status: "thinking", message: "Przygotowuję prompt dla Imagena..." });
        let styleStr = "";
        if (sceneBase && ANTHROPIC_API_KEY) {
          try {
            styleStr = await generateStyleDetails(sceneBase, ANTHROPIC_API_KEY);
          } catch {
            styleStr = "Professional photography, 85mm lens, natural light, clean composition.";
          }
        } else {
          // Brak visualDirection — neutralny prompt produktowy, bez kontekstu marki
          styleStr = "Professional product photography, clean studio light, 85mm lens, neutral background.";
        }

        const scenePrompt = sceneBase ? `${sceneBase}. ${styleStr}` : styleStr;
        send({ status: "brief_ready", brief: scenePrompt });

        const colorStr = brandColors.length ? ` Color palette: ${brandColors.join(", ")}.` : "";
        const logoCorner = logoPosition === "roman" ? "bottom-right" : logoPosition.replace("_", " ");

        const imagenPrompt =
          `STRICTLY NO text, letters, numbers, words, overlays or dark bands anywhere in the image.\n\n` +
          `${scenePrompt}${colorStr} ` +
          `Keep ${logoCorner} corner clear for logo. No watermarks.`;

        send({ status: "generating", message: "Imagen 4 Ultra generuje scenę..." });

        // KROK 3: 2 warianty
        const variants = [];

        for (let i = 0; i < 2; i++) {
          const iterPrompt = i === 0
            ? imagenPrompt
            : imagenPrompt + " Alternative angle, different lighting.";

          const imageBase64 = await generateImageWithGemini(iterPrompt, GOOGLE_API_KEY);
          const imageBuffer = Buffer.from(imageBase64, "base64");

          const formatResults = {};
          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;
            const composites = [];

            // 3a: Produkt bez białego tła
            if (productPngBuf) {
              await addProductComposite(composites, productPngBuf, fmt, sharp);
            }

            // 3b: Tekst (opentype.js paths — no system fonts)
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

            // 3c: Logo
            if (logoBase64) {
              const logoBuf = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.10);
              const resizedLogo = await sharp(logoBuf).resize(maxLogoW, maxLogoH, { fit: "inside" }).toBuffer();
              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, fmt.w, fmt.h, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            // 3d: Zloz na tle Imagena
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
