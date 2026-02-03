"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { createPlant, type PlantInput } from "@/lib/plants";

const emptyPlant: PlantInput = {
  name: "",
  variety: "",
  location: "",
  status: "",
  nextTask: "",
  plantedOn: "",
  wateredDates: [],
  fertilizedDates: [],
  prunedDates: [],
  waterIntervalDays: null,
  fertilizeIntervalDays: null,
  pruneIntervalDays: null,
  notes: "",
};

export default function NewPlantPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plant, setPlant] = useState<PlantInput>(emptyPlant);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  const isValid = useMemo(() => plant.name.trim().length > 0, [plant.name]);

  const updateField = <K extends keyof PlantInput>(
    field: K,
    value: PlantInput[K],
  ) => {
    setPlant((prev) => ({ ...prev, [field]: value }));
  };

  const updateDateListField = (
    field: "wateredDates" | "fertilizedDates",
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
    if (!isValid || isSaving) return;
    setIsSaving(true);
    setError("");

    try {
      const created = await createPlant(plant);
      router.push(`/my-garden/plants/${created.id}`);
    } catch {
      setError("Could not save plant. Please try again.");
      setIsSaving(false);
    }
  };

  if (status !== "authenticated") {
    return null;
  }

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">Add plant</span>
            <Link className="authGhostButton" href="/my-garden">
              Back to my garden
            </Link>
          </div>
          <h1>Create a new plant.</h1>
          <p>Capture the basics so you can track tasks and progress.</p>
        </header>

        <section className="settingsPanel" aria-live="polite">
          <div className="profileHeader">
            <h3>Plant details</h3>
            <div className="profileActions">
              <button
                type="button"
                className="profileSaveButton"
                onClick={handleSave}
                disabled={!isValid || isSaving}
              >
                {isSaving ? "Saving" : "Save plant"}
              </button>
            </div>
          </div>
          <div className="profileBody">
            <div className="profileFields">
              <label>
                Name
                <input
                  type="text"
                  value={plant.name}
                  onChange={(event) =>
                    updateField("name", event.target.value)
                  }
                  placeholder="Tomato, Lavender, Basil"
                />
              </label>
              <label>
                Variety
                <input
                  type="text"
                  value={plant.variety}
                  onChange={(event) =>
                    updateField("variety", event.target.value)
                  }
                  placeholder="Sun Gold, Genovese, Hidcote"
                />
              </label>
              <label>
                Location
                <input
                  type="text"
                  value={plant.location}
                  onChange={(event) =>
                    updateField("location", event.target.value)
                  }
                  placeholder="Raised bed 2, Balcony pots"
                />
              </label>
              <label>
                Status
                <input
                  type="text"
                  value={plant.status}
                  onChange={(event) =>
                    updateField("status", event.target.value)
                  }
                  placeholder="Seeded, Thriving, Harvest ready"
                />
              </label>
              <label>
                Next task
                <input
                  type="text"
                  value={plant.nextTask}
                  onChange={(event) =>
                    updateField("nextTask", event.target.value)
                  }
                  placeholder="Water tomorrow, Thin seedlings"
                />
              </label>
              <label>
                Planted on
                <input
                  type="date"
                  value={plant.plantedOn}
                  onChange={(event) =>
                    updateField("plantedOn", event.target.value)
                  }
                />
              </label>
              <label>
                Watered dates (one per line)
                <textarea
                  rows={4}
                  value={dateListValue(plant.wateredDates)}
                  onChange={(event) =>
                    updateDateListField("wateredDates", event.target.value)
                  }
                  placeholder="2026-02-01"
                />
              </label>
              <label>
                Fertilized dates (one per line)
                <textarea
                  rows={4}
                  value={dateListValue(plant.fertilizedDates)}
                  onChange={(event) =>
                    updateDateListField("fertilizedDates", event.target.value)
                  }
                  placeholder="2026-02-01"
                />
              </label>
              <label>
                Pruned dates (one per line)
                <textarea
                  rows={4}
                  value={dateListValue(plant.prunedDates)}
                  onChange={(event) =>
                    updateDateListField("prunedDates", event.target.value)
                  }
                  placeholder="2026-02-01"
                />
              </label>
              <label>
                Watering cadence (days, optional)
                <input
                  type="number"
                  min="1"
                  value={intervalValue(plant.waterIntervalDays)}
                  onChange={(event) =>
                    updateIntervalField("waterIntervalDays", event.target.value)
                  }
                  placeholder="7"
                />
              </label>
              <label>
                Fertilizing cadence (days, optional)
                <input
                  type="number"
                  min="1"
                  value={intervalValue(plant.fertilizeIntervalDays)}
                  onChange={(event) =>
                    updateIntervalField(
                      "fertilizeIntervalDays",
                      event.target.value,
                    )
                  }
                  placeholder="30"
                />
              </label>
              <label>
                Pruning cadence (days, optional)
                <input
                  type="number"
                  min="1"
                  value={intervalValue(plant.pruneIntervalDays)}
                  onChange={(event) =>
                    updateIntervalField("pruneIntervalDays", event.target.value)
                  }
                  placeholder="45"
                />
              </label>
              <label>
                Notes
                <textarea
                  rows={4}
                  value={plant.notes}
                  onChange={(event) =>
                    updateField("notes", event.target.value)
                  }
                  placeholder="Soil mix, sun exposure, reminders."
                />
              </label>
            </div>
            {error && <div className="profileFooter">{error}</div>}
          </div>
        </section>
      </div>
    </div>
  );
}
