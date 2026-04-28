import Anthropic from "@anthropic-ai/sdk";
import { RESEARCHER_PROMPT, CREATIVE_PROMPT, SOCIAL_PROMPT, ANALYST_PROMPT, MODEL, MODEL_CREATIVE } from "@/lib/prompts";

export const maxDuration = 300;

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

async function parseFile(name, base64, mimeType) {
  const buffer = Buffer.from(base64, "base64");
  if (mimeType === "application/pdf" || name.endsWith(".pdf")) {
    try {
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const data = await pdfParse(buffer);
      return `[PDF: ${name}]\n${data.text}`;
    } catch { return `[PDF: ${name} - blad parsowania]`; }
  }
  if (name.match(/\.(xlsx|xls|csv)$/i) || mimeType?.includes("spreadsheet") || mimeType?.includes("excel")) {
    try {
      const XLSX = (await import("xlsx")).default;
      const wb = XLSX.read(buffer, { type: "buffer" });
      let text = `[Excel: ${name}]\n`;
      wb.SheetNames.forEach((s) => { text += `\n--- Arkusz: ${s} ---\n`; text += XLSX.utils.sheet_to_csv(wb.Sheets[s]); });
      return text;
    } catch { return `[Excel: ${name} - blad parsowania]`; }
  }
  // Word documents - cannot parse binary as text, return note
  if (name.match(/\.(docx|doc)$/i) || mimeType?.includes("wordprocessingml") || mimeType?.includes("msword")) {
    return `[Word dokument: ${name}]\nUWAGA: Plik Word zostal dolaczony ale jego zawartosc nie moze byc automatycznie odczytana. Jesli zawiera wazne informacje - wklej je jako tekst w briefie.`;
  }
  // Other text files
  try {
    return `[Plik: ${name}]\n${buffer.toString("utf-8").slice(0, 8000)}`;
  } catch {
    return `[Plik: ${name} - nie mozna odczytac]`;
  }
}

async function callAgent(system, userMessage, useCreativeModel = false) {
  const model = useCreativeModel ? MODEL_CREATIVE : MODEL;
  const msg = await client.messages.create({
    model, max_tokens: 4096, system,
    messages: [{ role: "user", content: userMessage }],
  });
  return msg.content[0].text;
}

function extractClarificationQuestions(text) {
  const marker = "## PYTANIA DO KLIENTA";
  const idx = text.indexOf(marker);
  if (idx === -1) return null;
  return text.slice(idx + marker.length).trim();
}

function stripClarificationSection(text) {
  const marker = "## PYTANIA DO KLIENTA";
  const idx = text.indexOf(marker);
  return idx === -1 ? text : text.slice(0, idx).trim();
}

function sse(obj) { return `data: ${JSON.stringify(obj)}\n\n`; }

export async function POST(req) {
  let body;
  try {
    body = await req.json();
  } catch (e) {
    return Response.json(
      { error: `Blad parsowania danych: ${e.message}. Plik moze byc za duzy (limit 4MB).` },
      { status: 400 }
    );
  }
  const {
    mode, brief, notes, files = [],
    socialType, socialFocus, socialProduct, socialTonality,
    phase = "full",
    researchContent = "",
    creativeContent = "",
    clarificationAnswers = "",
    runAnalyst = false,        // analyst now optional
    existingResearch = "",     // for social-from-strategy
    existingCreative = "",     // for social-from-strategy
    researchBrand = false,
  } = body;

  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const send = (obj) => controller.enqueue(enc.encode(sse(obj)));

      try {
        // Basic validation
        if (!brief && files.length === 0 && !existingResearch) {
          send({ agent: "all", status: "error", message: "Brak briefu i plikow. Opisz projekt lub wgraj brief." });
          return;
        }

        // Parse files
        let parsedFiles = "";
        if (files.length > 0) {
          const parsed = await Promise.all(files.map((f) => parseFile(f.name, f.base64, f.mimeType)));
          parsedFiles = parsed.join("\n\n---\n\n");
        }

        // Social context
        let socialContext = "";
        if (mode === "social" || mode === "social_from_strategy") {
          socialContext = [
            socialType ? `Typ contentu: ${socialType === "posts" ? "Posty" : "Pomysly na rolki"}` : "",
            socialFocus === "specific" ? "Fokus: konkretny produkt/usluga/wydarzenie" : "",
            socialProduct ? `Opis produktu/wydarzenia:\n${socialProduct}` : "",
            socialTonality ? `Tonalnosc: ${socialTonality}` : "",
          ].filter(Boolean).join("\n");
        }

        // ── PHASE: ANALYST ONLY ──────────────────────────────────
        if (phase === "analyst_only") {
          send({ agent: "analyst", status: "running" });
          const ctx = [
            brief ? `BRIEF:\n${brief}` : "",
            notes ? `\nWskazowki:\n${notes}` : "",
            parsedFiles ? `\nMATERIALY:\n${parsedFiles}` : "",
            researchContent ? `\nINSIGHTY:\n${researchContent}` : "",
            creativeContent ? `\nKONCEPCJE KREATYWNE:\n${creativeContent}` : "",
          ].filter(Boolean).join("\n");
          const analysis = await callAgent(ANALYST_PROMPT, ctx);
          send({ agent: "analyst", status: "done", content: analysis });
          send({ agent: "all", status: "done" });
          return;
        }

        // ── PHASE: SOCIAL FROM STRATEGY ──────────────────────────
        if (phase === "social_from_strategy") {
          const socialInput = [
            `TRYB: Posty i rolki na podstawie istniejacego konceptu/strategii`,
            socialContext ? `\nKONTEKST SOCIAL:\n${socialContext}` : "",
            brief ? `\nBRIEF:\n${brief}` : "",
            existingResearch ? `\nINSIGHTY OD RESEARCHERA:\n${existingResearch}` : "",
            existingCreative ? `\nIST NIEJACY KONCEPT/STRATEGIA:\n${existingCreative}` : "",
            parsedFiles ? `\nDODATKOWE MATERIALY:\n${parsedFiles}` : "",
          ].filter(Boolean).join("\n");
          send({ agent: "social_content", status: "running" });
          const social = await callAgent(SOCIAL_PROMPT, socialInput, false); // Sonnet for speed
          send({ agent: "social_content", status: "done", content: social });
          send({ agent: "all", status: "done" });
          return;
        }

        // ── PHASE: AFTER CLARIFICATION ───────────────────────────
        if (phase === "after_clarification") {
          const research = researchContent + (clarificationAnswers ? `\n\n## ODPOWIEDZI KLIENTA:\n${clarificationAnswers}` : "");
          send({ agent: "researcher", status: "done", content: researchContent });
          await runCreative({ mode, brief, notes, socialContext, parsedFiles, research, send, runAnalyst });
          send({ agent: "all", status: "done" });
          return;
        }

        // ── PHASE: FULL ──────────────────────────────────────────
        const researcherInput = [
          `TRYB: ${mode}`,
          brief ? `\nBRIEF:\n${brief}` : "",
          notes ? `\nDODATKOWE WSKAZOWKI:\n${notes}` : "",
          socialContext ? `\nKONTEKST SOCIAL:\n${socialContext}` : "",
          parsedFiles
            ? `\nDOSTARCZONE MATERIALY:\n${parsedFiles}`
            : researchBrand
              ? `\nUWAGA: Klient poprosil o samodzielny research marki. Przeprowadz pelny research marki/kategorii na podstawie briefu i swojej wiedzy rynkowej. Znajdz insighty, mapuj konkurencje, zdefiniuj grupe celowa. Pracuj bez dodatkowych materialow - to Twoje zadanie.`
              : `\nUWAGA: Brak dodatkowych materialow od klienta. Pracuj z briefem i wiedza rynkowa.`,
        ].filter(Boolean).join("\n");
        send({ agent: "researcher", status: "running" });
        const rawResearch = await callAgent(RESEARCHER_PROMPT, researcherInput);

        const questions = extractClarificationQuestions(rawResearch);
        if (questions) {
          const cleanResearch = stripClarificationSection(rawResearch);
          send({ agent: "researcher", status: "done", content: cleanResearch });
          send({ agent: "researcher", status: "needs_clarification", questions, researchContent: cleanResearch });
          return;
        }

        send({ agent: "researcher", status: "done", content: rawResearch });
        await runCreative({ mode, brief, notes, socialContext, parsedFiles, research: rawResearch, send, runAnalyst });
        send({ agent: "all", status: "done" });

      } catch (err) {
        send({ agent: "all", status: "error", message: err.message || "Blad API" });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
  });
}

async function runCreative({ mode, brief, notes, socialContext, parsedFiles, research, send, runAnalyst }) {
  const baseCtx = [
    brief ? `BRIEF:\n${brief}` : "",
    notes ? `\nWskazowki:\n${notes}` : "",
    socialContext ? `\nKONTEKST SOCIAL:\n${socialContext}` : "",
    parsedFiles ? `\nMATERIALY KLIENTA:\n${parsedFiles}` : "",
    `\nINSIGHTY OD RESEARCHERA:\n${research}`,
  ].filter(Boolean).join("\n");

  if (mode === "ads") {
    // Ads: only analyst (always run)
    send({ agent: "analyst", status: "running" });
    const analysis = await callAgent(ANALYST_PROMPT, baseCtx);
    send({ agent: "analyst", status: "done", content: analysis });
    return;
  }

  // Social uses Sonnet (fast, <60s) - Opus would timeout on Vercel Hobby
  // Concept/Strategy use Opus (better quality, worth the wait)
  const isCreativeModel = mode !== "social";
  const creativeSystemPrompt = mode === "social" ? SOCIAL_PROMPT : CREATIVE_PROMPT;
  send({ agent: "creative", status: "running" });
  const creative = await callAgent(creativeSystemPrompt, baseCtx, isCreativeModel);
  send({ agent: "creative", status: "done", content: creative });

  // Analyst only if explicitly requested
  if (runAnalyst) {
    send({ agent: "analyst", status: "running" });
    const analystCtx = baseCtx + `\n\nKONCEPCJE KREATYWNE:\n${creative}`;
    const analysis = await callAgent(ANALYST_PROMPT, analystCtx);
    send({ agent: "analyst", status: "done", content: analysis });
  }
}
