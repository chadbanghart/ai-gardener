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
  const today = new Date();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
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
  const parseLocalDate = (value: string) => {
    const trimmed = value.includes("T") ? value.slice(0, 10) : value;
    const [year, month, day] = trimmed.split("-").map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day);
  };

  const formatDisplayDate = (value: string) => {
    const parsed = parseLocalDate(value);
    return parsed
      ? parsed.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "Not set";
  };

  const latestDate = (dates: string[]) =>
    dates.length ? [...dates].sort().at(-1) ?? "" : "";

  const formatShortDate = (value: Date) =>
    value.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
    });

  const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };

  const nextDueDate = (
    baseValue: string | null,
    intervalDays: number | null,
    startDate: Date,
  ) => {
    if (!baseValue || !intervalDays) return null;
    const base = parseLocalDate(baseValue);
    if (!base) return null;
    let next = addDays(base, intervalDays);
    while (next < startDate) {
      next = addDays(next, intervalDays);
    }
    return next;
  };

  const formatTaskLabel = (task: string, date: Date, startDate: Date) => {
    const isToday = date.toDateString() === startDate.toDateString();
    return isToday
      ? `${task} today`
      : `${task} on ${formatShortDate(date)}`;
  };

  const nextTaskForPlant = (plantRecord: PlantRecord) => {
    const tasks: Array<{ label: string; date: Date }> = [];
    const waterBase =
      latestDate(plantRecord.wateredDates) || plantRecord.plantedOn;
    const fertilizeBase =
      latestDate(plantRecord.fertilizedDates) || plantRecord.plantedOn;
    const pruneBase =
      latestDate(plantRecord.prunedDates) || plantRecord.plantedOn;

    const waterNext = nextDueDate(
      waterBase,
      plantRecord.waterIntervalDays ?? 7,
      startOfToday,
    );
    if (waterNext) {
      tasks.push({ label: "Water", date: waterNext });
    }

    const fertilizeNext = nextDueDate(
      fertilizeBase,
      plantRecord.fertilizeIntervalDays ?? 30,
      startOfToday,
    );
    if (fertilizeNext) {
      tasks.push({ label: "Fertilize", date: fertilizeNext });
    }

    const pruneNext = nextDueDate(
      pruneBase,
      plantRecord.pruneIntervalDays ?? null,
      startOfToday,
    );
    if (pruneNext) {
      tasks.push({ label: "Prune", date: pruneNext });
    }

    if (!tasks.length) {
      return "No tasks scheduled";
    }

    tasks.sort((a, b) => a.date.getTime() - b.date.getTime());
    const next = tasks[0];
    return formatTaskLabel(next.label, next.date, startOfToday);
  };

  const formatPlantAge = (plantedOn: string) => {
    const plantedDate = parseLocalDate(plantedOn);
    if (!plantedDate) return "Age: Not set";
    const totalDays = Math.max(
      0,
      Math.floor(
        (startOfToday.getTime() - plantedDate.getTime()) /
          (1000 * 60 * 60 * 24),
      ),
    );
    const years = Math.floor(totalDays / 365);
    const remainingDays = totalDays % 365;
    const weeks = Math.floor(remainingDays / 7);
    const days = remainingDays % 7;
    const parts = [];
    if (years >= 1) {
      parts.push(`${years}y`);
    }
    parts.push(`${weeks}w`, `${days}d`);
    return `Age: ${parts.join(" ")}`;
  };

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

  const updateField = <K extends keyof PlantRecord>(
    field: K,
    value: PlantRecord[K],
  ) => {
    setDraft((prev) => (prev ? { ...prev, [field]: value } : prev));
  };

  const updateDateListField = (
    field: "wateredDates" | "fertilizedDates" | "prunedDates",
    value: string,
  ) => {
    const dates = value
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .map((entry) => (entry.includes("T") ? entry.slice(0, 10) : entry))
      .filter(Boolean);
    updateField(field, dates);
  };

  const dateListValue = (dates: string[]) => dates.join("\n");

  const updateIntervalField = (
    field: "waterIntervalDays" | "fertilizeIntervalDays" | "pruneIntervalDays",
    value: string,
  ) => {
    const trimmed = value.trim();
    updateField(field, trimmed.length ? Number.parseInt(trimmed, 10) : null);
  };

  const intervalValue = (value: number | null) =>
    value === null ? "" : String(value);

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
                  Planted on
                  <input
                    type="date"
                    value={draft.plantedOn}
                    onChange={(event) =>
                      updateField("plantedOn", event.target.value)
                    }
                  />
                </label>
                <label>
                  Watered dates (one per line)
                  <textarea
                    rows={4}
                    value={dateListValue(draft.wateredDates)}
                    onChange={(event) =>
                      updateDateListField("wateredDates", event.target.value)
                    }
                  />
                </label>
                <label>
                  Fertilized dates (one per line)
                  <textarea
                    rows={4}
                    value={dateListValue(draft.fertilizedDates)}
                    onChange={(event) =>
                      updateDateListField("fertilizedDates", event.target.value)
                    }
                  />
                </label>
                <label>
                  Pruned dates (one per line)
                  <textarea
                    rows={4}
                    value={dateListValue(draft.prunedDates)}
                    onChange={(event) =>
                      updateDateListField("prunedDates", event.target.value)
                    }
                  />
                </label>
                <label>
                  Watering cadence (days, optional)
                  <input
                    type="number"
                    min="1"
                    value={intervalValue(draft.waterIntervalDays)}
                    onChange={(event) =>
                      updateIntervalField(
                        "waterIntervalDays",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Fertilizing cadence (days, optional)
                  <input
                    type="number"
                    min="1"
                    value={intervalValue(draft.fertilizeIntervalDays)}
                    onChange={(event) =>
                      updateIntervalField(
                        "fertilizeIntervalDays",
                        event.target.value,
                      )
                    }
                  />
                </label>
                <label>
                  Pruning cadence (days, optional)
                  <input
                    type="number"
                    min="1"
                    value={intervalValue(draft.pruneIntervalDays)}
                    onChange={(event) =>
                      updateIntervalField(
                        "pruneIntervalDays",
                        event.target.value,
                      )
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
              <p>{plant ? formatPlantAge(plant.plantedOn) : "Age: Not set"}</p>
              <p>{plant?.notes}</p>
            </div>
            <div className="landingHighlights">
              <div className="highlightCard">
                <h3>Location</h3>
                <p>{plant?.location}</p>
              </div>
              <div className="highlightCard">
                <h3>Next task</h3>
                <p>{plant ? nextTaskForPlant(plant) : "No tasks scheduled"}</p>
              </div>
              <div className="highlightCard">
                <h3>Planted on</h3>
                <p>
                  {plant?.plantedOn
                    ? formatDisplayDate(plant.plantedOn)
                    : "Not set"}
                </p>
              </div>
              <div className="highlightCard">
                <h3>Last watered</h3>
                <p>
                  {plant?.wateredDates?.length
                    ? formatDisplayDate(latestDate(plant.wateredDates))
                    : "Not yet"}
                </p>
              </div>
              <div className="highlightCard">
                <h3>Last fertilized</h3>
                <p>
                  {plant?.fertilizedDates?.length
                    ? formatDisplayDate(latestDate(plant.fertilizedDates))
                    : "Not yet"}
                </p>
              </div>
              <div className="highlightCard">
                <h3>Last pruned</h3>
                <p>
                  {plant?.prunedDates?.length
                    ? formatDisplayDate(latestDate(plant.prunedDates))
                    : "Not yet"}
                </p>
              </div>
            </div>
            {error && <div className="profileFooter">{error}</div>}
          </section>
        )}
      </div>
    </div>
  );
}
