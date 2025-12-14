// scripts/write-version.mjs
import { promises as fs } from "node:fs";
import path from "node:path";

const root = process.cwd();

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8");
  return JSON.parse(raw);
}

function upsertEnvVar(envText, key, value) {
  const lines = envText.split(/\r?\n/);
  let found = false;

  const out = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });

  if (!found) out.push(`${key}=${value}`);

  // trim trailing blank lines but keep file newline-y
  return out.join("\n").replace(/\n{3,}$/g, "\n\n");
}

async function main() {
  const pkgPath = path.join(root, "package.json");
  const pkg = await readJson(pkgPath);

  const version = String(pkg?.version || "0.0.0").trim();
  const buildTime = new Date().toISOString();

  // 1) public/version.json (copied into dist by Vite)
  const publicDir = path.join(root, "public");
  await fs.mkdir(publicDir, { recursive: true });

  const versionJsonPath = path.join(publicDir, "version.json");
  const versionJson = { version, buildTime };

  await fs.writeFile(versionJsonPath, JSON.stringify(versionJson, null, 2) + "\n", "utf8");

  // 2) .env.local (Vite reads this automatically)
  const envPath = path.join(root, ".env.local");
  let envText = "";
  try {
    envText = await fs.readFile(envPath, "utf8");
  } catch {
    envText = "";
  }

  envText = upsertEnvVar(envText, "VITE_APP_VERSION", version);
  envText = upsertEnvVar(envText, "VITE_APP_BUILD_TIME", buildTime);

  await fs.writeFile(envPath, envText.endsWith("\n") ? envText : envText + "\n", "utf8");

  console.log(`[version] VITE_APP_VERSION=${version}`);
  console.log(`[version] wrote public/version.json and .env.local`);
}

main().catch((err) => {
  console.error("[version] failed:", err);
  process.exit(1);
});
