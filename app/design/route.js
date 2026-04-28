import { generateImageWithGemini, buildImagePrompt, FORMATS, getLogoPosition, getTextY } from "@/lib/designer";

export const maxDuration = 120;

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

export async function POST(req) {
  const body = await req.json();
  const {
    concept,
    postContent = "",
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
          ? `POST CONTEXT: ${postContent}\n\nBRAND CONCEPT: ${concept}`
          : concept;

        const finalConcept = feedbackNotes
          ? `${fullConcept}\n\nCLIENT FEEDBACK FOR REVISION: ${feedbackNotes}`
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

            const composites = [];

            // Only add SVG overlay if there's actual text to render
            // This prevents the gray rectangle bug when textOnImage is empty
            if (textOnImage && textOnImage.trim()) {
              let fontFaceCSS = "";
              if (fontBase64) {
                fontFaceCSS = `@font-face { font-family: 'BrandFont'; src: url('data:font/truetype;base64,${fontBase64}'); }`;
              }
              const fontFamily = fontBase64 ? "BrandFont" : "Arial, Helvetica, sans-serif";
              const textY = getTextY(logoPosition, fmt.h);
              const fontSize = Math.floor(fmt.w * 0.05);
              const textContent = textOnImage.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

              const svgText = `<svg width="${fmt.w}" height="${fmt.h}" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <style>${fontFaceCSS}</style>
                  <filter id="shadow">
                    <feDropShadow dx="0" dy="2" stdDeviation="6" flood-opacity="0.55"/>
                  </filter>
                </defs>
                <rect x="40" y="${textY - fontSize - 16}" width="${fmt.w - 80}" height="${fontSize + 36}"
                  fill="black" fill-opacity="0.38" rx="8"/>
                <text x="${fmt.w / 2}" y="${textY}"
                  font-family="${fontFamily}" font-size="${fontSize}" font-weight="600"
                  fill="white" text-anchor="middle" filter="url(#shadow)">${textContent}</text>
              </svg>`;

              composites.push({ input: Buffer.from(svgText), top: 0, left: 0 });
            }

            // Add logo if provided
            if (logoBase64) {
              const logoBuffer = Buffer.from(logoBase64, "base64");
              const maxLogoW = Math.floor(fmt.w * 0.22);
              const maxLogoH = Math.floor(fmt.h * 0.1);
              const resizedLogo = await sharp(logoBuffer)
                .resize(maxLogoW, maxLogoH, { fit: "inside" })
                .toBuffer();
              const logoMeta = await sharp(resizedLogo).metadata();
              const pos = getLogoPosition(logoPosition, fmt.w, fmt.h, logoMeta.width, logoMeta.height);
              composites.push({ input: resizedLogo, top: pos.y, left: pos.x });
            }

            let finalBuffer;
            const resized = sharp(imageBuffer).resize(fmt.w, fmt.h, { fit: "cover", position: "center" });
            if (composites.length > 0) {
              finalBuffer = await resized.composite(composites).png().toBuffer();
            } else {
              finalBuffer = await resized.png().toBuffer();
            }

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
