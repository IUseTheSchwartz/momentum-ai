// src/pages/Roleplay.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import BackBar from "../components/BackBar";

export default function Roleplay({ setView, setStatus, permissionState, ensureMicPermission }) {
  // ============================================================
  // GOALS:
  // - super simple start
  // - rebuttal buttons
  // - no repeating same client line forever
  // - progresses into a basic call flow (qualifying Q&A)
  // ============================================================

  const [voiceOn, setVoiceOn] = useState(true);
  const [difficulty, setDifficulty] = useState(2); // 1 easy 2 normal 3 hard

  const [running, setRunning] = useState(false);
  const [callState, setCallState] = useState("idle"); // idle | active | ended

  const [clientLine, setClientLine] = useState("");
  const [agentText, setAgentText] = useState("");
  const [feedback, setFeedback] = useState(null);

  const [agentInputMode, setAgentInputMode] = useState("type"); // type | voice
  const [agentListening, setAgentListening] = useState(false);
  const srRef = useRef(null);

  // conversation engine
  const [phase, setPhase] = useState("idle"); // idle | objection | qualify | close
  const [scenarioId, setScenarioId] = useState("not_interested");
  const scenarioRef = useRef("not_interested");

  const [turn, setTurn] = useState(0);

  // client profile (used in qualify phase)
  const [profile, setProfile] = useState(null);

  // female voice selection
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
    if (!voiceOn) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.03;
      u.pitch = 0.95;
      u.volume = 1;

      const v = preferredVoiceRef.current || chooseFemaleVoice();
      if (v) u.voice = v;

      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  // -------- Scenarios (simple + controlled) --------
  const SCENARIOS = useMemo(
    () => ({
      not_interested: {
        label: "Not interested",
        clientStart: "I’m not interested.",
        best: [
          "No worries — real quick, do you currently have a policy or two in place?",
          "Totally get it. Before I let you go, do you have anything in place today?",
          "That’s fair. If you already have coverage I’ll leave you alone — do you have something in place right now?",
        ],
        okPushback: "I just don’t want to deal with this right now.",
        badPushback: "Yeah… I’m not interested. Like I said.",
      },
      busy: {
        label: "Busy",
        clientStart: "I’m busy right now.",
        best: [
          "Totally get it — this’ll take 60 seconds. Are you at least still interested in getting something in place?",
          "No worries. Give me 60 seconds to see if you even qualify — fair?",
          "I hear you. Quick yes/no: do you still want coverage, or should I close it out?",
        ],
        okPushback: "I said I’m busy. What is this about?",
        badPushback: "I can’t talk. I’m hanging up.",
      },
      cant_afford: {
        label: "Can’t afford",
        clientStart: "I can’t afford it.",
        best: [
          "I hear you — that’s why we look at options. What monthly number would feel comfortable if you’re approved?",
          "Makes sense. If we can get you approved, what’s a comfortable monthly budget?",
          "Totally get it. If it’s too high we stop — what monthly number feels doable?",
        ],
        okPushback: "I don’t know… money is tight.",
        badPushback: "If it costs anything, I’m not doing it.",
      },
      spouse: {
        label: "Talk to spouse",
        clientStart: "I need to talk to my wife/husband.",
        best: [
          "Of course — are they available for 2 minutes so we can handle it together?",
          "Totally. Are they there with you right now?",
          "No problem — what time today are you both free for 2 minutes so we can knock it out together?",
        ],
        okPushback: "They’re not here and they won’t like this.",
        badPushback: "I’m not doing anything without them. Bye.",
      },
      already_have: {
        label: "Already have",
        clientStart: "I already have something in place.",
        best: [
          "Perfect — is it through work or something you got personally?",
          "Nice. Do you know what it would actually pay out today?",
          "Great. If you don’t mind—work policy or personal policy?",
        ],
        okPushback: "It’s through work, I think. I’m covered.",
        badPushback: "I’m good. Don’t need anything.",
      },
      random: {
        label: "Random",
        clientStart: "",
        best: [],
        okPushback: "",
        badPushback: "",
      },
    }),
    []
  );

  function pickScenario(id) {
    if (id === "random") {
      const keys = Object.keys(SCENARIOS).filter((k) => k !== "random");
      return keys[Math.floor(Math.random() * keys.length)];
    }
    return id;
  }

  function clean(s) {
    return String(s || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/'/g, "")
      .replace(/[^a-z0-9\s]/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function scoreResponse(userText, bestText) {
    const uWords = new Set(clean(userText).split(" ").filter(Boolean));
    const bWords = new Set(clean(bestText).split(" ").filter(Boolean));

    let overlap = 0;
    bWords.forEach((w) => {
      if (uWords.has(w)) overlap += 1;
    });

    const raw = bWords.size ? overlap / bWords.size : 0;
    let base = Math.round(raw * 100);

    const hasQuestion = userText.includes("?");
    const hasEmpathy = /(totally|get it|understand|no worries|makes sense|i hear you|fair)/i.test(userText);

    if (hasQuestion) base += 8;
    if (hasEmpathy) base += 8;

    return Math.max(0, Math.min(100, base));
  }

  function getOutcome(score) {
    if (score >= 72) return "good";
    if (score >= 48) return "ok";
    return "bad";
  }

  // --------- Qualify Q&A (fake client profile) ---------
  function randomFrom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function makeClientProfile() {
    const first = randomFrom(["Maria", "James", "Tanya", "Robert", "Angela", "Chris", "Stephanie", "Mike"]);
    const state = randomFrom(["TX", "FL", "GA", "TN", "NC", "OH", "IL", "MO", "AZ"]);
    const smoker = Math.random() < 0.35;
    const beneficiary = randomFrom(["my son", "my daughter", "my wife", "my husband", "my mom", "my sister"]);
    const coverage = randomFrom(["10,000", "15,000", "20,000", "25,000"]);
    const budget = randomFrom(["40", "55", "65", "80"]);
    const workPolicy = Math.random() < 0.55;

    // dob approx
    const year = 1965 + Math.floor(Math.random() * 30); // 1965-1994
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);

    return {
      first,
      state,
      smoker,
      beneficiary,
      coverage,
      budget,
      workPolicy,
      dob: `${month}/${day}/${year}`,
    };
  }

  function clientAnswerToQuestion(q, p) {
    const s = clean(q);

    if (/(policy|life insurance|in place|coverage today)/.test(s)) {
      return p.workPolicy ? "Yeah, I have something through work." : "No, I don’t have anything right now.";
    }
    if (/(through work|work policy|personal)/.test(s)) {
      return p.workPolicy ? "It’s through work." : "I don’t have one, so nothing through work.";
    }
    if (/(how much|coverage|final expenses|face amount|10k|25k)/.test(s)) {
      return `Probably like $${p.coverage}.`;
    }
    if (/(beneficiary|who.*benefit|who.*go to)/.test(s)) {
      return `I’d put ${p.beneficiary}.`;
    }
    if (/(tobacco|nicotine|smoke|vape)/.test(s)) {
      return p.smoker ? "Yeah, I smoke." : "No, I don’t use tobacco.";
    }
    if (/(state|where.*located|what state)/.test(s)) {
      return `${p.state}.`;
    }
    if (/(date of birth|dob|born|birthday)/.test(s)) {
      return `${p.dob}.`;
    }
    if (/(monthly|budget|comfortable|afford)/.test(s)) {
      return `Probably around $${p.budget} a month.`;
    }

    // default
    return "Okay…";
  }

  // -------- Voice STT for agent (optional) --------
  function stopSpeechRec() {
    try {
      const sr = srRef.current;
      if (!sr) return;
      sr.onresult = null;
      sr.onerror = null;
      sr.onend = null;
      sr.stop?.();
    } catch {}
    srRef.current = null;
    setAgentListening(false);
  }

  async function startSpeechRec() {
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
        setAgentText(full.trim());
      };

      sr.onerror = () => {};
      sr.onend = () => setAgentListening(false);

      sr.start();
      srRef.current = sr;
      setAgentListening(true);
      return true;
    } catch {
      return false;
    }
  }

  // -------- Start / End / Submit --------
  function startRoleplay() {
    const chosen = pickScenario(scenarioId);
    scenarioRef.current = chosen;

    const p = makeClientProfile();
    setProfile(p);

    setRunning(true);
    setCallState("active");
    setPhase("objection");
    setTurn(0);
    setFeedback(null);
    setAgentText("");

    const firstLine = SCENARIOS[chosen].clientStart;
    setClientLine(firstLine);
    speak(firstLine);
    setStatus("Roleplay");
  }

  function endRoleplay() {
    setRunning(false);
    setCallState("ended");
    setPhase("idle");
    setClientLine("");
    setAgentText("");
    setFeedback(null);
    setTurn(0);
    stopSpeechRec();
    setStatus("Idle");
  }

  function submitTurn() {
    if (!running || callState !== "active") return;
    const user = agentText.trim();
    if (!user) return;

    const sid = scenarioRef.current;
    const scenario = SCENARIOS[sid];
    const p = profile || makeClientProfile();

    // If we’re in qualify mode, client answers the agent’s question
    if (phase === "qualify") {
      const answer = clientAnswerToQuestion(user, p);

      setClientLine(answer);
      speak(answer);

      setFeedback({
        score: null,
        note: "Good — keep moving forward with the questions.",
        best: "",
      });

      setTurn((t) => t + 1);
      setAgentText("");
      stopSpeechRec();
      return;
    }

    // Objection phase scoring
    const best = scenario.best?.[0] || "";
    const score = scoreResponse(user, best);
    const outcome = getOutcome(score);

    // Difficulty affects hangup chance on bad responses
    const hangupChance = difficulty === 1 ? 0.03 : difficulty === 2 ? 0.10 : 0.20;

    if (outcome === "bad" && Math.random() < hangupChance) {
      const hang = "Alright. I’m gonna go — I’m not doing all that right now.";
      setClientLine(hang);
      speak(hang);
      setFeedback({ score, note: "They hung up. Keep it shorter and ask a direct question.", best });
      setCallState("ended");
      setRunning(false);
      stopSpeechRec();
      return;
    }

    if (outcome === "good") {
      // progress into qualify
      const okLine = "Okay… just make it quick.";
      setClientLine(okLine);
      speak(okLine);
      setPhase("qualify");

      setFeedback({
        score,
        note: "✅ Nice. Now go straight into your qualifying questions.",
        best,
      });
    } else if (outcome === "ok") {
      // pushback but different line (no infinite repeat)
      const push = scenario.okPushback || "Okay… but what is this about?";
      setClientLine(push);
      speak(push);

      setFeedback({
        score,
        note: "Decent — tighten it up and end with a direct question.",
        best,
      });
    } else {
      // bad: client repeats/stronger pushback (still progresses a bit, not the same exact line)
      const push = scenario.badPushback || "I said no — I’m not interested.";
      setClientLine(push);
      speak(push);

      setFeedback({
        score,
        note: "Too long / not direct. Use a short rebuttal + question.",
        best,
      });
    }

    setTurn((t) => t + 1);
    setAgentText("");
    stopSpeechRec();
  }

  // -------- Rebuttal buttons (simple) --------
  const rebuttalOptions = useMemo(() => {
    const sid = scenarioRef.current;
    const scenario = SCENARIOS[sid] || SCENARIOS.not_interested;

    const list = scenario.best?.length ? scenario.best : SCENARIOS.not_interested.best;

    return [
      { label: "Best (short)", text: list[0] || "" },
      { label: "Empathy + question", text: list[1] || list[0] || "" },
      { label: "Alt", text: list[2] || list[0] || "" },
    ];
  }, [SCENARIOS]);

  // cleanup
  useEffect(() => {
    return () => {
      stopSpeechRec();
      try {
        window.speechSynthesis?.cancel?.();
      } catch {}
      setStatus("Idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <BackBar title="Roleplay" onBack={() => setView("home")} />

      {/* SIMPLE SETUP */}
      <div className="panel">
        <div className="panelTitle">Roleplay Setup</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Difficulty
            </div>
            <select className="field" value={difficulty} onChange={(e) => setDifficulty(Number(e.target.value))}>
              <option value={1}>Easy</option>
              <option value={2}>Normal</option>
              <option value={3}>Hard</option>
            </select>
          </div>

          <div>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Client voice
            </div>
            <select className="field" value={voiceOn ? "on" : "off"} onChange={(e) => setVoiceOn(e.target.value === "on")}>
              <option value="on">Voice ON</option>
              <option value="off">Voice OFF</option>
            </select>
          </div>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Your input
          </div>
          <select
            className="field"
            value={agentInputMode}
            onChange={(e) => {
              const v = e.target.value;
              setAgentInputMode(v);
              if (v === "type") stopSpeechRec();
            }}
          >
            <option value="type">Type</option>
            <option value="voice">Voice (speech-to-text)</option>
          </select>
        </div>

        <div style={{ marginTop: 10 }}>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Start scenario
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {Object.entries(SCENARIOS).map(([id, s]) => (
              <button
                key={id}
                className={scenarioId === id ? "chipOn" : "chipOff"}
                onClick={() => setScenarioId(id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          {!running ? (
            <button className="btnOutline" onClick={startRoleplay} style={{ width: "100%" }}>
              START ROLEPLAY
            </button>
          ) : (
            <button className="btnOutlineDim" onClick={endRoleplay} style={{ width: "100%" }}>
              END ROLEPLAY
            </button>
          )}
        </div>
      </div>

      {/* CALL */}
      {running && (
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
                background: "rgba(16,185,129,0.14)",
                color: C.emerald,
              }}
            >
              {phase === "objection" ? "Objection" : phase === "qualify" ? "Qualifying" : "Active"}
            </div>
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Client says
            </div>
            <div className="sayBox">{clientLine || "…"}</div>
          </div>

          {/* Rebuttal buttons only during objection phase */}
          {phase === "objection" && (
            <div style={{ marginTop: 10 }}>
              <div className="smallMuted" style={{ marginTop: 0 }}>
                Quick rebuttals (tap one)
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                {rebuttalOptions.map((o) => (
                  <button
                    key={o.label}
                    className="chipOn"
                    onClick={() => setAgentText(o.text)}
                    style={{ borderColor: "rgba(16,185,129,0.35)", background: "rgba(16,185,129,0.10)" }}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div style={{ marginTop: 12 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Your response ({agentInputMode === "voice" ? "voice → text" : "type"})
            </div>

            {agentInputMode === "voice" && (
              <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                <button className="btn" disabled={agentListening} onClick={startSpeechRec} style={{ whiteSpace: "nowrap" }}>
                  {agentListening ? "Listening…" : "Start talking"}
                </button>
                <button className="btnOutlineDim" disabled={!agentListening} onClick={stopSpeechRec} style={{ whiteSpace: "nowrap" }}>
                  Stop
                </button>
              </div>
            )}

            <textarea
              className="field"
              style={{ minHeight: 110, resize: "none", marginTop: 10 }}
              value={agentText}
              onChange={(e) => setAgentText(e.target.value)}
              placeholder={agentInputMode === "voice" ? "Your speech will appear here…" : "Type what you would say…"}
            />
          </div>

          <div className="row2" style={{ marginTop: 10 }}>
            <button className="btnOutline" onClick={submitTurn} disabled={!agentText.trim()}>
              SUBMIT (Client responds)
            </button>

            <button
              className="btnOutlineDim"
              onClick={() => {
                // quick “move forward” button
                if (phase === "objection") {
                  setClientLine("Okay… just make it quick.");
                  speak("Okay… just make it quick.");
                  setPhase("qualify");
                  setFeedback({ score: null, note: "Forced to qualifying. Now ask your questions.", best: "" });
                } else {
                  setClientLine("Okay…");
                  speak("Okay…");
                }
              }}
            >
              FORCE FORWARD
            </button>
          </div>

          {feedback && (
            <div style={{ marginTop: 12 }}>
              <div className="panelTitle">Coach</div>
              <div className="sayBox">
                {feedback.best ? (
                  <>
                    <div style={{ fontWeight: 900, marginBottom: 6 }}>Best response:</div>
                    <div style={{ marginBottom: 10 }}>{feedback.best}</div>
                  </>
                ) : null}
                <div>{feedback.note}</div>
              </div>

              {typeof feedback.score === "number" && (
                <div className="smallMuted" style={{ marginTop: 8 }}>
                  Score: <span style={{ color: C.emerald, fontWeight: 950 }}>{feedback.score}/100</span> • Turn {turn}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Tiny helper when call is not running */}
      {!running && (
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">How it works</div>
          <div className="smallMuted" style={{ marginTop: 0 }}>
            Start a scenario → rebut the objection → once the client says “make it quick”, you move into qualifying. In
            qualifying mode, the client answers your questions based on a generated profile.
          </div>
        </div>
      )}
    </>
  );
}
