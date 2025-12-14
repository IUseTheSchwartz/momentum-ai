// src/components/Shell.jsx
import { C } from "../theme";

export default function Shell({
  children,
  status,
  activeLight,
  updateBanner, // { updateAvailable, latestVersion, lastUpdateCheck, CURRENT_VERSION, installing, installError, installUpdate }
}) {
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
            flexDirection: "column",
            gap: 10,
            marginBottom: 14,
          }}
        >
          {/* Top header row */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 12,
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
                  background: activeLight ? C.emerald : "rgba(255,255,255,0.20)",
                  boxShadow: activeLight ? `0 0 18px ${C.emeraldGlow}` : "none",
                }}
              />
            </div>
          </div>

          {/* Update banner */}
          {updateBanner?.updateAvailable && (
            <div
              style={{
                borderRadius: 14,
                border: `1px solid rgba(16,185,129,0.35)`,
                background: "rgba(16,185,129,0.12)",
                padding: 10,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
              }}
            >
              <div style={{ fontSize: 12, fontWeight: 900 }}>
                Update available{" "}
                <span style={{ color: C.emerald }}>
                  {updateBanner.latestVersion ? `v${updateBanner.latestVersion}` : ""}
                </span>
                <div style={{ fontSize: 11, color: "rgba(237,239,242,0.75)", marginTop: 2 }}>
                  Current: v{updateBanner.CURRENT_VERSION}
                  {updateBanner.lastUpdateCheck ? ` • checked ${updateBanner.lastUpdateCheck}` : ""}
                </div>
                {!!updateBanner.installError && (
                  <div style={{ fontSize: 11, color: "rgba(255,180,180,0.95)", marginTop: 4 }}>
                    {updateBanner.installError}
                  </div>
                )}
              </div>

              <button
                className="btn"
                onClick={() => updateBanner.installUpdate?.()}
                disabled={!!updateBanner.installing}
                style={{ whiteSpace: "nowrap", opacity: updateBanner.installing ? 0.7 : 1 }}
              >
                {updateBanner.installing ? "Updating..." : "Update"}
              </button>
            </div>
          )}
        </div>

        {children}
      </div>
    </div>
  );
}
