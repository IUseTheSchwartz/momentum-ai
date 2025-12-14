// src/hooks/useUpdateBanner.js
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "../generated/appVersion";

function normalize(v) {
  return String(v || "")
    .trim()
    .replace(/^v/i, "");
}

function parseSemver(v) {
  // supports: "1.2.3", "1.2", "1", "1.2.3-beta.1"
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

  // same core; treat prerelease as "lower" than release
  const aPre = A.pre;
  const bPre = B.pre;
  if (!aPre && bPre) return 1;
  if (aPre && !bPre) return -1;
  return 0;
}

function formatCheckTime(d = new Date()) {
  // small + safe formatting
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

export default function useUpdateBanner() {
  const CURRENT_VERSION = useMemo(() => normalize(APP_VERSION || "0.0.0"), []);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [lastUpdateCheck, setLastUpdateCheck] = useState("");

  const inFlightRef = useRef(false);
  const stoppedRef = useRef(false);

  async function checkForUpdate() {
    if (stoppedRef.current) return;
    if (inFlightRef.current) return;

    inFlightRef.current = true;
    try {
      const res = await fetchWithTimeout(`/version.json?ts=${Date.now()}`, 5000);
      setLastUpdateCheck(formatCheckTime(new Date()));

      if (!res || !res.ok) return;

      const data = await res.json().catch(() => null);
      const remote = normalize(data?.version || "");

      if (!remote) return;

      setLatestVersion(remote);

      // If remote version is greater than current, show banner
      if (compareSemver(remote, CURRENT_VERSION) > 0) {
        setUpdateAvailable(true);
        // Once update is detected, we can stop checking to reduce noise
        stoppedRef.current = true;
      }
    } catch {
      // never throw
      setLastUpdateCheck(formatCheckTime(new Date()));
    } finally {
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    checkForUpdate();

    // check every 60s while app is open (until update found)
    const id = setInterval(() => {
      checkForUpdate();
    }, 60_000);

    // also check when user refocuses the app
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
  };
}
