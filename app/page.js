"use client";
import { useState, useRef, useCallback, useEffect } from "react";

// ── Stale ────────────────────────────────────────────────────────
const MODES = {
  concept:  { label: "Koncept kreatywny", emoji: "💡" },
  strategy: { label: "Strategia",         emoji: "🎯" },
  social:   { label: "Posty i rolki",     emoji: "📱" },
  ads:      { label: "Plan reklamowy",    emoji: "📊" },
};
const SOCIAL_TYPES = { posts: "Posty", reels: "Pomysly na rolki" };
const TONALITY_TYPES = {
  same: "Dopasowane do stylu klienta", creative: "Bardziej kreatywne",
  funny: "Bardziej humorystyczne", product: "Bardziej produktowe", lifestyle: "Bardziej lifestylowe",
};
const LOGO_POSITIONS = {
  bottom_right: "Dol prawy", bottom_left: "Dol lewy", bottom_center: "Dol srodek",
  top_right: "Gora prawy", top_left: "Gora lewy", center: "Centrum", roman: "Roman decyduje",
};
const AGENT_LABELS = {
  researcher:     { icon: "🔍", name: "Researcher" },
  creative:       { icon: "🎨", name: "Creative" },
  analyst:        { icon: "📊", name: "Analyst" },
  social_content: { icon: "📱", name: "Social" },
};
const STEPS_FOR_MODE = {
  concept: ["researcher","creative","analyst"],
  strategy: ["researcher","creative","analyst"],
  social: ["researcher","creative"],
  ads: ["researcher","analyst"],
};
const DESIGN_FORMATS = [
  { key: "instagram_feed",   label: "IG Feed 4:5" },
  { key: "instagram_story",  label: "IG Story 9:16" },
  { key: "instagram_square", label: "IG Square 1:1" },
  { key: "facebook_feed",    label: "FB Feed 4:5" },
];
const ACCEPTED = ".txt,.md,.pdf,.xlsx,.xls,.csv,.doc,.docx";
const IMG_ACCEPTED = ".png,.jpg,.jpeg,.webp";
const FONT_ACCEPTED = ".ttf,.otf,.woff,.woff2";

// ── Helpers ───────────────────────────────────────────────────────
function readAsBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = (e) => res(e.target.result.split(",")[1]);
    r.onerror = rej;
    r.readAsDataURL(file);
  });
}
async function prepFiles(fl) {
  return Promise.all(Array.from(fl).map(async (f) => ({
    name: f.name, mimeType: f.type, base64: await readAsBase64(f),
  })));
}

function DropZone({ files, onFiles, label, hint, accept = ACCEPTED, single = false }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const add = useCallback(async (fl) => {
    const prep = await prepFiles(fl);
    if (single) { onFiles(prep.slice(0, 1)); return; }
    onFiles((p) => { const n = new Set((Array.isArray(p) ? p : []).map(f => f.name)); return [...(Array.isArray(p) ? p : []), ...prep.filter(f => !n.has(f.name))]; });
  }, [onFiles, single]);
  return (
    <div>
      <div className={`upload-zone${drag ? " drag-over" : ""}`}
        onClick={() => ref.current.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
        <input ref={ref} type="file" accept={accept} multiple={!single} onChange={(e) => add(e.target.files)} />
        <div style={{ fontSize: 20, marginBottom: 6 }}>📎</div>
        <div style={{ fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 12, marginTop: 4, color: "var(--text-hint)" }}>{hint}</div>}
      </div>
      {(Array.isArray(files) ? files : []).length > 0 && (
        <div className="file-chips">
          {(Array.isArray(files) ? files : []).map((f) => (
            <span key={f.name} className="file-chip">
              {f.name}
              <button onClick={() => onFiles(Array.isArray(files) ? files.filter(x => x.name !== f.name) : [])}>x</button>
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

function ResultTabs({ mode, results, extraTabs = [] }) {
  const baseTabs = (STEPS_FOR_MODE[mode] || ["researcher"]).filter(t => results[t]);
  const allTabs = [...baseTabs, ...extraTabs.filter(t => results[t.key])];
  const [active, setActive] = useState(allTabs[0]?.key || allTabs[0]);
  const labels = { researcher: "Research", creative: "Kreacja", analyst: "Plan mediowy" };
  const getContent = (t) => typeof t === "string" ? results[t] : results[t.key];
  const getLabel = (t) => typeof t === "string" ? (labels[t] || t) : t.label;
  const getKey = (t) => typeof t === "string" ? t : t.key;
  return (
    <div>
      <div className="tabs">
        {allTabs.map((t) => (
          <button key={getKey(t)} className={`tab-btn${active === getKey(t) ? " active" : ""}`} onClick={() => setActive(getKey(t))}>
            {typeof t === "string" ? (AGENT_LABELS[t]?.icon || "") : ""} {getLabel(t)}
            {getContent(t) && <span style={{ marginLeft: 4, color: "var(--success-text)", fontSize: 11 }}>✓</span>}
          </button>
        ))}
      </div>
      <div className="result-box">
        {getContent(active)
          ? <div className="result-text">{getContent(active)}</div>
          : <div className="empty-state"><span className="spin">⟳</span></div>}
      </div>
    </div>
  );
}

function DesignVariant({ variant, variantNum, selectedFormats }) {
  const [activeFormat, setActiveFormat] = useState(selectedFormats[0]);
  const imgData = variant.formats[activeFormat];
  const fmt = DESIGN_FORMATS.find(f => f.key === activeFormat);
  const dl = () => {
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${imgData}`;
    a.download = `roman_w${variantNum}_${activeFormat}.png`;
    a.click();
  };
  return (
    <div style={{ border: "1px solid var(--border)", borderRadius: 12, overflow: "hidden", marginBottom: 12 }}>
      <div style={{ padding: "10px 14px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <strong style={{ fontSize: 14 }}>Wariant {variantNum}</strong>
        <button className="btn" style={{ fontSize: 12, padding: "4px 10px" }} onClick={dl}>Pobierz PNG</button>
      </div>
      <div style={{ display: "flex", gap: 4, padding: "8px 12px", flexWrap: "wrap", borderBottom: "1px solid var(--border)" }}>
        {selectedFormats.map(fk => {
          const f = DESIGN_FORMATS.find(x => x.key === fk);
          return (
            <button key={fk} className={`choice-btn${activeFormat === fk ? " selected" : ""}`}
              style={{ fontSize: 12, padding: "4px 10px" }} onClick={() => setActiveFormat(fk)}>{f?.label}</button>
          );
        })}
      </div>
      {imgData
        ? <img src={`data:image/png;base64,${imgData}`} alt={`Wariant ${variantNum}`}
            style={{ width: "100%", display: "block", maxHeight: 400, objectFit: "contain", background: "#f5f5f5" }} />
        : <div className="empty-state" style={{ minHeight: 200 }}>Generowanie...</div>
      }
    </div>
  );
}

// ── Main ──────────────────────────────────────────────────────────
export default function Home() {
  const [history, setHistory] = useState(["mode"]);
  const step = history[history.length - 1];
  const goNext = (s) => setHistory(p => [...p, s]);
  const goBack = () => setHistory(p => p.length > 1 ? p.slice(0, -1) : p);
  const isPast = (s) => { const i = history.indexOf(s); return i !== -1 && i < history.length - 1; };

  // Brief state
  const [mode, setMode] = useState(null);
  const [socialType, setSocialType] = useState(null);
  const [socialFocus, setSocialFocus] = useState(null);
  const [socialProduct, setSocialProduct] = useState("");
  const [socialProductFiles, setSocialProductFiles] = useState([]);
  const [socialTonality, setSocialTonality] = useState(null);
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

  // Post-pipeline options
  const [wantsAnalyst, setWantsAnalyst] = useState(null);
  const [wantsSocial, setWantsSocial] = useState(null); // after concept/strategy
  const [socialFromStrategyType, setSocialFromStrategyType] = useState(null);
  const [socialFromStrategyTonality, setSocialFromStrategyTonality] = useState(null);

  // Design state
  const [researchBrand, setResearchBrand] = useState(false);
  const [wantsDesign, setWantsDesign] = useState(null);
  const [selectedPostForDesign, setSelectedPostForDesign] = useState("");
  const [hasBrandAssets, setHasBrandAssets] = useState(null);
  const [logoFile, setLogoFile] = useState([]);
  const [fontFile, setFontFile] = useState([]);
  const [brandColors, setBrandColors] = useState("");
  const [logoPosition, setLogoPosition] = useState(null);
  const [designTextChoice, setDesignTextChoice] = useState(null);
  const [designText, setDesignText] = useState("");
  const [selectedFormats, setSelectedFormats] = useState(DESIGN_FORMATS.map(f => f.key));
  const [socialDone, setSocialDone] = useState(false);
  const [designVariants, setDesignVariants] = useState([]);
  const [designGenerating, setDesignGenerating] = useState(false);
  const [designError, setDesignError] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [designIteration, setDesignIteration] = useState(0);

  const setAgent = (id, s) => setAgentStatus(p => ({ ...p, [id]: s }));
  const setResult = (id, c) => setResults(p => ({ ...p, [id]: c }));

  // Auto-scroll to bottom when new content appears
  const messagesEndRef = useRef(null);
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [step, Object.keys(agentStatus).length, Object.keys(results).length, error, clarificationQs]);

  const resetAll = () => {
    setHistory(["mode"]); setMode(null); setSocialType(null); setSocialFocus(null);
    setSocialProduct(""); setSocialProductFiles([]); setSocialTonality(null);
    setBriefText(""); setBriefFiles([]); setExampleFiles([]); setProductFiles([]);
    setNotes(""); setAgentStatus({}); setResults({}); setDone(false); setError("");
    setClarificationQs(""); setClarificationAnswers(""); setResearchContent("");
    setResearchBrand(false); setSocialDone(false); setWantsAnalyst(null); setWantsSocial(null); setSocialFromStrategyType(null); setSocialFromStrategyTonality(null);
    setWantsDesign(null); setSelectedPostForDesign(""); setHasBrandAssets(null);
    setLogoFile([]); setFontFile([]); setBrandColors(""); setLogoPosition(null);
    setDesignTextChoice(null); setDesignText(""); setSelectedFormats(DESIGN_FORMATS.map(f => f.key));
    setDesignVariants([]); setDesignGenerating(false); setDesignError(""); setFeedbackText(""); setDesignIteration(0);
  };

  const getFiles = () => [
    ...briefFiles,
    ...socialProductFiles,
    ...(mode === "social" ? exampleFiles : []),
    ...productFiles,
  ];

  // ── Stream helper ────────────────────────────────────────────────
  const streamFromAPI = async (payload, path = "/api/pipeline") => {
    const res = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
    });
    if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error(e.error || "Blad serwera"); }
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
            setClarificationQs(ev.questions); setResearchContent(ev.researchContent);
            goNext("clarification"); return false;
          }
          if (ev.agent === "social_content" && ev.status === "done") setSocialDone(true);
          if (ev.agent === "all" && ev.status === "done") return true;
          if (ev.status === "error") throw new Error(ev.message);
        } catch (_) {}
      }
    }
    return true;
  };

  const runPipeline = async () => {
    goNext("running"); setError("");
    try {
      const ok = await streamFromAPI({
        mode, brief: briefText, notes,
        socialType, socialFocus, socialProduct, socialTonality,
        files: getFiles(), phase: "full",
        runAnalyst: false,
        researchBrand, // analyst always optional now
      });
      if (ok) setDone(true);
    } catch (e) { setError(e.message); goBack(); }
  };

  const runAfterClarification = async () => {
    goNext("running"); setError("");
    try {
      const ok = await streamFromAPI({
        mode, brief: briefText, notes,
        socialType, socialFocus, socialProduct, socialTonality,
        files: getFiles(), phase: "after_clarification",
        researchContent, clarificationAnswers, runAnalyst: false,
      });
      if (ok) setDone(true);
    } catch (e) { setError(e.message); goBack(); }
  };

  const runAnalystNow = async () => {
    goNext("running_analyst"); setError(""); setWantsAnalyst(true);
    setAgent("analyst", "running");
    try {
      await streamFromAPI({
        phase: "analyst_only",
        brief: briefText, files: getFiles(),
        researchContent: results.researcher || "",
        creativeContent: results.creative || "",
      });
    } catch (e) { setError(e.message); }
  };

  const runSocialFromStrategy = async () => {
    goNext("running_social"); setError(""); setSocialDone(false);
    try {
      await streamFromAPI({
        mode: "social_from_strategy", brief: briefText, files: getFiles(),
        phase: "social_from_strategy",
        socialType: socialFromStrategyType,
        socialTonality: socialFromStrategyTonality,
        existingResearch: results.researcher || "",
        existingCreative: results.creative || "",
      });
      setSocialDone(true);
    } catch (e) { setError(e.message); setSocialDone(true); }
  };

  // ── Design ───────────────────────────────────────────────────────
  const runDesign = async (iteration = 0, feedback = "") => {
    setDesignGenerating(true); setDesignError(""); setDesignVariants([]);
    try {
      const concept = results.creative || results.researcher || briefText;
      const colors = brandColors.split(/[,\s]+/).filter(Boolean);
      const actualText = designTextChoice === "custom" ? designText : "";

      const res = await fetch("/design", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.slice(0, 2000),
          postContent: selectedPostForDesign,
          brandColors: colors,
          logoBase64: logoFile[0]?.base64 || null,
          fontBase64: fontFile[0]?.base64 || null,
          textOnImage: actualText || null,
          logoPosition: logoPosition || "bottom_right",
          feedbackIteration: iteration,
          feedbackNotes: feedback,
          selectedFormats,
        }),
      });
      if (!res.ok) { const e = await res.text().catch(()=>""); throw new Error(`Blad API (${res.status}): ${e.slice(0,80)}`); }
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
            if (ev.status === "variant_done") setDesignVariants(p => [...p, ev.data]);
            if (ev.status === "error") throw new Error(ev.message);
          } catch (_) {}
        }
      }
      setDesignIteration(iteration + 1);
    } catch (e) { setDesignError(e.message); }
    finally { setDesignGenerating(false); }
  };

  // ── Word download ────────────────────────────────────────────────
  const downloadWord = async () => {
    const sections = [];
    if (results.researcher) sections.push({ heading: "Research i Insighty", content: results.researcher });
    if (results.creative) sections.push({ heading: "Koncepcje Kreatywne", content: results.creative });
    if (results["social_from_strategy"]) sections.push({ heading: "Posty i Rolki", content: results["social_from_strategy"] });
    if (results.analyst) sections.push({ heading: "Plan Reklamowy", content: results.analyst });

    const res = await fetch("/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Roman - ${MODES[mode]?.label || "Raport"}`, sections }),
    });
    if (!res.ok) {
      alert("Blad eksportu Word. Sprobuj ponownie.");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roman_${mode}_${new Date().toISOString().slice(0,10)}.docx`;
    a.click();
  };

  // ── UI helpers ───────────────────────────────────────────────────
  const activeSteps = mode ? (STEPS_FOR_MODE[mode] || []) : [];
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
  const BackBtn = () => (
    <button className="btn" style={{ marginRight: "auto" }} onClick={goBack}>← Wróc</button>
  );

  // Which steps to show in progress bar
  const currentSteps = (() => {
    if (["running_analyst"].includes(step)) return ["analyst"];
    if (["running_social"].includes(step)) return ["social_content"];
    return activeSteps;
  })();

  const isRunning = step === "running" || step === "running_analyst" || step === "running_social";
  const showDesignFlow = done && (mode === "concept" || mode === "strategy" || mode === "social");

  return (
    <div className="app">
      <div className="header">
        <div className="header-avatar">R</div>
        <div><div className="header-title">Luzny Roman</div><div className="header-sub">Twoj partner od kreacji i strategii</div></div>
      </div>

      <div className="messages" ref={messagesEndRef}>

        {/* MODE */}
        <RomanMsg>
          Hej! Co robimy dzisiaj?
          {step === "mode" && (
            <div className="choices">
              {Object.entries(MODES).map(([key, m]) => (
                <button key={key} className="choice-btn" onClick={() => {
                  setMode(key); goNext(key === "social" ? "social_type" : "brief");
                }}>{m.emoji} {m.label}</button>
              ))}
            </div>
          )}
        </RomanMsg>
        {mode && isPast("mode") && <UserMsg>{MODES[mode].emoji} {MODES[mode].label}</UserMsg>}

        {/* SOCIAL TYPE */}
        {mode === "social" && (isPast("social_type") || step === "social_type") && (
          <><RomanMsg>
            Posty czy pomysly na rolki?
            {step === "social_type" && (
              <><div className="choices">
                {Object.entries(SOCIAL_TYPES).map(([k, v]) => (
                  <button key={k} className="choice-btn" onClick={() => { setSocialType(k); goNext("social_focus"); }}>{v}</button>
                ))}
              </div><div className="btn-row"><BackBtn /></div></>
            )}
          </RomanMsg>
          {isPast("social_type") && socialType && <UserMsg>{SOCIAL_TYPES[socialType]}</UserMsg>}
          </>
        )}

        {/* SOCIAL FOCUS */}
        {mode === "social" && (isPast("social_focus") || step === "social_focus") && (
          <><RomanMsg>
            Konkretny produkt/wydarzenie czy ogolnie marka?
            {step === "social_focus" && (
              <><div className="choices">
                <button className="choice-btn" onClick={() => { setSocialFocus("specific"); goNext("social_product"); }}>Konkretny produkt/wydarzenie</button>
                <button className="choice-btn" onClick={() => { setSocialFocus("general"); goNext("brief"); }}>Ogolnie marka</button>
              </div><div className="btn-row"><BackBtn /></div></>
            )}
          </RomanMsg>
          {isPast("social_focus") && socialFocus && <UserMsg>{socialFocus === "specific" ? "Konkretny produkt/wydarzenie" : "Ogolnie marka"}</UserMsg>}
          </>
        )}

        {/* SOCIAL PRODUCT */}
        {mode === "social" && socialFocus === "specific" && (isPast("social_product") || step === "social_product") && (
          <><RomanMsg>
            Opisz produkt lub wydarzenie - albo wgraj materialy.
            {step === "social_product" && (
              <>
                <DropZone files={socialProductFiles} onFiles={setSocialProductFiles} label="Wgraj materialy o produkcie" hint="PDF, Word, Excel..." />
                <div className="input-area" style={{ marginTop: 10 }}>
                  <textarea className="msg-input" value={socialProduct} onChange={e => setSocialProduct(e.target.value)} placeholder="Opisz produkt lub wydarzenie..." />
                </div>
                <div className="btn-row">
                  <BackBtn />
                  <button className="btn btn-primary" disabled={!socialProduct.trim() && socialProductFiles.length === 0} onClick={() => goNext("brief")}>Dalej</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("social_product") && <UserMsg>{socialProduct ? socialProduct.slice(0,60)+"..." : socialProductFiles.map(f=>f.name).join(", ")}</UserMsg>}
          </>
        )}

        {/* BRIEF */}
        {(isPast("brief") || step === "brief") && (
          <><RomanMsg>
            {mode === "ads" ? "Wgraj brief i dane klienta." : "Wgraj brief lub opisz projekt tekstem."}
            {step === "brief" && (
              <>
                <DropZone files={briefFiles} onFiles={setBriefFiles} label="Wgraj brief (PDF, Word, Excel, TXT...)" hint="lub wpisz ponizej" />
                <div className="input-area" style={{ marginTop: 10 }}>
                  <textarea className="msg-input" value={briefText} onChange={e => setBriefText(e.target.value)}
                    placeholder={"Marka:\nProdukt/usluga:\nCel kampanii:\nGrupa docelowa:\nBudzet:\nRynek/kraj:"} />
                </div>
                <div className="btn-row">
                  <BackBtn />
                  <button className="btn btn-primary" disabled={!briefText.trim() && briefFiles.length === 0}
                    onClick={() => goNext(mode === "social" ? "social_tonality" : "products")}>Dalej</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("brief") && <UserMsg>{briefText ? briefText.slice(0,60)+"..." : briefFiles.map(f=>f.name).join(", ")}</UserMsg>}
          </>
        )}

        {/* SOCIAL TONALITY */}
        {mode === "social" && (isPast("social_tonality") || step === "social_tonality") && (
          <><RomanMsg>
            Jaka tonalnosc?
            {step === "social_tonality" && (
              <>
                <div className="choices">
                  {Object.entries(TONALITY_TYPES).map(([k, v]) => (
                    <button key={k} className={`choice-btn${socialTonality === k ? " selected" : ""}`} onClick={() => setSocialTonality(k)}>{v}</button>
                  ))}
                </div>
                <div className="btn-row"><BackBtn />
                  <button className="btn btn-primary" disabled={!socialTonality} onClick={() => goNext("examples")}>Dalej</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("social_tonality") && socialTonality && <UserMsg>{TONALITY_TYPES[socialTonality]}</UserMsg>}
          </>
        )}

        {/* EXAMPLES */}
        {mode === "social" && (isPast("examples") || step === "examples") && (
          <><RomanMsg>
            Masz przyklady zaakceptowanych postow lub rolek? Wgraj - zrozumiem styl klienta.
            {step === "examples" && (
              <>
                <DropZone files={exampleFiles} onFiles={setExampleFiles} label="Wgraj przyklady (opcjonalnie)" />
                <div className="btn-row">
                  <BackBtn />
                  <button className="btn" onClick={() => { setExampleFiles([]); goNext("products"); }}>Pominaj</button>
                  <button className="btn btn-primary" onClick={() => goNext("products")}>{exampleFiles.length > 0 ? "Dalej" : "Pominaj"}</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("examples") && <UserMsg>{exampleFiles.length > 0 ? exampleFiles.map(f=>f.name).join(", ") : "Pominieto"}</UserMsg>}
          </>
        )}

        {/* PRODUCTS */}
        {(isPast("products") || step === "products") && (
          <><RomanMsg>
            Masz materialy o produktach lub uslugach klienta? (katalogi, opisy, cenniki, briefy)
            <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 4 }}>Jesli nie - Roman przeprowadzi research samodzielnie</div>
            {step === "products" && (
              <>
                <DropZone files={productFiles} onFiles={setProductFiles} label="Wgraj materialy (opcjonalnie)" hint="PDF, Excel, Word, TXT..." />
                <div className="btn-row">
                  <BackBtn />
                  <button className="btn" onClick={() => { setProductFiles([]); setResearchBrand(true); goNext("notes"); }}>Szukaj samodzielnie</button>
                  <button className="btn btn-primary" onClick={() => { setResearchBrand(false); goNext("notes"); }}>{productFiles.length > 0 ? "Dalej" : "Pominaj"}</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("products") && <UserMsg>{productFiles.length > 0 ? productFiles.map(f=>f.name).join(", ") : "Brak materialow"}</UserMsg>}
          </>
        )}

        {/* NOTES */}
        {(isPast("notes") || step === "notes") && (
          <><RomanMsg>
            Cos jeszcze? Wytyczne, czego unikac?
            {step === "notes" && (
              <>
                <div className="input-area" style={{ marginTop: 10 }}>
                  <textarea className="msg-input" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="np. Unikamy humoru, target to kobiety 35+..." style={{ minHeight: 60 }} />
                </div>
                <div className="btn-row"><BackBtn /><button className="btn btn-primary" onClick={runPipeline}>Dzialaj Romek 🚀</button></div>
              </>
            )}
          </RomanMsg>
          {isPast("notes") && notes && <UserMsg>{notes.slice(0,60)}</UserMsg>}
          </>
        )}

        {/* CLARIFICATION */}
        {(isPast("clarification") || step === "clarification") && (
          <><RomanMsg>
            Mam kilka pytan zanim pojde dalej:
            <div style={{ marginTop: 8, padding: "10px 14px", background: "var(--bg)", borderRadius: 8, fontSize: 13, whiteSpace: "pre-wrap", border: "1px solid var(--border)" }}>
              {clarificationQs}
            </div>
            {step === "clarification" && (
              <>
                <div className="input-area" style={{ marginTop: 10 }}>
                  <textarea className="msg-input" value={clarificationAnswers} onChange={e => setClarificationAnswers(e.target.value)}
                    placeholder="Twoje odpowiedzi..." style={{ minHeight: 80 }} />
                </div>
                <div className="btn-row">
                  <button className="btn btn-primary" disabled={!clarificationAnswers.trim()} onClick={runAfterClarification}>Dzialaj Romek 🚀</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("clarification") && clarificationAnswers && <UserMsg>{clarificationAnswers.slice(0,60)}</UserMsg>}
          </>
        )}

        {/* RUNNING */}
        {isRunning && (
          <RomanMsg>
            Zaczynam...
            <div className="progress-steps" style={{ marginTop: 12 }}>
              {currentSteps.map(id => (
                <div key={id} className={stepClass(id)}>
                  <span className="step-icon">{agentStatus[id] === "running" ? <span className="spin">⟳</span> : AGENT_LABELS[id]?.icon}</span>
                  <div className="step-name">{AGENT_LABELS[id]?.name}</div>
                  <div className="step-status">{stepStatus(id)}</div>
                </div>
              ))}
            </div>
            {error && <div className="error-box">Blad: {error}</div>}
            {Object.keys(results).length > 0 && (
              <ResultTabs mode={mode} results={results}
                extraTabs={results["social_content"] ? [{ key: "social_content", label: "📱 Posty/Rolki" }] : []} />
            )}
          </RomanMsg>
        )}

        {/* DONE - RESULTS */}
        {(done || socialDone) && !isRunning && (
          <RomanMsg>
            Gotowe!
            <ResultTabs mode={mode} results={results}
              extraTabs={results["social_content"] ? [{ key: "social_content", label: "📱 Posty/Rolki" }] : []} />
            <div className="btn-row" style={{ marginTop: 12 }}>
              <button className="btn" onClick={resetAll}>Nowy brief</button>
              <button className="btn btn-primary" onClick={downloadWord}>Pobierz Word (.docx)</button>
            </div>
          </RomanMsg>
        )}

        {/* ── POST-PIPELINE OPTIONS ── */}

        {/* 1. Czy plan reklamowy? (concept/strategy/social) */}
        {(done || socialDone) && mode !== "ads" && wantsAnalyst === null && (
          <RomanMsg>
            Czy przygotowac plan reklamowy (budzety, benchmarki, konfiguracja analityki)?
            <div className="choices">
              <button className="choice-btn" onClick={() => { runAnalystNow(); }}>Tak, przygotuj plan</button>
              <button className="choice-btn" onClick={() => setWantsAnalyst(false)}>Nie, dziekuje</button>
            </div>
          </RomanMsg>
        )}
        {wantsAnalyst === false && <UserMsg>Nie, dziekuje</UserMsg>}
        {wantsAnalyst === true && results.analyst && <UserMsg>Tak, przygotuj plan</UserMsg>}

        {/* 2. Czy posty/rolki? (po concept/strategy) */}
        {done && (mode === "concept" || mode === "strategy") && wantsAnalyst !== null && wantsSocial === null && (
          <RomanMsg>
            Czy przygotowac posty lub rolki na podstawie tej strategii/konceptu?
            <div className="choices">
              <button className="choice-btn" onClick={() => setWantsSocial(true)}>Tak</button>
              <button className="choice-btn" onClick={() => setWantsSocial(false)}>Nie, dziekuje</button>
            </div>
          </RomanMsg>
        )}
        {wantsSocial === false && <UserMsg>Nie, dziekuje</UserMsg>}

        {/* 2b. Jaki typ social? */}
        {done && wantsSocial === true && socialFromStrategyType === null && (
          <RomanMsg>
            Posty czy rolki?
            <div className="choices">
              {Object.entries(SOCIAL_TYPES).map(([k, v]) => (
                <button key={k} className="choice-btn" onClick={() => setSocialFromStrategyType(k)}>{v}</button>
              ))}
            </div>
          </RomanMsg>
        )}

        {/* 2c. Tonalnosc dla social from strategy */}
        {done && wantsSocial === true && socialFromStrategyType !== null && socialFromStrategyTonality === null && (
          <RomanMsg>
            Jaka tonalnosc?
            <div className="choices">
              {Object.entries(TONALITY_TYPES).map(([k, v]) => (
                <button key={k} className="choice-btn" onClick={() => { setSocialFromStrategyTonality(k); runSocialFromStrategy(); }}>
                  {v}
                </button>
              ))}
            </div>
          </RomanMsg>
        )}

        {/* 3. Czy grafiki? */}
        {done && showDesignFlow && wantsAnalyst !== null
          && (wantsSocial !== null || (mode !== "concept" && mode !== "strategy"))
          && (wantsSocial !== true || socialDone || wantsSocial === false)
          && wantsDesign === null && (
          <RomanMsg>
            Czy chcesz zobaczyc propozycje wizualizacji graficznych?
            <div className="choices">
              <button className="choice-btn" onClick={() => { setWantsDesign(true); goNext("design_post_select"); }}>Tak, generuj wizualizacje</button>
              <button className="choice-btn" onClick={() => setWantsDesign(false)}>Nie, dziekuje</button>
            </div>
          </RomanMsg>
        )}
        {wantsDesign === false && <UserMsg>Nie, dziekuje</UserMsg>}

        {/* DESIGN FLOW */}

        {/* Post selection (for social) */}
        {wantsDesign && (isPast("design_post_select") || step === "design_post_select") && (results.creative || results["social_from_strategy"]) && (mode === "social" || wantsSocial) && (
          <><RomanMsg>
            Grafika bedzie odnosic sie do konkretnego posta. Opisz lub wklej tresc posta do ktorego chcesz grafike.
            {step === "design_post_select" && (
              <>
                <div className="input-area" style={{ marginTop: 10 }}>
                  <textarea className="msg-input" value={selectedPostForDesign} onChange={e => setSelectedPostForDesign(e.target.value)}
                    placeholder="Wklej tresc wybranego posta lub opisz o czym ma byc grafika..."
                    style={{ minHeight: 80 }} />
                </div>
                <div className="btn-row">
                  <button className="btn" onClick={() => goNext("design_assets")}>Pominaj (ogolna grafika)</button>
                  <button className="btn btn-primary" disabled={!selectedPostForDesign.trim()} onClick={() => goNext("design_assets")}>Dalej</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("design_post_select") && <UserMsg>{selectedPostForDesign ? selectedPostForDesign.slice(0,60)+"..." : "Ogolna grafika"}</UserMsg>}
          </>
        )}

        {/* Assets */}
        {wantsDesign && (isPast("design_assets") || step === "design_assets") && (
          <><RomanMsg>
            Masz logo, font i kolory klienta?
            {step === "design_assets" && (
              <>
                <div className="choices">
                  <button className="choice-btn" onClick={() => { setHasBrandAssets(true); goNext("design_upload"); }}>Tak, wgram</button>
                  <button className="choice-btn" onClick={() => { setHasBrandAssets(false); goNext("design_position"); }}>Nie - Roman robi co moze</button>
                </div>
                <div className="btn-row"><BackBtn /></div>
              </>
            )}
          </RomanMsg>
          {isPast("design_assets") && <UserMsg>{hasBrandAssets ? "Tak, mam assety" : "Brak assetow"}</UserMsg>}
          </>
        )}

        {/* Upload assets */}
        {wantsDesign && hasBrandAssets && (isPast("design_upload") || step === "design_upload") && (
          <><RomanMsg>
            Wgraj logo (PNG), font (TTF) i podaj kolory HEX.
            {step === "design_upload" && (
              <>
                <div style={{ marginTop: 10 }}>
                  <div className="field-label">Logo (PNG z przezroczystoscia)</div>
                  <DropZone files={logoFile} onFiles={setLogoFile} label="Wgraj logo" accept={IMG_ACCEPTED} single />
                </div>
                <div style={{ marginTop: 10 }}>
                  <div className="field-label">Font marki (TTF, OTF)</div>
                  <DropZone files={fontFile} onFiles={setFontFile} label="Wgraj font" accept={FONT_ACCEPTED} single />
                </div>
                <div className="input-area" style={{ marginTop: 10 }}>
                  <input type="text" placeholder="Kolory HEX np. #FF5733, #2C3E50" value={brandColors}
                    onChange={e => setBrandColors(e.target.value)}
                    style={{ width: "100%", border: "none", background: "none", outline: "none", fontFamily: "inherit", fontSize: 14 }} />
                </div>
                <div className="btn-row"><BackBtn /><button className="btn btn-primary" onClick={() => goNext("design_position")}>Dalej</button></div>
              </>
            )}
          </RomanMsg>
          {isPast("design_upload") && <UserMsg>Logo: {logoFile[0]?.name || "brak"} | Font: {fontFile[0]?.name || "brak"}</UserMsg>}
          </>
        )}

        {/* Logo position */}
        {wantsDesign && (isPast("design_position") || step === "design_position") && (
          <><RomanMsg>
            Gdzie ma byc logo?
            {step === "design_position" && (
              <>
                <div className="choices">
                  {Object.entries(LOGO_POSITIONS).map(([k, v]) => (
                    <button key={k} className={`choice-btn${logoPosition === k ? " selected" : ""}`} onClick={() => setLogoPosition(k)}>{v}</button>
                  ))}
                </div>
                <div className="btn-row"><BackBtn />
                  <button className="btn btn-primary" disabled={!logoPosition} onClick={() => goNext("design_text")}>Dalej</button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("design_position") && logoPosition && <UserMsg>{LOGO_POSITIONS[logoPosition]}</UserMsg>}
          </>
        )}

        {/* Text */}
        {wantsDesign && (isPast("design_text") || step === "design_text") && (
          <><RomanMsg>
            Czy na grafice ma byc konkretny tekst?
            {step === "design_text" && (
              <>
                <div className="choices">
                  <button className="choice-btn" onClick={() => setDesignTextChoice("custom")}>Wpisuje tekst</button>
                  <button className="choice-btn" onClick={() => setDesignTextChoice("none")}>Bez tekstu</button>
                </div>
                {designTextChoice === "custom" && (
                  <div className="input-area" style={{ marginTop: 10 }}>
                    <textarea className="msg-input" value={designText} onChange={e => setDesignText(e.target.value)}
                      placeholder="Tekst ktory ma pojawic sie na grafice..." style={{ minHeight: 60 }} />
                  </div>
                )}
                {designTextChoice && (
                  <div className="btn-row"><BackBtn />
                    <button className="btn btn-primary" onClick={() => goNext("design_formats")}>Dalej</button>
                  </div>
                )}
              </>
            )}
          </RomanMsg>
          {isPast("design_text") && designTextChoice && <UserMsg>{designTextChoice === "custom" ? `"${designText}"` : "Bez tekstu"}</UserMsg>}
          </>
        )}

        {/* Formats */}
        {wantsDesign && (isPast("design_formats") || step === "design_formats") && (
          <><RomanMsg>
            Ktore formaty?
            {step === "design_formats" && (
              <>
                <div className="choices">
                  {DESIGN_FORMATS.map(f => (
                    <button key={f.key} className={`choice-btn${selectedFormats.includes(f.key) ? " selected" : ""}`}
                      onClick={() => setSelectedFormats(p => p.includes(f.key) ? p.filter(x => x !== f.key) : [...p, f.key])}>
                      {f.label}
                    </button>
                  ))}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 6 }}>Mozesz wybrac kilka</div>
                <div className="btn-row"><BackBtn />
                  <button className="btn btn-primary" disabled={selectedFormats.length === 0}
                    onClick={() => { goNext("design_generating"); runDesign(0, ""); }}>
                    Generuj 2 propozycje 🎨
                  </button>
                </div>
              </>
            )}
          </RomanMsg>
          {isPast("design_formats") && <UserMsg>{selectedFormats.map(k => DESIGN_FORMATS.find(f=>f.key===k)?.label).join(", ")}</UserMsg>}
          </>
        )}

        {/* Design results */}
        {wantsDesign && (step === "design_generating" || designVariants.length > 0) && (
          <RomanMsg>
            {designGenerating && designVariants.length === 0 && (
              <div className="empty-state">
                <span className="spin" style={{ fontSize: 24 }}>⟳</span>
                <div>
                  <div>Generuje wizualizacje...</div>
                  <div style={{ fontSize: 12, color: "var(--text-hint)", marginTop: 4 }}>To moze zajac 30-60 sekund</div>
                </div>
              </div>
            )}
            {!designGenerating && designVariants.length === 0 && !designError && step === "design_generating" && (
              <div className="error-box">
                Nie udalo sie wygenerowac wizualizacji. Sprawdz czy klucz GOOGLE_API_KEY jest ustawiony w Vercel.
                <div style={{ marginTop: 8 }}>
                  <button className="btn" onClick={() => runDesign(0, "")}>Sprobuj ponownie</button>
                </div>
              </div>
            )}
            {designError && <div className="error-box">Blad: {designError}<div style={{marginTop:8}}><button className="btn" onClick={() => {setDesignError(""); runDesign(0,"");}}>Sprobuj ponownie</button></div></div>}
            {designVariants.map((v, i) => (
              <DesignVariant key={i} variant={v} variantNum={i + 1} selectedFormats={selectedFormats} />
            ))}
            {designVariants.length >= 2 && !designGenerating && (
              <>
                <div style={{ marginTop: 12, fontWeight: 500, fontSize: 14 }}>Co chcesz zmienic?</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
                  Opisz dokladnie - kolory, kompozycje, nastoj, co Ci sie nie podoba.
                </div>
                <div className="input-area">
                  <textarea className="msg-input" value={feedbackText} onChange={e => setFeedbackText(e.target.value)}
                    placeholder="np. Za ciemne tlo, logo za male, chce bardziej minimalistycznie..."
                    style={{ minHeight: 70 }} />
                </div>
                <div className="btn-row">
                  <button className="btn" onClick={resetAll}>Nowy brief</button>
                  <button className="btn btn-primary" disabled={!feedbackText.trim()}
                    onClick={() => { runDesign(designIteration, feedbackText); setFeedbackText(""); }}>
                    Popraw i generuj 🎨
                  </button>
                </div>
              </>
            )}
            {designGenerating && designVariants.length > 0 && (
              <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 8 }}>
                <span className="spin">⟳</span> Generuje kolejne warianty...
              </div>
            )}
          </RomanMsg>
        )}

        <div ref={messagesEndRef} style={{ height: 1 }} />
      </div>
    </div>
  );
}
