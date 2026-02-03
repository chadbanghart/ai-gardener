"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PlantRecord } from "@/lib/plants";
import { fetchPlants } from "@/lib/plants";

export default function MyGardenPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plants, setPlants] = useState<PlantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
      setIsLoading(true);
      fetchPlants()
        .then((data) => {
          setPlants(data);
          setError("");
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : "Could not load plants. Please try again.";
          setError(message);
        })
        .finally(() => setIsLoading(false));
    }
  }, [status]);

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

        <section className="gardenSection" aria-labelledby="my-plants">
          <div className="sectionHeader">
            <div>
              <p className="sectionEyebrow">My plants</p>
              <h2 id="my-plants">Every plant you are tracking.</h2>
            </div>
            <p className="sectionHint">
              Tap a card to open the plant details page.
            </p>
          </div>

          <div className="plantActions">
            <Link className="authButton" href="/my-garden/plants/new">
              Add plant
            </Link>
          </div>

          {isLoading ? (
            <div className="emptyState">
              <h3>Loading plants...</h3>
            </div>
          ) : plants.length === 0 ? (
            <div className="emptyState">
              <h3>No plants yet.</h3>
              <p>
                Add your first plant to start tracking notes, tasks, and
                progress.
              </p>
              <Link className="authButton" href="/my-garden/plants/new">
                Create your first plant
              </Link>
            </div>
          ) : (
            <div className="plantGrid">
              {plants.map((plant) => (
                <Link
                  className="plantCard"
                  key={plant.id}
                  href={`/my-garden/plants/${plant.id}`}
                >
                  <div className="plantCardHeader">
                    <div>
                      <h3>{plant.name}</h3>
                      <p className="plantVariety">{plant.variety}</p>
                    </div>
                    <span className="plantTag">{plant.status}</span>
                  </div>
                  <div className="plantMeta">
                    <span>Location</span>
                    <strong>{plant.location}</strong>
                  </div>
                  <div className="plantMeta">
                    <span>Next task</span>
                    <strong>{plant.nextTask}</strong>
                  </div>
                </Link>
              ))}
            </div>
          )}
          {error && <div className="profileFooter">{error}</div>}
        </section>
      </div>
    </div>
  );
}
