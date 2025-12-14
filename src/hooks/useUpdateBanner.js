// src/hooks/useUpdateBanner.js
import { useEffect, useMemo, useState } from "react";

function norm(v) {
  return String(v || "").trim().replace(/^v/i, "");
}

function parseSemver(v) {
  const [a, b, c] = norm(v).split(".").map((x) => parseInt(x, 10) || 0);
  return [a || 0, b || 0, c || 0];
}

function cmpSemver(a, b) {
  const pa = parseSemver(a);
  const pb = parseSemver(b);
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

function getEnvVersion() {
  try {
    return (
      (typeof import.meta !== "undefined" && import.meta.env?.VITE_APP_VERSION) ||
      (typeof window !== "undefined" && window.__APP_VERSION__) ||
      ""
    );
  } catch {
    return "";
  }
}

async function getLocalBundledVersion() {
  try {
    const res = await fetch(`/version.json?ts=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) return "";
    const data = await res.json();
    return String(data?.version || "").trim();
  } catch {
    return "";
  }
}

async function getLatestFromGithub(repo) {
  // repo = "owner/name"
  const res = await fetch(`https://api.github.com/repos/${repo}/releases/latest`, { cache: "no-store" });
  if (!res.ok) return null;
  const data = await res.json();

  const latestVersion = norm(data.tag_name || data.name || "");
  if (!latestVersion) return null;

  // Prefer a direct asset download if available, else fall back to release page
  let downloadUrl = data.html_url || "";
  const assets = Array.isArray(data.assets) ? data.assets : [];
  const asset = assets.find((a) => a?.browser_download_url) || null;
  if (asset?.browser_download_url) downloadUrl = asset.browser_download_url;

  return { latestVersion, downloadUrl };
}

export default function useUpdateBanner() {
  const repo = import.meta.env?.VITE_GITHUB_REPO; // <-- set this
  const CURRENT_VERSION = useMemo(() => norm(getEnvVersion()), []);

  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [latestVersion, setLatestVersion] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");
  const [lastUpdateCheck, setLastUpdateCheck] = useState("");

  async function checkForUpdate() {
    try {
      // Determine current version
      let current = CURRENT_VERSION;
      if (!current) current = norm(await getLocalBundledVersion());
      if (!current) current = "0.0.0";

      // Determine latest version (remote)
      if (!repo) return; // nothing to check against

      const latest = await getLatestFromGithub(repo);
      if (!latest) return;

      setLastUpdateCheck(new Date().toLocaleTimeString());
      setLatestVersion(latest.latestVersion);
      setDownloadUrl(latest.downloadUrl || "");

      setUpdateAvailable(cmpSemver(latest.latestVersion, current) === 1);
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    checkForUpdate();
    const id = setInterval(checkForUpdate, 60_000); // 60s (GitHub rate limits if you do 15s)
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    CURRENT_VERSION: CURRENT_VERSION || "0.0.0",
    updateAvailable,
    latestVersion,
    downloadUrl,
    lastUpdateCheck,
    checkForUpdate,
  };
}
