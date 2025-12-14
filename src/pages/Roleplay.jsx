// src/pages/Roleplay.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import BackBar from "../components/BackBar";

export default function Roleplay({ setView, setStatus, permissionState, ensureMicPermission }) {
  const DEFAULT_OBJECTIONS = useMemo(
    () => [
      {
        id: "busy",
        category: "Time",
        difficulty: 1,
        client: "I’m busy right now.",
        best: "Totally get it — this’ll take 60 seconds. Are you at least still interested in getting something in place?",
      },
      {
        id: "not_interested",
        category: "Interest",
        difficulty: 1,
        client: "I’m not interested.",
        best: "No worries — real quick, do you currently have a policy or two in place?",
      },
      {
        id: "spouse",
        category: "Spouse",
        difficulty: 2,
        client: "I need to talk to my wife/husband.",
        best: "Of course — are they available for 2 minutes so we can handle it together? If not, what time today are you both free?",
      },
      {
        id: "already_have",
        category: "Existing",
        difficulty: 2,
        client: "I already have something in place.",
        best: "Perfect — most people do. Is it through work or personal, and do you know what it would actually pay out today?",
      },
      {
        id: "cant_afford",
        category: "Price",
        difficulty: 2,
        client: "I can’t afford it.",
        best: "I hear you — that’s why we look at options. What monthly number would feel comfortable if we can get you approved?",
      },
      {
        id: "dont_give_bank",
        category: "Banking",
        difficulty: 3,
        client: "I don’t want to give you my bank info.",
        best: "I understand. We don’t draft anything today — we just set it up so it’s ready if you’re approved. If you don’t qualify, we stop right there. Fair?",
      },
      {
        id: "dont_give_social",
        category: "Social",
        difficulty: 3,
        client: "I’m not giving my social over the phone.",
        best: "I get it. It’s only to verify identity and eligibility — if you’re not comfortable, we can pause here. Before we do: are you still wanting coverage, yes or no?",
      },
    ],
    []
  );

  const [rpDifficulty, setRpDifficulty] = useState(2);
  const [rpVoiceOn, setRpVoiceOn] = useState(true);

  const ALL_CATEGORIES = useMemo(
    () => ["Time", "Interest", "Spouse", "Existing", "Price", "Banking", "Social"],
    []
  );

  const [rpCats, setRpCats] = useState(() => Object.fromEntries(ALL_CATEGORIES.map((c) => [c, true])));

  const [rpRunning, setRpRunning] = useState(false);
  const [rpClientLine, setRpClientLine] = useState("");
  const [rpAgentText, setRpAgentText] = useState("");
  const [rpFeedback, setRpFeedback] = useState(null);
  const [rpTurn, setRpTurn] = useState(0);

  const [rpCallState, setRpCallState] = useState("idle"); // idle | ringing | answered | ended
  const [rpAgentInputMode, setRpAgentInputMode] = useState("voice"); // voice | type
  const [rpAgentListening, setRpAgentListening] = useState(false);
  const rpSRRef = useRef(null);

  // custom objections
  const [customClient, setCustomClient] = useState("");
  const [customBest, setCustomBest] = useState("");
  const [customCat, setCustomCat] = useState("Interest");
  const [customDiff, setCustomDiff] = useState(2);

  const [customObjections, setCustomObjections] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("momentum_ai_custom_objections") || "[]");
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem("momentum_ai_custom_objections", JSON.stringify(customObjections));
  }, [customObjections]);

  const allObjections = useMemo(() => [...DEFAULT_OBJECTIONS, ...customObjections], [DEFAULT_OBJECTIONS, customObjections]);

  // ---------- Female voice selection ----------
  const preferredVoiceRef = useRef(null);

  function chooseFemaleVoice() {
    try {
      const voices = window.speechSynthesis?.getVoices?.() || [];
      if (!voices.length) return null;

      const isEnglish = (v) => /en(-|_)?/i.test(v.lang || "");
      const name = (v) => String(v.name || "").toLowerCase();

      const femaleHints = [
        "female",
        "samantha",
        "victoria",
        "karen",
        "tessa",
        "moira",
        "serena",
        "zira",
        "ava",
        "allison",
        "emma",
        "olivia",
        "natalie",
        "joanna",
      ];

      let pick =
        voices.find((v) => isEnglish(v) && femaleHints.some((h) => name(v).includes(h))) ||
        voices.find((v) => femaleHints.some((h) => name(v).includes(h))) ||
        null;

      if (!pick) pick = voices.find((v) => isEnglish(v)) || voices[0] || null;

      preferredVoiceRef.current = pick;
      return pick;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    chooseFemaleVoice();
    const handler = () => chooseFemaleVoice();
    window.speechSynthesis?.addEventListener?.("voiceschanged", handler);
    return () => window.speechSynthesis?.removeEventListener?.("voiceschanged", handler);
  }, []);

  function speak(text) {
    if (!rpVoiceOn) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.02;
      u.pitch = 0.95;
      u.volume = 1;

      const v = preferredVoiceRef.current || chooseFemaleVoice();
      if (v) u.voice = v;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function filteredObjections() {
    const allowedCats = new Set(Object.entries(rpCats).filter(([, on]) => on).map(([k]) => k));
    return allObjections.filter((o) => allowedCats.has(o.category) && o.difficulty <= rpDifficulty);
  }

  function scoreResponse(userText, bestText) {
    const clean = (s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    const u = new Set(clean(userText));
    const b = new Set(clean(bestText));

    let overlap = 0;
    b.forEach((w) => {
      if (u.has(w)) overlap += 1;
    });

    const raw = b.size ? overlap / b.size : 0;
    const base = Math.round(raw * 100);

    const hasQuestion = userText.includes("?");
    const hasEmpathy = /(totally|get it|understand|no worries|makes sense)/i.test(userText);

    let bonus = 0;
    if (hasQuestion) bonus += 6;
    if (hasEmpathy) bonus += 6;

    return Math.max(0, Math.min(100, base + bonus));
  }

  function nextClientLineFromPool() {
    const pool = filteredObjections();
    if (pool.length === 0) {
      return {
        client: "Okay. What’s the next step?",
        best: "Perfect — let’s take 60 seconds and see if you can even get approved. Sound fair?",
        category: "Interest",
        difficulty: 1,
      };
    }
    return pool[Math.floor(Math.random() * pool.length)];
  }

  // ---------- Ringing sound ----------
  const ringCtxRef = useRef(null);
  const ringGainRef = useRef(null);
  const ringOscRef = useRef(null);
  const ringIntervalRef = useRef(null);

  function ringStart() {
    try {
      ringStop();
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      ringCtxRef.current = ctx;

      const gain = ctx.createGain();
      gain.gain.value = 0.0;
      gain.connect(ctx.destination);
      ringGainRef.current = gain;

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 440;
      osc.connect(gain);
      osc.start();
      ringOscRef.current = osc;

      let on = false;
      const pulse = () => {
        on = !on;
        gain.gain.setTargetAtTime(on ? 0.18 : 0.0, ctx.currentTime, 0.02);
        osc.frequency.setTargetAtTime(on ? 440 : 0, ctx.currentTime, 0.02);
      };

      pulse();
      ringIntervalRef.current = setInterval(pulse, 1100);
    } catch {}
  }

  function ringStop() {
    try {
      if (ringIntervalRef.current) clearInterval(ringIntervalRef.current);
      ringIntervalRef.current = null;

      if (ringGainRef.current) {
        ringGainRef.current.gain.setTargetAtTime(0, ringCtxRef.current?.currentTime || 0, 0.01);
      }
      ringOscRef.current?.stop?.();
      ringOscRef.current = null;

      ringCtxRef.current?.close?.();
      ringCtxRef.current = null;
      ringGainRef.current = null;
    } catch {}
  }

  // ---------- Agent speech-to-text ----------
  function stopRoleplaySpeechRec() {
    try {
      const sr = rpSRRef.current;
      if (!sr) return;
      sr.onresult = null;
      sr.onerror = null;
      sr.onend = null;
      sr.stop?.();
    } catch {}
    rpSRRef.current = null;
    setRpAgentListening(false);
  }

  async function startRoleplaySpeechRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;

    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) return false;

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
        setRpAgentText(full.trim());
      };

      sr.onerror = () => {};
      sr.onend = () => setRpAgentListening(false);

      sr.start();
      rpSRRef.current = sr;
      setRpAgentListening(true);
      return true;
    } catch {
      return false;
    }
  }

  // NEW ROLEPLAY FLOW: ring -> answered, agent speaks first
  function startRoleplay() {
    setRpRunning(true);
    setRpTurn(0);
    setRpFeedback(null);
    setRpAgentText("");
    setRpClientLine("");

    setRpCallState("ringing");
    ringStart();

    const delay = 2000 + Math.floor(Math.random() * 1200);
    setTimeout(() => {
      ringStop();
      setRpCallState("answered");
    }, delay);
  }

  function endRoleplay(hangupText) {
    setRpRunning(false);
    setRpCallState("ended");
    ringStop();
    stopRoleplaySpeechRec();
    setRpFeedback({ hangup: true, note: hangupText, score: 0, best: "" });
    speak(hangupText);
  }

  function submitRoleplay() {
    if (!rpRunning) return;

    const user = rpAgentText.trim();
    if (!user) return;

    const next = nextClientLineFromPool();
    const score = scoreResponse(user, next.best);

    const hangupChance = rpDifficulty === 1 ? 0.05 : rpDifficulty === 2 ? 0.12 : 0.22;
    const tooWeak = score < (rpDifficulty === 3 ? 35 : 25);
    const rng = Math.random();

    if (tooWeak && rng < hangupChance) {
      endRoleplay("Alright — I’m not doing all that. I’ll call back later.");
      return;
    }

    setRpFeedback({
      hangup: false,
      score,
      best: next.best,
      note:
        score >= 75
          ? "Solid. Keep it short and keep control."
          : score >= 50
          ? "Decent — tighten it up and ask a direct question."
          : "Too long / not direct. Use the better response and move forward.",
    });

    setRpTurn((t) => t + 1);
    setRpClientLine(next.client);
    speak(next.client);

    setRpAgentText("");
    stopRoleplaySpeechRec();
  }

  function addCustomObjection() {
    const c = customClient.trim();
    const b = customBest.trim();
    if (!c || !b) return;

    setCustomObjections((prev) => [
      {
        id: crypto.randomUUID(),
        category: customCat,
        difficulty: customDiff,
        client: c,
        best: b,
      },
      ...prev,
    ]);

    setCustomClient("");
    setCustomBest("");
  }

  useEffect(() => {
    return () => {
      ringStop();
      stopRoleplaySpeechRec();
      setStatus("Idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <BackBar title="Roleplay Trainer" onBack={() => setView("home")} />

      <div className="panel">
        <div className="panelTitle">Setup</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Difficulty
            </div>
            <select className="field" value={rpDifficulty} onChange={(e) => setRpDifficulty(Number(e.target.value))}>
              <option value={1}>Easy</option>
              <option value={2}>Normal</option>
              <option value={3}>Hard</option>
            </select>
          </div>

          <div>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Client voice
            </div>
            <select className="field" value={rpVoiceOn ? "on" : "off"} onChange={(e) => setRpVoiceOn(e.target.value === "on")}>
              <option value="on">Female Voice ON</option>
              <option value="off">Voice OFF</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Objection categories
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {ALL_CATEGORIES.map((cat) => (
              <button key={cat} className={rpCats[cat] ? "chipOn" : "chipOff"} onClick={() => setRpCats((p) => ({ ...p, [cat]: !p[cat] }))}>
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Agent input
          </div>
          <select
            className="field"
            value={rpAgentInputMode}
            onChange={(e) => {
              const v = e.target.value;
              setRpAgentInputMode(v);
              if (v === "type") stopRoleplaySpeechRec();
            }}
          >
            <option value="voice">Voice (speech-to-text)</option>
            <option value="type">Type</option>
          </select>
        </div>

        <div style={{ marginTop: 12 }}>
          {!rpRunning ? (
            <button className="btnOutline" onClick={startRoleplay}>
              START ROLEPLAY
            </button>
          ) : (
            <button
              className="btnOutlineDim"
              onClick={() => {
                ringStop();
                stopRoleplaySpeechRec();
                setRpRunning(false);
                setRpCallState("idle");
                setRpClientLine("");
                setRpFeedback(null);
                setRpAgentText("");
              }}
            >
              END ROLEPLAY
            </button>
          )}
        </div>
      </div>

      {rpRunning && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div className="panelTitle">Call</div>
            <div
              style={{
                fontSize: 12,
                fontWeight: 950,
                padding: "6px 10px",
                borderRadius: 999,
                border: `1px solid ${C.border}`,
                background: rpCallState === "answered" ? "rgba(16,185,129,0.14)" : "rgba(255,255,255,0.06)",
                color: rpCallState === "answered" ? C.emerald : "rgba(237,239,242,0.75)",
              }}
            >
              {rpCallState === "ringing" ? "Ringing…" : rpCallState === "answered" ? "Answered" : "Ended"}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Client says
            </div>
            <div className="sayBox">
              {rpCallState !== "answered" ? "…" : rpClientLine ? rpClientLine : "— (You talk first. Do your own intro, then submit.)"}
            </div>
          </div>

          <div style={{ marginTop: 12 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Your response ({rpAgentInputMode === "voice" ? "voice → auto text" : "type"})
            </div>

            {rpAgentInputMode === "voice" ? (
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn" disabled={rpAgentListening || rpCallState !== "answered"} onClick={startRoleplaySpeechRec} style={{ whiteSpace: "nowrap" }}>
                  {rpAgentListening ? "Listening…" : "Start talking"}
                </button>
                <button className="btnOutlineDim" disabled={!rpAgentListening} onClick={stopRoleplaySpeechRec} style={{ whiteSpace: "nowrap" }}>
                  Stop
                </button>
              </div>
            ) : null}

            <textarea
              className="field"
              style={{ minHeight: 110, resize: "none", marginTop: 10 }}
              value={rpAgentText}
              onChange={(e) => setRpAgentText(e.target.value)}
              placeholder={rpAgentInputMode === "voice" ? "Your speech will appear here…" : "Type what you would say…"}
            />
          </div>

          <div className="row2" style={{ marginTop: 10 }}>
            <button className="btnOutline" onClick={submitRoleplay} disabled={!rpAgentText.trim() || rpCallState !== "answered"}>
              SUBMIT (Client responds)
            </button>
            <button
              className="btnOutlineDim"
              onClick={() => {
                const next = nextClientLineFromPool();
                setRpClientLine(next.client);
                speak(next.client);
                setRpFeedback(null);
              }}
              disabled={rpCallState !== "answered"}
            >
              FORCE NEXT CLIENT LINE
            </button>
          </div>

          {rpFeedback && (
            <div style={{ marginTop: 12 }}>
              {rpFeedback.hangup ? (
                <div className="sayBox">{rpFeedback.note}</div>
              ) : (
                <>
                  <div className="panelTitle">Better response</div>
                  <div className="sayBox">{rpFeedback.best}</div>
                  <div className="smallMuted">
                    Score: <span style={{ color: C.emerald, fontWeight: 950 }}>{rpFeedback.score}/100</span> • {rpFeedback.note} • Turn {rpTurn}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panelTitle">Add custom objection</div>

        <div className="smallMuted" style={{ marginTop: 0 }}>
          Add as many variations as you want.
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Client says
          </div>
          <input className="field" value={customClient} onChange={(e) => setCustomClient(e.target.value)} placeholder="Example: I don’t want to give my banking info…" />
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Best response
          </div>
          <input className="field" value={customBest} onChange={(e) => setCustomBest(e.target.value)} placeholder="Example: I understand — we don’t draft anything today…" />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
          <select className="field" value={customCat} onChange={(e) => setCustomCat(e.target.value)}>
            {ALL_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select className="field" value={customDiff} onChange={(e) => setCustomDiff(Number(e.target.value))}>
            <option value={1}>Easy</option>
            <option value={2}>Normal</option>
            <option value={3}>Hard</option>
          </select>
        </div>

        <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={addCustomObjection}>
          Add objection
        </button>

        <div className="smallMuted">
          Custom objections saved: <span style={{ color: C.emerald, fontWeight: 900 }}>{customObjections.length}</span>
        </div>
      </div>
    </>
  );
}
