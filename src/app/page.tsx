"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function Home() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">AI Garden Assistant</span>
          </div>
          <h1>Grow a calmer, greener garden.</h1>
          <p>
            A free, hobby-grade chat companion for watering, soil, pests, and
            seasonal care.
          </p>
        </header>

        <section className="landing">
          <div className="landingIntro">
            <h2>Plan, plant, and keep every conversation.</h2>
            <p>
              Garden AI keeps your growing notes in one place. Create a profile
              with your climate and garden type, then get tailored advice for
              soil, pests, watering, and seasonal timing.
            </p>
            <div className="landingActions">
              {isAuthed ? (
                <>
                  <Link className="authButton" href="/chats">
                    Open chats
                  </Link>
                  <Link className="authGhostButton" href="/settings">
                    Update profile settings
                  </Link>
                </>
              ) : (
                <>
                  <Link className="authButton" href="/signup">
                    Sign up
                  </Link>
                  <Link className="authGhostButton" href="/login">
                    Log in
                  </Link>
                </>
              )}
            </div>
          </div>
            <div className="landingHighlights">
              <div className="highlightCard">
                <h3>Set your profile once</h3>
                <p>
                  Add your location, sunlight, and garden type to get more
                  tailored advice in every chat.
                </p>
              </div>
              <div className="highlightCard">
                <h3>Guided by your garden</h3>
                <p>
                  Save sunlight, irrigation style, and notes once and Garden AI
                  keeps your context ready for every chat.
              </p>
            </div>
            <div className="highlightCard">
              <h3>Local-first by design</h3>
              <p>
                Uses your local Ollama model, so your garden planning stays
                private and offline-friendly.
              </p>
            </div>
            <div className="highlightCard">
              <h3>Season-ready prompts</h3>
              <p>
                Quick starter prompts cover watering schedules, leaf yellowing,
                and compost basics.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
