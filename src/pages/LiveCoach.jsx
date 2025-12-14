// src/pages/LiveCoach.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { C } from "../theme";
import BackBar from "../components/BackBar";
import MicBlock from "../components/MicBlock";

export default function LiveCoach({
  setView,
  setStatus,
  permissionState,
  ensureMicPermission,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  loadDevices,
}) {
  // ===== LIVE COACH =====
  const [isListening, setIsListening] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [sayThisNext, setSayThisNext] = useState(
    "Click START. Momentum AI triggers after the CLIENT finishes talking and there’s a short pause."
  );

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
  const noiseFloorRef = useRef(0.02);
  const talkThresholdRef = useRef(0.04);
  const silenceThresholdRef = useRef(0.03);

  // ---- Voiceprint Enrollment (local-only) ----
  const VOICEPRINT_KEY = "momentum_ai_voiceprints_v1";
  const [enrolling, setEnrolling] = useState(false);
  const [enrollSecondsLeft, setEnrollSecondsLeft] = useState(60);
  const enrollStopRef = useRef(null);

  // voice feature extraction refs
  const bandRangesRef = useRef(null);
  const segmentSumRef = useRef(null);
  const segmentFramesRef = useRef(0);

  // enrollment accumulation refs
  const enrollSumRef = useRef(null);
  const enrollFramesRef = useRef(0);

  // ===== Guided Enrollment Script + Word Highlight =====
  const ENROLL_LINES = useMemo(
    () => [
      "Hi, this is Momentum Financial calling you back about your request.",
      "I’m going to ask a few quick questions to see what you qualify for.",
      "This will only take about a minute, and I’ll keep it simple.",
      "Do you currently have any life insurance in place today?",
      "Is that through work, or something you got personally?",
      "About how much coverage are you wanting to get in place?",
      "Who would you want listed as the beneficiary?",
      "Do you use tobacco or nicotine products at all?",
      "What state are you in, and what’s your date of birth?",
      "Perfect. If you’re good with it, I’ll go ahead and check options now.",
    ],
    []
  );

  const [enrollLineIndex, setEnrollLineIndex] = useState(0);
  const [enrollTranscript, setEnrollTranscript] = useState("");
  const [enrollCompletedCount, setEnrollCompletedCount] = useState(0);
  const [enrollCompleted, setEnrollCompleted] = useState(() => new Array(10).fill(false));
  const enrollSRRef = useRef(null);
  const enrollingRef = useRef(false);

  // ✅ FIX: keep current line index in a ref so SpeechRecognition never reads stale state
  const enrollLineIndexRef = useRef(0);
  useEffect(() => {
    enrollLineIndexRef.current = enrollLineIndex;
  }, [enrollLineIndex]);

  // ✅ FIX: prevent double-advance spam
  const lastAdvanceMsRef = useRef(0);

  // ✅ FIX: normalize both ’ and ' the same (remove apostrophes entirely)
  function normalizeWords(s) {
    return String(s || "")
      .toLowerCase()
      // normalize curly apostrophes/quotes to straight, then remove apostrophes
      .replace(/[’‘]/g, "'")
      .replace(/'/g, "")
      // strip everything except letters/numbers/spaces
      .replace(/[^a-z0-9\s]/g, "")
      .split(/\s+/)
      .filter(Boolean);
  }

  function computeMatch(expectedLine, spoken) {
    const e = normalizeWords(expectedLine);
    const s = normalizeWords(spoken);

    if (!e.length) return { ratio: 0, matchedWordIndexes: [] };
    if (!s.length) return { ratio: 0, matchedWordIndexes: [] };

    let si = 0;
    const matched = [];

    for (let ei = 0; ei < e.length; ei++) {
      const target = e[ei];
      while (si < s.length && s[si] !== target) si++;
      if (si < s.length && s[si] === target) {
        matched.push(ei);
        si++;
      }
    }

    const ratio = matched.length / e.length;
    return { ratio, matchedWordIndexes: matched };
  }

  function renderHighlightedLine(line, spoken) {
    const words = String(line || "").split(/\s+/);
    const { matchedWordIndexes } = computeMatch(line, spoken);

    const matchedSet = new Set(matchedWordIndexes);
    return (
      <div style={{ lineHeight: 1.35, fontSize: 14, fontWeight: 800 }}>
        {words.map((w, i) => (
          <span
            key={`${w}-${i}`}
            style={{
              color: matchedSet.has(i) ? C.emerald : "rgba(237,239,242,0.92)",
              textShadow: matchedSet.has(i) ? `0 0 14px ${C.emeraldGlow}` : "none",
              transition: "color 120ms ease",
            }}
          >
            {w}
            {i < words.length - 1 ? " " : ""}
          </span>
        ))}
      </div>
    );
  }

  function stopEnrollSpeechRec() {
    try {
      const sr = enrollSRRef.current;
      if (!sr) return;
      sr.onresult = null;
      sr.onerror = null;
      sr.onend = null;
      sr.stop?.();
    } catch {}
    enrollSRRef.current = null;
  }

  function startEnrollSpeechRec() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return false;

    // always start clean
    stopEnrollSpeechRec();

    try {
      const sr = new SR();
      sr.continuous = true;
      sr.interimResults = true;
      sr.lang = "en-US";

      sr.onresult = (e) => {
        // Build transcript text (ok to be "full", match is subsequence-based)
        let full = "";
        for (let i = 0; i < e.results.length; i++) {
          full += e.results[i][0]?.transcript ? e.results[i][0].transcript + " " : "";
        }
        full = full.trim();
        setEnrollTranscript(full);

        const idx = enrollLineIndexRef.current;
        const currentLine = ENROLL_LINES[idx] || "";
        const { ratio } = computeMatch(currentLine, full);

        const DONE_AT = 0.82;

        // ✅ debounce advance
        const now = Date.now();
        if (ratio >= DONE_AT && now - lastAdvanceMsRef.current > 700) {
          lastAdvanceMsRef.current = now;

          setEnrollCompleted((prev) => {
            const next = [...prev];
            if (!next[idx]) next[idx] = true;
            return next;
          });

          // advance line + update ref in the setter (no stale)
          setEnrollLineIndex((prevIdx) => {
            const nextIdx = prevIdx + 1 >= ENROLL_LINES.length ? 0 : prevIdx + 1;
            enrollLineIndexRef.current = nextIdx;
            return nextIdx;
          });

          setEnrollTranscript("");

          // ✅ FIX: restart recognition cleanly so results reset & it keeps listening
          stopEnrollSpeechRec();
          setTimeout(() => {
            if (enrollingRef.current) startEnrollSpeechRec();
          }, 180);
        }
      };

      sr.onerror = () => {};
      sr.onend = () => {
        // keep it running during enrollment
        if (enrollingRef.current) {
          setTimeout(() => {
            if (enrollingRef.current) {
              try {
                sr.start?.();
              } catch {}
            }
          }, 120);
        }
      };

      sr.start();
      enrollSRRef.current = sr;
      return true;
    } catch {
      return false;
    }
  }

  useEffect(() => {
    const count = enrollCompleted.filter(Boolean).length;
    setEnrollCompletedCount(count);
  }, [enrollCompleted]);

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
        const mag = Math.pow(10, db / 20);
        if (Number.isFinite(mag)) {
          sum += mag;
          cnt += 1;
        }
      }

      const avg = cnt ? sum / cnt : 0;
      out[bi] = Math.log(1 + avg);
    }

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
    const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
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
    setStatus("Idle");
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

      setupBandRanges(ctx, analyser);

      streamRef.current = stream;

      runningRef.current = true;
      inSpeechRef.current = false;
      heardSpeechSinceSuggestionRef.current = false;
      lastSpeechMsRef.current = Date.now();

      segmentSumRef.current = new Array(20).fill(0);
      segmentFramesRef.current = 0;

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

        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);

        const level = Math.max(0, Math.min(100, Math.round(rms * 200)));
        setMicLevel(level);

        const now = Date.now();

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
          inSpeechRef.current = true;
          heardSpeechSinceSuggestionRef.current = true;
          lastSpeechMsRef.current = now;

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

          if (inSpeechRef.current && heardSpeechSinceSuggestionRef.current && silentFor >= SILENCE_MS) {
            inSpeechRef.current = false;
            heardSpeechSinceSuggestionRef.current = false;

            let segVec = null;
            if (segmentSumRef.current && segmentFramesRef.current > 3) {
              segVec = segmentSumRef.current.map((x) => x / segmentFramesRef.current);

              let n = 0;
              for (let i = 0; i < segVec.length; i++) n += segVec[i] * segVec[i];
              n = Math.sqrt(n) || 1;
              segVec = segVec.map((x) => x / n);
            }

            segmentSumRef.current = new Array(20).fill(0);
            segmentFramesRef.current = 0;

            let sim = 0;
            let speaker = "Unknown";

            if (segVec && enrolledVec) {
              sim = cosineSim(segVec, enrolledVec);
              speaker = sim >= matchThreshold ? "Agent" : "Client";
            }

            setVoiceSimilarity(sim);
            setDetectedSpeaker(speaker);

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

  // ---------- Enrollment ----------
  function stopEnrollmentHard() {
    enrollingRef.current = false;
    stopEnrollSpeechRec();

    if (enrollStopRef.current) {
      try {
        enrollStopRef.current();
      } catch {}
      enrollStopRef.current = null;
    }

    setEnrolling(false);
    setEnrollSecondsLeft(60);
    enrollSumRef.current = null;
    enrollFramesRef.current = 0;

    setEnrollLineIndex(0);
    setEnrollTranscript("");
    setEnrollCompleted(new Array(10).fill(false));
    setEnrollCompletedCount(0);
    setStatus("Idle");
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
    enrollingRef.current = true;

    setEnrollSecondsLeft(60);
    setDetectedSpeaker("Unknown");
    setVoiceSimilarity(0);

    setEnrollLineIndex(0);
    enrollLineIndexRef.current = 0;
    lastAdvanceMsRef.current = 0;

    setEnrollTranscript("");
    setEnrollCompleted(new Array(10).fill(false));
    setEnrollCompletedCount(0);

    startEnrollSpeechRec();

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

      calibratingRef.current = true;
      const calStart = Date.now();
      let calSamples = 0;
      let calSum = 0;

      const timeData = new Uint8Array(analyser.fftSize);
      const freqDb = new Float32Array(analyser.frequencyBinCount);

      enrollSumRef.current = new Array(20).fill(0);
      enrollFramesRef.current = 0;

      const startMs = Date.now();
      const totalMs = 60_000;

      const tick = () => {
        analyser.getByteTimeDomainData(timeData);

        let sum = 0;
        for (let i = 0; i < timeData.length; i++) {
          const v = (timeData[i] - 128) / 128;
          sum += v * v;
        }
        const rms = Math.sqrt(sum / timeData.length);
        const level = Math.max(0, Math.min(100, Math.round(rms * 200)));
        setMicLevel(level);

        const now = Date.now();

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
        if (raf) cancelAnimationFrame(raf);

        try {
          stream?.getTracks()?.forEach((t) => t.stop());
        } catch {}
        try {
          ctx?.close?.();
        } catch {}

        enrollingRef.current = false;
        stopEnrollSpeechRec();

        let vec = null;
        if (enrollSumRef.current && enrollFramesRef.current > 15) {
          vec = enrollSumRef.current.map((x) => x / enrollFramesRef.current);

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
          setSayThisNext("Not enough clear speech captured. Try again and read the lines louder.");
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
        try {
          stream?.getTracks()?.forEach((t) => t.stop());
        } catch {}
        try {
          ctx?.close?.();
        } catch {}

        enrollingRef.current = false;
        stopEnrollSpeechRec();

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

  // cleanup on unmount
  useEffect(() => {
    return () => {
      stopLiveHard();
      stopEnrollmentHard();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <BackBar title="Live Coach" onBack={() => setView("home")} />

      <div className="panel">
        <MicBlock
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          loadDevices={loadDevices}
          permissionState={permissionState}
        />

        {!isEnrolledForSelectedMic ? (
          <div style={{ marginTop: 8 }}>
            <div className="panelTitle">Voice Enrollment Required</div>

            <div className="smallMuted" style={{ marginTop: 0 }}>
              Read each line out loud. It highlights as you speak and auto-advances. If you finish all 10 lines
              before 60 seconds, it loops back so you can keep talking.
            </div>

            <div className="sayBox" style={{ marginTop: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10 }}>
                <div style={{ fontWeight: 950 }}>
                  Line {enrollLineIndex + 1}/10{" "}
                  <span style={{ color: C.emerald }}>• {enrollCompletedCount}/10 complete</span>
                </div>
                <div style={{ fontWeight: 900, color: "rgba(237,239,242,0.75)" }}>
                  {enrolling ? (
                    <>
                      <span style={{ color: C.emerald }}>{enrollSecondsLeft}s</span> left
                    </>
                  ) : (
                    "Ready"
                  )}
                </div>
              </div>

              <div style={{ marginTop: 10 }}>
                {renderHighlightedLine(ENROLL_LINES[enrollLineIndex], enrollTranscript)}
              </div>

              <div style={{ marginTop: 10, fontSize: 12, color: "rgba(237,239,242,0.70)" }}>
                {(() => {
                  const { ratio } = computeMatch(ENROLL_LINES[enrollLineIndex], enrollTranscript);
                  const pct = Math.round(ratio * 100);
                  return (
                    <>
                      Match: <span style={{ color: C.emerald, fontWeight: 950 }}>{pct}%</span> • (If your browser doesn’t
                      support speech recognition, highlighting won’t work.)
                    </>
                  );
                })()}
              </div>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, color: C.muted, marginBottom: 6 }}>
                Mic level {calibratingRef.current ? "(calibrating…)" : ""}
              </div>
              <div className="meter">
                <div className="meterFill" style={{ width: `${micLevel}%` }} />
              </div>
            </div>

            <div className="row2" style={{ marginTop: 12 }}>
              <button className="btnOutline" disabled={enrolling || !selectedDeviceId} onClick={startEnrollment60s}>
                START 60s ENROLLMENT
              </button>
              <button className="btnOutlineDim" disabled={!enrolling} onClick={stopEnrollmentHard}>
                STOP
              </button>
            </div>

            <div className="smallMuted">After enrollment, Live Coach unlocks automatically for this mic.</div>
          </div>
        ) : (
          <>
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
                Detected: <span style={{ color: C.emerald, fontWeight: 950 }}>{detectedSpeaker}</span> • similarity{" "}
                <span style={{ color: C.emerald, fontWeight: 950 }}>{voiceSimilarity.toFixed(3)}</span>
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

      <div className="panel" style={{ marginTop: 12 }}>
        <div className="panelTitle">SAY THIS NEXT</div>
        <div className="sayBox">{sayThisNext}</div>
        <div className="smallMuted">
          Triggers only after the <b>CLIENT</b> finishes talking (based on your enrolled voiceprint).
        </div>
      </div>
    </>
  );
}
