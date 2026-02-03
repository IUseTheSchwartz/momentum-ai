// src/pages/Home.jsx
export default function Home({ setView }) {
  const cards = [
    {
      title: "HALO Leads",
      desc: "On-screen guided sales flow. Listens to agent voice only and advances when script is matched.",
      onClick: () => setView("live"),
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
          <li>HALO Leads displays the full script from start to finish.</li>
          <li>The system listens to agent speech only.</li>
          <li>The script advances automatically when your wording matches the expected line.</li>
        </ol>
        <div className="howNote">
          Note: HALO Leads does not record calls and does not use voiceprints or biometric identification.
        </div>
      </div>
    </>
  );
}
