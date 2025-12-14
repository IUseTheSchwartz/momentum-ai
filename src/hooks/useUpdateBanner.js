// src/hooks/useUpdateBanner.js
import { useEffect, useMemo, useState } from "react";

function getCurrentVersion() {
  try {
    return (
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION) ||
      (typeof window !== "undefined" && window.__APP_VERSION__) ||
      "0.0.0"
    );
  } catch {
    return "0.0.0";
  }
}

export default function useUpdateBanner() {
  const CURRENT_VERSION = useMemo(() => getCurrentVersion(), []);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [lastUpdateCheck, setLastUpdateCheck] = useState("");

  async function checkForUpdate() {
    try {
      const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
      if (!res.ok) return;

      const data = await res.json();
      const v = String(data?.version || "").trim();
      if (!v) return;

      setLastUpdateCheck(new Date().toLocaleTimeString());

      if (v !== CURRENT_VERSION) {
        setLatestVersion(v);
        setUpdateAvailable(true);
      } else {
        setUpdateAvailable(false);
        setLatestVersion("");
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    checkForUpdate();
    const id = setInterval(checkForUpdate, 15000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    CURRENT_VERSION,
    updateAvailable,
    latestVersion,
    lastUpdateCheck,
    checkForUpdate,
  };
}
