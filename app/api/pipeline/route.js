import Anthropic from "@anthropic-ai/sdk";
import { RESEARCHER_PROMPT, CREATIVE_PROMPT, SOCIAL_PROMPT, ANALYST_PROMPT, MODEL } from "@/lib/prompts";

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Parse uploaded files server-side ────────────────────────────
async function parseFile(name, base64, mimeType) {
  const buffer = Buffer.from(base64, "base64");

  // PDF
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const data = await pdfParse(buffer);
      return `[PDF: ${name}]\n${data.text}`;
    } catch {
      return `[PDF: ${name} — błąd parsowania, plik może być zeskanowany]`;
    }
  }

  // Excel / CSV
  if (name.match(/\.(xlsx|xls|csv)$/i) || mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) {
    try {
      const XLSX = (await import("xlsx")).default;
      const wb = XLSX.read(buffer, { type: "buffer" });
      let text = `[Excel/CSV: ${name}]\n`;
      wb.SheetNames.forEach((sheetName) => {
        const ws = wb.Sheets[sheetName];
        text += `\n--- Arkusz: ${sheetName} ---\n`;
        text += XLSX.utils.sheet_to_csv(ws);
      });
      return text;
    } catch {
      return `[Excel: ${name} — błąd parsowania]`;
    }
  }

  // Text / Markdown / other
  return `[Plik: ${name}]\n${buffer.toString("utf-8")}`;
}

// ── Call one agent ───────────────────────────────────────────────
async function callAgent(system, userMessage) {
  const msg = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    system,
    messages: [{ role: "user", content: userMessage }],
  });
  return msg.content[0].text;
}

function sse(obj) {
  return `data: ${JSON.stringify(obj)}\n\n`;
}

// ── Main POST handler ────────────────────────────────────────────
export async function POST(req) {
  const body = await req.json();
  const { mode, brief, notes, files = [] } = body;
  // files: [{name, base64, mimeType}]

  if (!brief || brief.trim().length < 10) {
    return Response.json({ error: "Brief jest za krótki." }, { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        // ── Parse all files ──────────────────────────────────────
        let parsedFiles = "";
        if (files.length > 0) {
          send({ agent: "system", status: "parsing", message: "Parsowanie plików..." });
          const parsed = await Promise.all(
            files.map((f) => parseFile(f.name, f.base64, f.mimeType))
          );
          parsedFiles = parsed.join("\n\n---\n\n");
        }

        // ── Build researcher context ─────────────────────────────
        const researcherInput = [
          `TRYB: ${mode}`,
          `\nBRIEF:\n${brief}`,
          notes ? `\nDODATKOWE WSKAZÓWKI:\n${notes}` : "",
          parsedFiles ? `\n\nDOSTARCZONE MATERIAŁY:\n${parsedFiles}` : "",
        ].filter(Boolean).join("\n");

        // ── RESEARCHER ───────────────────────────────────────────
        send({ agent: "researcher", status: "running" });
        const research = await callAgent(RESEARCHER_PROMPT, researcherInput);
        send({ agent: "researcher", status: "done", content: research });

        // ── Mode routing ─────────────────────────────────────────
        if (mode === "ads") {
          // Ads only: Researcher → Analyst
          send({ agent: "analyst", status: "running" });
          const analystInput = [
            `BRIEF:\n${brief}`,
            notes ? `\nWskazówki:\n${notes}` : "",
            parsedFiles ? `\nDANE OD KLIENTA:\n${parsedFiles}` : "",
            `\nINSIGHTY (Researcher):\n${research}`,
          ].filter(Boolean).join("\n");
          const analysis = await callAgent(ANALYST_PROMPT, analystInput);
          send({ agent: "analyst", status: "done", content: analysis });

        } else {
          // Concept / Strategy / Social: Researcher → Creative → Analyst
          const creativeSystemPrompt = mode === "social" ? SOCIAL_PROMPT : CREATIVE_PROMPT;

          send({ agent: "creative", status: "running" });
          const creativeInput = [
            `TRYB: ${mode}`,
            `\nBRIEF:\n${brief}`,
            notes ? `\nWskazówki:\n${notes}` : "",
            parsedFiles ? `\nMATERIAŁY KLIENTA:\n${parsedFiles}` : "",
            `\nINSIGHTY OD RESEARCHERA:\n${research}`,
          ].filter(Boolean).join("\n");
          const creative = await callAgent(creativeSystemPrompt, creativeInput);
          send({ agent: "creative", status: "done", content: creative });

          // Analyst only for concept/strategy (not for social-only)
          if (mode === "concept" || mode === "strategy") {
            send({ agent: "analyst", status: "running" });
            const analystInput = [
              `BRIEF:\n${brief}`,
              `\nINSIGHTY:\n${research}`,
              `\nKONCEPCJE:\n${creative}`,
            ].join("\n");
            const analysis = await callAgent(ANALYST_PROMPT, analystInput);
            send({ agent: "analyst", status: "done", content: analysis });
          }
        }

        send({ agent: "all", status: "done" });
      } catch (err) {
        send({ agent: "all", status: "error", message: err.message || "Błąd API" });
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
