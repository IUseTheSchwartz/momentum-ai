import { useEffect, useRef, useState } from "react";

/**
 * LIVE COACH — DETERMINISTIC SCRIPT ENGINE
 * - Agent voice ONLY
 * - Script-driven
 * - Semantic match required to advance
 * - Auto branch selection
 */

const SIMILARITY_THRESHOLD = 0.78;

/* ---------------- UTILS ---------------- */

function normalize(text = "") {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function similarity(a, b) {
  a = normalize(a);
  b = normalize(b);
  if (!a || !b) return 0;

  const aWords = new Set(a.split(" "));
  const bWords = new Set(b.split(" "));
  let match = 0;

  aWords.forEach(w => {
    if (bWords.has(w)) match++;
  });

  return match / Math.max(aWords.size, bWords.size);
}

/* ---------------- SCRIPT ---------------- */

const SCRIPT = [
  {
    id: "intro_1",
    type: "line",
    text:
      "Hey client name, this is your name. I was just giving you a quick call from the Benefits for Veterans Office. How are you doing today?"
  },
  {
    id: "intro_2",
    type: "line",
    text:
      "This call is in regards to the request you submitted for the new final expense and life options for veterans. I am the medical underwriter assigned to your file."
  },
  {
    id: "intro_3",
    type: "line",
    text:
      "I have your date of birth listed here as blank. Is that correct?"
  },
  {
    id: "intro_4",
    type: "line",
    text:
      "It shows here you are a veteran. Thank you for your service."
  },
  {
    id: "concern",
    type: "line",
    text:
      "What was your main concern? Like most veterans, just wanting to make sure the funeral expense does not fall a burden on your loved ones. Were you also looking to leave something extra behind if possible?"
  },

  {
    id: "branch_coverage",
    type: "branch",
    options: [
      {
        label: "Already have coverage",
        triggers: [
          "i already have coverage",
          "i have insurance",
          "im already covered"
        ],
        next: "coverage_1"
      },
      {
        label: "Don't remember filling out",
        triggers: [
          "dont remember filling this out",
          "i dont remember",
          "i dont recall"
        ],
        next: "forgot_1"
      }
    ]
  },

  /* ---- COVERAGE PATH ---- */
  {
    id: "coverage_1",
    type: "line",
    text:
      "Perfect, did you get this taken care of through the VA?"
  },
  {
    id: "coverage_2",
    type: "line",
    text:
      "Veterans who already have coverage usually want to make sure the funeral expense was handled through the VA, correct?"
  },
  {
    id: "coverage_3",
    type: "line",
    text:
      "When you sent in the request were you looking for a discount through the VA or to add more coverage?"
  },

  /* ---- FORGOT PATH ---- */
  {
    id: "forgot_1",
    type: "line",
    text:
      "That is okay, I usually do not remember what I eat for breakfast. You put your date of birth as blank, correct?"
  },
  {
    id: "forgot_2",
    type: "line",
    text:
      "Most veterans fill this out to make sure final expenses do not fall on loved ones or to leave extra money behind. Do you currently have anything in place?"
  },

  /* ---- SUITABILITY ---- */
  {
    id: "suitability_1",
    type: "line",
    text:
      "We will spend about a minute on your financial situation to make sure everything is affordable."
  },
  {
    id: "suitability_2",
    type: "line",
    text:
      "Now god forbid if you were to pass away today who would be responsible for paying the funeral expenses?"
  },
  {
    id: "suitability_3",
    type: "line",
    text:
      "Have you thought about whether you would be buried or cremated?"
  },
  {
    id: "suitability_4",
    type: "line",
    text:
      "Do you know how much that costs nowadays?"
  },

  /* ---- HEALTH ---- */
  {
    id: "health_1",
    type: "line",
    text:
      "Now a little bit on your health. Do you go to the VA or a civilian doctor?"
  },

  /* ---- PRESENTATION ---- */
  {
    id: "present_1",
    type: "line",
    text:
      "Before we go over the packages I want to explain how the process works."
  },

  /* ---- QUOTE ---- */
  {
    id: "quote_1",
    type: "line",
    text:
      "The system built three packages. Gold, Silver, and Bronze."
  },
  {
    id: "golden_question",
    type: "line",
    text:
      "Given those three options, which one makes the most sense for you?"
  },

  /* ---- CLOSE ---- */
  {
    id: "close_1",
    type: "line",
    text:
      "Everything is submitted and approved. This is my direct line if you need anything."
  }
];

/* ---------------- COMPONENT ---------------- */

export default function LiveCoach() {
  const [index, setIndex] = useState(0);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef(null);

  const current = SCRIPT[index];

  useEffect(() => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onresult = e => {
      const last = e.results[e.results.length - 1][0].transcript;
      setTranscript(last);
      handleSpeech(last);
    };

    recognition.start();
    recognitionRef.current = recognition;

    return () => recognition.stop();
  }, [index]);

  function handleSpeech(spoken) {
    if (!current) return;

    // BRANCH
    if (current.type === "branch") {
      for (const option of current.options) {
        for (const trigger of option.triggers) {
          if (similarity(spoken, trigger) > SIMILARITY_THRESHOLD) {
            const nextIndex = SCRIPT.findIndex(s => s.id === option.next);
            if (nextIndex !== -1) setIndex(nextIndex);
            return;
          }
        }
      }
      return;
    }

    // LINE
    const score = similarity(spoken, current.text);
    if (score >= SIMILARITY_THRESHOLD) {
      setIndex(i => i + 1);
    }
  }

  function reset() {
    setIndex(0);
    setTranscript("");
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2>Live Coach</h2>

      <button onClick={reset}>RESET</button>

      <div style={{ marginTop: 20 }}>
        {SCRIPT.map((item, i) => (
          <div
            key={item.id}
            style={{
              padding: 8,
              marginBottom: 6,
              background:
                i === index ? "#1e293b" : "transparent",
              color: i === index ? "#fff" : "#aaa",
              borderRadius: 6
            }}
          >
            {item.type === "branch"
              ? "— WAITING FOR BRANCH —"
              : item.text}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, fontSize: 12, opacity: 0.6 }}>
        Last agent speech: {transcript}
      </div>
    </div>
  );
}
