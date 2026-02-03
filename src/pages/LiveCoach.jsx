import { useEffect, useMemo, useRef, useState } from "react";
import SCRIPT from "./scripts/script.veterans";

/* ================= CONFIG ================= */

const MATCH_THRESHOLD = 0.78;

/* ================= UTILS ================= */

const normalize = (text) =>
  String(text || "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const similarity = (a, b) => {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;

  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  let hit = 0;
  aw.forEach((w) => bw.has(w) && hit++);
  return hit / Math.max(aw.size, bw.size);
};

function findById(script, id) {
  const i = script.findIndex((x) => x.id === id);
  return i >= 0 ? { i, node: script[i] } : null;
}

// Given an index, return the "active prompt node":
// - If current is a note (spoken:false), skip forward to next spoken line (but keep notes for display)
// - If current is a branch, keep it (branch must be resolved)
// - If current is a spoken line, keep it
function getActiveIndex(script, idx) {
  let i = idx;
  while (i < script.length) {
    const n = script[i];
    if (!n) break;
    if (n.type === "branch") return i;
    if (n.spoken === false) {
      i += 1;
      continue;
    }
    return i;
  }
  return Math.min(idx, script.length - 1);
}

// Collect note lines between the last spoken/branch and the active index
function collectRecentNotes(script, fromIdx, toIdx) {
  const notes = [];
  for (let i = fromIdx; i < toIdx; i++) {
    const n = script[i];
    if (!n) continue;
    if (n.type === "branch") continue;
    if (n.spoken === false && n.text) notes.push(n.text);
  }
  return notes.slice(-6); // keep it readable
}

/* ================= COMPONENT ================= */

export default function LiveCoach() {
  const [rawIdx, setRawIdx] = useState(0); // internal pointer
  const [lastSpeech, setLastSpeech] = useState("");
  const [status, setStatus] = useState("Listening");
  const [lastMatch, setLastMatch] = useState({ ok: false, score: 0, expected: "" });

  const recognitionRef = useRef(null);

  // Refs to avoid SpeechRecognition restarting every line
  const idxRef = useRef(0);
  useEffect(() => {
    idxRef.current = rawIdx;
  }, [rawIdx]);

  const activeIdx = useMemo(() => getActiveIndex(SCRIPT, rawIdx), [rawIdx]);
  const current = SCRIPT[activeIdx];

  // Find where the last "spoken step boundary" was to collect notes cleanly
  const lastBoundaryIdx = useMemo(() => {
    // walk backwards from activeIdx until we hit a spoken line or a branch
    for (let i = activeIdx - 1; i >= 0; i--) {
      const n = SCRIPT[i];
      if (!n) continue;
      if (n.type === "branch") return i + 1;
      if (n.spoken !== false) return i + 1;
    }
    return 0;
  }, [activeIdx]);

  const recentNotes = useMemo(
    () => collectRecentNotes(SCRIPT, lastBoundaryIdx, activeIdx),
    [lastBoundaryIdx, activeIdx]
  );

  // Precompute: branch option previews (show first line of each path)
  const branchPreviews = useMemo(() => {
    if (!current || current.type !== "branch") return [];
    return (current.options || []).map((opt) => {
      const hit = findById(SCRIPT, opt.next);
      const previewText = hit?.node?.text || "(missing target)";
      return {
        label: opt.label,
        nextId: opt.next,
        previewText,
        triggers: opt.triggers || [],
      };
    });
  }, [current]);

  // Start SpeechRecognition ONCE
  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      setStatus("SpeechRecognition not supported in this browser");
      return;
    }

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = (e) => {
      const spoken = e.results[e.results.length - 1][0].transcript;
      setLastSpeech(spoken);
      handleSpeech(spoken);
    };

    rec.onerror = () => {
      setStatus("Mic error (check permissions)");
    };

    rec.onend = () => {
      // Keep it running
      try {
        rec.start();
      } catch {}
    };

    try {
      rec.start();
      setStatus("Listening");
    } catch {
      setStatus("Could not start mic");
    }

    recognitionRef.current = rec;
    return () => {
      try {
        rec.onresult = null;
        rec.onerror = null;
        rec.onend = null;
        rec.stop();
      } catch {}
      recognitionRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const advanceTo = (nextIndex) => {
    const clamped = Math.max(0, Math.min(SCRIPT.length - 1, nextIndex));
    setRawIdx(clamped);
  };

  const handleSpeech = (spoken) => {
    const idxNow = idxRef.current;
    const activeNow = getActiveIndex(SCRIPT, idxNow);
    const node = SCRIPT[activeNow];
    if (!node) return;

    // BRANCH: match agent’s spoken response against branch triggers
    if (node.type === "branch") {
      let best = { score: 0, next: null };

      for (const opt of node.options || []) {
        for (const trig of opt.triggers || []) {
          const sc = similarity(spoken, trig);
          if (sc > best.score) best = { score: sc, next: opt.next };
        }
      }

      if (best.next && best.score >= MATCH_THRESHOLD) {
        const hit = findById(SCRIPT, best.next);
        if (hit) {
          setLastMatch({ ok: true, score: best.score, expected: `BRANCH → ${best.next}` });
          advanceTo(hit.i);
        }
      } else {
        setLastMatch({ ok: false, score: best.score, expected: "Branch option" });
      }
      return;
    }

    // SPOKEN STEP: match to the expected line
    const expected = node.text || "";
    const sc = similarity(spoken, expected);

    if (sc >= MATCH_THRESHOLD) {
      setLastMatch({ ok: true, score: sc, expected });
      // move rawIdx to the item after the active node
      advanceTo(activeNow + 1);
    } else {
      setLastMatch({ ok: false, score: sc, expected });
    }
  };

  const reset = () => {
    setRawIdx(0);
    idxRef.current = 0;
    setLastSpeech("");
    setLastMatch({ ok: false, score: 0, expected: "" });
  };

  const progressText = useMemo(() => {
    const totalSpoken = SCRIPT.filter((n) => n && n.spoken !== false && n.type !== "branch").length;
    const spokenDone = SCRIPT.slice(0, activeIdx).filter((n) => n && n.spoken !== false && n.type !== "branch").length;
    return `${spokenDone}/${totalSpoken}`;
  }, [activeIdx]);

  // UI colors
  const C = {
    bg: "#070A0F",
    panel: "#0D1322",
    panel2: "#0A1020",
    border: "rgba(255,255,255,0.08)",
    text: "rgba(237,239,242,0.92)",
    muted: "rgba(237,239,242,0.62)",
    dim: "rgba(237,239,242,0.40)",
    emerald: "#19C37D",
    emeraldGlow: "rgba(25,195,125,0.35)",
    red: "#EF4444",
    amber: "#F59E0B",
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(900px 500px at 20% 0%, rgba(25,195,125,0.10), transparent 55%), ${C.bg}`,
        color: C.text,
        padding: 22,
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 30, fontWeight: 900, letterSpacing: -0.4 }}>HALO Leads</div>
            <div style={{ color: C.muted, marginTop: 6 }}>
              Step-by-step trainer — advances only when your spoken line matches.
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <div
              style={{
                padding: "8px 12px",
                borderRadius: 999,
                background: C.panel2,
                border: `1px solid ${C.border}`,
                fontWeight: 800,
                color: status.includes("Listening") ? C.emerald : C.amber,
              }}
            >
              {status}
            </div>

            <button
              onClick={reset}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                background: C.panel,
                border: `1px solid ${C.border}`,
                color: C.text,
                fontWeight: 900,
                cursor: "pointer",
              }}
            >
              RESET
            </button>
          </div>
        </div>

        {/* Progress */}
        <div
          style={{
            marginTop: 14,
            padding: 12,
            borderRadius: 14,
            background: C.panel2,
            border: `1px solid ${C.border}`,
            display: "flex",
            justifyContent: "space-between",
            gap: 10,
            alignItems: "center",
          }}
        >
          <div style={{ color: C.muted, fontWeight: 800 }}>
            Progress: <span style={{ color: C.text }}>{progressText}</span>
          </div>

          <div style={{ color: C.muted, fontWeight: 800 }}>
            Match:{" "}
            <span style={{ color: lastMatch.ok ? C.emerald : C.dim, fontWeight: 950 }}>
              {Math.round((lastMatch.score || 0) * 100)}%
            </span>
          </div>
        </div>

        {/* Notes (agent-only) */}
        {recentNotes.length > 0 && (
          <div
            style={{
              marginTop: 14,
              padding: 14,
              borderRadius: 14,
              background: C.panel2,
              border: `1px solid ${C.border}`,
            }}
          >
            <div style={{ fontWeight: 950, color: C.muted, marginBottom: 10 }}>Agent Notes</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: C.dim, lineHeight: 1.35 }}>
              {recentNotes.map((t, i) => (
                <li key={`${t}-${i}`}>{t}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Main step card */}
        <div
          style={{
            marginTop: 14,
            padding: 18,
            borderRadius: 16,
            background: C.panel,
            border: `1px solid ${C.border}`,
            boxShadow: `0 10px 30px rgba(0,0,0,0.40)`,
          }}
        >
          {current?.type === "branch" ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 950, color: C.muted, marginBottom: 10 }}>
                OBJECTION / BRANCH — say the first line of the option you’re choosing
              </div>

              <div style={{ display: "grid", gap: 10 }}>
                {branchPreviews.map((o) => (
                  <div
                    key={o.nextId}
                    style={{
                      padding: 12,
                      borderRadius: 14,
                      background: "rgba(255,255,255,0.03)",
                      border: `1px solid ${C.border}`,
                    }}
                  >
                    <div style={{ fontWeight: 950, color: C.text }}>{o.label}</div>
                    <div style={{ marginTop: 6, color: C.muted, lineHeight: 1.35 }}>
                      <span style={{ color: C.emerald, fontWeight: 950 }}>Say:</span> {o.previewText}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: 13, fontWeight: 950, color: C.muted, marginBottom: 10 }}>
                SAY THIS NEXT
              </div>

              <div
                style={{
                  fontSize: 20,
                  fontWeight: 900,
                  lineHeight: 1.35,
                  color: C.text,
                  textShadow: `0 0 16px ${C.emeraldGlow}`,
                }}
              >
                {current?.text || "(end)"}
              </div>

              <div style={{ marginTop: 10, color: C.dim, fontSize: 12 }}>
                Tip: If you say filler like “uh” / “oops” / “f***”, it won’t advance.
              </div>
            </>
          )}
        </div>

        {/* Debug: last speech */}
        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 14,
            background: C.panel2,
            border: `1px solid ${C.border}`,
          }}
        >
          <div style={{ fontWeight: 950, color: C.muted, marginBottom: 8 }}>Last agent speech</div>
          <div style={{ color: C.text, lineHeight: 1.35 }}>{lastSpeech || <span style={{ color: C.dim }}>(none yet)</span>}</div>

          {lastMatch.expected ? (
            <div style={{ marginTop: 10, fontSize: 12, color: lastMatch.ok ? C.emerald : C.dim }}>
              {lastMatch.ok ? "✅ Matched step." : "⛔ Not matched."} Expected:{" "}
              <span style={{ color: C.muted }}>{lastMatch.expected}</span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
