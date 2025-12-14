import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

function App() {
  // Views
  const [view, setView] = useState("home"); // home | live | record | roleplay

  // Shared mic devices
  const [devices, setDevices] = useState([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [permissionState, setPermissionState] = useState("unknown"); // unknown | granted | denied

  // Status light
  const [status, setStatus] = useState("Idle");

  // ===== LIVE COACH =====
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [sayThisNext, setSayThisNext] = useState(
    "Click START. Momentum AI triggers after the CLIENT finishes talking and there’s a short pause."
  );

  // speaker detection UI
  const [detectedSpeaker, setDetectedSpeaker] = useState("Unknown"); // Agent | Client | Unknown
  const [voiceSimilarity, setVoiceSimilarity] = useState(0);
  const [matchThreshold, setMatchThreshold] = useState(() => {
    const v = Number(localStorage.getItem("momentum_ai_voice_threshold") || "0.88");
    return Number.isFinite(v) ? v : 0.88;
  });

  // live audio refs
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  // VAD / silence detection gating
  const runningRef = useRef(false);
  const inSpeechRef = useRef(false);
  const heardSpeechSinceSuggestionRef = useRef(false);
  const lastSpeechMsRef = useRef(0);

  // Noise calibration
  const calibratingRef = useRef(false);
  const noiseFloorRef = useRef(0.02); // RMS baseline
  const talkThresholdRef = useRef(0.04);
  const silenceThresholdRef = useRef(0.03);

  // ---- Voiceprint Enrollment (local-only) ----
  const VOICEPRINT_KEY = "momentum_ai_voiceprints_v1"; // { [deviceId]: { vec:number[], createdAt, seconds } }
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSecondsLeft, setEnrollSecondsLeft] = useState(60);
  const enrollStopRef = useRef(null);

  // voice feature extraction refs
  const bandRangesRef = useRef(null); // [{start,end}, ...]
  const segmentSumRef = useRef(null); // number[]
  const segmentFramesRef = useRef(0);

  // enrollment accumulation refs
  const enrollSumRef = useRef(null);
  const enrollFramesRef = useRef(0);

  // ===== RECORDER =====
  const [isRecording, setIsRecording] = useState(false);
  const [recordingHint, setRecordingHint] = useState("Ready.");
  const [recordings, setRecordings] = useState([]); // {id,name,blobUrl,sizeKb,createdAt}
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

  // ===== ROLEPLAY =====
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

  const [rpDifficulty, setRpDifficulty] = useState(2); // 1 easy, 2 normal, 3 hard
  const [rpVoiceOn, setRpVoiceOn] = useState(true);

  const ALL_CATEGORIES = useMemo(
    () => ["Time", "Interest", "Spouse", "Existing", "Price", "Banking", "Social"],
    []
  );

  const [rpCats, setRpCats] = useState(() => {
    return Object.fromEntries(ALL_CATEGORIES.map((c) => [c, true]));
  });

  const [rpRunning, setRpRunning] = useState(false);
  const [rpClientLine, setRpClientLine] = useState("");
  const [rpAgentText, setRpAgentText] = useState("");
  const [rpFeedback, setRpFeedback] = useState(null);
  const [rpTurn, setRpTurn] = useState(0);

  // Add custom objection
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

  const allObjections = useMemo(() => {
    return [...DEFAULT_OBJECTIONS, ...customObjections];
  }, [DEFAULT_OBJECTIONS, customObjections]);

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

  // ---------- MIC / DEVICES ----------
  async function ensureMicPermission() {
    try {
      const s = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.getTracks().forEach((t) => t.stop());
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

    if (!selectedDeviceId && inputs[0]?.deviceId) setSelectedDeviceId(inputs[0].deviceId);
  }

  useEffect(() => {
    loadDevices();
    const handler = () => loadDevices();
    navigator.mediaDevices.addEventListener?.("devicechange", handler);
    return () => navigator.mediaDevices.removeEventListener?.("devicechange", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If user leaves Live screen, hard-stop live mic + enrollment
  useEffect(() => {
    if (view !== "live") {
      stopLiveHard();
      stopEnrollmentHard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  // ---------- voiceprint storage helpers ----------
  function loadVoiceprints() {
    try {
      return JSON.parse(localStorage.getItem(VOICEPRINT_KEY) || "{}");
    } catch {
      return {};
    }
  }

  function saveVoiceprints(obj) {
    localStorage.setItem(VOICEPRINT_KEY, JSON.stringify(obj));
  }

  function getEnrolledVec(deviceId) {
    if (!deviceId) return null;
    const m = loadVoiceprints();
    return m?.[deviceId]?.vec || null;
  }

  const isEnrolledForSelectedMic = useMemo(() => {
    const v = getEnrolledVec(selectedDeviceId);
    return Array.isArray(v) && v.length > 0;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDeviceId]);

  // ---------- voice features ----------
  function setupBandRanges(ctx, analyser) {
    const sampleRate = ctx.sampleRate;
    const nyquist = sampleRate / 2;
    const nBins = analyser.frequencyBinCount;

    // 20 log-spaced bands from ~120Hz to ~3800Hz
    const bands = 20;
    const fMin = 120;
    const fMax = Math.min(3800, nyquist - 10);

    const edges = [];
    for (let i = 0; i <= bands; i++) {
      const t = i / bands;
      const f = fMin * Math.pow(fMax / fMin, t);
      edges.push(f);
    }

    const ranges = [];
    for (let i = 0; i < bands; i++) {
      const a = edges[i];
      const b = edges[i + 1];
      const start = Math.max(0, Math.floor((a / nyquist) * nBins));
      const end = Math.min(nBins - 1, Math.ceil((b / nyquist) * nBins));
      ranges.push({ start, end: Math.max(start + 1, end) });
    }
    bandRangesRef.current = ranges;
  }

  function extractBandVector(floatFreqDb) {
    const ranges = bandRangesRef.current;
    if (!ranges) return null;

    const out = new Array(ranges.length).fill(0);

    for (let bi = 0; bi < ranges.length; bi++) {
      const { start, end } = ranges[bi];
      let sum = 0;
      let cnt = 0;

      for (let i = start; i <= end; i++) {
        const db = floatFreqDb[i];
        // convert dB -> linear magnitude (rough)
        const mag = Math.pow(10, db / 20);
        if (Number.isFinite(mag)) {
          sum += mag;
          cnt += 1;
        }
      }

      const avg = cnt ? sum / cnt : 0;
      // compress dynamic range
      out[bi] = Math.log(1 + avg);
    }

    // L2 normalize
    let norm = 0;
    for (let i = 0; i < out.length; i++) norm += out[i] * out[i];
    norm = Math.sqrt(norm) || 1;

    for (let i = 0; i < out.length; i++) out[i] = out[i] / norm;

    return out;
  }

  function cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let dot = 0;
    let na = 0;
    let nb = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      na += a[i] * a[i];
      nb += b[i] * b[i];
    }
    const denom = (Math.sqrt(na) * Math.sqrt(nb)) || 1;
    return dot / denom;
  }

  // ---------- LIVE COACH ----------
  function stopLiveHard() {
    runningRef.current = false;

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    analyserRef.current = null;

    if (audioCtxRef.current) {
      try {
        audioCtxRef.current.close?.();
      } catch {}
      audioCtxRef.current = null;
    }

    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((t) => t.stop());
      } catch {}
      streamRef.current = null;
    }

    calibratingRef.current = false;
    inSpeechRef.current = false;
    heardSpeechSinceSuggestionRef.current = false;

    segmentSumRef.current = null;
    segmentFramesRef.current = 0;

    setMicLevel(0);
    setIsListening(false);
    setDetectedSpeaker("Unknown");
    setVoiceSimilarity(0);
    if (status !== "Idle") setStatus("Idle");
  }

  function pickLiveSuggestion() {
    const lines = [
      "No worries — real quick, do you currently have a policy or two in place?",
      "Okay, is that through work or personal?",
      "Got it. If it’s okay, this’ll take about a minute so we can see if you can even get approved.",
      "Before we go further, about how much do you have set aside right now for final expenses?",
      "Fair enough — what monthly number would feel comfortable if we can get you approved?",
      "That makes sense. The only reason I’m asking is so we don’t waste your time — sound fair?",
    ];
    return lines[Math.floor(Math.random() * lines.length)];
  }

  async function startLive() {
    if (isListening) return;

    // REQUIRED enrollment gate
    if (!isEnrolledForSelectedMic) {
      setStatus("Enrollment required");
      setSayThisNext("Enroll your voice first (60 seconds) for this microphone.");
      return;
    }

    setStatus("Requesting microphone…");
    setSayThisNext("Listening… (triggers after CLIENT finishes talking + short pause)");
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

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioContext();
      audioCtxRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      analyserRef.current = analyser;
      src.connect(analyser);

      // build band ranges once
      setupBandRanges(ctx, analyser);

      streamRef.current = stream;

      // Reset gating state
      runningRef.current = true;
      inSpeechRef.current = false;
      heardSpeechSinceSuggestionRef.current = false;
      lastSpeechMsRef.current = Date.now();

      segmentSumRef.current = new Array(20).fill(0);
      segmentFramesRef.current = 0;

      // Calibrate noise floor for ~1.2s
      calibratingRef.current = true;
      const calStart = Date.now();
      let calSamples = 0;
      let calSum = 0;

      const timeData = new Uint8Array(analyser.fftSize);
      const freqDb = new Float32Array(analyser.frequencyBinCount);

      const enrolledVec = getEnrolledVec(selectedDeviceId);

      const tick = () => {
        if (!runningRef.current || !analyserRef.current) return;

        analyserRef.current.getByteTimeDomainData(timeData);

        // RMS
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);

        // UI meter
        const level = Math.max(0, Math.min(100, Math.round(rms * 200)));
        setMicLevel(level);

        const now = Date.now();

        // Calibration window
        if (calibratingRef.current) {
          calSum += rms;
          calSamples += 1;

          if (now - calStart >= 1200) {
            const avg = calSamples ? calSum / calSamples : 0.02;
            noiseFloorRef.current = Math.max(0.01, Math.min(0.06, avg));

            talkThresholdRef.current = Math.max(0.03, noiseFloorRef.current * 2.6);
            silenceThresholdRef.current = Math.max(0.02, noiseFloorRef.current * 1.7);

            calibratingRef.current = false;
          }

          rafRef.current = requestAnimationFrame(tick);
          return;
        }

        const TALK = talkThresholdRef.current;
        const SIL = silenceThresholdRef.current;

        if (rms >= TALK) {
          // in speech
          inSpeechRef.current = true;
          heardSpeechSinceSuggestionRef.current = true;
          lastSpeechMsRef.current = now;

          // collect spectral features during speech
          analyserRef.current.getFloatFrequencyData(freqDb);
          const vec = extractBandVector(freqDb);
          if (vec) {
            if (!segmentSumRef.current) segmentSumRef.current = new Array(vec.length).fill(0);
            for (let i = 0; i < vec.length; i++) segmentSumRef.current[i] += vec[i];
            segmentFramesRef.current += 1;
          }
        } else if (rms <= SIL) {
          const silentFor = now - lastSpeechMsRef.current;
          const SILENCE_MS = 850;

          // if speech ended -> decide speaker for that segment ONCE
          if (
            inSpeechRef.current &&
            heardSpeechSinceSuggestionRef.current &&
            silentFor >= SILENCE_MS
          ) {
            inSpeechRef.current = false;
            heardSpeechSinceSuggestionRef.current = false;

            // compute segment embedding
            let segVec = null;
            if (segmentSumRef.current && segmentFramesRef.current > 3) {
              segVec = segmentSumRef.current.map((x) => x / segmentFramesRef.current);

              // normalize
              let n = 0;
              for (let i = 0; i < segVec.length; i++) n += segVec[i] * segVec[i];
              n = Math.sqrt(n) || 1;
              segVec = segVec.map((x) => x / n);
            }

            // reset segment accumulation for next segment
            segmentSumRef.current = new Array(20).fill(0);
            segmentFramesRef.current = 0;

            // classify agent vs client using enrolled voiceprint
            let sim = 0;
            let speaker = "Unknown";

            if (segVec && enrolledVec) {
              sim = cosineSim(segVec, enrolledVec);
              speaker = sim >= matchThreshold ? "Agent" : "Client";
            }

            setVoiceSimilarity(sim);
            setDetectedSpeaker(speaker);

            // IMPORTANT: only fire “Say This Next” when CLIENT finishes talking
            if (speaker === "Client") {
              setSayThisNext(pickLiveSuggestion());
            }
          }
        }

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);

      setIsListening(true);
      setStatus("Listening");
    } catch {
      stopLiveHard();
      setStatus("Could not start microphone");
      setSayThisNext("Could not access that mic. Pick another mic from the dropdown.");
    }
  }

  function stopLive() {
    stopLiveHard();
    setSayThisNext("Stopped. Click START to listen again.");
  }

  // ---------- Enrollment (local-only, required per mic) ----------
  function stopEnrollmentHard() {
    if (enrollStopRef.current) {
      try { enrollStopRef.current(); } catch {}
      enrollStopRef.current = null;
    }
    setEnrolling(false);
    setEnrollSecondsLeft(60);
    enrollSumRef.current = null;
    enrollFramesRef.current = 0;
  }

  async function startEnrollment60s() {
    if (enrolling) return;

    setStatus("Enrollment: requesting mic…");
    setSayThisNext("Enrolling voice…");

    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) {
      setStatus("Mic permission denied");
      return;
    }

    setEnrolling(true);
    setEnrollSecondsLeft(60);
    setDetectedSpeaker("Unknown");
    setVoiceSimilarity(0);

    let stream = null;
    let ctx = null;
    let analyser = null;
    let raf = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : true,
      });

      const AudioContext = window.AudioContext || window.webkitAudioContext;
      ctx = new AudioContext();

      const src = ctx.createMediaStreamSource(stream);
      analyser = ctx.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.6;
      src.connect(analyser);

      setupBandRanges(ctx, analyser);

      // calibration
      calibratingRef.current = true;
      const calStart = Date.now();
      let calSamples = 0;
      let calSum = 0;

      const timeData = new Uint8Array(analyser.fftSize);
      const freqDb = new Float32Array(analyser.frequencyBinCount);

      // reset enrollment accumulators
      enrollSumRef.current = new Array(20).fill(0);
      enrollFramesRef.current = 0;

      const startMs = Date.now();
      const totalMs = 60_000;

      const tick = () => {
        analyser.getByteTimeDomainData(timeData);

        // RMS
        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const level = Math.max(0, Math.min(100, Math.round(rms * 200)));
        setMicLevel(level);

        const now = Date.now();

        // noise calibration first ~1.2s
        if (calibratingRef.current) {
          calSum += rms;
          calSamples += 1;

          if (now - calStart >= 1200) {
            const avg = calSamples ? calSum / calSamples : 0.02;
            noiseFloorRef.current = Math.max(0.01, Math.min(0.06, avg));

            talkThresholdRef.current = Math.max(0.03, noiseFloorRef.current * 2.6);
            silenceThresholdRef.current = Math.max(0.02, noiseFloorRef.current * 1.7);

            calibratingRef.current = false;
          }
        } else {
          // only collect frames when voice is above talk threshold
          if (rms >= talkThresholdRef.current) {
            analyser.getFloatFrequencyData(freqDb);
            const vec = extractBandVector(freqDb);
            if (vec) {
              for (let i = 0; i < vec.length; i++) enrollSumRef.current[i] += vec[i];
              enrollFramesRef.current += 1;
            }
          }
        }

        const elapsed = now - startMs;
        const left = Math.max(0, Math.ceil((totalMs - elapsed) / 1000));
        setEnrollSecondsLeft(left);

        if (elapsed >= totalMs) {
          finalize();
          return;
        }

        raf = requestAnimationFrame(tick);
      };

      const finalize = () => {
        // stop capture
        if (raf) cancelAnimationFrame(raf);

        try { stream?.getTracks()?.forEach((t) => t.stop()); } catch {}
        try { ctx?.close?.(); } catch {}

        // build final voiceprint
        let vec = null;
        if (enrollSumRef.current && enrollFramesRef.current > 15) {
          vec = enrollSumRef.current.map((x) => x / enrollFramesRef.current);

          // normalize
          let n = 0;
          for (let i = 0; i < vec.length; i++) n += vec[i] * vec[i];
          n = Math.sqrt(n) || 1;
          vec = vec.map((x) => x / n);
        }

        setEnrolling(false);
        setEnrollSecondsLeft(60);
        setMicLevel(0);

        if (!vec) {
          setStatus("Enrollment failed");
          setSayThisNext("Not enough clear speech captured. Try again and read the script louder.");
          return;
        }

        const all = loadVoiceprints();
        all[selectedDeviceId] = {
          vec,
          createdAt: new Date().toISOString(),
          seconds: 60,
        };
        saveVoiceprints(all);

        setStatus("Enrolled");
        setSayThisNext("Enrollment saved for this microphone. You can now START Live Coach.");
      };

      enrollStopRef.current = () => {
        if (raf) cancelAnimationFrame(raf);
        try { stream?.getTracks()?.forEach((t) => t.stop()); } catch {}
        try { ctx?.close?.(); } catch {}
        setEnrolling(false);
        setEnrollSecondsLeft(60);
        setMicLevel(0);
        setStatus("Idle");
      };

      raf = requestAnimationFrame(tick);
    } catch {
      stopEnrollmentHard();
      setStatus("Could not start enrollment mic");
      setSayThisNext("Could not access that mic. Pick another mic and try again.");
    }
  }

  function clearEnrollmentForMic() {
    const all = loadVoiceprints();
    if (selectedDeviceId && all[selectedDeviceId]) {
      delete all[selectedDeviceId];
      saveVoiceprints(all);
    }
    setStatus("Idle");
    setSayThisNext("Enrollment cleared. Please enroll again (required).");
  }

  // ---------- RECORDER ----------
  async function startRecording() {
    if (isRecording) return;

    setStatus("Recording");
    setRecordingHint("Requesting microphone…");

    const ok = permissionState === "granted" ? true : await ensureMicPermission();
    if (!ok) {
      setRecordingHint("Mic permission denied.");
      setStatus("Idle");
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

        setRecordingHint("Saved below. Click Download to save locally.");
        setStatus("Idle");
      };

      mr.start();
      setIsRecording(true);
      setRecordingHint("Recording…");
    } catch {
      setRecordingHint("Could not start recording. Try another mic.");
      setStatus("Idle");
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

  // ---------- ROLEPLAY ----------
  function speak(text) {
    if (!rpVoiceOn) return;
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1.0;
      u.pitch = 1.0;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch {}
  }

  function filteredObjections() {
    const allowedCats = new Set(
      Object.entries(rpCats)
        .filter(([, on]) => on)
        .map(([k]) => k)
    );

    return allObjections.filter(
      (o) => allowedCats.has(o.category) && o.difficulty <= rpDifficulty
    );
  }

  function startRoleplay() {
    setRpRunning(true);
    setRpTurn(0);
    setRpFeedback(null);
    setRpAgentText("");

    const opening = "Hi — is this you? I’m just calling you back about the form you filled out.";
    setRpClientLine(opening);
    speak(opening);

    const pool = filteredObjections();
    if (pool.length === 0) return;
  }

  function endRoleplay(hangupText) {
    setRpRunning(false);
    setRpFeedback({ hangup: true, note: hangupText, score: 0, best: "" });
    speak(hangupText);
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

  function submitRoleplay() {
    if (!rpRunning) return;

    const user = rpAgentText.trim();
    if (!user) return;

    const next = nextClientLineFromPool();
    const score = scoreResponse(user, next.best);

    const hangupChance =
      rpDifficulty === 1 ? 0.05 : rpDifficulty === 2 ? 0.12 : 0.22;

    const tooWeak = score < (rpDifficulty === 3 ? 35 : 25);
    const rng = Math.random();

    if (tooWeak && rng < hangupChance) {
      endRoleplay("Alright man — I’m not doing all that. I’ll call back later.");
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

  // ---------- UI HELPERS ----------
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
        <div style={{ maxWidth: 420, margin: "0 auto" }}>
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
                  background: isListening || isRecording || enrolling ? C.emerald : "rgba(255,255,255,0.20)",
                  boxShadow: isListening || isRecording || enrolling ? `0 0 18px ${C.emeraldGlow}` : "none",
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

  // ---------- HOME ----------
  if (view === "home") {
    const cards = [
      {
        title: "Live Coach",
        desc: "Requires 60s voice enrollment per mic. Detects Agent vs Client locally.",
        onClick: () => setView("live"),
      },
      {
        title: "Recorder",
        desc: "Records mic audio. Stop → Download the file for review.",
        onClick: () => setView("record"),
      },
      {
        title: "Roleplay Trainer",
        desc: "Start roleplay. Pick difficulty + categories (Banking/Social included).",
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

        <div className="howItWorks">
          <div className="howTitle">How it works</div>
          <ol className="howList">
            <li>Select your microphone.</li>
            <li>Live Coach requires a 60-second voice enrollment (local-only) for that mic.</li>
            <li>Momentum AI detects Agent vs Client by matching your voiceprint.</li>
            <li>Suggestions trigger only after the CLIENT finishes talking + a short pause.</li>
          </ol>
          <div className="howNote">
            Note: This is a lightweight local voice “fingerprint,” not bank-grade biometric security.
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- LIVE ----------
  if (view === "live") {
    const enrolledVec = getEnrolledVec(selectedDeviceId);

    return (
      <Shell>
        {BackBar("Live Coach")}

        <div className="panel">
          <MicBlock />

          {/* REQUIRED Enrollment Gate */}
          {!isEnrolledForSelectedMic ? (
            <div style={{ marginTop: 8 }}>
              <div className="panelTitle">Voice Enrollment Required</div>

              <div className="smallMuted" style={{ marginTop: 0 }}>
                This is per mic device. You’ll read the script out loud for 60 seconds so Momentum AI can detect
                when it’s YOU talking vs the client (local-only).
              </div>

              <div className="sayBox" style={{ marginTop: 10 }}>
                Read this naturally for 60 seconds:
                {"\n\n"}
                “Hi, this is Momentum Financial. I’m calling you back about the life insurance request you sent in.
                I’m going to ask a few quick questions and see what you can qualify for. This will only take a minute.
                If you’re driving or busy, tell me a better time and I’ll call back.”
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                  Mic level {calibratingRef.current ? "(calibrating…)" : ""}
                </div>
                <div className="meter">
                  <div className="meterFill" style={{ width: `${micLevel}%` }} />
                </div>

                {enrolling && (
                  <div className="smallMuted" style={{ marginTop: 8 }}>
                    Enrolling… <span style={{ color: C.emerald, fontWeight: 950 }}>{enrollSecondsLeft}s</span> left
                  </div>
                )}
              </div>

              <div className="row2" style={{ marginTop: 12 }}>
                <button className="btnOutline" disabled={enrolling || !selectedDeviceId} onClick={startEnrollment60s}>
                  START 60s ENROLLMENT
                </button>
                <button className="btnOutlineDim" disabled={!enrolling} onClick={stopEnrollmentHard}>
                  STOP
                </button>
              </div>

              <div className="smallMuted">
                After enrollment, Live Coach will unlock automatically for this mic.
              </div>
            </div>
          ) : (
            <>
              {/* Live controls */}
              <div className="row2">
                <button className="btnOutline" disabled={isListening || enrolling} onClick={startLive}>
                  START
                </button>
                <button className="btnOutlineDim" disabled={!isListening} onClick={stopLive}>
                  STOP
                </button>
              </div>

              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                  Mic level {calibratingRef.current ? "(calibrating…)" : ""}
                </div>
                <div className="meter">
                  <div className="meterFill" style={{ width: `${micLevel}%` }} />
                </div>

                <div className="smallMuted" style={{ marginTop: 8 }}>
                  Detected:{" "}
                  <span style={{ color: C.emerald, fontWeight: 950 }}>{detectedSpeaker}</span>
                  {"  "}• similarity{" "}
                  <span style={{ color: C.emerald, fontWeight: 950 }}>
                    {voiceSimilarity.toFixed(3)}
                  </span>
                </div>

                <div className="smallMuted" style={{ marginTop: 6 }}>
                  Threshold:{" "}
                  <input
                    type="range"
                    min="0.70"
                    max="0.97"
                    step="0.01"
                    value={matchThreshold}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      setMatchThreshold(v);
                      localStorage.setItem("momentum_ai_voice_threshold", String(v));
                    }}
                    style={{ width: "100%" }}
                  />
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span>More “Agent”</span>
                    <span>More “Client”</span>
                  </div>
                </div>

                <div className="smallMuted" style={{ marginTop: 6 }}>
                  (Local-only) Enrollment saved for this mic.{" "}
                  <button className="btn" style={{ marginLeft: 8 }} onClick={clearEnrollmentForMic}>
                    Re-enroll
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Say box */}
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">SAY THIS NEXT</div>
          <div className="sayBox">{sayThisNext}</div>
          <div className="smallMuted">
            This now triggers only after the <b>CLIENT</b> finishes talking (based on your enrolled voiceprint).
          </div>
        </div>
      </Shell>
    );
  }

  // ---------- RECORDER ----------
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

  // ---------- ROLEPLAY ----------
  if (view === "roleplay") {
    return (
      <Shell>
        {BackBar("Roleplay Trainer")}

        <div className="panel">
          <div className="panelTitle">Setup</div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <div className="smallMuted" style={{ marginTop: 0 }}>
                Difficulty
              </div>
              <select
                className="field"
                value={rpDifficulty}
                onChange={(e) => setRpDifficulty(Number(e.target.value))}
              >
                <option value={1}>Easy</option>
                <option value={2}>Normal</option>
                <option value={3}>Hard</option>
              </select>
            </div>

            <div>
              <div className="smallMuted" style={{ marginTop: 0 }}>
                Client voice
              </div>
              <select
                className="field"
                value={rpVoiceOn ? "on" : "off"}
                onChange={(e) => setRpVoiceOn(e.target.value === "on")}
              >
                <option value="on">Voice ON</option>
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
                <button
                  key={cat}
                  className={rpCats[cat] ? "chipOn" : "chipOff"}
                  onClick={() => setRpCats((p) => ({ ...p, [cat]: !p[cat] }))}
                >
                  {cat}
                </button>
              ))}
            </div>
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
                  setRpRunning(false);
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
            <div className="panelTitle">Client says</div>
            <div className="sayBox">{rpClientLine}</div>

            <div style={{ marginTop: 12 }}>
              <div className="smallMuted" style={{ marginTop: 0 }}>
                Your response (type it — we’ll add speech-to-text later if you want)
              </div>
              <textarea
                className="field"
                style={{ minHeight: 110, resize: "none" }}
                value={rpAgentText}
                onChange={(e) => setRpAgentText(e.target.value)}
                placeholder="Type what you would say…"
              />
            </div>

            <div className="row2" style={{ marginTop: 10 }}>
              <button className="btnOutline" onClick={submitRoleplay} disabled={!rpAgentText.trim()}>
                SUBMIT
              </button>
              <button
                className="btnOutlineDim"
                onClick={() => {
                  const next = nextClientLineFromPool();
                  setRpClientLine(next.client);
                  speak(next.client);
                  setRpFeedback(null);
                }}
              >
                SKIP / NEXT
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
                      Score: <span style={{ color: C.emerald, fontWeight: 950 }}>{rpFeedback.score}/100</span>{" "}
                      • {rpFeedback.note} • Turn {rpTurn}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* Add custom objections */}
        <div className="panel" style={{ marginTop: 12 }}>
          <div className="panelTitle">Add custom objection</div>

          <div className="smallMuted" style={{ marginTop: 0 }}>
            Add as many variations as you want.
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Client says
            </div>
            <input
              className="field"
              value={customClient}
              onChange={(e) => setCustomClient(e.target.value)}
              placeholder="Example: I don’t want to give my banking info…"
            />
          </div>

          <div style={{ marginTop: 10 }}>
            <div className="smallMuted" style={{ marginTop: 0 }}>
              Best response
            </div>
            <input
              className="field"
              value={customBest}
              onChange={(e) => setCustomBest(e.target.value)}
              placeholder="Example: I understand — we don’t draft anything today…"
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 10 }}>
            <select className="field" value={customCat} onChange={(e) => setCustomCat(e.target.value)}>
              {ALL_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              className="field"
              value={customDiff}
              onChange={(e) => setCustomDiff(Number(e.target.value))}
            >
              <option value={1}>Easy</option>
              <option value={2}>Normal</option>
              <option value={3}>Hard</option>
            </select>
          </div>

          <button className="btn" style={{ marginTop: 10, width: "100%" }} onClick={addCustomObjection}>
            Add objection
          </button>

          <div className="smallMuted">
            Custom objections saved:{" "}
            <span style={{ color: C.emerald, fontWeight: 900 }}>{customObjections.length}</span>
          </div>
        </div>
      </Shell>
    );
  }

  return null;
}

export default App;
