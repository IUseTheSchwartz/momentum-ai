import { useEffect, useRef, useState } from "react";

/* ================= CONFIG ================= */

const SIMILARITY_THRESHOLD = 0.78;

/* ================= UTILS ================= */

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

/* ================= SCRIPT ================= */
/* EVERY SPOKEN LINE — NO SUMMARIES */

const SCRIPT = [
  /* ---------- INTRO ---------- */
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
      "This call is in regards to the request you submitted for that new final expense and life options for veterans. I am the medical underwriter assigned to your file."
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
    id: "intro_5",
    type: "line",
    text:
      "What was your main concern? Like most veterans, just wanting to make sure the funeral expense does not fall a burden on your loved ones. Got it. Were you also looking to leave something extra behind as well?"
  },

  /* ---------- BRANCH: EARLY OBJECTION ---------- */
  {
    id: "branch_early",
    type: "branch",
    options: [
      {
        label: "Already have coverage",
        triggers: [
          "i already have coverage",
          "i have coverage",
          "i have insurance",
          "im covered"
        ],
        next: "coverage_1"
      },
      {
        label: "Dont remember",
        triggers: [
          "i dont remember filling this out",
          "i dont remember",
          "i dont recall"
        ],
        next: "forgot_1"
      }
    ]
  },

  /* ---------- COVERAGE PATH ---------- */
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
      "That actually makes my job easier. Veterans who already have coverage usually want to make sure their funeral expense was handled through the VA, correct?"
  },
  {
    id: "coverage_3",
    type: "line",
    text:
      "When you sent in this request were you looking to get a discount through the VA or add more coverage?"
  },
  {
    id: "coverage_4",
    type: "line",
    text:
      "What was the main reason you submitted the request in the first place?"
  },

  /* ---------- FORGOT PATH ---------- */
  {
    id: "forgot_1",
    type: "line",
    text:
      "That is okay, I usually do not remember what I eat for breakfast most days. You put your date of birth as blank, correct?"
  },
  {
    id: "forgot_2",
    type: "line",
    text:
      "Most veterans fill this out to make sure their final expenses do not fall on their loved ones or to leave extra money behind. Do you currently have anything in place?"
  },

  /* ---------- SUITABILITY ---------- */
  {
    id: "suit_1",
    type: "line",
    text:
      "We will spend about a minute on yourself and your financial situation to make sure everything is affordable and within the budget."
  },
  {
    id: "suit_2",
    type: "line",
    text:
      "Now god forbid, if you were to pass away today who would be the beneficiary responsible for paying for the funeral expenses?"
  },
  {
    id: "suit_3",
    type: "line",
    text:
      "What is their name, relationship to you, and how old are they?"
  },
  {
    id: "suit_4",
    type: "line",
    text:
      "Is your beneficiary in a financial position to cover a funeral expense or is that why you were looking into this?"
  },
  {
    id: "suit_5",
    type: "line",
    text:
      "Have you thought about whether you would be buried or cremated?"
  },
  {
    id: "suit_6",
    type: "line",
    text:
      "Do you know how much that costs nowadays?"
  },
  {
    id: "suit_7",
    type: "line",
    text:
      "Cremation can be five to seven thousand and burial can be fifteen to twenty thousand."
  },
  {
    id: "suit_8",
    type: "line",
    text:
      "Do you have anything put aside or a life insurance policy that would cover that cost if something happened today?"
  },

  /* ---------- INCOME ---------- */
  {
    id: "income_1",
    type: "line",
    text:
      "Are you currently working, retired, or disabled?"
  },
  {
    id: "income_2",
    type: "line",
    text:
      "What would you say you bring in per month just to the ballpark?"
  },
  {
    id: "income_3",
    type: "line",
    text:
      "After bills and expenses, how much are you typically left with?"
  },

  /* ---------- DISCOUNTS ---------- */
  {
    id: "discount_1",
    type: "line",
    text:
      "Are you a smoker or a non smoker?"
  },
  {
    id: "discount_2",
    type: "line",
    text:
      "Do you bank with a federal bank or military credit union?"
  },
  {
    id: "discount_3",
    type: "line",
    text:
      "That is so we can apply the second discount for you."
  },

  /* ---------- HEALTH ---------- */
  {
    id: "health_1",
    type: "line",
    text:
      "For your medical needs do you go to the VA or a civilian doctor?"
  },
  {
    id: "health_2",
    type: "line",
    text:
      "Any heart attacks, strokes, cancer, diabetes, breathing issues, anxiety, kidney or liver problems in the last five years?"
  },
  {
    id: "health_3",
    type: "line",
    text:
      "Any hospitalizations in the last year for forty eight hours or more?"
  },
  {
    id: "health_4",
    type: "line",
    text:
      "And lastly a rough height and weight?"
  },

  /* ---------- PROCESS ---------- */
  {
    id: "process_1",
    type: "line",
    text:
      "Before we go over the packages I want to explain how the process works."
  },
  {
    id: "process_2",
    type: "line",
    text:
      "This is not like a grocery store. We have to get approval from the carrier based on medical records."
  },

  /* ---------- QUOTE ---------- */
  {
    id: "quote_1",
    type: "line",
    text:
      "The system built three packages, gold, silver, and bronze."
  },
  {
    id: "quote_2",
    type: "line",
    text:
      "The bronze covers basic funeral expenses."
  },
  {
    id: "quote_3",
    type: "line",
    text:
      "The silver covers full cost factoring inflation."
  },
  {
    id: "quote_4",
    type: "line",
    text:
      "The gold covers the full cost and leaves money behind."
  },
  {
    id: "quote_5",
    type: "line",
    text:
      "Given those three options which one makes the most sense for you?"
  },

  /* ---------- CLOSE ---------- */
  {
    id: "close_1",
    type: "line",
    text:
      "Everything is fully submitted and approved. This number is my direct line."
  },
  {
    id: "close_2",
    type: "line",
    text:
      "Look out for the policy in the mail in ten to twelve business days."
  },
  {
    id: "close_3",
    type: "line",
    text:
      "Was I of service to you and your loved ones?"
  }
];

/* ================= COMPONENT ================= */

export default function LiveCoach() {
  const [index, setIndex] = useState(0);
  const [lastSpeech, setLastSpeech] = useState("");
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
      const spoken =
        e.results[e.results.length - 1][0].transcript;
      setLastSpeech(spoken);
      handleSpeech(spoken);
    };

    recognition.start();
    recognitionRef.current = recognition;

    return () => recognition.stop();
  }, [index]);

  function handleSpeech(spoken) {
    if (!current) return;

    if (current.type === "branch") {
      for (const option of current.options) {
        for (const trigger of option.triggers) {
          if (similarity(spoken, trigger) >= SIMILARITY_THRESHOLD) {
            const nextIndex = SCRIPT.findIndex(
              s => s.id === option.next
            );
            if (nextIndex !== -1) setIndex(nextIndex);
            return;
          }
        }
      }
      return;
    }

    if (similarity(spoken, current.text) >= SIMILARITY_THRESHOLD) {
      setIndex(i => i + 1);
    }
  }

  function reset() {
    setIndex(0);
    setLastSpeech("");
  }

  return (
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2>Live Coach</h2>
      <button onClick={reset}>RESET</button>

      <div style={{ marginTop: 20 }}>
        {SCRIPT.map((s, i) => (
          <div
            key={s.id}
            style={{
              padding: 8,
              marginBottom: 6,
              borderRadius: 6,
              background:
                i === index ? "#1e293b" : "transparent",
              color: i === index ? "#fff" : "#aaa"
            }}
          >
            {s.type === "branch" ? "— WAITING FOR BRANCH —" : s.text}
          </div>
        ))}
      </div>

      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.6 }}>
        Last agent speech: {lastSpeech}
      </div>
    </div>
  );
}
