import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const host = process.env.TAURI_DEV_HOST;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJsonSafe(p) {
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return null;
  }
}

function readAppVersion() {
  // 1) Prefer Tauri version (usually what you actually ship)
  const tauriConfPath = path.resolve(__dirname, "src-tauri", "tauri.conf.json");
  const tauriConf = readJsonSafe(tauriConfPath);
  const tauriVersion = tauriConf?.package?.version;
  if (tauriVersion) return String(tauriVersion);

  // 2) Fallback to package.json
  const pkgPath = path.resolve(__dirname, "package.json");
  const pkg = readJsonSafe(pkgPath);
  const pkgVersion = pkg?.version;
  if (pkgVersion) return String(pkgVersion);

  return "0.0.0";
}

function emitVersionJsonPlugin(version) {
  const writeVersionFile = () => {
    const publicDir = path.resolve(__dirname, "public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const payload = {
      version,
      builtAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(publicDir, "version.json"),
      JSON.stringify(payload, null, 2),
      "utf-8"
    );
  };

  return {
    name: "emit-version-json",
    apply: "serve", // also run in dev
    configureServer() {
      writeVersionFile();
    },
  };
}

function emitVersionJsonBuildPlugin(version) {
  const writeVersionFile = () => {
    const publicDir = path.resolve(__dirname, "public");
    if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });

    const payload = {
      version,
      builtAt: new Date().toISOString(),
    };

    fs.writeFileSync(
      path.join(publicDir, "version.json"),
      JSON.stringify(payload, null, 2),
      "utf-8"
    );
  };

  return {
    name: "emit-version-json-build",
    apply: "build",
    buildStart() {
      writeVersionFile();
    },
  };
}

// https://vite.dev/config/
export default defineConfig(async () => {
  const version = readAppVersion();

  return {
    plugins: [
      react(),
      emitVersionJsonPlugin(version),
      emitVersionJsonBuildPlugin(version),
    ],

    // Makes your App.jsx read this:
    // const CURRENT_VERSION = import.meta.env.VITE_APP_VERSION
    define: {
      "import.meta.env.VITE_APP_VERSION": JSON.stringify(version),
    },

    clearScreen: false,

    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
  };
});
