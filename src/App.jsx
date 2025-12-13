import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function App() {
  // Views
  const [view, setView] = useState("home"); // home | live | record | roleplay

  // Shared mic device list
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [permissionState, setPermissionState] = useState("unknown"); // unknown | granted | denied

  // Live Coach
  const [status, setStatus] = useState("Idle");
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [sayThisNext, setSayThisNext] = useState(
    "Click START. When the client pauses, Momentum AI will show your next line here."
  );

  // Recorder
  const [isRecording, setIsRecording] = useState(false);
  const [recordingHint, setRecordingHint] = useState("Ready.");
  const [recordings, setRecordings] = useState([]); // { id, name, blobUrl, sizeKb, createdAt }
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // Roleplay
  const OBJECTIONS = useMemo(
    () => [
      {
        key: "busy",
        client: "I’m busy right now.",
        better: "Totally get it — this’ll take 60 seconds. Are you at least still interested in getting something in place?",
        tips: ["Acknowledge", "Timeframe assurance", "Yes/no question"],
      },
      {
        key: "not_interested",
        client: "I’m not interested.",
        better: "No worries — real quick, do you currently have a policy or two in place?",
        tips: ["Don’t argue", "Ask a simple question", "Move to discovery"],
      },
      {
        key: "wife",
        client: "I need to talk to my wife/husband.",
        better: "Of course — is your spouse available for 2 minutes so we can handle it together? If not, what time today are you both free?",
        tips: ["Agree", "Invite them in", "Lock a time"],
      },
      {
        key: "already_have",
        client: "I already have something in place.",
        better: "Perfect — most people do. Is it through work or personal, and do you know what it would actually pay out today?",
        tips: ["Validate", "Clarify type", "Expose gaps"],
      },
      {
        key: "cant_afford",
        client: "I can’t afford it.",
        better: "I hear you — that’s why we look at options. What monthly number would feel comfortable if we can get you approved?",
        tips: ["Empathy", "Control the budget", "Keep moving"],
      },
      {
        key: "dont_give_info",
        client: "I don’t want to give out my info.",
        better: "I understand — we only use it to see if you can qualify. If you don’t qualify, we stop right there. Fair?",
        tips: ["Reduce risk", "Explain why", "Ask for agreement"],
      },
    ],
    []
  );

  const [rpIndex, setRpIndex] = useState(0);
  const [rpUser, setRpUser] = useState("");
  const [rpScore, setRpScore] = useState(null);

  // WebAudio meter + silence detection (Live Coach)
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const lastTalkRef = useRef(Date.now());
  const lastTriggerRef = useRef(0);

  // Strict black + emerald palette
  const C = {
    bg: "#050607",
    panel: "#0A0B0D",
    panel2: "#070809",
    text: "#EDEFF2",
    muted: "#A8AFB7",
    emerald: "#10B981",
    emeraldGlow: "rgba(16,185,129,0.35)",
    border: "rgba(255,255,255,0.08)",
    danger: "#FF6B6B",
  };

  async function ensureMicPermission() {
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach((t) => t.stop());
      setPermissionState("granted");
      return true;
    } catch {
      setPermissionState("denied");
      return false;
    }
  }

  async function loadDevices() {
    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) return;

    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all.filter((d) => d.kind === "audioinput");
    setDevices(inputs);

    if (!selectedDeviceId && inputs[0]?.deviceId) {
      setSelectedDeviceId(inputs[0].deviceId);
    }
  }

  useEffect(() => {
    loadDevices();
    const handler = () => loadDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function cleanupLiveAudio() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;

    if (audioCtxRef.current) {
      audioCtxRef.current.close?.();
      audioCtxRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setMicLevel(0);
  }

  function startMeterAndSilenceDetection(stream) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);

    const SILENCE_THRESHOLD = 0.03; // tweak if needed
    const SILENCE_MS = 900; // how long of quiet before triggering
    const COOLDOWN_MS = 1600;

    const autoLines = [
      "No worries — real quick, do you currently have a policy or two in place?",
      "Okay, and is that through work or personal?",
      "Got it. If it’s okay, this’ll take about a minute so we can see if you can even get approved.",
      "Before we go further, about how much do you have set aside right now for final expenses?",
      "Fair enough — what monthly number would feel comfortable if we can get you approved?",
    ];

    const tick = () => {
      if (!analyserRef.current) return;

      analyserRef.current.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);

      const level = Math.max(0, Math.min(100, Math.round(rms * 200)));
      setMicLevel(level);

      const now = Date.now();
      if (rms > SILENCE_THRESHOLD) {
        lastTalkRef.current = now;
      } else {
        const silentFor = now - lastTalkRef.current;
        const sinceLastTrigger = now - lastTriggerRef.current;

        if (silentFor >= SILENCE_MS && sinceLastTrigger >= COOLDOWN_MS) {
          lastTriggerRef.current = now;

          // rotate suggestions
          const pick = autoLines[Math.floor(Math.random() * autoLines.length)];
          setSayThisNext(pick);
        }
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function startLive() {
    if (isListening) return;

    setStatus("Requesting microphone…");
    setSayThisNext("Listening… (auto-suggest triggers on pauses)");
    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) {
      setStatus("Mic permission denied");
      setSayThisNext("Allow microphone access, then try again.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      });

      streamRef.current = stream;
      lastTalkRef.current = Date.now();
      lastTriggerRef.current = 0;

      startMeterAndSilenceDetection(stream);

      setIsListening(true);
      setStatus("Listening");
    } catch {
      setStatus("Could not start microphone");
      setSayThisNext("Could not access that mic. Pick another mic from the dropdown.");
    }
  }

  function stopLive() {
    if (!isListening) return;
    setStatus("Stopping…");
    cleanupLiveAudio();
    setIsListening(false);
    setStatus("Idle");
    setSayThisNext("Stopped. Click START to listen again.");
  }

  async function startRecording() {
    if (isRecording) return;

    setRecordingHint("Requesting microphone…");
    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) {
      setRecordingHint("Mic permission denied.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      });

      chunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = mr;

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) chunksRef.current.push(e.data);
      };

      mr.onstop = () => {
        // stop tracks
        stream.getTracks().forEach((t) => t.stop());

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const blobUrl = URL.createObjectURL(blob);

        const ts = new Date().toISOString().replace(/[:.]/g, "-");
        const name = `momentum-ai-recording-${ts}.webm`;

        setRecordings((prev) => [
          {
            id: crypto.randomUUID(),
            name,
            blobUrl,
            sizeKb: Math.round(blob.size / 1024),
            createdAt: new Date().toLocaleString(),
          },
          ...prev,
        ]);

        setRecordingHint("Saved to list below. Click “Download” to save locally.");
      };

      mr.start();
      setIsRecording(true);
      setRecordingHint("Recording…");
    } catch {
      setRecordingHint("Could not start recording. Try another mic.");
    }
  }

  function stopRecording() {
    if (!isRecording) return;
    setRecordingHint("Stopping…");
    setIsRecording(false);

    const mr = mediaRecorderRef.current;
    if (mr && mr.state !== "inactive") mr.stop();
    mediaRecorderRef.current = null;
  }

  function downloadRecording(rec) {
    const a = document.createElement("a");
    a.href = rec.blobUrl;
    a.download = rec.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function scoreResponse(userText, betterText) {
    // simple scoring: keyword overlap (no AI yet)
    const clean = (s) =>
      s
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter(Boolean);

    const u = new Set(clean(userText));
    const b = new Set(clean(betterText));

    let overlap = 0;
    b.forEach((w) => {
      if (u.has(w)) overlap += 1;
    });

    const raw = b.size ? overlap / b.size : 0;
    return Math.max(0, Math.min(100, Math.round(raw * 100)));
  }

  function nextRoleplay() {
    setRpScore(null);
    setRpUser("");
    setRpIndex((i) => (i + 1) % OBJECTIONS.length);
  }

  function Shell({ children }) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(900px 550px at 18% 10%, rgba(16,185,129,0.18), transparent 60%),
                       radial-gradient(800px 520px at 86% 18%, rgba(16,185,129,0.10), transparent 58%),
                       ${C.bg}`,
          color: C.text,
          padding: 16,
          boxSizing: "border-box",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >
        <div style={{ maxWidth: 520, margin: "0 auto" }}>
          {/* Header (no subtitle per your request) */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div style={{ fontSize: 28, fontWeight: 950, letterSpacing: 0.2 }}>
              Momentum <span style={{ color: C.emerald }}>AI</span>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "8px 10px",
                borderRadius: 14,
                background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 12, color: C.muted }}>Status</div>
              <div style={{ fontSize: 12, fontWeight: 900 }}>{status}</div>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: isListening || isRecording ? C.emerald : "rgba(255,255,255,0.20)",
                  boxShadow: isListening || isRecording ? `0 0 18px ${C.emeraldGlow}` : "none",
                }}
              />
            </div>
          </div>

          {children}
        </div>
      </div>
    );
  }

  function BackBar(title) {
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
        <button className="btn" onClick={() => setView("home")}>
          ← Menu
        </button>
        <div style={{ color: C.muted, fontSize: 13, fontWeight: 800 }}>{title}</div>
      </div>
    );
  }

  function MicBlock() {
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Microphone</div>

        <select
          value={selectedDeviceId}
          onChange={(e) => setSelectedDeviceId(e.target.value)}
          className="field"
        >
          {devices.length === 0 ? (
            <option value="">No mics detected</option>
          ) : (
            devices.map((d) => (
              <option key={d.deviceId} value={d.deviceId}>
                {d.label || `Microphone (${d.deviceId.slice(0, 6)}…)`}
              </option>
            ))
          )}
        </select>

        <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={loadDevices}>
          Refresh devices
        </button>

        {permissionState === "denied" && (
          <div style={{ marginTop: 8, color: C.danger, fontSize: 12 }}>
            Mic permission denied. Allow microphone access in OS settings.
          </div>
        )}
      </div>
    );
  }

  // HOME MENU
  if (view === "home") {
    // equal-height cards + hover pop
    const cards = [
      {
        title: "Live Coach",
        desc:
          "Listens to your mic. When the client pauses, Momentum AI pops your next line automatically.",
        onClick: () => setView("live"),
      },
      {
        title: "Recorder",
        desc: "Records your mic audio. Stop → Download the file for review & coaching.",
        onClick: () => setView("record"),
      },
      {
        title: "Roleplay Trainer",
        desc: "Practice objections. Type your response → get a better response + score.",
        onClick: () => setView("roleplay"),
      },
    ];

    return (
      <Shell>
        <div className="grid3">
          {cards.map((c) => (
            <button key={c.title} className="modeCard" onClick={c.onClick}>
              <div className="modeTitle">{c.title}</div>
              <div className="modeDesc">{c.desc}</div>
              <div className="modeLink">Open →</div>
            </button>
          ))}
        </div>

        {/* Fill the page with "How it works" */}
        <div className="howItWorks">
          <div className="howTitle">How it works</div>
          <ol className="howList">
            <li>Pick your microphone (or leave default).</li>
            <li>Start Live Coach while you’re on a call (phone call on speaker / near your mic).</li>
            <li>When the client pauses, Momentum AI auto-triggers a recommended next line.</li>
            <li>Use Recorder to save calls for review. Use Roleplay to drill objections daily.</li>
          </ol>
          <div className="howNote">
            To make suggestions based on the client’s exact words, we’ll add speech-to-text next.
            (Right now it’s pause-triggered coaching + roleplay.)
          </div>
        </div>
      </Shell>
    );
  }

  // LIVE
  if (view === "live") {
    return (
      <Shell>
        {BackBar("Live Coach")}

        <div className="panel">
          <MicBlock />

          <div className="row2">
            <button className="btnOutline" disabled={isListening} onClick={startLive}>
              START
            </button>
            <button className="btnOutlineDim" disabled={!isListening} onClick={stopLive}>
              STOP
            </button>
          </div>

          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Mic level</div>
            <div className="meter">
              <div className="meterFill" style={{ width: `${micLevel}%` }} />
            </div>
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">SAY THIS NEXT</div>
          <div className="sayBox">{sayThisNext}</div>
          <div className="smallMuted">Auto-triggers on pauses (silence detection).</div>
        </div>
      </Shell>
    );
  }

  // RECORDER (WORKING)
  if (view === "record") {
    return (
      <Shell>
        {BackBar("Recorder")}

        <div className="panel">
          <MicBlock />

          <div className="row2">
            <button className="btnOutline" disabled={isRecording} onClick={startRecording}>
              START
            </button>
            <button className="btnOutlineDim" disabled={!isRecording} onClick={stopRecording}>
              STOP
            </button>
          </div>

          <div className="smallMuted" style={{ marginTop: 10 }}>
            {recordingHint}
          </div>
        </div>

        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">Recordings</div>

          {recordings.length === 0 ? (
            <div className="smallMuted">No recordings yet.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {recordings.map((r) => (
                <div
                  key={r.id}
                  style={{
                    border: "1px solid rgba(16,185,129,0.35)",
                    borderRadius: 14,
                    padding: 10,
                    background: "#050607",
                    boxShadow: `0 0 22px rgba(16,185,129,0.08)`,
                  }}
                >
                  <div style={{ fontWeight: 900 }}>{r.name}</div>
                  <div className="smallMuted">
                    {r.createdAt} • {r.sizeKb} KB
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button className="btn" onClick={() => downloadRecording(r)}>
                      Download
                    </button>
                    <audio controls src={r.blobUrl} style={{ width: "100%" }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Shell>
    );
  }

  // ROLEPLAY (WORKING)
  const current = OBJECTIONS[rpIndex];
  return (
    <Shell>
      {BackBar("Roleplay Trainer")}

      <div className="panel">
        <div className="panelTitle">Client says</div>
        <div className="sayBox">{current.client}</div>

        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Your response</div>
          <textarea
            className="field"
            style={{ minHeight: 110, resize: "none" }}
            value={rpUser}
            onChange={(e) => setRpUser(e.target.value)}
            placeholder="Type what you would say…"
          />
        </div>

        <div className="row2" style={{ marginTop: 10 }}>
          <button
            className="btnOutline"
            onClick={() => setRpScore(scoreResponse(rpUser, current.better))}
            disabled={!rpUser.trim()}
          >
            Score it
          </button>
          <button className="btnOutlineDim" onClick={nextRoleplay}>
            Next
          </button>
        </div>

        {rpScore !== null && (
          <div style={{ marginTop: 12 }}>
            <div className="panelTitle">Better response</div>
            <div className="sayBox">{current.better}</div>

            <div className="smallMuted" style={{ marginTop: 8 }}>
              Score: <span style={{ color: C.emerald, fontWeight: 950 }}>{rpScore}/100</span>
              {" • "}
              Tips: {current.tips.join(" • ")}
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}

export default App;
