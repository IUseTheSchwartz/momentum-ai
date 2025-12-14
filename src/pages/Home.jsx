// src/pages/Home.jsx
export default function Home({ setView }) {
  const cards = [
    {
      title: "Live Coach",
      desc: "Requires 60s voice enrollment per mic. Detects Agent vs Client locally.",
      onClick: () => setView("live"),
    },
    {
      title: "Recorder",
      desc: "Records mic audio. Stop → Download the file for review.",
      onClick: () => setView("record"),
    },
    {
      title: "Roleplay Trainer",
      desc: "Ringing → Answered. YOU talk first. Client voice is always female.",
      onClick: () => setView("roleplay"),
    },
  ];

  return (
    <>
      <div className="grid3">
        {cards.map((c) => (
          <button key={c.title} className="modeCard" onClick={c.onClick}>
            <div className="modeTitle">{c.title}</div>
            <div className="modeDesc">{c.desc}</div>
            <div className="modeLink">Open →</div>
          </button>
        ))}
      </div>

      <div className="howItWorks">
        <div className="howTitle">How it works</div>
        <ol className="howList">
          <li>Select your microphone.</li>
          <li>Live Coach requires a 60-second voice enrollment (local-only) for that mic.</li>
          <li>Enrollment guides you through 10 lines with live highlighting.</li>
          <li>Momentum AI detects Agent vs Client by matching your voiceprint.</li>
        </ol>
        <div className="howNote">
          Note: This is a lightweight local voice “fingerprint,” not bank-grade biometric security.
        </div>
      </div>
    </>
  );
}
