"use client";
import { useState, useRef, useCallback } from "react";

// ── Stałe ────────────────────────────────────────────────────────
const MODES = {
  concept:  { label: "Koncept kreatywny", emoji: "💡", agents: ["researcher","creative","analyst"] },
  strategy: { label: "Strategia",         emoji: "🎯", agents: ["researcher","creative","analyst"] },
  social:   { label: "Posty i rolki",     emoji: "📱", agents: ["researcher","creative"] },
  ads:      { label: "Plan reklamowy",    emoji: "📊", agents: ["researcher","analyst"] },
};

const STEPS_FOR_MODE = {
  concept:  ["researcher","creative","analyst"],
  strategy: ["researcher","creative","analyst"],
  social:   ["researcher","creative"],
  ads:      ["researcher","analyst"],
};

const AGENT_LABELS = {
  researcher: { icon: "🔍", name: "Researcher" },
  creative:   { icon: "🎨", name: "Creative" },
  analyst:    { icon: "📊", name: "Analyst" },
};

const ACCEPTED_TYPES = ".txt,.md,.pdf,.xlsx,.xls,.csv,.doc,.docx";

// ── File helpers ──────────────────────────────────────────────────
function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function prepareFiles(fileList) {
  return Promise.all(
    Array.from(fileList).map(async (f) => ({
      name: f.name,
      mimeType: f.type,
      base64: await readFileAsBase64(f),
    }))
  );
}

// ── FileDropZone component ────────────────────────────────────────
function FileDropZone({ files, onFiles, label, hint }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();

  const addFiles = useCallback(async (fileList) => {
    const prepared = await prepareFiles(fileList);
    onFiles((prev) => {
      const names = new Set(prev.map((f) => f.name));
      return [...prev, ...prepared.filter((f) => !names.has(f.name))];
    });
  }, [onFiles]);

  return (
    <div>
      <div
        className={`upload-zone${drag ? " drag-over" : ""}`}
        onClick={() => ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
      >
        <input ref={ref} type="file" accept={ACCEPTED_TYPES} multiple
          onChange={(e) => addFiles(e.target.files)} />
        <div style={{ fontSize: 22, marginBottom: 6 }}>📎</div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-hint)" }}>{hint}</div>}
      </div>
      {files.length > 0 && (
        <div className="file-chips">
          {files.map((f) => (
            <span key={f.name} className="file-chip">
              {f.name}
              <button onClick={() => onFiles((prev) => prev.filter((x) => x.name !== f.name))}>×</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── RomanMessage component ────────────────────────────────────────
function RomanMsg({ children }) {
  return (
    <div className="msg-row">
      <div className="msg-avatar">R</div>
      <div style={{ flex: 1 }}>
        <div className="msg-bubble">{children}</div>
      </div>
    </div>
  );
}

function UserMsg({ children }) {
  return (
    <div className="msg-row user">
      <div className="msg-avatar user-av">Ty</div>
      <div className="msg-bubble">{children}</div>
    </div>
  );
}

// ── Tabs ──────────────────────────────────────────────────────────
function ResultTabs({ mode, results, done }) {
  const [active, setActive] = useState("researcher");

  const tabs = STEPS_FOR_MODE[mode] || ["researcher"];
  const tabLabels = { researcher: "Research", creative: "Kreacja", analyst: "Plan mediowy" };

  const content = results[active] || "";

  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab-btn${active === t ? " active" : ""}`} onClick={() => setActive(t)}>
            {AGENT_LABELS[t]?.icon} {tabLabels[t]}
            {results[t] && <span style={{ marginLeft: 4, color: "var(--success-text)", fontSize: 11 }}>✓</span>}
          </button>
        ))}
      </div>
      <div className="result-box">
        {content
          ? <div className="result-text">{content}</div>
          : <div className="empty-state"><span className="spin">⟳</span> Oczekiwanie...</div>
        }
      </div>
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function Home() {
  // Conversation state
  const [step, setStep] = useState("mode"); // mode → brief → examples (social) → products → notes → running → done
  const [mode, setMode] = useState(null);
  const [briefText, setBriefText] = useState("");
  const [briefFiles, setBriefFiles] = useState([]);
  const [exampleFiles, setExampleFiles] = useState([]);
  const [productFiles, setProductFiles] = useState([]);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");

  // Pipeline state
  const [agentStatus, setAgentStatus] = useState({});
  const [results, setResults] = useState({});
  const [done, setDone] = useState(false);

  const setAgent = (id, status) => setAgentStatus((p) => ({ ...p, [id]: status }));
  const setResult = (id, content) => setResults((p) => ({ ...p, [id]: content }));

  // ── Run pipeline ───────────────────────────────────────────────
  const runPipeline = async () => {
    setStep("running");
    setError("");
    setAgentStatus({});
    setResults({});
    setDone(false);

    // Combine all files
    const allFiles = [
      ...briefFiles,
      ...(mode === "social" ? exampleFiles : []),
      ...productFiles,
    ];

    const combinedBrief = [
      briefText.trim(),
      briefFiles.length > 0 ? `[Pliki briefu: ${briefFiles.map(f => f.name).join(", ")}]` : "",
    ].filter(Boolean).join("\n\n");

    const examplesNote = mode === "social" && exampleFiles.length > 0
      ? `\n[Przykłady postów/rolek: ${exampleFiles.map(f => f.name).join(", ")}]`
      : "";

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode,
          brief: combinedBrief + examplesNote,
          notes: notes.trim(),
          files: allFiles,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Błąd serwera " + res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: sd, value } = await reader.read();
        if (sd) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const ev = JSON.parse(line);
            if (ev.status === "running") setAgent(ev.agent, "running");
            if (ev.status === "done" && ev.agent !== "all") {
              setAgent(ev.agent, "done");
              if (ev.content) setResult(ev.agent, ev.content);
            }
            if (ev.agent === "all" && ev.status === "done") { setDone(true); setStep("done"); }
            if (ev.status === "error") throw new Error(ev.message);
          } catch (_) {}
        }
      }
    } catch (e) {
      setError(e.message || "Błąd połączenia.");
      setStep("notes"); // step back so user can retry
    }
  };

  // ── Build full report ─────────────────────────────────────────
  const buildReport = () => {
    const now = new Date().toLocaleString("pl-PL");
    const parts = [`# RAPORT — ${MODES[mode]?.label}\nData: ${now}\n\n${"=".repeat(60)}\n\nBRIEF:\n${briefText}`];
    if (results.researcher) parts.push(`\n\n${"=".repeat(60)}\n\nRESEARCH:\n${results.researcher}`);
    if (results.creative) parts.push(`\n\n${"=".repeat(60)}\n\nKREACJA:\n${results.creative}`);
    if (results.analyst) parts.push(`\n\n${"=".repeat(60)}\n\nPLAN MEDIOWY:\n${results.analyst}`);
    return parts.join("");
  };

  const download = () => {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([buildReport()], { type: "text/markdown" })),
      download: `roman_${mode}_${new Date().toISOString().slice(0,10)}.md`,
    });
    a.click();
  };

  const reset = () => {
    setStep("mode"); setMode(null); setBriefText(""); setBriefFiles([]);
    setExampleFiles([]); setProductFiles([]); setNotes(""); setError("");
    setAgentStatus({}); setResults({}); setDone(false);
  };

  // ── Progress steps ────────────────────────────────────────────
  const activeSteps = mode ? STEPS_FOR_MODE[mode] : [];
  const stepClass = (id) => {
    const s = agentStatus[id];
    if (s === "running") return "progress-step running";
    if (s === "done") return "progress-step done";
    return "progress-step";
  };
  const stepStatus = (id) => {
    const s = agentStatus[id];
    if (s === "running") return "Pracuje...";
    if (s === "done") return "Gotowe ✓";
    return "Oczekuje";
  };

  // ── Render ────────────────────────────────────────────────────
  return (
    <div className="app">
      <div className="header">
        <div className="header-avatar">R</div>
        <div>
          <div className="header-title">Luzny Roman</div>
          <div className="header-sub">Twój partner od kreacji i strategii</div>
        </div>
      </div>

      <div className="messages">

        {/* KROK 1 — Wybór trybu */}
        <RomanMsg>
          Hej! Co robimy dzisiaj?
          {step === "mode" && (
            <div className="choices">
              {Object.entries(MODES).map(([key, m]) => (
                <button key={key} className="choice-btn" onClick={() => { setMode(key); setStep("brief"); }}>
                  {m.emoji} {m.label}
                </button>
              ))}
            </div>
          )}
        </RomanMsg>

        {/* Po wyborze trybu */}
        {mode && step !== "mode" && (
          <UserMsg>{MODES[mode].emoji} {MODES[mode].label}</UserMsg>
        )}

        {/* KROK 2 — Brief */}
        {mode && step !== "mode" && (
          <RomanMsg>
            {mode === "ads"
              ? "Super! Wgraj brief i dane klienta — możesz dodać Excel z wynikami, raporty PDF, cokolwiek masz."
              : "Spoko! Wgraj brief lub opisz projekt tekstem. Im więcej wiesz — tym lepiej zadziała."}

            {step === "brief" && (
              <>
                <FileDropZone
                  files={briefFiles}
                  onFiles={setBriefFiles}
                  label="Wgraj brief (PDF, TXT, MD, Word...)"
                  hint="lub wpisz poniżej"
                />
                <div className="input-area" style={{ marginTop: 10 }}>
                  <textarea
                    className="msg-input"
                    value={briefText}
                    onChange={(e) => setBriefText(e.target.value)}
                    placeholder={"Marka:\nProdukt/usługa:\nCel kampanii:\nGrupa docelowa:\nBudżet:\nRynek/kraj:\nDodatkowe info:"}
                  />
                </div>
                <div className="btn-row">
                  <button className="btn btn-primary" disabled={!briefText.trim() && briefFiles.length === 0}
                    onClick={() => setStep(mode === "social" ? "examples" : "products")}>
                    Dalej →
                  </button>
                </div>
              </>
            )}
          </RomanMsg>
        )}

        {/* Po briefie */}
        {mode && !["mode","brief"].includes(step) && (
          <UserMsg>
            {briefFiles.length > 0 && briefFiles.map(f => `📄 ${f.name}`).join(", ")}
            {briefText && briefFiles.length > 0 && " + "}
            {briefText && (briefText.length > 80 ? briefText.slice(0,80) + "..." : briefText)}
          </UserMsg>
        )}

        {/* KROK 3 — Przykłady (tylko social) */}
        {mode === "social" && !["mode","brief"].includes(step) && (
          <RomanMsg>
            Masz przykłady postów lub scenariusze rolek, które klient już zaakceptował? Wgraj je — pomogą mi zrozumieć styl i ton, który klient lubi.

            {step === "examples" && (
              <>
                <FileDropZone
                  files={exampleFiles}
                  onFiles={setExampleFiles}
                  label="Wgraj przykłady (TXT, PDF, Word...)"
                  hint="Nie musisz — możesz pominąć"
                />
                <div className="btn-row">
                  <button className="btn" onClick={() => { setExampleFiles([]); setStep("products"); }}>
                    Pomiń
                  </button>
                  <button className="btn btn-primary" onClick={() => setStep("products")}>
                    {exampleFiles.length > 0 ? "Dalej →" : "Pomiń →"}
                  </button>
                </div>
              </>
            )}
          </RomanMsg>
        )}

        {mode === "social" && !["mode","brief","examples"].includes(step) && (
          <UserMsg>
            {exampleFiles.length > 0 ? exampleFiles.map(f => `📄 ${f.name}`).join(", ") : "Pominięto"}
          </UserMsg>
        )}

        {/* KROK 4 — Materiały o produktach */}
        {mode && !["mode","brief","examples"].includes(step) && step !== "mode" &&
         !(mode === "social" && step === "examples") && (
          <RomanMsg>
            Masz materiały o produktach lub usługach klienta? Katalogi, cenniki, opisy, cokolwiek — wgraj, a będę lepiej rozumiał ofertę.

            {step === "products" && (
              <>
                <FileDropZone
                  files={productFiles}
                  onFiles={setProductFiles}
                  label="Wgraj materiały (PDF, Excel, Word, TXT...)"
                  hint="Możesz pominąć"
                />
                <div className="btn-row">
                  <button className="btn" onClick={() => setStep("notes")}>Pomiń</button>
                  <button className="btn btn-primary" onClick={() => setStep("notes")}>
                    {productFiles.length > 0 ? "Dalej →" : "Pomiń →"}
                  </button>
                </div>
              </>
            )}
          </RomanMsg>
        )}

        {mode && !["mode","brief","examples","products"].includes(step) && (
          <UserMsg>
            {productFiles.length > 0 ? productFiles.map(f => `📄 ${f.name}`).join(", ") : "Brak materiałów"}
          </UserMsg>
        )}

        {/* KROK 5 — Dodatkowe wskazówki */}
        {mode && step === "notes" && (
          <RomanMsg>
            Coś jeszcze? Konkretne wytyczne, czego absolutnie unikać, tone of voice, budżet? Możesz też kliknąć od razu.

            <div className="input-area" style={{ marginTop: 10 }}>
              <textarea
                className="msg-input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="np. Unikamy humoru, target to kobiety 35+, marka jest premium..."
                style={{ minHeight: 60 }}
              />
            </div>
            <div className="btn-row">
              <button className="btn btn-primary" onClick={runPipeline}>
                Działaj Romek 🚀
              </button>
            </div>
          </RomanMsg>
        )}

        {/* RUNNING */}
        {(step === "running" || step === "done") && (
          <>
            {notes && <UserMsg>{notes.length > 80 ? notes.slice(0,80) + "..." : notes}</UserMsg>}

            <RomanMsg>
              {step === "running" ? "Na to czekałem! Zaczynam..." : "Gotowe! Masz to poniżej."}

              {/* Progress */}
              <div className="progress-steps" style={{ marginTop: 12 }}>
                {activeSteps.map((id) => (
                  <div key={id} className={stepClass(id)}>
                    <span className="step-icon">
                      {agentStatus[id] === "running"
                        ? <span className="spin">⟳</span>
                        : AGENT_LABELS[id]?.icon}
                    </span>
                    <div className="step-name">{AGENT_LABELS[id]?.name}</div>
                    <div className="step-status">{stepStatus(id)}</div>
                  </div>
                ))}
              </div>

              {error && <div className="error-box">❌ {error}</div>}

              {/* Results */}
              {Object.keys(results).length > 0 && (
                <ResultTabs mode={mode} results={results} done={done} />
              )}

              {done && (
                <div className="btn-row" style={{ marginTop: 12 }}>
                  <button className="btn" onClick={reset}>Nowy brief</button>
                  <button className="btn" onClick={() => navigator.clipboard.writeText(buildReport())}>
                    Kopiuj raport
                  </button>
                  <button className="btn btn-primary" onClick={download}>
                    Pobierz .md
                  </button>
                </div>
              )}
            </RomanMsg>
          </>
        )}

      </div>
    </div>
  );
}
