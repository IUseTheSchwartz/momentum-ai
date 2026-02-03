import { useEffect, useRef, useState } from "react";
import SCRIPT from "./scripts/script.veterans";

/* ================= CONFIG ================= */

const MATCH_THRESHOLD = 0.78;

/* ================= UTILS ================= */

const normalize = text =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const similarity = (a, b) => {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;

  const aw = new Set(a.split(" "));
  const bw = new Set(b.split(" "));
  let hit = 0;
  aw.forEach(w => bw.has(w) && hit++);
  return hit / Math.max(aw.size, bw.size);
};

/* ================= COMPONENT ================= */

export default function LiveCoach() {
  const [idx, setIdx] = useState(0);
  const [lastSpeech, setLastSpeech] = useState("");
  const recognitionRef = useRef(null);

  const current = SCRIPT[idx];

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;

    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onresult = e => {
      const spoken = e.results[e.results.length - 1][0].transcript;
      setLastSpeech(spoken);
      handleSpeech(spoken);
    };

    rec.start();
    recognitionRef.current = rec;
    return () => rec.stop();
  }, [idx]);

  const handleSpeech = spoken => {
    if (!current) return;

    if (current.type === "branch") {
      for (const opt of current.options) {
        for (const trigger of opt.triggers) {
          if (similarity(spoken, trigger) >= MATCH_THRESHOLD) {
            const jump = SCRIPT.findIndex(s => s.id === opt.next);
            if (jump !== -1) setIdx(jump);
            return;
          }
        }
      }
      return;
    }

    if (current.spoken !== false) {
      if (similarity(spoken, current.text) >= MATCH_THRESHOLD) {
        setIdx(i => i + 1);
      }
    }
  };

  const reset = () => {
    setIdx(0);
    setLastSpeech("");
  };

  return (
    <div style={{ padding: 24, maxWidth: 1000 }}>
      <h2>Live Coach</h2>
      <button onClick={reset}>RESET</button>

      <div style={{ marginTop: 20 }}>
        {SCRIPT.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: 8,
              marginBottom: 6,
              borderRadius: 6,
              background: i === idx ? "#1e293b" : "transparent",
              color: s.spoken === false ? "#666" : i === idx ? "#fff" : "#aaa"
            }}
          >
            {s.type === "branch"
              ? "— WAITING FOR BRANCH —"
              : s.text}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.6 }}>
        Last agent speech: {lastSpeech}
      </div>
    </div>
  );
}
