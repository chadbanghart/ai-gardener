"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MyGardenPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">My garden</span>
          </div>
          <h1>Your garden at a glance.</h1>
          <p>
            This space will grow into your home base for plants, beds, tasks,
            and seasonal notes. We'll add features here one at a time.
          </p>
        </header>

        <section className="landing">
          <div className="landingIntro">
            <h2>First component coming soon.</h2>
            <p>
              Next up: we can add your first garden card, a quick log, or a
              simple overview panel.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
