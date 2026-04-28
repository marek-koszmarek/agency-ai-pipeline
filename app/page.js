"use client";
import { useState, useRef } from "react";
import "./globals.css";

const TABS = [
  { id: "research", label: "Research" },
  { id: "creative", label: "Koncepcje" },
  { id: "analysis", label: "Plan mediowy" },
  { id: "report", label: "Pełny raport" },
];

const STEPS = [
  { id: "researcher", label: "Researcher", icon: "🔍", desc: "Analiza rynku i insighty" },
  { id: "creative", label: "Creative", icon: "🎨", desc: "Koncepcje kreatywne" },
  { id: "analyst", label: "Analyst", icon: "📊", desc: "Plan mediowy" },
];

export default function Home() {
  const [brief, setBrief] = useState("");
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [steps, setSteps] = useState({ researcher: "idle", creative: "idle", analyst: "idle" });
  const [results, setResults] = useState({ research: "", creative: "", analysis: "" });
  const [activeTab, setActiveTab] = useState("research");
  const [done, setDone] = useState(false);
  const fileRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => setBrief(e.target.result);
    reader.readAsText(file, "utf-8");
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const setStep = (id, status) =>
    setSteps((prev) => ({ ...prev, [id]: status }));

  const setResult = (key, value) =>
    setResults((prev) => ({ ...prev, [key]: value }));

  const runPipeline = async () => {
    if (!brief.trim() || brief.trim().length < 20) {
      setError("Brief jest za krótki — opisz klienta, produkt i cel kampanii.");
      return;
    }
    setError("");
    setRunning(true);
    setDone(false);
    setResults({ research: "", creative: "", analysis: "" });
    setSteps({ researcher: "idle", creative: "idle", analyst: "idle" });
    setActiveTab("research");

    try {
      const res = await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Błąd serwera " + res.status);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done: streamDone, value } = await reader.read();
        if (streamDone) break;
        buffer += decoder.decode(value, { stream: true });
        const parts = buffer.split("\n\n");
        buffer = parts.pop();

        for (const part of parts) {
          const line = part.replace(/^data: /, "").trim();
          if (!line) continue;
          try {
            const ev = JSON.parse(line);

            if (ev.status === "running") {
              setStep(ev.agent, "running");
              if (ev.agent === "creative") setActiveTab("creative");
              if (ev.agent === "analyst") setActiveTab("analysis");
            }

            if (ev.status === "done" && ev.agent !== "all") {
              setStep(ev.agent, "done");
              const key = ev.agent === "analyst" ? "analysis" : ev.agent === "creative" ? "creative" : "research";
              setResult(key, ev.content);
              if (ev.agent === "researcher") setActiveTab("research");
              if (ev.agent === "creative") setActiveTab("creative");
              if (ev.agent === "analyst") setActiveTab("analysis");
            }

            if (ev.agent === "all" && ev.status === "done") {
              setActiveTab("report");
              setDone(true);
            }

            if (ev.status === "error") {
              throw new Error(ev.message || "Błąd agenta");
            }
          } catch (_) {}
        }
      }
    } catch (e) {
      setError(e.message || "Błąd połączenia. Sprawdź konfigurację serwera.");
    } finally {
      setRunning(false);
    }
  };

  const buildReport = () => {
    const now = new Date().toLocaleString("pl-PL");
    return `# RAPORT AGENCJI — PEŁNY PIPELINE\nData: ${now}\n\n${"=".repeat(60)}\n\n## BRIEF KLIENTA\n${brief}\n\n${"=".repeat(60)}\n\n## CZĘŚĆ 1: RESEARCH I INSIGHTY\n\n${results.research}\n\n${"=".repeat(60)}\n\n## CZĘŚĆ 2: KONCEPCJE KREATYWNE\n\n${results.creative}\n\n${"=".repeat(60)}\n\n## CZĘŚĆ 3: PLAN MEDIOWY I ANALITYCZNY\n\n${results.analysis}`;
  };

  const download = () => {
    const blob = new Blob([buildReport()], { type: "text/markdown" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `agency_report_${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
  };

  const copyReport = () => {
    navigator.clipboard.writeText(buildReport());
  };

  const reset = () => {
    setBrief(""); setFileName(""); setError(""); setRunning(false); setDone(false);
    setSteps({ researcher: "idle", creative: "idle", analyst: "idle" });
    setResults({ research: "", creative: "", analysis: "" });
    setActiveTab("research");
  };

  const stepClass = (id) => {
    const s = steps[id];
    if (s === "running") return "pipe-step active";
    if (s === "done") return "pipe-step done";
    return "pipe-step";
  };

  const stepStatus = (id) => {
    const s = steps[id];
    if (s === "running") return "Pracuje...";
    if (s === "done") return "Gotowe ✓";
    return "Oczekuje";
  };

  const tabContent = () => {
    if (activeTab === "report") return done ? buildReport() : "";
    if (activeTab === "research") return results.research;
    if (activeTab === "creative") return results.creative;
    if (activeTab === "analysis") return results.analysis;
    return "";
  };

  const showPipeline = running || done || Object.values(steps).some((s) => s !== "idle");

  return (
    <div className="app">
      <div className="header">
        <h1>Agency AI Pipeline</h1>
        <p>Researcher → Creative → Analyst &mdash; wgraj brief i uruchom</p>
      </div>

      {!showPipeline && (
        <div className="card">
          <label className="field-label">Brief klienta</label>

          <div
            className={`upload-zone${dragging ? " drag-over" : ""}`}
            onClick={() => fileRef.current.click()}
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            style={{ marginBottom: "1rem" }}
          >
            <input ref={fileRef} type="file" accept=".txt,.md,.doc,.docx" onChange={(e) => handleFile(e.target.files[0])} />
            {fileName
              ? <><div style={{ fontSize: 20, marginBottom: 6 }}>📄</div><strong>{fileName}</strong><div style={{ fontSize: 12, marginTop: 4, color: "var(--text-hint)" }}>Kliknij żeby zmienić plik</div></>
              : <><div style={{ fontSize: 20, marginBottom: 6 }}>📂</div><div>Przeciągnij plik briefu (.txt, .md) lub <strong>kliknij</strong></div></>
            }
          </div>

          <div className="divider">lub wpisz poniżej</div>

          <textarea
            value={brief}
            onChange={(e) => { setBrief(e.target.value); setFileName(""); }}
            placeholder={"Marka: ...\nProdukt / usługa: ...\nCel kampanii: ...\nGrupa docelowa: ...\nBudżet mediowy: ...\nRynek / kraj: ...\nDodatkowe informacje: ..."}
          />

          {error && <div className="error-box" style={{ marginTop: "0.75rem" }}>❌ {error}</div>}

          <div className="row-end">
            <span style={{ fontSize: 12, color: "var(--text-hint)" }}>
              {brief.trim().length > 0 && `${brief.trim().length} znaków`}
            </span>
            <button className="btn btn-primary" onClick={runPipeline} disabled={running}>
              Uruchom pipeline →
            </button>
          </div>
        </div>
      )}

      {showPipeline && (
        <>
          <div className="pipeline">
            {STEPS.map((s) => (
              <div key={s.id} className={stepClass(s.id)}>
                <span className="pipe-icon">
                  {steps[s.id] === "running"
                    ? <span className="spin" style={{ fontSize: 20 }}>⟳</span>
                    : s.icon}
                </span>
                <div className="pipe-name">{s.label}</div>
                <div className="pipe-status">{stepStatus(s.id)}</div>
              </div>
            ))}
          </div>

          {error && <div className="error-box">❌ {error}</div>}

          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <div className="tabs" style={{ padding: "0 1rem" }}>
              {TABS.map((t) => (
                <button
                  key={t.id}
                  className={`tab-btn${activeTab === t.id ? " active" : ""}`}
                  onClick={() => setActiveTab(t.id)}
                >
                  {t.label}
                  {t.id === "research" && results.research && <span className="badge badge-success" style={{ marginLeft: 6 }}>✓</span>}
                  {t.id === "creative" && results.creative && <span className="badge badge-success" style={{ marginLeft: 6 }}>✓</span>}
                  {t.id === "analysis" && results.analysis && <span className="badge badge-success" style={{ marginLeft: 6 }}>✓</span>}
                  {t.id === "report" && done && <span className="badge badge-info" style={{ marginLeft: 6 }}>Gotowy</span>}
                </button>
              ))}
            </div>

            <div style={{ padding: "1rem 1.5rem 1.5rem" }}>
              {tabContent() ? (
                <div className="result-box">
                  <div className="result-text">{tabContent()}</div>
                </div>
              ) : (
                <div className="empty-state">
                  {running
                    ? <><span className="spin" style={{ fontSize: 24 }}>⟳</span><span>Agent pracuje...</span></>
                    : <span>Oczekiwanie na agenta...</span>
                  }
                </div>
              )}
            </div>
          </div>

          <div className="row-end">
            <button className="btn" onClick={reset}>Nowy brief</button>
            {done && <>
              <button className="btn" onClick={copyReport}>Kopiuj raport</button>
              <button className="btn btn-primary" onClick={download}>Pobierz .md</button>
            </>}
          </div>
        </>
      )}
    </div>
  );
}
