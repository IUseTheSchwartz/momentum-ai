// src/components/MicBlock.jsx
import { C } from "../theme";

export default function MicBlock({
  devices,
  selectedDeviceId,
  setSelectedDeviceId,
  loadDevices,
  permissionState,
}) {
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
