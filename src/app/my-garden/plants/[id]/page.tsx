"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type { PlantRecord } from "@/lib/plants";
import { deletePlant, fetchPlantById, updatePlant } from "@/lib/plants";

export default function PlantDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [plant, setPlant] = useState<PlantRecord | null>(null);
  const [draft, setDraft] = useState<PlantRecord | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState("");
  const plantId =
    typeof params?.id === "string"
      ? params.id
      : Array.isArray(params?.id)
        ? params.id[0]
        : "";
  const hasPlantId = plantId.length > 0;
  const isValid = useMemo(
    () => Boolean(draft?.name.trim()),
    [draft?.name],
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated" && hasPlantId) {
      setIsLoading(true);
      fetchPlantById(plantId)
        .then((found) => {
          setPlant(found);
          setDraft(found);
          setError("");
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : "Could not load plant. Please try again.";
          setError(message);
          setPlant(null);
          setDraft(null);
        })
        .finally(() => setIsLoading(false));
    }
  }, [status, plantId, hasPlantId]);

  const handleEditToggle = () => {
    if (isEditing) {
      setDraft(plant);
      setError("");
    }
    setIsEditing((prev) => !prev);
  };

  const updateField = (field: keyof PlantRecord, value: string) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const handleSave = async () => {
    if (!draft || !isValid || isSaving) return;
    setIsSaving(true);
    try {
      const saved = await updatePlant(draft);
      setPlant(saved);
      setDraft(saved);
      setIsEditing(false);
      setError("");
    } catch {
      setError("Could not save changes. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!plant || isDeleting) return;
    const confirmed = window.confirm(
      "Delete this plant? This cannot be undone.",
    );
    if (!confirmed) return;
    setIsDeleting(true);
    try {
      await deletePlant(plant.id);
      router.push("/my-garden");
    } catch {
      setError("Could not delete plant. Please try again.");
      setIsDeleting(false);
    }
  };

  if (status !== "authenticated") {
    return null;
  }

  if (isLoading) {
    return (
      <div className="page">
        <div className="shell">
          <header className="hero">
            <div className="heroTop">
              <span className="eyebrow">Plant details</span>
              <Link className="authGhostButton" href="/my-garden">
                Back to my garden
              </Link>
            </div>
            <h1>Loading plant...</h1>
          </header>
        </div>
      </div>
    );
  }

  if (!plant && !draft) {
    return (
      <div className="page">
        <div className="shell">
          <header className="hero">
            <div className="heroTop">
              <span className="eyebrow">Plant details</span>
              <Link className="authGhostButton" href="/my-garden">
                Back to my garden
              </Link>
            </div>
            <h1>Plant not found.</h1>
            <p>
              This plant might have been removed. Pick another plant to keep
              exploring.
            </p>
          </header>
        </div>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">Plant details</span>
            <div className="heroActions">
              <Link className="authGhostButton" href="/my-garden">
                Back to my garden
              </Link>
              <button
                type="button"
                className="authGhostButton"
                onClick={handleEditToggle}
              >
                {isEditing ? "Cancel" : "Edit plant"}
              </button>
              <button
                type="button"
                className="dangerButton"
                onClick={handleDelete}
                disabled={isDeleting}
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
          <h1>{plant?.name}</h1>
          <p>{plant?.variety}</p>
        </header>

        {isEditing && draft ? (
          <section className="settingsPanel" aria-live="polite">
            <div className="profileHeader">
              <h3>Edit plant</h3>
              <div className="profileActions">
                <button
                  type="button"
                  className="profileSaveButton"
                  onClick={handleSave}
                  disabled={!isValid || isSaving}
                >
                  {isSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </div>
            <div className="profileBody">
              <div className="profileFields">
                <label>
                  Name
                  <input
                    type="text"
                    value={draft.name}
                    onChange={(event) =>
                      updateField("name", event.target.value)
                    }
                  />
                </label>
                <label>
                  Variety
                  <input
                    type="text"
                    value={draft.variety}
                    onChange={(event) =>
                      updateField("variety", event.target.value)
                    }
                  />
                </label>
                <label>
                  Location
                  <input
                    type="text"
                    value={draft.location}
                    onChange={(event) =>
                      updateField("location", event.target.value)
                    }
                  />
                </label>
                <label>
                  Status
                  <input
                    type="text"
                    value={draft.status}
                    onChange={(event) =>
                      updateField("status", event.target.value)
                    }
                  />
                </label>
                <label>
                  Next task
                  <input
                    type="text"
                    value={draft.nextTask}
                    onChange={(event) =>
                      updateField("nextTask", event.target.value)
                    }
                  />
                </label>
                <label>
                  Notes
                  <textarea
                    rows={4}
                    value={draft.notes}
                    onChange={(event) =>
                      updateField("notes", event.target.value)
                    }
                  />
                </label>
              </div>
              {error && <div className="profileFooter">{error}</div>}
            </div>
          </section>
        ) : (
          <section className="landing">
            <div className="landingIntro">
              <h2>{plant?.status}</h2>
              <p>{plant?.notes}</p>
            </div>
            <div className="landingHighlights">
              <div className="highlightCard">
                <h3>Location</h3>
                <p>{plant?.location}</p>
              </div>
              <div className="highlightCard">
                <h3>Next task</h3>
                <p>{plant?.nextTask}</p>
              </div>
            </div>
            {error && <div className="profileFooter">{error}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
