// src/components/BackBar.jsx
import { C } from "../theme";

export default function BackBar({ title, onBack }) {
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 12, alignItems: "center" }}>
      <button className="btn" onClick={onBack}>
        ← Menu
      </button>
      <div style={{ color: C.muted, fontSize: 13, fontWeight: 800 }}>{title}</div>
    </div>
  );
}
