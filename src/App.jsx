import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css"; // you can keep this import; we override styling inline

function App() {
  const [status, setStatus] = useState("Idle");
  const [isRunning, setIsRunning] = useState(false);

  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");

  const [permissionState, setPermissionState] = useState("unknown"); // unknown | granted | denied
  const [micLevel, setMicLevel] = useState(0); // 0..100

  const [sayThisNext, setSayThisNext] = useState(
    "Click START to begin listening. Momentum AI will show your next line here."
  );

  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  const emerald = "#10B981"; // emerald-ish
  const bg = "#0B0F14";
  const panel = "#111827";
  const panel2 = "#0F172A";
  const text = "#E5E7EB";
  const muted = "#9CA3AF";

  const canStart = useMemo(() => {
    return !isRunning;
  }, [isRunning]);

  async function ensureMicPermission() {
    try {
      const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      testStream.getTracks().forEach((t) => t.stop());
      setPermissionState("granted");
      return true;
    } catch (e) {
      setPermissionState("denied");
      return false;
    }
  }

  async function loadDevices() {
    // Important: device labels are often empty until mic permission is granted
    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) {
      setSayThisNext("Microphone permission was denied. Allow mic access to use Momentum AI.");
      return;
    }

    const all = await navigator.mediaDevices.enumerateDevices();
    const inputs = all.filter((d) => d.kind === "audioinput");

    setDevices(inputs);

    // Auto-select default device if none selected
    if (!selectedDeviceId && inputs[0]?.deviceId) {
      setSelectedDeviceId(inputs[0].deviceId);
    }
  }

  useEffect(() => {
    loadDevices();
    // Keep device list fresh if devices change (plug/unplug)
    const handler = () => loadDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function startMeter(stream) {
    // WebAudio mic level meter
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

      // Calculate RMS
      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        sum += v * v;
      }
      const rms = Math.sqrt(sum / data.length);

      // Convert to 0..100 scale (tuned for UI)
      const level = Math.max(0, Math.min(100, Math.round(rms * 200)));
      setMicLevel(level);

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }

  async function start() {
    if (isRunning) return;

    setStatus("Requesting microphone…");
    setSayThisNext("Listening… (Suggestion engine will go here next)");
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
    } catch (e) {
      setStatus("Could not start microphone");
      setSayThisNext("Could not access selected microphone. Try another mic from the dropdown.");
    }
  }

  function stop() {
    if (!isRunning) return;

    setStatus("Stopping…");

    // Stop meter
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    analyserRef.current = null;

    // Close audio context
    if (audioCtxRef.current) {
      audioCtxRef.current.close?.();
      audioCtxRef.current = null;
    }

    // Stop mic stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    setIsRunning(false);
    setMicLevel(0);
    setStatus("Idle");
    setSayThisNext("Stopped. Click START to listen again.");
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: `radial-gradient(1200px 700px at 20% 10%, rgba(16,185,129,0.18), transparent 60%),
                     radial-gradient(900px 600px at 85% 25%, rgba(16,185,129,0.10), transparent 55%),
                     ${bg}`,
        color: text,
        padding: 20,
        boxSizing: "border-box",
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, "Helvetica Neue", Arial, "Noto Sans", "Apple Color Emoji", "Segoe UI Emoji"',
      }}
    >
      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
          <div>
            <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: 0.2 }}>
              Momentum <span style={{ color: emerald }}>AI</span>
            </div>
            <div style={{ color: muted, marginTop: 4, fontSize: 13 }}>
              Live call coach • Mic-only capture • Instant “Say this next”
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 14,
              background: `linear-gradient(180deg, ${panel}, ${panel2})`,
              border: `1px solid rgba(16,185,129,0.25)`,
            }}
          >
            <div style={{ fontSize: 12, color: muted }}>Status</div>
            <div style={{ fontSize: 12, fontWeight: 700 }}>{status}</div>
            <div
              style={{
                width: 10,
                height: 10,
                borderRadius: 99,
                background: isRunning ? emerald : "#374151",
                boxShadow: isRunning ? `0 0 18px rgba(16,185,129,0.55)` : "none",
              }}
            />
          </div>
        </div>

        {/* Main grid */}
        <div style={{ display: "grid", gridTemplateColumns: "360px 1fr", gap: 16, marginTop: 18 }}>
          {/* Left panel */}
          <div
            style={{
              background: `linear-gradient(180deg, ${panel}, ${panel2})`,
              border: `1px solid rgba(255,255,255,0.06)`,
              borderRadius: 18,
              padding: 14,
            }}
          >
            <div style={{ fontWeight: 800, fontSize: 14, marginBottom: 10 }}>Controls</div>

            {/* Mic dropdown */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>Microphone</div>
              <div style={{ display: "flex", gap: 8 }}>
                <select
                  value={selectedDeviceId}
                  onChange={(e) => setSelectedDeviceId(e.target.value)}
                  style={{
                    flex: 1,
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "#0B1220",
                    color: text,
                    outline: "none",
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
                  style={{
                    padding: "10px 10px",
                    borderRadius: 12,
                    border: "1px solid rgba(255,255,255,0.10)",
                    background: "#0B1220",
                    color: text,
                    cursor: "pointer",
                  }}
                >
                  Refresh
                </button>
              </div>
              {permissionState === "denied" && (
                <div style={{ marginTop: 8, color: "#FCA5A5", fontSize: 12 }}>
                  Mic permission denied. Allow microphone access in OS settings.
                </div>
              )}
            </div>

            {/* Start/Stop */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 6 }}>
              <button
                disabled={!canStart}
                onClick={start}
                style={{
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(16,185,129,0.55)",
                  background: canStart ? `linear-gradient(180deg, rgba(16,185,129,0.22), rgba(16,185,129,0.06))` : "#0B1220",
                  color: canStart ? text : muted,
                  fontWeight: 800,
                  cursor: canStart ? "pointer" : "not-allowed",
                }}
              >
                START
              </button>

              <button
                disabled={!isRunning}
                onClick={stop}
                style={{
                  padding: "12px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: isRunning ? "rgba(255,255,255,0.06)" : "#0B1220",
                  color: isRunning ? text : muted,
                  fontWeight: 800,
                  cursor: isRunning ? "pointer" : "not-allowed",
                }}
              >
                STOP
              </button>
            </div>

            {/* Mic meter */}
            <div style={{ marginTop: 14 }}>
              <div style={{ fontSize: 12, color: muted, marginBottom: 6 }}>Mic level</div>
              <div
                style={{
                  height: 10,
                  borderRadius: 999,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.10)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${micLevel}%`,
                    height: "100%",
                    background: emerald,
                    boxShadow: `0 0 12px rgba(16,185,129,0.5)`,
                    transition: "width 60ms linear",
                  }}
                />
              </div>
              <div style={{ marginTop: 6, fontSize: 12, color: muted }}>{micLevel}%</div>
            </div>

            {/* Note */}
            <div
              style={{
                marginTop: 14,
                padding: 12,
                borderRadius: 14,
                border: "1px solid rgba(16,185,129,0.18)",
                background: "rgba(16,185,129,0.06)",
                color: muted,
                fontSize: 12,
                lineHeight: 1.4,
              }}
            >
              Momentum AI only listens to your selected microphone.
              <br />
              Next step: recording + pause-triggered suggestions.
            </div>
          </div>

          {/* Right panel */}
          <div
            style={{
              background: `linear-gradient(180deg, ${panel}, ${panel2})`,
              border: `1px solid rgba(255,255,255,0.06)`,
              borderRadius: 18,
              padding: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div style={{ fontWeight: 900, fontSize: 16 }}>SAY THIS NEXT</div>
              <div style={{ fontSize: 12, color: muted }}>
                (Hidden transcript later • only shows your line)
              </div>
            </div>

            <div
              style={{
                marginTop: 12,
                borderRadius: 18,
                border: `1px solid rgba(16,185,129,0.25)`,
                background: "rgba(0,0,0,0.25)",
                padding: 16,
                minHeight: 220,
                boxShadow: "0 12px 40px rgba(0,0,0,0.35)",
              }}
            >
              <div style={{ fontSize: 20, fontWeight: 800, lineHeight: 1.25, whiteSpace: "pre-wrap" }}>
                {sayThisNext}
              </div>

              <div style={{ marginTop: 14, color: muted, fontSize: 12, lineHeight: 1.4 }}>
                When the client stops talking, Momentum AI will update this immediately.
                <br />
                We’ll wire in the “Logan brain” and pause-trigger detection next.
              </div>
            </div>

            {/* Small dev buttons (safe to remove later) */}
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button
                onClick={() =>
                  setSayThisNext(
                    "No worries — real quick, do you currently have a policy or two in place?"
                  )
                }
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: text,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Test suggestion
              </button>

              <button
                onClick={() => setSayThisNext("Listening… (Suggestion engine will go here next)")}
                style={{
                  padding: "10px 12px",
                  borderRadius: 14,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "rgba(255,255,255,0.06)",
                  color: text,
                  cursor: "pointer",
                  fontWeight: 700,
                }}
              >
                Reset text
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ marginTop: 14, color: muted, fontSize: 12 }}>
          Momentum AI • v0.1 • Windows + macOS builds via GitHub Actions
        </div>
      </div>
    </div>
  );
}

export default App;
