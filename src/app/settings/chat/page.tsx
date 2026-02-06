"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";

export default function ChatSettingsPage() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">Settings / Chat</span>
            {isAuthed && (
              <Link className="authGhostButton" href="/settings">
                Back to settings
              </Link>
            )}
          </div>
          <h1>Chat settings.</h1>
          <p>We are still shaping this space. Check back soon.</p>
        </header>
      </div>
    </div>
  );
}
