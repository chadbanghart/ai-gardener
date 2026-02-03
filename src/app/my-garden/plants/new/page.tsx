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

  const updateField = (field: keyof PlantInput, value: string) => {
    setPlant((prev) => ({ ...prev, [field]: value }));
  };

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
