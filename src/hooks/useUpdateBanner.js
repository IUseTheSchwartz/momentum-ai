// src/hooks/useUpdateBanner.js
import { useEffect, useMemo, useRef, useState } from "react";
import { APP_VERSION } from "../generated/appVersion";

function normalize(v) {
  return String(v || "").trim().replace(/^v/i, "");
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

export default function useUpdateBanner() {
  const CURRENT_VERSION = useMemo(() => normalize(APP_VERSION || "0.0.0"), []);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [lastUpdateCheck, setLastUpdateCheck] = useState("");
  const [installing, setInstalling] = useState(false);
  const [installError, setInstallError] = useState("");

  const inFlightRef = useRef(false);
  const updateRef = useRef(null);

  async function isTauriRuntime() {
    try {
      // Most reliable: window.__TAURI__
      if (typeof window !== "undefined" && window.__TAURI__) return true;

      // Fallback: api/core isTauri (if available)
      const core = await import("@tauri-apps/api/core");
      if (typeof core.isTauri === "function") return !!core.isTauri();
    } catch {
      // ignore
    }
    return false;
  }

  async function checkForUpdate() {
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      setLastUpdateCheck(formatCheckTime(new Date()));
      setInstallError("");

      const tauriOk = await isTauriRuntime();
      if (!tauriOk) {
        // Running in plain browser dev -> don't show updater banner
        setUpdateAvailable(false);
        setLatestVersion("");
        updateRef.current = null;
        return;
      }

      const { check } = await import("@tauri-apps/plugin-updater");

      // `check()` returns an update object OR null (depending on platform/config)
      const update = await check();

      // No update
      if (!update) {
        setUpdateAvailable(false);
        setLatestVersion("");
        updateRef.current = null;
        return;
      }

      // Some builds expose `available`; some return an object only when available.
      const available =
        typeof update.available === "boolean" ? update.available : true;

      if (!available) {
        setUpdateAvailable(false);
        setLatestVersion("");
        updateRef.current = null;
        return;
      }

      const v = normalize(update.version || update?.manifest?.version || "");
      setLatestVersion(v);
      setUpdateAvailable(true);
      updateRef.current = update;
    } catch (e) {
      // Never crash UI
      setLastUpdateCheck(formatCheckTime(new Date()));
      setUpdateAvailable(false);
      setLatestVersion("");
      updateRef.current = null;
    } finally {
      inFlightRef.current = false;
    }
  }

  async function installUpdate() {
    try {
      setInstalling(true);
      setInstallError("");

      const update = updateRef.current;
      if (!update) return;

      // Download + install
      await update.downloadAndInstall();

      // Relaunch so the installed update actually takes effect
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (e) {
      setInstallError("Update failed. Try again or restart the app.");
    } finally {
      setInstalling(false);
    }
  }

  useEffect(() => {
    checkForUpdate();

    // check every 60s
    const id = setInterval(checkForUpdate, 60_000);

    // also check when app refocuses
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
    installing,
    installError,
    checkForUpdate,
    installUpdate,
  };
}
