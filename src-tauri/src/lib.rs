// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
use serde::{Deserialize, Serialize};

#[tauri::command]
fn greet(name: &str) -> String {
  format!("Hello, {}! You've been greeted from Rust!", name)
}

#[derive(Debug, Deserialize)]
struct RoleplayTurnInput {
  api_key: String,
  model: Option<String>,
  difficulty: Option<u8>,
  transcript: String,
}

#[derive(Debug, Serialize)]
struct RoleplayTurnOutput {
  raw_text: String,
}

#[tauri::command]
async fn ai_roleplay_turn(input: RoleplayTurnInput) -> Result<RoleplayTurnOutput, String> {
  let api_key = input.api_key.trim();
  if api_key.is_empty() {
    return Err("Missing API key. Paste your OpenAI API key in Roleplay settings.".into());
  }

  let model = input.model.unwrap_or_else(|| "gpt-5-mini".to_string());
  let difficulty = input.difficulty.unwrap_or(2);

  // System prompt: “client simulator + coach”, returns JSON as text
  let system = format!(
r#"You are simulating a life insurance prospect on a phone call. Difficulty: {} (1 easy, 2 normal, 3 hard).

Rules:
- Respond as the CLIENT (short, realistic, sometimes skeptical).
- Also include COACH feedback for the agent.
- Output MUST be valid JSON only. No extra text.

JSON schema:
{{
  "client": "string (what client says next)",
  "coach": {{
    "score": number 0-100,
    "note": "1 short sentence coaching",
    "best": "a better agent response (short)"
  }},
  "hangup": boolean
}}

Conversation so far:
{}"#,
    difficulty,
    input.transcript
  );

  let body = serde_json::json!({
    "model": model,
    "messages": [
      { "role": "system", "content": system }
    ],
    "temperature": 0.7
  });

  let client = reqwest::Client::new();
  let resp = client
    .post("https://api.openai.com/v1/chat/completions")
    .bearer_auth(api_key)
    .json(&body)
    .send()
    .await
    .map_err(|e| format!("AI request failed: {}", e))?;

  let status = resp.status();
  let json: serde_json::Value = resp
    .json()
    .await
    .map_err(|e| format!("AI response not JSON: {} (status {})", e, status))?;

  let text = json["choices"][0]["message"]["content"]
    .as_str()
    .unwrap_or("")
    .to_string();

  if text.trim().is_empty() {
    return Err(format!("AI returned empty content (status {})", status));
  }

  Ok(RoleplayTurnOutput { raw_text: text })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_opener::init())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .invoke_handler(tauri::generate_handler![
      greet,
      ai_roleplay_turn // ✅ NEW
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
