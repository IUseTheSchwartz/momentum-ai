// src/ai/brain.js
import { APP_VERSION } from "../generated/appVersion";

function isTauri() {
  return typeof window !== "undefined" && !!window.__TAURI_INTERNALS__;
}

function safeJsonParse(s) {
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

function toTranscript(turns) {
  return (turns || [])
    .map((t) => (t.role === "agent" ? `Agent: ${t.text}` : `Client: ${t.text}`))
    .join("\n");
}

/**
 * Calls the Rust command `ai_roleplay_turn` (we reuse it as the general “AI brain”).
 *
 * @param {Object} args
 * @param {string} args.apiKey
 * @param {string} [args.model]
 * @param {number} [args.difficulty]
 * @param {Array<{role:'agent'|'client', text:string}>} args.turns
 * @param {string} [args.mode] - 'roleplay' | 'live'
 * @returns {Promise<{client:string, coach?:{score?:number, note?:string, best?:string}, hangup?:boolean, raw?:string}>}
 */
export async function aiBrainTurn({
  apiKey,
  model = "gpt-5-mini",
  difficulty = 2,
  turns = [],
  mode = "roleplay",
} = {}) {
  if (!isTauri()) {
    throw new Error("AI Brain requires the Tauri app (not browser).");
  }
  if (!apiKey || !apiKey.trim()) {
    throw new Error("Missing API key.");
  }

  const { invoke } = await import("@tauri-apps/api/core");

  const header = [
    `App: Momentum AI v${APP_VERSION || "0.0.0"}`,
    `Mode: ${mode}`,
    `Rules: keep replies short, realistic, phone-call style.`,
    ``,
  ].join("\n");

  const transcript = header + toTranscript(turns);

  const res = await invoke("ai_roleplay_turn", {
    input: {
      api_key: apiKey,
      model,
      difficulty,
      transcript,
    },
  });

  const raw = res?.raw_text || "";
  const parsed = safeJsonParse(raw);

  // If the model didn’t follow JSON, still return something usable
  if (!parsed || typeof parsed !== "object") {
    return { client: raw || "(no response)", coach: null, hangup: false, raw };
  }

  return {
    client: String(parsed.client || ""),
    coach: parsed.coach || null,
    hangup: !!parsed.hangup,
    raw,
  };
}
