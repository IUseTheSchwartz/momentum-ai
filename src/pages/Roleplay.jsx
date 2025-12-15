// src/pages/Roleplay.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import BackBar from "../components/BackBar";

function isTauri() {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

export default function Roleplay({ setView, setStatus, permissionState, ensureMicPermission }) {
  const [difficulty, setDifficulty] = useState(2);

  // ✅ user-pasted key (local-only). We'll secure it later if you want.
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("momentum_ai_openai_key") || "");
  const [model, setModel] = useState(() => localStorage.getItem("momentum_ai_openai_model") || "gpt-5-mini");

  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(false);

  // chat log
  const [chat, setChat] = useState([]); // { who: "client"|"agent", text }
  const [agentText, setAgentText] = useState("");

  // coach panel
  const [coach, setCoach] = useState(null); // {score,note,best}
  const [hangup, setHangup] = useState(false);

  // Voice -> text (optional, same as before)
  const [inputMode, setInputMode] = useState("type"); // type | voice
  const [listening, setListening] = useState(false);
  const srRef = useRef(null);

  const QUICK = useMemo(
    () => [
      "Totally get it — this’ll take 60 seconds. Are you at least still interested in getting something in place?",
      "Is that through work, or something you got personally?",
      "Fair enough — what monthly number would feel comfortable if we can get you approved?",
      "Before we go further, do you currently have any life insurance in place today?",
    ],
    []
  );

  useEffect(() => {
    localStorage.setItem("momentum_ai_openai_key", apiKey);
  }, [apiKey]);

  useEffect(() => {
    localStorage.setItem("momentum_ai_openai_model", model);
  }, [model]);

  function buildTranscript(nextChat) {
    // keep it simple & readable for the model
    return nextChat
      .map((m) => (m.who === "agent" ? `Agent: ${m.text}` : `Client: ${m.text}`))
      .join("\n");
  }

  async function aiTurn(nextChat) {
    if (!isTauri()) {
      alert("AI Roleplay requires the Tauri app (not a normal browser tab).");
      return null;
    }

    const { invoke } = await import("@tauri-apps/api/core");

    const transcript = buildTranscript(nextChat);

    const res = await invoke("ai_roleplay_turn", {
      input: {
        api_key: apiKey,
        model,
        difficulty,
        transcript,
      },
    });

    // res = { raw_text }
    const rawText = res?.raw_text || "";
    const parsed = safeJsonParse(rawText);

    if (!parsed || !parsed.client) {
      return { fallbackRaw: rawText };
    }

    return parsed;
  }

  async function start() {
    if (!apiKey.trim()) {
      alert("Paste your OpenAI API key first (Roleplay Setup).");
      return;
    }

    setStatus("Roleplay");
    setRunning(true);
    setHangup(false);
    setCoach(null);
    setAgentText("");
    setChat([]);

    // First client line (AI generates opener objection)
    setLoading(true);
    try {
      const seed = [{ who: "agent", text: "Hi — this is Momentum Financial getting back to you about your request." }];
      const out = await aiTurn(seed);

      if (out?.fallbackRaw) {
        setChat(seed);
        setCoach(null);
        setHangup(false);
        setChat((prev) => [...prev, { who: "client", text: out.fallbackRaw }]);
        return;
      }

      setChat([...seed, { who: "client", text: out.client }]);
      setCoach(out.coach || null);
      setHangup(!!out.hangup);
    } catch (e) {
      console.error(e);
      alert("AI failed to start roleplay. Check your key/model.");
      setRunning(false);
    } finally {
      setLoading(false);
    }
  }

  function stop() {
    setRunning(false);
    setHangup(false);
    setLoading(false);
    setCoach(null);
    setAgentText("");
    setChat([]);
    stopSpeech();
    setStatus("Idle");
  }

  function stopSpeech() {
    try {
      const sr = srRef.current;
      if (!sr) return;
      sr.onresult = null;
      sr.onerror = null;
      sr.onend = null;
      sr.stop?.();
    } catch {}
    srRef.current = null;
    setListening(false);
  }

  async function startSpeech() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("SpeechRecognition not supported on this system.");
      return;
    }

    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) return;

    stopSpeech();

    try {
      const sr = new SR();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = "en-US";

      sr.onresult = (e) => {
        let full = "";
        for (let i = 0; i < e.results.length; i++) {
          full += e.results[i][0]?.transcript ? e.results[i][0].transcript + " " : "";
        }
        setAgentText(full.trim());
      };

      sr.onerror = () => {};
      sr.onend = () => setListening(false);

      sr.start();
      srRef.current = sr;
      setListening(true);
    } catch {
      setListening(false);
    }
  }

  async function send() {
    if (!running || loading || hangup) return;

    const text = agentText.trim();
    if (!text) return;

    const nextChat = [...chat, { who: "agent", text }];
    setChat(nextChat);
    setAgentText("");

    setLoading(true);
    try {
      const out = await aiTurn(nextChat);

      if (out?.fallbackRaw) {
        setChat((prev) => [...prev, { who: "client", text: out.fallbackRaw }]);
        setCoach(null);
        setHangup(false);
        return;
      }

      setChat((prev) => [...prev, { who: "client", text: out.client }]);
      setCoach(out.coach || null);
      setHangup(!!out.hangup);
    } catch (e) {
      console.error(e);
      alert("AI failed to respond. Try again.");
    } finally {
      setLoading(false);
      stopSpeech();
    }
  }

  return (
    <>
      <BackBar title="Roleplay Trainer" onBack={() => setView("home")} />

      <div className="panel">
        <div className="panelTitle">Setup</div>

        <div className="smallMuted" style={{ marginTop: 0 }}>
          This is now AI-driven: client replies change based on what you say (no more looping the same line).
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <div>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Difficulty
            </div>
            <select className="field" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))} disabled={running}>
              <option value={1}>Easy</option>
              <option value={2}>Normal</option>
              <option value={3}>Hard</option>
            </select>
          </div>

          <div>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Input
            </div>
            <select
              className="field"
              value={inputMode}
              onChange={(e) => {
                const v = e.target.value;
                setInputMode(v);
                if (v === "type") stopSpeech();
              }}
              disabled={running && loading}
            >
              <option value="type">Type</option>
              <option value="voice">Voice → Text</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            OpenAI API key (local only)
          </div>
          <input
            className="field"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            disabled={running}
            style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace" }}
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Model
          </div>
          <input className="field" value={model} onChange={(e) => setModel(e.target.value)} disabled={running} />
        </div>

        <div style={{ marginTop: 12 }}>
          {!running ? (
            <button className="btnOutline" onClick={start} disabled={loading}>
              {loading ? "Starting…" : "START ROLEPLAY"}
            </button>
          ) : (
            <button className="btnOutlineDim" onClick={stop}>
              END ROLEPLAY
            </button>
          )}
        </div>
      </div>

      {running && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">Call</div>

          <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 8 }}>
            {chat.map((m, i) => (
              <div
                key={i}
                className="sayBox"
                style={{
                  border: `1px solid ${C.border}`,
                  background: m.who === "client" ? "rgba(255,255,255,0.06)" : "rgba(16,185,129,0.10)",
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 950, color: m.who === "client" ? "rgba(237,239,242,0.70)" : C.emerald }}>
                  {m.who === "client" ? "CLIENT" : "YOU"}
                </div>
                <div style={{ marginTop: 6 }}>{m.text}</div>
              </div>
            ))}
          </div>

          {hangup && (
            <div className="sayBox" style={{ marginTop: 10 }}>
              Client hung up. Click END ROLEPLAY, then START again.
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Your response
            </div>

            {inputMode === "voice" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" onClick={startSpeech} disabled={listening || loading || hangup} style={{ whiteSpace: "nowrap" }}>
                  {listening ? "Listening…" : "Start talking"}
                </button>
                <button className="btnOutlineDim" onClick={stopSpeech} disabled={!listening} style={{ whiteSpace: "nowrap" }}>
                  Stop
                </button>
              </div>
            )}

            <textarea
              className="field"
              style={{ minHeight: 110, resize: "none", marginTop: 10 }}
              value={agentText}
              onChange={(e) => setAgentText(e.target.value)}
              placeholder={inputMode === "voice" ? "Your speech will appear here…" : "Type what you would say…"}
              disabled={loading || hangup}
            />

            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
              {QUICK.map((q) => (
                <button key={q} className="chipOn" onClick={() => setAgentText((t) => (t ? t + " " + q : q))} disabled={loading || hangup}>
                  Quick rebuttal
                </button>
              ))}
            </div>

            <div className="row2" style={{ marginTop: 10 }}>
              <button className="btnOutline" onClick={send} disabled={!agentText.trim() || loading || hangup}>
                {loading ? "Thinking…" : "SEND"}
              </button>
              <button className="btnOutlineDim" onClick={() => setAgentText("")} disabled={loading}>
                Clear
              </button>
            </div>

            {coach && (
              <div style={{ marginTop: 12 }}>
                <div className="panelTitle">Coach</div>
                <div className="sayBox">{coach.best || "—"}</div>
                <div className="smallMuted" style={{ marginTop: 6 }}>
                  Score: <span style={{ color: C.emerald, fontWeight: 950 }}>{coach.score ?? "—"}</span> • {coach.note || ""}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
