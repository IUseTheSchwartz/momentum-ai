// src/hooks/useUpdateBanner.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

function getCurrentVersion() {
  try {
    const v =
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION) ||
      (typeof window !== "undefined" && window.__APP_VERSION__) ||
      "0.0.0";
    return String(v || "0.0.0").trim();
  } catch {
    return "0.0.0";
  }
}

// Returns: -1 if a<b, 0 if a==b, 1 if a>b
function compareSemver(a, b) {
  const parse = (v) =>
    String(v || "")
      .trim()
      .replace(/^v/i, "")
      .split(/[.+-]/) // "1.2.3-beta" -> ["1","2","3","beta"]
      .slice(0, 3)
      .map((x) => {
        const n = Number(x);
        return Number.isFinite(n) ? n : 0;
      });

  const A = parse(a);
  const B = parse(b);

  for (let i = 0; i < 3; i++) {
    const x = A[i] ?? 0;
    const y = B[i] ?? 0;
    if (x < y) return -1;
    if (x > y) return 1;
  }
  return 0;
}

export default function useUpdateBanner(options = {}) {
  const {
    enabled = true,
    intervalMs = 15000,
    path = "/version.json",
  } = options;

  const CURRENT_VERSION = useMemo(() => getCurrentVersion(), []);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [lastUpdateCheck, setLastUpdateCheck] = useState("");

  const checkingRef = useRef(false);
  const abortRef = useRef(null);

  const checkForUpdate = useCallback(async () => {
    if (!enabled) return;
    if (checkingRef.current) return;

    checkingRef.current = true;

    try {
      // Abort any prior in-flight fetch (helps in React StrictMode/dev)
      try {
        abortRef.current?.abort?.();
      } catch {}
      const ac = new AbortController();
      abortRef.current = ac;

      // In Tauri + Vite, always resolve against current origin
      const url = new URL(path, window.location.origin);
      url.searchParams.set("ts", String(Date.now()));

      const res = await fetch(url.toString(), {
        cache: "no-store",
        headers: { "Cache-Control": "no-cache" },
        signal: ac.signal,
      });

      if (!res.ok) return;

      // Avoid crashing if server returns HTML or something unexpected
      const text = await res.text();
      let data = null;
      try {
        data = JSON.parse(text);
      } catch {
        return;
      }

      const v = String(data?.version || "").trim();
      if (!v) return;

      setLastUpdateCheck(new Date().toLocaleTimeString());

      // Only show banner if latest > current
      const newer = compareSemver(CURRENT_VERSION, v) === -1;
      if (newer) {
        setLatestVersion(v);
        setUpdateAvailable(true);
      } else {
        setLatestVersion("");
        setUpdateAvailable(false);
      }
    } catch {
      // ignore (offline / blocked / aborted / etc.)
    } finally {
      checkingRef.current = false;
    }
  }, [CURRENT_VERSION, enabled, path]);

  useEffect(() => {
    if (!enabled) return;

    checkForUpdate();
    const id = window.setInterval(checkForUpdate, intervalMs);

    return () => {
      window.clearInterval(id);
      try {
        abortRef.current?.abort?.();
      } catch {}
      checkingRef.current = false;
    };
  }, [checkForUpdate, enabled, intervalMs]);

  return {
    CURRENT_VERSION,
    updateAvailable,
    latestVersion,
    lastUpdateCheck,
    checkForUpdate,
  };
}
