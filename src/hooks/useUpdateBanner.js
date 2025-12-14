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
      minute: "2-digit"
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
      headers: { "cache-control": "no-cache" }
    });
    return res;
  } finally {
    clearTimeout(t);
  }
}

function isTauri() {
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

  // Store the Update handle returned by plugin-updater
  const updateHandleRef = useRef(null);

  async function checkForUpdate() {
    if (stoppedRef.current) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    try {
      setLastUpdateCheck(formatCheckTime(new Date()));

      // --- REAL Tauri updater path ---
      if (isTauri()) {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check(); // Update | null

        // Per v2 docs: null means no update available.
        if (update) {
          updateHandleRef.current = update;

          const remoteVersion = normalize(update.version || "");
          if (remoteVersion) setLatestVersion(remoteVersion);

          // If you want a safety compare, keep it; otherwise update != null is enough.
          if (!remoteVersion || compareSemver(remoteVersion, CURRENT_VERSION) > 0) {
            setUpdateAvailable(true);
            stoppedRef.current = true;
          }
          return;
        }

        // no update
        return;
      }

      // --- Browser fallback (only useful if version.json is hosted remotely) ---
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
      setLastUpdateCheck(formatCheckTime(new Date()));
    } finally {
      inFlightRef.current = false;
    }
  }

  async function installAndRestart() {
    if (!isTauri()) {
      window.location.reload();
      return;
    }
    if (updating) return;

    setUpdating(true);
    try {
      const update = updateHandleRef.current;
      if (!update || typeof update.downloadAndInstall !== "function") {
        throw new Error("No update handle available. Try checking for updates again.");
      }

      // downloads + installs
      await update.downloadAndInstall();

      // restart app
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      console.error(e);
      alert(
        "Update failed to install automatically. Please try again, or download the latest release manually."
      );
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
    installAndRestart
  };
}
