"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function SettingsPage() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">Settings</span>
            {isAuthed && (
              <Link className="authGhostButton" href="/chats">
                Back to chats
              </Link>
            )}
          </div>
          <h1>Shape your Garden AI experience.</h1>
          <p>
            Configure your profile, define each garden location, and tune how
            chats behave.
          </p>
        </header>

        {status === "loading" && (
          <section className="settingsPanel">
            <div className="profileBody">
              <div className="profileFooter">Checking session...</div>
            </div>
          </section>
        )}

        {status === "unauthenticated" && (
          <section className="authGate">
            <h2>Log in to manage settings.</h2>
            <p>Sign in to update your profile and garden configuration.</p>
            <div className="authGateActions">
              <Link className="authButton" href="/login">
                Log in
              </Link>
              <Link className="authGhostButton" href="/signup">
                Sign up
              </Link>
            </div>
          </section>
        )}

        {isAuthed && (
          <section className="settingsGrid">
            <div className="settingsCard">
              <h2>Profile</h2>
              <p>
                Keep your location and environment preferences up to date.
              </p>
              <Link className="authButton" href="/settings/profile">
                Open profile settings
              </Link>
            </div>
            <div className="settingsCard">
              <h2>Garden</h2>
              <p>
                Add each garden spot: raised beds, in-ground zones, or starters.
              </p>
              <Link className="authButton" href="/settings/garden">
                Open garden settings
              </Link>
            </div>
            <div className="settingsCard">
              <h2>Chat</h2>
              <p>Tailor how Garden AI responds, remembers, and follows up.</p>
              <Link className="authGhostButton" href="/settings/chat">
                Chat settings coming soon
              </Link>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
