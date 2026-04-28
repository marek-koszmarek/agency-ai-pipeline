import { generateImageWithGemini, buildImagePrompt, extractVisualDirection, FORMATS, getLogoPosition, getTextY } from "@/lib/designer";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

export async function POST(req) {
  const body = await req.json();
  const {
    concept,
    postContent = "",      // specific post content for social graphics
    brandColors = [],
    logoBase64,
    fontBase64,
    textOnImage,
    logoPosition = "bottom_right",
    feedbackIteration = 0,
    feedbackNotes = "",
    selectedFormats = ["instagram_feed", "instagram_story", "instagram_square", "facebook_feed"],
  } = body;

  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  if (!GOOGLE_API_KEY) throw new Error("Brak GOOGLE_API_KEY");

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        const sharp = (await import("sharp")).default;

        const fullConcept = postContent
          ? `KONTEKST POSTU:\n${postContent}\n\nSZERSZY KONCEPT:\n${concept}`
          : concept;

        const finalConcept = feedbackNotes
          ? `${fullConcept}\n\nPOPRAWKI OD KLIENTA:\n${feedbackNotes}`
          : fullConcept;

        const variants = [];
        for (let i = 0; i < 2; i++) {
          send({ status: "generating", message: `Generuje wariant ${i + 1}/2...` });

          const prompt = buildImagePrompt({
            concept: finalConcept,
            brandColors,
            textOnImage,
            logoPosition,
            iteration: feedbackIteration * 2 + i,
          });

          const imageBase64 = await generateImageWithGemini(prompt, GOOGLE_API_KEY);
          const imageBuffer = Buffer.from(imageBase64, "base64");

          const formatResults = {};
          for (const formatKey of selectedFormats) {
            const fmt = FORMATS[formatKey];
            if (!fmt) continue;

            let composed = sharp(imageBuffer).resize(fmt.w, fmt.h, { fit: "cover", position: "center" });
            const svgW = fmt.w;
            const svgH = fmt.h;
            const svgLayers = [];

            if (textOnImage) {
              let fontFaceCSS = "";
              if (fontBase64) {
                fontFaceCSS = `@font-face { font-family: 'BrandFont'; src: url('data:font/truetype;base64,${fontBase64}'); }`;
              }
              const fontFamily = fontBase64 ? "BrandFont" : "Arial, Helvetica, sans-serif";
              const textY = getTextY(logoPosition, svgH);
              const fontSize = Math.floor(svgW * 0.05);

              svgLayers.push(`
                <defs>
                  <style>${fontFaceCSS}</style>
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="6" flood-opacity="0.6"/>
                  </filter>
                </defs>
                <rect x="40" y="${textY - fontSize - 20}" width="${svgW - 80}" height="${fontSize + 40}"
                  fill="black" fill-opacity="0.35" rx="8"/>
                <text x="${svgW / 2}" y="${textY}"
                  font-family="${fontFamily}" font-size="${fontSize}"
                  fill="white" text-anchor="middle" filter="url(#shadow)">${textOnImage}</text>
              `);
            }

            const svgBuffer = Buffer.from(
              `<svg width="${svgW}" height="${svgH}" xmlns="http://www.w3.org/2000/svg">${svgLayers.join("")}</svg>`
            );

            const composites = [{ input: svgBuffer, top: 0, left: 0 }];

            if (logoBase64) {
              const logoBuffer = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(svgW * 0.22);
              const maxLogoH = Math.floor(svgH * 0.1);
              const resizedLogo = await sharp(logoBuffer)
                .resize(maxLogoW, maxLogoH, { fit: "inside" })
                .toBuffer();
              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, svgW, svgH, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            const finalBuffer = await composed.composite(composites).png().toBuffer();
            formatResults[formatKey] = finalBuffer.toString("base64");
          }

          variants.push({ variant: i + 1, formats: formatResults });
          send({ status: "variant_done", variant: i + 1, data: variants[i] });
        }

        send({ status: "done", variants });
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
