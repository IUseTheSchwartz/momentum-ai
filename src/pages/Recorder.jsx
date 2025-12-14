// src/pages/Recorder.jsx
import { useRef, useState, useEffect } from "react";
import BackBar from "../components/BackBar";
import MicBlock from "../components/MicBlock";

export default function Recorder({
  setView,
  setStatus,
  permissionState,
  ensureMicPermission,
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  loadDevices,
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingHint, setRecordingHint] = useState("Ready.");
  const [recordings, setRecordings] = useState([]);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);

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

  useEffect(() => {
    return () => {
      try {
        const mr = mediaRecorderRef.current;
        if (mr && mr.state !== "inactive") mr.stop();
      } catch {}
      setStatus("Idle");
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <BackBar title="Recorder" onBack={() => setView("home")} />

      <div className="panel">
        <MicBlock
          devices={devices}
          selectedDeviceId={selectedDeviceId}
          setSelectedDeviceId={setSelectedDeviceId}
          loadDevices={loadDevices}
          permissionState={permissionState}
        />

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
    </>
  );
}
