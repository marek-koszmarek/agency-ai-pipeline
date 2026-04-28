import Anthropic from "@anthropic-ai/sdk";
import { RESEARCHER_PROMPT, CREATIVE_PROMPT, ANALYST_PROMPT, MODEL } from "@/lib/prompts";

export const maxDuration = 300; // 5 minut max

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function callAgent(system, userMessage) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  return msg.content[0].text;
}

function encode(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

export async function POST(req) {
  const { brief } = await req.json();

  if (!brief || brief.trim().length < 20) {
    return Response.json({ error: "Brief jest za krótki." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(encode(obj)));

      try {
        // ── RESEARCHER ────────────────────────────────────────────
        send({ agent: "researcher", status: "running" });

        const research = await callAgent(
          RESEARCHER_PROMPT,
          `Brief klienta:\n\n${brief}\n\nWykonaj pełną analizę i dostarcz insighty gotowe dla agenta kreatywnego.`
        );

        send({ agent: "researcher", status: "done", content: research });

        // ── CREATIVE ──────────────────────────────────────────────
        send({ agent: "creative", status: "running" });

        const creative = await callAgent(
          CREATIVE_PROMPT,
          `Brief klienta:\n${brief}\n\n---\n\nInsighty od Researcher Agent:\n${research}\n\nStwórz 3 różne koncepcje kreatywne i rekomenduj jedną.`
        );

        send({ agent: "creative", status: "done", content: creative });

        // ── ANALYST ───────────────────────────────────────────────
        send({ agent: "analyst", status: "running" });

        const analysis = await callAgent(
          ANALYST_PROMPT,
          `Brief klienta:\n${brief}\n\n---\n\nInsighty (Researcher):\n${research}\n\n---\n\nKoncepcje kreatywne (Creative):\n${creative}\n\nStwórz kompletny plan mediowy i analityczny.`
        );

        send({ agent: "analyst", status: "done", content: analysis });
        send({ agent: "all", status: "done" });
      } catch (err) {
        send({ agent: "all", status: "error", message: err.message || "Nieznany błąd API" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
