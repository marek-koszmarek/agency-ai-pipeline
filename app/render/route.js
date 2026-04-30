import { renderTemplate, FORMATS_RENDERER } from "@/lib/renderer";
import m1 from "@/lib/clients/m1.json";
import beanBuddies from "@/lib/clients/bean-buddies.json";

export const maxDuration = 60;

const CLIENTS = { "m1": m1, "bean-buddies": beanBuddies };

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

export async function POST(req) {
  const body = await req.json();
  const {
    clientSlug,
    productImageBase64,
    textOnImage,
    logoBase64,
    selectedFormats = ["instagram_feed", "instagram_story", "instagram_square", "facebook_feed"],
  } = body;

  const template = CLIENTS[clientSlug] ?? m1;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        const variants = [];

        send({ status: "rendering", message: "Renderuje wariant 1..." });
        const formatResults1 = {};
        for (const formatKey of selectedFormats) {
          if (!FORMATS_RENDERER[formatKey]) continue;
          formatResults1[formatKey] = await renderTemplate({
            productImageBase64,
            template: { ...template, product: { ...template.product, position: "center" } },
            textOnImage,
            logoBase64,
            formatKey,
          });
        }
        const variant1 = { variant: 1, formats: formatResults1 };
        variants.push(variant1);
        send({ status: "variant_done", variant: 1, data: variant1 });

        send({ status: "rendering", message: "Renderuje wariant 2..." });
        const formatResults2 = {};
        for (const formatKey of selectedFormats) {
          if (!FORMATS_RENDERER[formatKey]) continue;
          formatResults2[formatKey] = await renderTemplate({
            productImageBase64,
            template: { ...template, product: { ...template.product, position: "left" } },
            textOnImage,
            logoBase64,
            formatKey,
          });
        }
        const variant2 = { variant: 2, formats: formatResults2 };
        variants.push(variant2);
        send({ status: "variant_done", variant: 2, data: variant2 });

        send({ status: "done", variants });
      } catch (err) {
        send({ status: "error", message: err.message || "Blad renderowania" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}
