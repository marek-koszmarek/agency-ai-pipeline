"use client";
import { useState, useRef, useCallback } from "react";

const MODES = {
  concept:  { label: "Koncept kreatywny", emoji: "💡" },
  strategy: { label: "Strategia",         emoji: "🎯" },
  social:   { label: "Posty i rolki",     emoji: "📱" },
  ads:      { label: "Plan reklamowy",    emoji: "📊" },
};

const SOCIAL_TYPES   = { posts: "Posty", reels: "Pomysły na rolki" };
const TONALITY_TYPES = {
  same:      "Dopasowane do dotychczasowego stylu",
  creative:  "Bardziej kreatywne",
  funny:     "Bardziej humorystyczne",
  product:   "Bardziej produktowe",
  lifestyle: "Bardziej lifestylowe",
};

const AGENT_LABELS = {
  researcher: { icon: "🔍", name: "Researcher" },
  creative:   { icon: "🎨", name: "Creative" },
  analyst:    { icon: "📊", name: "Analyst" },
};

const STEPS_FOR_MODE = {
  concept:  ["researcher","creative","analyst"],
  strategy: ["researcher","creative","analyst"],
  social:   ["researcher","creative"],
  ads:      ["researcher","analyst"],
};

const ACCEPTED = ".txt,.md,.pdf,.xlsx,.xls,.csv,.doc,.docx";

function readAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}

async function prepFiles(fileList) {
  return Promise.all(Array.from(fileList).map(async (f) => ({
    name: f.name, mimeType: f.type, base64: await readAsBase64(f),
  })));
}

function DropZone({ files, onFiles, label, hint }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const add = useCallback(async (fl) => {
    const prep = await prepFiles(fl);
    onFiles((p) => { const n = new Set(p.map((f) => f.name)); return [...p, ...prep.filter((f) => !n.has(f.name))]; });
  }, [onFiles]);
  return (
    <div>
      <div className={`upload-zone${drag ? " drag-over" : ""}`}
        onClick={() => ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
        <input ref={ref} type="file" accept={ACCEPTED} multiple onChange={(e) => add(e.target.files)} />
        <div style={{ fontSize: 20, marginBottom: 6 }}>📎</div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-hint)" }}>{hint}</div>}
      </div>
      {files.length > 0 && (
        <div className="file-chips">
          {files.map((f) => (
            <span key={f.name} className="file-chip">
              {f.name}
              <button onClick={() => onFiles((p) => p.filter((x) => x.name !== f.name))}>x</button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RomanMsg({ children }) {
  return (
    <div className="msg-row">
      <div className="msg-avatar">R</div>
      <div style={{ flex: 1 }}><div className="msg-bubble">{children}</div></div>
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

function ResultTabs({ mode, results }) {
  const tabs = STEPS_FOR_MODE[mode] || ["researcher"];
  const [active, setActive] = useState(tabs[0]);
  const labels = { researcher: "Research", creative: "Kreacja", analyst: "Plan mediowy" };
  const content = results[active] || "";
  return (
    <div>
      <div className="tabs">
        {tabs.map((t) => (
          <button key={t} className={`tab-btn${active === t ? " active" : ""}`} onClick={() => setActive(t)}>
            {AGENT_LABELS[t]?.icon} {labels[t]}
            {results[t] && <span style={{ marginLeft: 4, color: "var(--success-text)", fontSize: 11 }}>✓</span>}
          </button>
        ))}
      </div>
      <div className="result-box">
        {content
          ? <div className="result-text">{content}</div>
          : <div className="empty-state"><span className="spin">⟳</span> Oczekiwanie...</div>}
      </div>
    </div>
  );
}

export default function Home() {
  // History stack — back button pops last entry
  const [history, setHistory] = useState(["mode"]);
  const step = history[history.length - 1];
  const goNext  = (s) => setHistory((p) => [...p, s]);
  const goBack  = () => setHistory((p) => p.length > 1 ? p.slice(0, -1) : p);

  // Form state
  const [mode, setMode] = useState(null);
  const [socialType, setSocialType] = useState(null);        // posts | reels
  const [socialFocus, setSocialFocus] = useState(null);      // specific | general
  const [socialProduct, setSocialProduct] = useState("");    // text about product/event
  const [socialProductFiles, setSocialProductFiles] = useState([]);
  const [socialTonality, setSocialTonality] = useState(null); // same | creative | funny | product | lifestyle
  const [briefText, setBriefText] = useState("");
  const [briefFiles, setBriefFiles] = useState([]);
  const [exampleFiles, setExampleFiles] = useState([]);
  const [productFiles, setProductFiles] = useState([]);
  const [notes, setNotes] = useState("");

  // Pipeline state
  const [agentStatus, setAgentStatus] = useState({});
  const [results, setResults] = useState({});
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const [clarificationQs, setClarificationQs] = useState("");
  const [clarificationAnswers, setClarificationAnswers] = useState("");
  const [researchContent, setResearchContent] = useState("");

  const setAgent = (id, s) => setAgentStatus((p) => ({ ...p, [id]: s }));
  const setResult = (id, c) => setResults((p) => ({ ...p, [id]: c }));

  const resetAll = () => {
    setHistory(["mode"]); setMode(null); setSocialType(null); setSocialFocus(null);
    setSocialProduct(""); setSocialProductFiles([]); setSocialTonality(null);
    setBriefText(""); setBriefFiles([]); setExampleFiles([]); setProductFiles([]);
    setNotes(""); setAgentStatus({}); setResults({}); setDone(false);
    setError(""); setClarificationQs(""); setClarificationAnswers(""); setResearchContent("");
  };

  const buildPayload = (phase = "full", extra = {}) => {
    const allFiles = [
      ...briefFiles,
      ...socialProductFiles,
      ...(mode === "social" ? exampleFiles : []),
      ...productFiles,
    ];
    return {
      mode,
      brief: briefText,
      notes,
      socialType,
      socialFocus,
      socialProduct,
      socialTonality,
      files: allFiles,
      phase,
      ...extra,
    };
  };

  const streamPipeline = async (payload) => {
    const res = await fetch("/api/pipeline", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Błąd serwera"); }

    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = "";
    while (true) {
      const { done: sd, value } = await reader.read();
      if (sd) break;
      buf += dec.decode(value, { stream: true });
      const parts = buf.split("\n\n"); buf = parts.pop();
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
          if (ev.status === "needs_clarification") {
            setClarificationQs(ev.questions);
            setResearchContent(ev.researchContent);
            goNext("clarification");
            return; // pause — user must answer
          }
          if (ev.agent === "all" && ev.status === "done") { setDone(true); }
          if (ev.status === "error") throw new Error(ev.message);
        } catch (_) {}
      }
    }
  };

  const runPipeline = async () => {
    goNext("running");
    setError("");
    try { await streamPipeline(buildPayload("full")); }
    catch (e) { setError(e.message || "Błąd połączenia."); goBack(); }
  };

  const resumeAfterClarification = async () => {
    goNext("running");
    setError("");
    try {
      await streamPipeline(buildPayload("after_clarification", {
        researchContent,
        clarificationAnswers,
      }));
    } catch (e) { setError(e.message || "Błąd połączenia."); goBack(); }
  };

  const buildReport = () => {
    const now = new Date().toLocaleString("pl-PL");
    const parts = [`# RAPORT - ${MODES[mode]?.label}\nData: ${now}\n\nBRIEF:\n${briefText}`];
    if (results.researcher) parts.push(`\nRESEARCH:\n${results.researcher}`);
    if (results.creative) parts.push(`\nKREACJA:\n${results.creative}`);
    if (results.analyst) parts.push(`\nPLAN MEDIOWY:\n${results.analyst}`);
    return parts.join("\n\n" + "=".repeat(60) + "\n\n");
  };

  const download = () => {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([buildReport()], { type: "text/markdown" })),
      download: `roman_${mode}_${new Date().toISOString().slice(0,10)}.md`,
    });
    a.click();
  };

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
    if (s === "done") return "Gotowe";
    return "Oczekuje";
  };

  const BackBtn = ({ label = "Wróć" }) => (
    <button className="btn" style={{ marginRight: "auto" }} onClick={goBack}>← {label}</button>
  );

  const isPast = (s) => {
    const idx = history.indexOf(s);
    return idx !== -1 && idx < history.length - 1;
  };

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

        {/* KROK: WYBÓR TRYBU */}
        <RomanMsg>
          Hej! Co robimy dzisiaj?
          {step === "mode" && (
            <div className="choices">
              {Object.entries(MODES).map(([key, m]) => (
                <button key={key} className="choice-btn" onClick={() => {
                  setMode(key);
                  goNext(key === "social" ? "social_type" : "brief");
                }}>{m.emoji} {m.label}</button>
              ))}
            </div>
          )}
        </RomanMsg>

        {mode && isPast("mode") && <UserMsg>{MODES[mode].emoji} {MODES[mode].label}</UserMsg>}

        {/* SOCIAL: POSTY CZY ROLKI */}
        {mode === "social" && (isPast("social_type") || step === "social_type") && (
          <>
            <RomanMsg>
              Chcesz gotowe posty czy pomysły na rolki?
              {step === "social_type" && (
                <>
                  <div className="choices">
                    {Object.entries(SOCIAL_TYPES).map(([key, label]) => (
                      <button key={key} className="choice-btn" onClick={() => { setSocialType(key); goNext("social_focus"); }}>
                        {label}
                      </button>
                    ))}
                  </div>
                  <div className="btn-row"><BackBtn /></div>
                </>
              )}
            </RomanMsg>
            {isPast("social_type") && socialType && <UserMsg>{SOCIAL_TYPES[socialType]}</UserMsg>}
          </>
        )}

        {/* SOCIAL: KONKRETNY PRODUKT/WYDARZENIE? */}
        {mode === "social" && (isPast("social_focus") || step === "social_focus") && (
          <>
            <RomanMsg>
              Mają dotyczyć konkretnego produktu, usługi lub wydarzenia - czy ogólnie marki?
              {step === "social_focus" && (
                <>
                  <div className="choices">
                    <button className="choice-btn" onClick={() => { setSocialFocus("specific"); goNext("social_product"); }}>Konkretny produkt/wydarzenie</button>
                    <button className="choice-btn" onClick={() => { setSocialFocus("general"); goNext("brief"); }}>Ogólnie marka</button>
                  </div>
                  <div className="btn-row"><BackBtn /></div>
                </>
              )}
            </RomanMsg>
            {isPast("social_focus") && socialFocus && (
              <UserMsg>{socialFocus === "specific" ? "Konkretny produkt/wydarzenie" : "Ogólnie marka"}</UserMsg>
            )}
          </>
        )}

        {/* SOCIAL: OPIS PRODUKTU/WYDARZENIA */}
        {mode === "social" && socialFocus === "specific" && (isPast("social_product") || step === "social_product") && (
          <>
            <RomanMsg>
              Opisz ten produkt, usługę lub wydarzenie - albo wgraj materiały. Im więcej wiem, tym lepiej.
              {step === "social_product" && (
                <>
                  <DropZone files={socialProductFiles} onFiles={setSocialProductFiles}
                    label="Wgraj materiały o produkcie/wydarzeniu" hint="PDF, Word, Excel, TXT..." />
                  <div className="input-area" style={{ marginTop: 10 }}>
                    <textarea className="msg-input" value={socialProduct}
                      onChange={(e) => setSocialProduct(e.target.value)}
                      placeholder="Opisz produkt, usługę lub wydarzenie..." />
                  </div>
                  <div className="btn-row">
                    <BackBtn />
                    <button className="btn btn-primary"
                      disabled={!socialProduct.trim() && socialProductFiles.length === 0}
                      onClick={() => goNext("brief")}>Dalej</button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("social_product") && (
              <UserMsg>
                {socialProductFiles.map(f => `Plik: ${f.name}`).join(", ")}
                {socialProduct && (socialProductFiles.length > 0 ? " + " : "") + (socialProduct.length > 60 ? socialProduct.slice(0,60) + "..." : socialProduct)}
              </UserMsg>
            )}
          </>
        )}

        {/* BRIEF */}
        {(isPast("brief") || step === "brief") && (
          <>
            <RomanMsg>
              {mode === "ads"
                ? "Wgraj brief i dane klienta - Excel, raporty PDF, cokolwiek masz."
                : "Wgraj brief lub opisz projekt tekstem. Im więcej wiesz - tym lepiej zadziała."}
              {step === "brief" && (
                <>
                  <DropZone files={briefFiles} onFiles={setBriefFiles}
                    label="Wgraj brief (PDF, Word, Excel, TXT...)" hint="lub wpisz poniżej" />
                  <div className="input-area" style={{ marginTop: 10 }}>
                    <textarea className="msg-input" value={briefText} onChange={(e) => setBriefText(e.target.value)}
                      placeholder={"Marka:\nProdukt/usługa:\nCel kampanii:\nGrupa docelowa:\nBudżet:\nRynek/kraj:"} />
                  </div>
                  <div className="btn-row">
                    <BackBtn />
                    <button className="btn btn-primary"
                      disabled={!briefText.trim() && briefFiles.length === 0}
                      onClick={() => goNext(mode === "social" ? "social_tonality" : "products")}>Dalej</button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("brief") && (
              <UserMsg>
                {briefFiles.map(f => f.name).join(", ")}
                {briefText && (briefFiles.length > 0 ? " + " : "") + (briefText.length > 60 ? briefText.slice(0,60)+"..." : briefText)}
              </UserMsg>
            )}
          </>
        )}

        {/* SOCIAL: TONALNOŚĆ */}
        {mode === "social" && (isPast("social_tonality") || step === "social_tonality") && (
          <>
            <RomanMsg>
              Czy {SOCIAL_TYPES[socialType]?.toLowerCase()} mają być dopasowane do dotychczasowego stylu klienta - czy chcesz coś zmienić?
              {step === "social_tonality" && (
                <>
                  <div className="choices">
                    {Object.entries(TONALITY_TYPES).map(([key, label]) => (
                      <button key={key} className={`choice-btn${socialTonality === key ? " selected" : ""}`}
                        onClick={() => setSocialTonality(key)}>{label}</button>
                    ))}
                  </div>
                  <div className="btn-row">
                    <BackBtn />
                    <button className="btn btn-primary" disabled={!socialTonality}
                      onClick={() => goNext("examples")}>Dalej</button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("social_tonality") && socialTonality && (
              <UserMsg>{TONALITY_TYPES[socialTonality]}</UserMsg>
            )}
          </>
        )}

        {/* SOCIAL: PRZYKŁADY */}
        {mode === "social" && (isPast("examples") || step === "examples") && (
          <>
            <RomanMsg>
              Masz przykłady postów lub scenariusze rolek, które klient zaakceptował? Wgraj - pomogę zrozumieć styl.
              {step === "examples" && (
                <>
                  <DropZone files={exampleFiles} onFiles={setExampleFiles}
                    label="Wgraj przykłady (opcjonalnie)" hint="TXT, PDF, Word..." />
                  <div className="btn-row">
                    <BackBtn />
                    <button className="btn" onClick={() => { setExampleFiles([]); goNext("products"); }}>Pomiń</button>
                    <button className="btn btn-primary" onClick={() => goNext("products")}>
                      {exampleFiles.length > 0 ? "Dalej" : "Pomiń"}
                    </button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("examples") && (
              <UserMsg>{exampleFiles.length > 0 ? exampleFiles.map(f => f.name).join(", ") : "Pominięto"}</UserMsg>
            )}
          </>
        )}

        {/* MATERIAŁY O PRODUKTACH */}
        {(isPast("products") || step === "products") && (
          <>
            <RomanMsg>
              Masz materiały o produktach lub usługach klienta? Katalogi, cenniki, opisy - wgraj jeśli masz.
              {step === "products" && (
                <>
                  <DropZone files={productFiles} onFiles={setProductFiles}
                    label="Wgraj materiały (opcjonalnie)" hint="PDF, Excel, Word, TXT..." />
                  <div className="btn-row">
                    <BackBtn />
                    <button className="btn" onClick={() => { setProductFiles([]); goNext("notes"); }}>Pomiń</button>
                    <button className="btn btn-primary" onClick={() => goNext("notes")}>
                      {productFiles.length > 0 ? "Dalej" : "Pomiń"}
                    </button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("products") && (
              <UserMsg>{productFiles.length > 0 ? productFiles.map(f => f.name).join(", ") : "Brak materiałów"}</UserMsg>
            )}
          </>
        )}

        {/* WSKAZÓWKI + URUCHOMIENIE */}
        {(isPast("notes") || step === "notes") && (
          <>
            <RomanMsg>
              Coś jeszcze? Wytyczne, czego unikać, tone of voice? Możesz też od razu kliknąć.
              {step === "notes" && (
                <>
                  <div className="input-area" style={{ marginTop: 10 }}>
                    <textarea className="msg-input" value={notes} onChange={(e) => setNotes(e.target.value)}
                      placeholder="np. Unikamy humoru, target to kobiety 35+, marka premium..."
                      style={{ minHeight: 60 }} />
                  </div>
                  <div className="btn-row">
                    <BackBtn />
                    <button className="btn btn-primary" onClick={runPipeline}>Działaj Romek 🚀</button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("notes") && notes && <UserMsg>{notes.length > 80 ? notes.slice(0,80)+"..." : notes}</UserMsg>}
          </>
        )}

        {/* CLARIFICATION — Roman pyta usera */}
        {(isPast("clarification") || step === "clarification") && (
          <>
            <RomanMsg>
              Mam kilka pytań zanim pójdę dalej:
              <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--bg)", borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", border: "1px solid var(--border)" }}>
                {clarificationQs}
              </div>
              {step === "clarification" && (
                <>
                  <div className="input-area" style={{ marginTop: 10 }}>
                    <textarea className="msg-input" value={clarificationAnswers}
                      onChange={(e) => setClarificationAnswers(e.target.value)}
                      placeholder="Twoje odpowiedzi..."
                      style={{ minHeight: 80 }} />
                  </div>
                  <div className="btn-row">
                    <button className="btn btn-primary" disabled={!clarificationAnswers.trim()}
                      onClick={resumeAfterClarification}>Działaj Romek 🚀</button>
                  </div>
                </>
              )}
            </RomanMsg>
            {isPast("clarification") && clarificationAnswers && (
              <UserMsg>{clarificationAnswers.length > 80 ? clarificationAnswers.slice(0,80)+"..." : clarificationAnswers}</UserMsg>
            )}
          </>
        )}

        {/* RUNNING / DONE */}
        {(step === "running" || done) && (
          <RomanMsg>
            {done ? "Gotowe!" : "Na to czekałem! Zaczynam..."}
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
            {error && <div className="error-box">Błąd: {error}</div>}
            {Object.keys(results).length > 0 && <ResultTabs mode={mode} results={results} />}
            {done && (
              <div className="btn-row" style={{ marginTop: 12 }}>
                <button className="btn" onClick={resetAll}>Nowy brief</button>
                <button className="btn" onClick={() => navigator.clipboard.writeText(buildReport())}>Kopiuj</button>
                <button className="btn btn-primary" onClick={download}>Pobierz .md</button>
              </div>
            )}
          </RomanMsg>
        )}

      </div>
    </div>
  );
}
