import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function App() {
  // Views: home menu + the 3 features
  const [view, setView] = useState("home"); // home | live | record | roleplay

  // Live Coach state (mic + meter)
  const [status, setStatus] = useState("Idle");
  const [isRunning, setIsRunning] = useState(false);
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [permissionState, setPermissionState] = useState("unknown"); // unknown | granted | denied
  const [micLevel, setMicLevel] = useState(0);
  const [sayThisNext, setSayThisNext] = useState(
    "Click START to begin listening. Momentum AI will show your next line here."
  );

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  // Strict black + emerald palette (no blues)
  const C = {
    bg: "#050607",
    panel: "#0A0B0D",
    panel2: "#070809",
    border: "rgba(255,255,255,0.08)",
    text: "#EDEFF2",
    muted: "#A8AFB7",
    emerald: "#10B981",
    emeraldSoft: "rgba(16,185,129,0.18)",
    emeraldGlow: "rgba(16,185,129,0.45)",
    danger: "#FF6B6B",
  };

  const canStart = useMemo(() => !isRunning, [isRunning]);

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
    if (!ok) {
      setSayThisNext("Microphone permission denied. Allow mic access to use Momentum AI.");
      return;
    }
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

  function startMeter(stream) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    audioCtxRef.current = ctx;

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    source.connect(analyser);

    const data = new Uint8Array(analyser.fftSize);

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

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function start() {
    if (isRunning) return;

    setStatus("Requesting microphone…");
    setSayThisNext("Listening…");
    setMicLevel(0);

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
      startMeter(stream);

      setIsRunning(true);
      setStatus("Listening");
    } catch {
      setStatus("Could not start microphone");
      setSayThisNext("Could not access that mic. Pick another mic from the dropdown.");
    }
  }

  function stop() {
    if (!isRunning) return;

    setStatus("Stopping…");

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

    setIsRunning(false);
    setMicLevel(0);
    setStatus("Idle");
    setSayThisNext("Stopped. Click START to listen again.");
  }

  function Shell({ children }) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: `radial-gradient(900px 550px at 18% 10%, ${C.emeraldSoft}, transparent 60%),
                       radial-gradient(800px 520px at 86% 18%, rgba(16,185,129,0.10), transparent 58%),
                       ${C.bg}`,
          color: C.text,
          padding: 20,
          boxSizing: "border-box",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial',
        }}
      >
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {/* Header */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
              marginBottom: 14,
            }}
          >
            <div>
              <div style={{ fontSize: 28, fontWeight: 900, letterSpacing: 0.2 }}>
                Momentum <span style={{ color: C.emerald }}>AI</span>
              </div>
              <div style={{ color: C.muted, marginTop: 4, fontSize: 13 }}>
                Black + emerald • plug & play • no setup for agents
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: "10px 12px",
                borderRadius: 14,
                background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
                border: `1px solid ${C.border}`,
              }}
            >
              <div style={{ fontSize: 12, color: C.muted }}>Status</div>
              <div style={{ fontSize: 12, fontWeight: 800 }}>{status}</div>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 999,
                  background: isRunning ? C.emerald : "rgba(255,255,255,0.20)",
                  boxShadow: isRunning ? `0 0 18px ${C.emeraldGlow}` : "none",
                }}
              />
            </div>
          </div>

          {children}

          <div style={{ marginTop: 14, color: C.muted, fontSize: 12 }}>
            Momentum AI • v0.1
          </div>
        </div>
      </div>
    );
  }

  function Card({ title, desc, onClick }) {
    return (
      <button
        onClick={onClick}
        style={{
          textAlign: "left",
          width: "100%",
          padding: 16,
          borderRadius: 18,
          background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
          border: `1px solid rgba(16,185,129,0.45)`,
          boxShadow: `0 0 0 1px rgba(16,185,129,0.20), 0 0 28px rgba(16,185,129,0.12)`,
          cursor: "pointer",
        }}
        className="noBlueFocus"
      >
        <div style={{ fontWeight: 950, fontSize: 16, color: C.text }}>{title}</div>
        <div style={{ marginTop: 6, fontSize: 13, color: C.muted, lineHeight: 1.35 }}>
          {desc}
        </div>
        <div style={{ marginTop: 12, fontSize: 12, color: C.emerald, fontWeight: 800 }}>
          Open →
        </div>
      </button>
    );
  }

  function BackBar() {
    return (
      <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
        <button
          onClick={() => setView("home")}
          style={{
            padding: "10px 12px",
            borderRadius: 14,
            background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
            border: `1px solid rgba(16,185,129,0.45)`,
            boxShadow: `0 0 18px rgba(16,185,129,0.10)`,
            color: C.text,
            cursor: "pointer",
            fontWeight: 800,
          }}
          className="noBlueFocus"
        >
          ← Menu
        </button>

        {view === "live" && (
          <div style={{ color: C.muted, fontSize: 13, alignSelf: "center" }}>
            Live Coach
          </div>
        )}
        {view === "record" && (
          <div style={{ color: C.muted, fontSize: 13, alignSelf: "center" }}>
            Recorder
          </div>
        )}
        {view === "roleplay" && (
          <div style={{ color: C.muted, fontSize: 13, alignSelf: "center" }}>
            Roleplay Trainer
          </div>
        )}
      </div>
    );
  }

  // HOME MENU (first screen)
  if (view === "home") {
    return (
      <Shell>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr 1fr",
            gap: 14,
            marginTop: 6,
          }}
        >
          <Card
            title="Live Coach"
            desc="Listen on your mic. When the client stops talking, Momentum AI shows what you should say next."
            onClick={() => setView("live")}
          />
          <Card
            title="Recorder"
            desc="Record your mic audio and save it locally for review, coaching, and training."
            onClick={() => setView("record")}
          />
          <Card
            title="Roleplay Trainer"
            desc="Upload a script and roleplay objections. Momentum AI scores and suggests better responses."
            onClick={() => setView("roleplay")}
          />
        </div>

        <div
          style={{
            marginTop: 14,
            padding: 14,
            borderRadius: 18,
            background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
            border: `1px solid ${C.border}`,
            color: C.muted,
            fontSize: 13,
            lineHeight: 1.4,
          }}
        >
          No setup for agents. Eventually this will be fully automatic: it only shows your line (no transcript on screen).
        </div>
      </Shell>
    );
  }

  // RECORD & ROLEPLAY placeholders for now (menu + clean layout)
  if (view === "record") {
    return (
      <Shell>
        <BackBar />
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
            border: `1px solid rgba(16,185,129,0.45)`,
            boxShadow: `0 0 28px rgba(16,185,129,0.10)`,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 18 }}>Recorder</div>
          <div style={{ marginTop: 8, color: C.muted }}>
            Coming next: Start/Stop recording + save to Desktop/Momentum AI/Recordings.
          </div>
        </div>
      </Shell>
    );
  }

  if (view === "roleplay") {
    return (
      <Shell>
        <BackBar />
        <div
          style={{
            padding: 18,
            borderRadius: 18,
            background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
            border: `1px solid rgba(16,185,129,0.45)`,
            boxShadow: `0 0 28px rgba(16,185,129,0.10)`,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 18 }}>Roleplay Trainer</div>
          <div style={{ marginTop: 8, color: C.muted }}>
            Coming next: upload script + roleplay objections + score improvements.
          </div>
        </div>
      </Shell>
    );
  }

  // LIVE COACH screen
  return (
    <Shell>
      <BackBar />

      <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16 }}>
        {/* Left controls */}
        <div
          style={{
            background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: 14,
          }}
        >
          <div style={{ fontWeight: 950, fontSize: 14, marginBottom: 10 }}>Controls</div>

          {/* Mic dropdown (fix overlap by stacking refresh below on small space) */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Microphone</div>

            <select
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="noBlueFocus"
              style={{
                width: "100%",
                padding: "10px 10px",
                borderRadius: 14,
                border: `1px solid rgba(16,185,129,0.45)`,
                background: "#050607",
                color: C.text,
                outline: "none",
                boxShadow: `0 0 18px rgba(16,185,129,0.08)`,
              }}
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

            <button
              onClick={loadDevices}
              className="noBlueFocus"
              style={{
                marginTop: 10,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 14,
                border: `1px solid rgba(16,185,129,0.45)`,
                background: "#050607",
                color: C.text,
                cursor: "pointer",
                fontWeight: 800,
                boxShadow: `0 0 18px rgba(16,185,129,0.08)`,
              }}
            >
              Refresh devices
            </button>

            {permissionState === "denied" && (
              <div style={{ marginTop: 8, color: C.danger, fontSize: 12 }}>
                Mic permission denied. Allow microphone access in OS settings.
              </div>
            )}
          </div>

          {/* Start/Stop: emerald glowing outline only */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
            <button
              disabled={!canStart}
              onClick={start}
              className="noBlueFocus"
              style={{
                padding: "12px 12px",
                borderRadius: 16,
                border: `1px solid rgba(16,185,129,0.75)`,
                background: "#050607",
                color: canStart ? C.text : C.muted,
                fontWeight: 950,
                cursor: canStart ? "pointer" : "not-allowed",
                boxShadow: canStart ? `0 0 26px rgba(16,185,129,0.16)` : "none",
              }}
            >
              START
            </button>

            <button
              disabled={!isRunning}
              onClick={stop}
              className="noBlueFocus"
              style={{
                padding: "12px 12px",
                borderRadius: 16,
                border: `1px solid rgba(16,185,129,0.40)`,
                background: "#050607",
                color: isRunning ? C.text : C.muted,
                fontWeight: 950,
                cursor: isRunning ? "pointer" : "not-allowed",
                boxShadow: isRunning ? `0 0 22px rgba(16,185,129,0.10)` : "none",
              }}
            >
              STOP
            </button>
          </div>

          {/* Mic meter */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>Mic level</div>
            <div
              style={{
                height: 10,
                borderRadius: 999,
                background: "rgba(255,255,255,0.06)",
                border: `1px solid rgba(16,185,129,0.30)`,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${micLevel}%`,
                  height: "100%",
                  background: C.emerald,
                  boxShadow: `0 0 18px ${C.emeraldGlow}`,
                  transition: "width 60ms linear",
                }}
              />
            </div>
          </div>
        </div>

        {/* Right suggestion */}
        <div
          style={{
            background: `linear-gradient(180deg, ${C.panel}, ${C.panel2})`,
            border: `1px solid ${C.border}`,
            borderRadius: 18,
            padding: 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div style={{ fontWeight: 950, fontSize: 16 }}>SAY THIS NEXT</div>
            <div style={{ fontSize: 12, color: C.muted }}>(only shows your line)</div>
          </div>

          <div
            style={{
              marginTop: 12,
              borderRadius: 18,
              border: `1px solid rgba(16,185,129,0.55)`,
              background: "#050607",
              padding: 16,
              minHeight: 240,
              boxShadow: `0 0 32px rgba(16,185,129,0.10)`,
            }}
          >
            <div style={{ fontSize: 20, fontWeight: 950, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>
              {sayThisNext}
            </div>

            <div style={{ marginTop: 14, color: C.muted, fontSize: 12, lineHeight: 1.4 }}>
              Next: pause-trigger detection + Logan-style suggestion engine.
            </div>
          </div>

          {/* quick dev test button */}
          <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
            <button
              onClick={() =>
                setSayThisNext("No worries — real quick, do you currently have a policy or two in place?")
              }
              className="noBlueFocus"
              style={{
                padding: "10px 12px",
                borderRadius: 16,
                border: `1px solid rgba(16,185,129,0.55)`,
                background: "#050607",
                color: C.text,
                cursor: "pointer",
                fontWeight: 850,
                boxShadow: `0 0 22px rgba(16,185,129,0.10)`,
              }}
            >
              Test suggestion
            </button>
          </div>
        </div>
      </div>
    </Shell>
  );
}

export default App;
