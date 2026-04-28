"use client";
import { useState, useRef, useCallback } from "react";

// ── CONSTANTS ─────────────────────────────────────────────────────
const MODES = [
  { key: "concept",  emoji: "💡", name: "Koncept kreatywny", desc: "Big Idea, linia kreatywna, manifesty" },
  { key: "strategy", emoji: "🎯", name: "Strategia marki",   desc: "Platforma komunikacyjna, pozycjonowanie" },
  { key: "social",   emoji: "📱", name: "Posty i Rolki",     desc: "Content na social media" },
  { key: "ads",      emoji: "📊", name: "Plan reklamowy",    desc: "Google Ads, Meta, budżety, KPI" },
  { key: "design",   emoji: "🖼️", name: "Grafiki / Design",  desc: "Wizualizacje, grafiki postów" },
];

const SOCIAL_TYPES   = { posts: "Posty",             reels: "Pomysły na rolki" };
const SOCIAL_FOCUS   = { specific: "Konkretny produkt/wydarzenie", general: "Ogólnie marka" };
const TONALITY_TYPES = {
  same:      "Dopasowane do stylu klienta",
  creative:  "Bardziej kreatywne",
  funny:     "Humorystyczne",
  product:   "Produktowe",
  lifestyle: "Lifestylowe",
};
const LOGO_POSITIONS = {
  bottom_right: "Dół prawy", bottom_left: "Dół lewy", bottom_center: "Dół centrum",
  top_right: "Góra prawy",   top_left: "Góra lewy",   center: "Centrum", roman: "Roman decyduje",
};
const DESIGN_FORMATS = [
  { key: "instagram_feed",   label: "IG Feed 4:5",   w: 1080, h: 1350 },
  { key: "instagram_story",  label: "IG Story 9:16", w: 1080, h: 1920 },
  { key: "instagram_square", label: "IG Square 1:1", w: 1080, h: 1080 },
  { key: "facebook_feed",    label: "FB Feed 4:5",   w: 1080, h: 1350 },
];
const AGENTS = {
  researcher:     { icon: "🔍", name: "Researcher",  desc: "Analizuje rynek i insighty" },
  creative:       { icon: "🎨", name: "Creative",    desc: "Tworzy koncepcje i strategie" },
  analyst:        { icon: "📊", name: "Analyst",     desc: "Plan mediowy i budżety" },
  social_content: { icon: "📱", name: "Social Agent",desc: "Posty i scenariusze rolek" },
};
const STEPS = {
  concept:  ["researcher","creative"],
  strategy: ["researcher","creative"],
  social:   ["researcher","social_content"],
  ads:      ["researcher","analyst"],
  design:   [],
};
const ACCEPTED      = ".txt,.md,.pdf,.xlsx,.xls,.csv,.doc,.docx";
const IMG_ACCEPTED  = ".png,.jpg,.jpeg,.webp";
const FONT_ACCEPTED = ".ttf,.otf,.woff,.woff2";

// ── HELPERS ───────────────────────────────────────────────────────
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

// ── COMPONENTS ────────────────────────────────────────────────────
function FileOrPaste({ files, onFiles, text, onText, label, hint, accept = ACCEPTED, single = false, textPlaceholder }) {
  const [drag, setDrag] = useState(false);
  const ref = useRef();
  const add = useCallback(async (fl) => {
    const prep = await prepFiles(fl);
    if (single) { onFiles(prep.slice(0, 1)); return; }
    onFiles(p => {
      const n = new Set((p || []).map(f => f.name));
      return [...(p || []), ...prep.filter(f => !n.has(f.name))];
    });
  }, [onFiles, single]);

  return (
    <div>
      {label && <div className="field-label">{label}</div>}
      <div className="file-or-paste">
        <div>
          <div
            className={`upload-zone${drag ? " drag-over" : ""}`}
            onClick={() => ref.current.click()}
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}>
            <input ref={ref} type="file" accept={accept} multiple={!single}
              onChange={e => add(e.target.files)} />
            <div className="upload-icon">📎</div>
            <div className="upload-label">Wgraj plik<br /><span style={{color:"var(--text-dim)"}}>PDF, Word, Excel, TXT...</span></div>
          </div>
          {(files || []).length > 0 && (
            <div className="file-chips">
              {(files || []).map(f => (
                <span key={f.name} className="file-chip">
                  {f.name}
                  <button onClick={() => onFiles((files||[]).filter(x => x.name !== f.name))}>×</button>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="or-divider"><div className="or-line"/><div className="or-text">LUB</div><div className="or-line"/></div>
        <div>
          <textarea
            className="field-textarea"
            style={{ minHeight: 120 }}
            value={text || ""}
            onChange={e => onText(e.target.value)}
            placeholder={textPlaceholder || hint || "Wklej lub wpisz treść tutaj..."} />
        </div>
      </div>
    </div>
  );
}

function Pill({ children, active, onClick }) {
  return (
    <button className={`pill${active ? " active" : ""}`} onClick={onClick}>{children}</button>
  );
}

function DesignVariant({ variant, variantNum, selectedFormats }) {
  const [active, setActive] = useState(selectedFormats[0]);
  const img = variant.formats?.[active];
  const dl = () => {
    if (!img) return;
    const a = document.createElement("a");
    a.href = `data:image/png;base64,${img}`;
    a.download = `roman_w${variantNum}_${active}.png`;
    a.click();
  };
  return (
    <div className="design-card">
      <div className="design-card-header">
        <span className="design-card-title">Wariant {variantNum}</span>
        <button className="btn-action" onClick={dl}>⬇ PNG</button>
      </div>
      <div className="format-tabs">
        {selectedFormats.map(k => {
          const f = DESIGN_FORMATS.find(x => x.key === k);
          return <button key={k} className={`fmt-btn${active===k?" active":""}`} onClick={()=>setActive(k)}>{f?.label}</button>;
        })}
      </div>
      {img
        ? <img src={`data:image/png;base64,${img}`} alt={`Wariant ${variantNum}`}
            style={{width:"100%",display:"block",maxHeight:340,objectFit:"contain",background:"#111"}} />
        : <div className="empty-state" style={{minHeight:200}}><span className="spin">⟳</span></div>}
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────
export default function Home() {

  // ── View state ──────────────────────────────────────────────────
  const [view, setView] = useState("config"); // config | running | clarification | results | design_results

  // ── Mode & options ───────────────────────────────────────────────
  const [mode, setMode]                     = useState("concept");
  const [socialType, setSocialType]         = useState("posts");
  const [socialFocus, setSocialFocus]       = useState("general");
  const [socialProduct, setSocialProduct]   = useState("");
  const [socialProductFiles, setSocialProductFiles] = useState([]);
  const [socialTonality, setSocialTonality] = useState("same");
  const [researchBrand, setResearchBrand]   = useState(false);

  // ── Brief inputs ─────────────────────────────────────────────────
  const [briefText, setBriefText]           = useState("");
  const [briefFiles, setBriefFiles]         = useState([]);
  const [exampleText, setExampleText]       = useState("");
  const [exampleFiles, setExampleFiles]     = useState([]);
  const [productText, setProductText]       = useState("");
  const [productFiles, setProductFiles]     = useState([]);
  const [notes, setNotes]                   = useState("");

  // ── Pipeline state ───────────────────────────────────────────────
  const [agentStatus, setAgentStatus]       = useState({});
  const [results, setResults]               = useState({});
  const [error, setError]                   = useState("");
  const [clarificationQs, setClarificationQs]     = useState("");
  const [clarificationAnswers, setClarificationAnswers] = useState("");
  const [researchContent, setResearchContent]     = useState("");
  const [activeResultTab, setActiveResultTab]     = useState(null);

  // ── Post-pipeline ─────────────────────────────────────────────────
  const [visualDirection, setVisualDirection] = useState("");
  const [wantsAnalyst, setWantsAnalyst]     = useState(null);
  const [wantsSocial, setWantsSocial]       = useState(null);
  const [socialFromType, setSocialFromType] = useState("posts");
  const [socialFromTone, setSocialFromTone] = useState("same");
  const [socialDone, setSocialDone]         = useState(false);

  // ── Design state ─────────────────────────────────────────────────
  const [hasBrandAssets, setHasBrandAssets] = useState(false);
  const [logoFile, setLogoFile]             = useState([]);
  const [fontFile, setFontFile]             = useState([]);
  const [brandColors, setBrandColors]       = useState("");
  const [logoPosition, setLogoPosition]     = useState("bottom_right");
  const [designText, setDesignText]         = useState("");
  const [postForDesign, setPostForDesign]   = useState("");
  const [selectedFormats, setSelectedFormats] = useState(["instagram_feed","instagram_story","instagram_square","facebook_feed"]);
  const [designVariants, setDesignVariants] = useState([]);
  const [designGenerating, setDesignGenerating] = useState(false);
  const [designError, setDesignError]       = useState("");
  const [feedbackText, setFeedbackText]     = useState("");
  const [designIteration, setDesignIteration] = useState(0);

  const setAgent = (id, s) => setAgentStatus(p => ({ ...p, [id]: s }));
  const setResult = (id, c) => setResults(p => ({ ...p, [id]: c }));

  // ── Reset ─────────────────────────────────────────────────────────
  const resetAll = () => {
    setView("config"); setMode("concept");
    setSocialType("posts"); setSocialFocus("general"); setSocialProduct(""); setSocialProductFiles([]);
    setSocialTonality("same"); setResearchBrand(false);
    setBriefText(""); setBriefFiles([]); setExampleText(""); setExampleFiles([]);
    setProductText(""); setProductFiles([]); setNotes("");
    setAgentStatus({}); setResults({}); setError("");
    setClarificationQs(""); setClarificationAnswers(""); setResearchContent("");
    setActiveResultTab(null); setWantsAnalyst(null); setWantsSocial(null); setSocialDone(false);
    setHasBrandAssets(false); setLogoFile([]); setFontFile([]); setBrandColors("");
    setLogoPosition("bottom_right"); setDesignText(""); setPostForDesign("");
    setSelectedFormats(["instagram_feed","instagram_story","instagram_square","facebook_feed"]);
    setDesignVariants([]); setDesignGenerating(false); setDesignError(""); setFeedbackText(""); setDesignIteration(0);
  };

  const getFiles = () => {
    const all = [...briefFiles];
    if (exampleFiles.length) all.push(...exampleFiles);
    if (productFiles.length) all.push(...productFiles);
    if (socialProductFiles.length) all.push(...socialProductFiles);
    return all;
  };

  const buildBriefText = () => {
    let t = briefText;
    if (exampleText) t += `\n\n--- PRZYKLADY POSTOW/MATERIALOW ---\n${exampleText}`;
    if (productText) t += `\n\n--- INFORMACJE O PRODUKTACH/USLUGACH ---\n${productText}`;
    if (socialProduct) t += `\n\n--- PRODUKT/WYDARZENIE ---\n${socialProduct}`;
    return t;
  };

  // ── Stream helper ─────────────────────────────────────────────────
  const streamFromAPI = async (payload, path = "/api/pipeline") => {
    const res = await fetch(path, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const e = await res.json().catch(() => ({}));
      throw new Error(e.error || `Błąd serwera (${res.status})`);
    }
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
        let ev;
        try { ev = JSON.parse(line); } catch (_) { continue; }
        if (ev.status === "running") setAgent(ev.agent, "running");
        if (ev.status === "done" && ev.agent !== "all") {
          setAgent(ev.agent, "done");
          if (ev.content) { setResult(ev.agent, ev.content); setActiveResultTab(t => t || ev.agent); }
        }
        if (ev.agent === "social_content" && ev.status === "done") setSocialDone(true);
        if (ev.status === "needs_clarification") {
          setClarificationQs(ev.questions); setResearchContent(ev.researchContent);
          setView("clarification"); return false;
        }
        if (ev.agent === "all" && ev.status === "done") return true;
        if (ev.status === "error") throw new Error(ev.message || "Błąd serwera");
      }
    }
    return true;
  };

  // ── Run pipeline ──────────────────────────────────────────────────
  const runPipeline = async () => {
    const totalSize = getFiles().reduce((s, f) => s + (f.base64?.length || 0), 0);
    if (totalSize > 8_000_000) {
      setError("Pliki są za duże (ponad 6MB łącznie). Użyj mniejszych plików lub wklej tekst bezpośrednio.");
      return;
    }
    if (!briefText.trim() && briefFiles.length === 0) {
      setError("Wpisz brief lub wgraj plik briefu.");
      return;
    }
    setError(""); setView("running"); setAgentStatus({}); setResults({});
    try {
      const socialContext = mode === "social" ? [
        `Typ: ${SOCIAL_TYPES[socialType]}`,
        `Fokus: ${SOCIAL_FOCUS[socialFocus]}`,
        socialTonality ? `Tonalność: ${TONALITY_TYPES[socialTonality]}` : "",
      ].filter(Boolean).join("\n") : "";
      const ok = await streamFromAPI({
        mode, brief: buildBriefText(), notes,
        socialType, socialFocus, socialProduct, socialTonality,
        files: getFiles(), phase: "full",
        runAnalyst: false, researchBrand,
      });
      if (ok) setView("results");
    } catch (e) {
      console.error(e);
      setError(e.message || "Błąd połączenia.");
      setView("config");
    }
  };

  const runAfterClarification = async () => {
    setView("running"); setError("");
    try {
      const ok = await streamFromAPI({
        mode, brief: buildBriefText(), notes,
        socialType, socialFocus, socialProduct, socialTonality,
        files: getFiles(), phase: "after_clarification",
        researchContent, clarificationAnswers, runAnalyst: false,
      });
      if (ok) setView("results");
    } catch (e) {
      setError(e.message || "Błąd połączenia.");
      setView("clarification");
    }
  };

  const runAnalystNow = async () => {
    setWantsAnalyst(true); setAgent("analyst", "running");
    try {
      await streamFromAPI({
        phase: "analyst_only", brief: buildBriefText(), files: getFiles(),
        researchContent: results.researcher || "",
        creativeContent: results.creative || "",
      });
    } catch (e) { setError(e.message); }
  };

  const runSocialFromStrategy = async () => {
    setView("running_social"); setError(""); setSocialDone(false);
    setAgent("social_content", "waiting");
    try {
      await streamFromAPI({
        mode: "social_from_strategy", brief: buildBriefText(), files: getFiles(),
        phase: "social_from_strategy",
        socialType: socialFromType,
        socialTonality: socialFromTone,
        existingResearch: results.researcher || "",
        existingCreative: results.creative || "",
      });
      setSocialDone(true); setView("results");
    } catch (e) {
      setError(e.message); setSocialDone(true); setView("results");
    }
  };

  // ── Design ────────────────────────────────────────────────────────
  const runDesign = async (iteration = 0, feedback = "") => {
    setDesignGenerating(true); setDesignError(""); setDesignVariants([]);
    try {
      // For design, combine creative content + user visual direction
      const baseContent = mode === "design"
        ? (briefText || "")
        : (results.creative || results["social_content"] || results.researcher || briefText || "");
      // Append visual direction if provided - this is pure visual guidance, not brief
      const concept = visualDirection
        ? `VISUAL DIRECTION FROM USER:
${visualDirection}

CREATIVE CONCEPT:
${baseContent}`
        : baseContent;
      const colors = brandColors.split(/[,\s]+/).filter(Boolean);
      const res = await fetch("/design", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          concept: concept.slice(0, 2000),
          postContent: postForDesign,
          brandColors: colors,
          logoBase64: logoFile[0]?.base64 || null,
          fontBase64: fontFile[0]?.base64 || null,
          textOnImage: designText || null,
          logoPosition,
          feedbackIteration: iteration,
          feedbackNotes: feedback,
          selectedFormats,
        }),
      });
      if (!res.ok) throw new Error(`Błąd API (${res.status})`);
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
          let ev;
          try { ev = JSON.parse(line); } catch (_) { continue; }
          if (ev.status === "variant_done") setDesignVariants(p => [...p, ev.data]);
          if (ev.status === "error") throw new Error(ev.message || "Błąd Gemini API");
        }
      }
      setDesignIteration(iteration + 1);
    } catch (e) { setDesignError(e.message); }
    finally { setDesignGenerating(false); }
  };

  const downloadWord = async () => {
    const sections = [];
    if (results.researcher) sections.push({ heading: "Research i Insighty", content: results.researcher });
    if (results.creative) sections.push({ heading: "Koncepcje Kreatywne / Strategia", content: results.creative });
    if (results["social_content"]) sections.push({ heading: "Posty i Rolki", content: results["social_content"] });
    if (results.analyst) sections.push({ heading: "Plan Reklamowy", content: results.analyst });
    const res = await fetch("/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: `Roman — ${MODES.find(m=>m.key===mode)?.name || "Raport"}`, sections }),
    });
    if (!res.ok) { alert("Błąd eksportu."); return; }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `roman_${mode}_${new Date().toISOString().slice(0,10)}.docx`;
    a.click();
  };

  // ── Result tabs ───────────────────────────────────────────────────
  const allTabs = [
    results.researcher     && { key: "researcher",     label: "🔍 Research" },
    results.creative       && { key: "creative",       label: "🎨 Kreacja" },
    results.analyst        && { key: "analyst",        label: "📊 Plan mediowy" },
    results.social_content && { key: "social_content", label: "📱 Posty / Rolki" },
  ].filter(Boolean);

  const currentTab = activeResultTab || allTabs[0]?.key;

  // ── UI ─────────────────────────────────────────────────────────────
  const isDesignMode = mode === "design";
  const currentMode = MODES.find(m => m.key === mode);

  // Config form sections numbering
  let secNum = 0;
  const N = () => { secNum++; return secNum; };

  // Running agents list
  const runningAgents = STEPS[mode] || [];

  return (
    <div className="app">
      {/* ── HEADER ── */}
      <header className="header">
        <div className="header-logo">
          <div className="header-avatar">R</div>
          <div>
            <div className="header-title">Luzny Roman</div>
            <div className="header-sub">AI Pipeline Agencyjny</div>
          </div>
        </div>
        <div className="header-right">
          {view !== "config" && (
            <button className="btn-new" onClick={resetAll}>+ Nowy projekt</button>
          )}
        </div>
      </header>

      {/* ── SIDEBAR ── */}
      <nav className="sidebar">
        <div className="sidebar-label">Tryb pracy</div>
        {MODES.map(m => (
          <button key={m.key}
            className={`mode-btn${mode === m.key ? " active" : ""}`}
            onClick={() => { setMode(m.key); if (view !== "config") setView("config"); }}>
            <div className="mode-icon">{m.emoji}</div>
            <div className="mode-info">
              <div className="mode-name">{m.name}</div>
              <div className="mode-desc">{m.desc}</div>
            </div>
          </button>
        ))}
      </nav>

      {/* ── MAIN ── */}
      <main className="main">

        {/* ═══ CONFIG VIEW ═══ */}
        {view === "config" && (
          <>
            {/* BRIEF */}
            <div className="section">
              <div className="section-header">
                <div className="section-num">01</div>
                <div className="section-title">Brief</div>
                <div className="section-hint">Opisz projekt lub wgraj plik briefu</div>
              </div>
              <div className="section-body">
                <FileOrPaste
                  files={briefFiles} onFiles={setBriefFiles}
                  text={briefText} onText={setBriefText}
                  textPlaceholder={"Marka:\nProdukt / usługa:\nCel kampanii:\nGrupa docelowa:\nBudżet:\nRynek / kraj:\nDodatkowe uwagi:"} />
              </div>
            </div>

            {/* SOCIAL OPTIONS */}
            {mode === "social" && (
              <div className="section">
                <div className="section-header">
                  <div className="section-num">02</div>
                  <div className="section-title">Ustawienia social media</div>
                </div>
                <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div className="field-label">Typ contentu</div>
                    <div className="pills">
                      {Object.entries(SOCIAL_TYPES).map(([k,v]) => (
                        <Pill key={k} active={socialType===k} onClick={()=>setSocialType(k)}>{v}</Pill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Fokus</div>
                    <div className="pills">
                      {Object.entries(SOCIAL_FOCUS).map(([k,v]) => (
                        <Pill key={k} active={socialFocus===k} onClick={()=>setSocialFocus(k)}>{v}</Pill>
                      ))}
                    </div>
                  </div>
                  {socialFocus === "specific" && (
                    <div>
                      <div className="field-label">Opis produktu / wydarzenia</div>
                      <FileOrPaste
                        files={socialProductFiles} onFiles={setSocialProductFiles}
                        text={socialProduct} onText={setSocialProduct}
                        textPlaceholder="Opisz produkt lub wydarzenie, jego cechy, USP..." />
                    </div>
                  )}
                  <div>
                    <div className="field-label">Tonalność</div>
                    <div className="pills">
                      {Object.entries(TONALITY_TYPES).map(([k,v]) => (
                        <Pill key={k} active={socialTonality===k} onClick={()=>setSocialTonality(k)}>{v}</Pill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Przykłady zaakceptowanych postów / rolek klienta</div>
                    <FileOrPaste
                      files={exampleFiles} onFiles={setExampleFiles}
                      text={exampleText} onText={setExampleText}
                      textPlaceholder="Wklej przykładowe posty, które klientowi się podobają..." />
                  </div>
                </div>
              </div>
            )}

            {/* DESIGN OPTIONS */}
            {mode === "design" && (
              <>
              <div className="section">
                <div className="section-header">
                  <div className="section-num">02</div>
                  <div className="section-title">Kierunek wizualny</div>
                  <div className="section-hint">opcjonalne — pomaga Romanowi lepiej dobrać estetykę</div>
                </div>
                <div className="section-body">
                  <div className="field-label">Opisz jak ma wyglądać grafika</div>
                  <textarea className="field-textarea" value={visualDirection}
                    onChange={e => setVisualDirection(e.target.value)} style={{ minHeight: 80 }}
                    placeholder="np. Minimalistyczne zdjecie produktu, biale tlo. Albo: ciemne tlo, zlote akcenty, luksus. Albo: lifestyle, kobieta z kawa, sloneczne mieszkanie." />
                </div>
              </div>
              <div className="section">
                <div className="section-header">
                  <div className="section-num">03</div>
                  <div className="section-title">Assety marki</div>
                </div>
                <div className="section-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                  <div>
                    <div className="field-label">Logo (PNG z przezroczystością)</div>
                    <FileOrPaste files={logoFile} onFiles={setLogoFile} accept={".png,.jpg,.jpeg,.webp"} single
                      text={null} onText={()=>{}} textPlaceholder="(tylko plik)" />
                  </div>
                  <div className="grid-2">
                    <div>
                      <div className="field-label">Font marki (TTF, OTF)</div>
                      <div className="upload-zone" onClick={() => {}} style={{cursor:"default"}}>
                        <input type="file" accept={FONT_ACCEPTED} onChange={async e => setFontFile(await prepFiles(e.target.files))} style={{display:"block",opacity:0,position:"absolute"}} />
                        <div className="upload-icon">🔤</div>
                        <div className="upload-label" onClick={e => e.currentTarget.previousElementSibling?.previousElementSibling?.click()}>
                          {fontFile[0]?.name || "Wgraj font TTF / OTF"}
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="field-label">Kolory HEX</div>
                      <textarea className="field-textarea" style={{minHeight:80}} value={brandColors}
                        onChange={e=>setBrandColors(e.target.value)}
                        placeholder="#7C3AED, #1A1A2E..." />
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Pozycja logo</div>
                    <div className="pills">
                      {Object.entries(LOGO_POSITIONS).map(([k,v]) => (
                        <Pill key={k} active={logoPosition===k} onClick={()=>setLogoPosition(k)}>{v}</Pill>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="field-label">Tekst na grafice (opcjonalnie)</div>
                    <input className="field-input" value={designText} onChange={e=>setDesignText(e.target.value)}
                      placeholder='np. "Wpadaj TU, do M1 Marki"' />
                  </div>
                  <div>
                    <div className="field-label">Formaty</div>
                    <div className="pills">
                      {DESIGN_FORMATS.map(f => (
                        <Pill key={f.key} active={selectedFormats.includes(f.key)}
                          onClick={() => setSelectedFormats(p => p.includes(f.key) ? p.filter(x=>x!==f.key) : [...p,f.key])}>
                          {f.label}
                        </Pill>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MATERIALY */}
            {mode !== "design" && mode !== "social" && (
              <div className="section">
                <div className="section-header">
                  <div className="section-num">02</div>
                  <div className="section-title">Materiały o produktach / usługach</div>
                  <div className="section-hint">opcjonalne</div>
                </div>
                <div className="section-body">
                  <FileOrPaste
                    files={productFiles} onFiles={setProductFiles}
                    text={productText} onText={setProductText}
                    textPlaceholder="Wklej opisy produktów, cenniki, USP, dane klienta..." />
                  <div style={{ marginTop: 12 }}>
                    <Pill active={researchBrand} onClick={() => setResearchBrand(p => !p)}>
                      {researchBrand ? "✓" : ""} Roman szuka informacji samodzielnie
                    </Pill>
                  </div>
                </div>
              </div>
              </>
            )}

            {/* NOTES */}
            {mode !== "design" && (
              <div className="section">
                <div className="section-header">
                  <div className="section-num">{mode === "social" ? "03" : "03"}</div>
                  <div className="section-title">Dodatkowe wytyczne</div>
                  <div className="section-hint">opcjonalne</div>
                </div>
                <div className="section-body">
                  <textarea className="field-textarea" value={notes} onChange={e=>setNotes(e.target.value)}
                    placeholder="Czego unikać, specyfika marki, ton komunikacji, ograniczenia..." />
                </div>
              </div>
            )}

            {/* GENERATE BAR */}
            <div className="generate-bar">
              <button className="btn-generate"
                disabled={!briefText.trim() && briefFiles.length === 0 && mode !== "design"}
                onClick={mode === "design" ? () => { setView("design_results"); runDesign(0,""); } : runPipeline}>
                <span className="btn-icon">🚀</span>
                {mode === "design" ? "Generuj Grafiki" : "Działaj Romek"}
              </button>
              {error && <div className="error-inline">⚠️ {error}</div>}
            </div>
          </>
        )}

        {/* ═══ RUNNING VIEW ═══ */}
        {(view === "running" || view === "running_social") && (
          <div className="overlay">
            <div className="progress-card">
              <div className="progress-title">Roman pracuje...</div>
              <div className="progress-subtitle">Nie zamykaj okna. To może zająć 30–90 sekund.</div>
              <div className="progress-agents">
                {(view === "running_social" ? ["social_content"] : runningAgents).map(id => {
                  const s = agentStatus[id];
                  return (
                    <div key={id} className={`agent-row${s==="running"?" running":s==="done"?" done":""}`}>
                      <div className="agent-icon-wrap">{s==="running" ? <span className="spin">⟳</span> : AGENTS[id]?.icon}</div>
                      <div className="agent-info">
                        <div className="agent-name">{AGENTS[id]?.name}</div>
                        <div className="agent-status">{AGENTS[id]?.desc}</div>
                      </div>
                      <div className="agent-badge">
                        {s==="running" ? "Pracuje" : s==="done" ? "✓ Gotowe" : "Oczekuje"}
                      </div>
                    </div>
                  );
                })}
              </div>
              {error && <div style={{color:"var(--red)",fontSize:13,padding:"12px",background:"rgba(248,113,113,0.08)",borderRadius:10,border:"1px solid rgba(248,113,113,0.2)"}}>
                ⚠️ {error}
              </div>}
            </div>
          </div>
        )}

        {/* ═══ CLARIFICATION VIEW ═══ */}
        {view === "clarification" && (
          <>
            <div className="section">
              <div className="section-header">
                <div className="section-num">!</div>
                <div className="section-title">Roman potrzebuje kilku odpowiedzi</div>
              </div>
              <div className="section-body">
                <div className="clarif-box">{clarificationQs}</div>
                <div className="field-label" style={{marginBottom:8}}>Twoje odpowiedzi</div>
                <textarea className="field-textarea" style={{minHeight:120}} value={clarificationAnswers}
                  onChange={e=>setClarificationAnswers(e.target.value)}
                  placeholder="Odpowiedz na powyższe pytania..." />
              </div>
            </div>
            <div className="generate-bar">
              <button className="btn-generate" disabled={!clarificationAnswers.trim()} onClick={runAfterClarification}>
                <span className="btn-icon">🚀</span> Kontynuuj
              </button>
              <button className="btn-action" onClick={resetAll}>← Zacznij od nowa</button>
            </div>
          </>
        )}

        {/* ═══ RESULTS VIEW ═══ */}
        {(view === "results" || view === "running_social") && view !== "clarification" && allTabs.length > 0 && (
          <div className="results-view">
            {/* Results header */}
            <div className="results-header">
              <div className="results-title">
                {currentMode?.emoji} {currentMode?.name} — wyniki
              </div>
              <div className="results-actions">
                <button className="btn-action" onClick={resetAll}>+ Nowy projekt</button>
                <button className="btn-action primary" onClick={downloadWord}>⬇ Word (.docx)</button>
              </div>
            </div>

            {/* Tabs */}
            <div className="results-tabs">
              {allTabs.map(t => (
                <button key={t.key} className={`result-tab${currentTab===t.key?" active":""}`}
                  onClick={()=>setActiveResultTab(t.key)}>
                  {t.label}
                  {results[t.key] && <div className="tab-dot"/>}
                </button>
              ))}
            </div>

            {/* Content */}
            <div className="result-content">
              {results[currentTab]
                ? <div className="result-text">{results[currentTab]}</div>
                : <div className="empty-state">
                    <div className="empty-icon"><span className="spin">⟳</span></div>
                    <div>Generowanie...</div>
                  </div>}
            </div>

            {/* Post-pipeline actions */}
            {view === "results" && (
              <div style={{ padding: "24px 40px", borderTop: "1px solid var(--border)", display: "flex", flexWrap: "wrap", gap: 12 }}>
                {/* Analyst */}
                {mode !== "ads" && mode !== "design" && wantsAnalyst === null && (
                  <>
                    <button className="btn-action" onClick={runAnalystNow}>📊 Dodaj plan reklamowy</button>
                    <button className="btn-action" onClick={()=>setWantsAnalyst(false)} style={{color:"var(--text-dim)"}}>Pomiń</button>
                  </>
                )}
                {/* Social from strategy */}
                {(mode==="concept"||mode==="strategy") && wantsAnalyst!==null && wantsSocial===null && (
                  <>
                    <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                      <span style={{fontSize:13,color:"var(--text-muted)"}}>Dodaj posty/rolki:</span>
                      {Object.entries(SOCIAL_TYPES).map(([k,v]) => (
                        <Pill key={k} active={socialFromType===k} onClick={()=>setSocialFromType(k)}>{v}</Pill>
                      ))}
                      <button className="btn-action primary" onClick={()=>{setWantsSocial(true);runSocialFromStrategy();}}>Generuj</button>
                      <button className="btn-action" onClick={()=>setWantsSocial(false)} style={{color:"var(--text-dim)"}}>Pomiń</button>
                    </div>
                  </>
                )}
                {/* Design */}
                {(wantsAnalyst!==null || mode==="ads" || mode==="social") && (mode!=="concept"&&mode!=="strategy" || wantsSocial!==null) && (
                  <>
                    {visualDirection === "" && (
                      <div style={{display:"flex",alignItems:"center",gap:8,flex:1}}>
                        <input className="field-input" style={{flex:1,fontSize:12}}
                          value={visualDirection}
                          onChange={e=>setVisualDirection(e.target.value)}
                          placeholder="Opisz kierunek wizualny grafiki (opcjonalnie)..." />
                      </div>
                    )}
                    <button className="btn-action primary"
                      onClick={() => { setView("design_results"); runDesign(0,""); }}>
                      🖼️ Generuj grafiki
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ═══ DESIGN RESULTS VIEW ═══ */}
        {view === "design_results" && (
          <div className="results-view">
            <div className="results-header">
              <div className="results-title">🖼️ Wizualizacje graficzne</div>
              <div className="results-actions">
                <button className="btn-action" onClick={resetAll}>+ Nowy projekt</button>
                {mode !== "design" && (
                  <button className="btn-action" onClick={() => setView("results")}>← Wyniki</button>
                )}
              </div>
            </div>
            <div className="result-content">
              {designGenerating && designVariants.length === 0 && (
                <div className="empty-state">
                  <div className="empty-icon"><span className="spin">⟳</span></div>
                  <div>Gemini generuje wizualizacje...</div>
                  <div style={{fontSize:12,color:"var(--text-dim)"}}>To może zająć 30–60 sekund</div>
                </div>
              )}
              {designError && (
                <div style={{padding:20,background:"rgba(248,113,113,0.08)",border:"1px solid rgba(248,113,113,0.2)",borderRadius:12,color:"var(--red)",fontSize:13,marginBottom:20}}>
                  <strong>Błąd generowania:</strong><br/>{designError}
                  <div style={{marginTop:12,display:"flex",gap:8}}>
                    <button className="btn-action" onClick={()=>{setDesignError("");runDesign(0,"");}}>Spróbuj ponownie</button>
                  </div>
                </div>
              )}
              {!designGenerating && designVariants.length === 0 && !designError && (
                <div className="empty-state">
                  <div className="empty-icon">🖼️</div>
                  <div>Brak wariantów. Kliknij "Generuj grafiki".</div>
                  <button className="btn-action primary" style={{marginTop:12}} onClick={()=>runDesign(0,"")}>🎨 Generuj</button>
                </div>
              )}
              {designVariants.length > 0 && (
                <>
                  <div className="design-grid">
                    {designVariants.map((v,i) => (
                      <DesignVariant key={i} variant={v} variantNum={i+1} selectedFormats={selectedFormats} />
                    ))}
                  </div>
                  {designGenerating && (
                    <div style={{textAlign:"center",color:"var(--text-muted)",fontSize:13,marginTop:12}}>
                      <span className="spin">⟳</span> Generuje kolejne warianty...
                    </div>
                  )}
                  {!designGenerating && (
                    <div className="section" style={{marginTop:24}}>
                      <div className="section-header">
                        <div className="section-num">↻</div>
                        <div className="section-title">Feedback i iteracja</div>
                      </div>
                      <div className="section-body">
                        <textarea className="field-textarea" value={feedbackText}
                          onChange={e=>setFeedbackText(e.target.value)}
                          placeholder="Co zmienić? np. Za ciemne tło, logo za małe, bardziej minimalistycznie, zmień kolory na ciepłe..." />
                        <div style={{marginTop:12}}>
                          <button className="btn-generate" disabled={!feedbackText.trim()}
                            onClick={()=>{runDesign(designIteration,feedbackText);setFeedbackText("");}}>
                            <span className="btn-icon">🎨</span> Popraw i wygeneruj
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
