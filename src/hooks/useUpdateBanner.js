import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "../generated/appVersion";

function normalize(v) {
  return String(v || "").trim().replace(/^v/i, "");
}

function parseSemver(v) {
  const s = normalize(v);
  const [core, pre = ""] = s.split("-", 2);

  const parts = core.split(".").map((x) => {
    const n = parseInt(x, 10);
    return Number.isFinite(n) ? n : 0;
  });

  while (parts.length < 3) parts.push(0);
  return { parts: parts.slice(0, 3), pre };
}

function compareSemver(a, b) {
  const A = parseSemver(a);
  const B = parseSemver(b);

  for (let i = 0; i < 3; i++) {
    if (A.parts[i] > B.parts[i]) return 1;
    if (A.parts[i] < B.parts[i]) return -1;
  }

  // prerelease is lower than release
  const aPre = A.pre;
  const bPre = B.pre;
  if (!aPre && bPre) return 1;
  if (aPre && !bPre) return -1;
  return 0;
}

function formatCheckTime(d = new Date()) {
  try {
    return d.toLocaleString(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

async function fetchWithTimeout(url, ms = 5000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);

  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: ctrl.signal,
      headers: { "cache-control": "no-cache" },
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function isTauri() {
  // Tauri v2 exposes __TAURI_INTERNALS__ in the webview
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

export default function useUpdateBanner() {
  const CURRENT_VERSION = useMemo(() => normalize(APP_VERSION || "0.0.0"), []);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [lastUpdateCheck, setLastUpdateCheck] = useState("");
  const [updating, setUpdating] = useState(false);

  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);

  // Store whatever the updater returns, so install can use it
  const updateHandleRef = useRef(null);

  async function checkForUpdate() {
    if (stoppedRef.current) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    try {
      setLastUpdateCheck(formatCheckTime(new Date()));

      // --- Preferred path: REAL Tauri updater ---
      if (isTauri()) {
        const mod = await import("@tauri-apps/plugin-updater");
        const checkFn = mod.check ?? mod.checkUpdate;
        if (typeof checkFn === "function") {
          const result = await checkFn();

          // Different versions of the plugin return slightly different shapes.
          // We support the common ones safely.
          const available =
            !!result?.available ||
            !!result?.shouldUpdate ||
            (typeof result?.updateAvailable === "boolean" ? result.updateAvailable : false);

          const remoteVersion =
            normalize(result?.version) ||
            normalize(result?.manifest?.version) ||
            normalize(result?.update?.version) ||
            "";

          updateHandleRef.current = result;

          if (remoteVersion) setLatestVersion(remoteVersion);

          // If plugin already tells us it's available, trust it.
          if (available) {
            setUpdateAvailable(true);
            stoppedRef.current = true;
            return;
          }

          // If plugin didn't give a boolean, fall back to semver compare if we got a version.
          if (remoteVersion && compareSemver(remoteVersion, CURRENT_VERSION) > 0) {
            setUpdateAvailable(true);
            stoppedRef.current = true;
            return;
          }

          return;
        }
      }

      // --- Fallback path: your version.json method (ONLY useful if hosted remotely) ---
      const res = await fetchWithTimeout(`/version.json?ts=${Date.now()}`, 5000);
      if (!res || !res.ok) return;

      const data = await res.json().catch(() => null);
      const remote = normalize(data?.version || "");
      if (!remote) return;

      setLatestVersion(remote);

      if (compareSemver(remote, CURRENT_VERSION) > 0) {
        setUpdateAvailable(true);
        stoppedRef.current = true;
      }
    } catch {
      // never throw
      setLastUpdateCheck(formatCheckTime(new Date()));
    } finally {
      inFlightRef.current = false;
    }
  }

  async function installAndRestart() {
    if (!isTauri()) {
      // in a normal browser build, your old behavior was just reload
      window.location.reload();
      return;
    }

    if (updating) return;

    setUpdating(true);
    try {
      const handle = updateHandleRef.current;

      // Common pattern: result has downloadAndInstall()
      if (handle && typeof handle.downloadAndInstall === "function") {
        await handle.downloadAndInstall();
      } else {
        // Other pattern: plugin exports install/update functions
        const mod = await import("@tauri-apps/plugin-updater");
        const installFn = mod.installUpdate ?? mod.install ?? mod.downloadAndInstall;
        if (typeof installFn === "function") {
          await installFn();
        }
      }

      // Relaunch the app to finish update
      try {
        const proc = await import("@tauri-apps/api/process");
        if (typeof proc.relaunch === "function") {
          await proc.relaunch();
          return;
        }
      } catch {
        // ignore
      }

      // Worst-case fallback: tell user to close & reopen
      alert("Update installed. Please close and reopen Momentum AI to finish updating.");
    } finally {
      setUpdating(false);
    }
  }

  useEffect(() => {
    checkForUpdate();

    const id = setInterval(() => checkForUpdate(), 60_000);
    const onFocus = () => checkForUpdate();
    window.addEventListener("focus", onFocus);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    updateAvailable,
    latestVersion,
    lastUpdateCheck,
    CURRENT_VERSION,
    updating,
    installAndRestart,
  };
}
