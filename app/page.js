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
const CLIENTS_LIST = [
  { key: "m1",           label: "M1" },
  { key: "bean-buddies", label: "Bean & Buddies" },
];
const CLIENT_CONFIGS = {
  "m1": {
    name: "M1",
    colors: { primary: "#E30613", background: "#000000", text: "#FFFFFF" },
    font: "Poppins Bold",
    logoPosition: "Dół prawy",
    textPlacement: "Pasmo dolne",
  },
  "bean-buddies": {
    name: "Bean & Buddies",
    colors: { primary: "#000000", secondary: "#FFFFFF", background: "#FFFFFF", text: "#000000" },
    font: "RockwellNova Bold",
    logoPosition: "Dół centrum",
    textPlacement: "Złoty podział",
  },
};
const AGENTS = {
  researcher:     { icon: "🔍", name: "Researcher",   desc: "Analizuje rynek i insighty" },
  creative:       { icon: "🎨", name: "Creative",     desc: "Tworzy koncepcje i strategie" },
  analyst:        { icon: "📊", name: "Analyst",      desc: "Plan mediowy i budżety" },
  social_content: { icon: "📱", name: "Social Agent", desc: "Posty i scenariusze rolek" },
};
const STEPS = {
  concept:  ["researcher","creative"],
  strategy: ["researcher","creative"],
  social:   ["researcher","social_content"],
  ads:      ["researcher","analyst"],
  design:   [],
};
const ACCEPTED      = ".txt,.md,.pdf,.xlsx,.xls,.csv,.doc,.docx";
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
async function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1200;
        let w = img.width, h = img.height;
        if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r); }
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        canvas.getContext("2d").drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL("image/jpeg", 0.82).split(",")[1]);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}

function prepFiles(fl) {
  return Promise.all(Array.from(fl).map(async (f) => {
    const base64 = f.type.startsWith("image/")
      ? await compressImage(f)
      : await readAsBase64(f);
    return { name: f.name, mimeType: f.type.startsWith("image/") ? "image/jpeg" : f.type, base64 };
  }));
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
        {onText !== null && (
          <>
            <div className="or-divider"><div className="or-line"/><div className="or-text">LUB</div><div className="or-line"/></div>
            <div>
              <textarea
                className="field-textarea"
                style={{ minHeight: 120 }}
                value={text || ""}
                onChange={e => onText(e.target.value)}
                placeholder={textPlaceholder || hint || "Wklej lub wpisz treść tutaj..."} />
            </div>
          </>
        )}
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

// Compress image to max 1080px and 80% quality before base64 encoding
