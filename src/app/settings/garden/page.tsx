"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type GardenLocation = {
  id: string;
  name: string;
  settingType: string;
  soilType: string;
  soilPh: string;
  sunAmount: string[];
  notes: string;
};

type GardenDraft = {
  name: string;
  settingType: string;
  soilType: string;
  soilPh: string;
  sunAmount: string[];
  notes: string;
};

const emptyDraft: GardenDraft = {
  name: "",
  settingType: "",
  soilType: "",
  soilPh: "",
  sunAmount: [],
  notes: "",
};

const typeOptions = [
  "Raised bed",
  "In-ground bed",
  "Container",
  "Seedling starter",
  "Trees",
  "Other",
];

const sunOptions = [
  "Full sun",
  "Part sun",
  "Part shade",
  "Shade",
  "Mixed",
];

export default function GardenSettingsPage() {
  const { status } = useSession();
  const isAuthed = status === "authenticated";
  const router = useRouter();
  const [locations, setLocations] = useState<GardenLocation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, GardenDraft>>({});
  const [newDraft, setNewDraft] = useState<GardenDraft>(emptyDraft);
  const [statusMessage, setStatusMessage] = useState("");

  const canAdd = useMemo(
    () => Boolean(newDraft.name.trim() && newDraft.settingType.trim()),
    [newDraft.name, newDraft.settingType],
  );

  const loadLocations = async () => {
    setIsLoading(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/garden-locations");
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error("Failed to load locations");
      }
      const data = (await response.json()) as { locations?: GardenLocation[] };
      setLocations(data.locations ?? []);
    } catch {
      setLocations([]);
      setStatusMessage("Could not load garden settings.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthed) {
      void loadLocations();
      return;
    }
    if (status === "unauthenticated") {
      setLocations([]);
      setStatusMessage("");
      router.replace("/");
    }
  }, [isAuthed, status, router]);

  const updateNewDraft = (field: keyof GardenDraft, value: string) => {
    setNewDraft((current) => ({ ...current, [field]: value }));
  };

  const updateDraft = (id: string, field: keyof GardenDraft, value: string) => {
    setDrafts((current) => ({
      ...current,
      [id]: { ...current[id], [field]: value },
    }));
  };

  const toggleNewSunAmount = (value: string) => {
    setNewDraft((current) => {
      const selected = new Set(current.sunAmount);
      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }
      return { ...current, sunAmount: Array.from(selected) };
    });
  };

  const toggleDraftSunAmount = (id: string, value: string) => {
    setDrafts((current) => {
      const selected = new Set(current[id]?.sunAmount ?? []);
      if (selected.has(value)) {
        selected.delete(value);
      } else {
        selected.add(value);
      }
      return {
        ...current,
        [id]: { ...current[id], sunAmount: Array.from(selected) },
      };
    });
  };

  const startEditing = (location: GardenLocation) => {
    setEditingId(location.id);
    setDrafts((current) => ({
      ...current,
      [location.id]: {
        name: location.name,
        settingType: location.settingType,
        soilType: location.soilType ?? "",
        soilPh: location.soilPh ?? "",
        sunAmount: location.sunAmount ?? [],
        notes: location.notes ?? "",
      },
    }));
    setStatusMessage("");
  };

  const cancelEditing = () => {
    setEditingId(null);
  };

  const addLocation = async () => {
    if (!isAuthed || isSaving || !canAdd) return;
    setIsSaving(true);
    setStatusMessage("");
    try {
      const response = await fetch("/api/garden-locations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newDraft.name,
          settingType: newDraft.settingType,
          soilType: newDraft.soilType,
          soilPh: newDraft.soilPh,
          sunAmount: newDraft.sunAmount,
          notes: newDraft.notes,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save location");
      }
      const data = (await response.json()) as { location: GardenLocation };
      setLocations((current) => [data.location, ...current]);
      setNewDraft(emptyDraft);
      setStatusMessage("Garden location added.");
    } catch {
      setStatusMessage("Save failed. Try again.");
    } finally {
      setIsSaving(false);
    }
  };

  const saveEdits = async (location: GardenLocation) => {
    if (!isAuthed || !editingId) return;
    const draft = drafts[location.id];
    if (!draft?.name.trim() || !draft?.settingType.trim()) {
      setStatusMessage("Name and type are required.");
      return;
    }
    setStatusMessage("");
    try {
      const response = await fetch(`/api/garden-locations/${location.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: draft.name,
          settingType: draft.settingType,
          soilType: draft.soilType,
          soilPh: draft.soilPh,
          sunAmount: draft.sunAmount,
          notes: draft.notes,
        }),
      });
      if (!response.ok) {
        throw new Error("Failed to save edits");
      }
      const data = (await response.json()) as { location: GardenLocation };
      setLocations((current) =>
        current.map((item) =>
          item.id === location.id ? data.location : item,
        ),
      );
      setEditingId(null);
      setStatusMessage("Garden location updated.");
    } catch {
      setStatusMessage("Save failed. Try again.");
    }
  };

  const deleteLocation = async (location: GardenLocation) => {
    if (!isAuthed || isDeletingId) return;
    setIsDeletingId(location.id);
    setStatusMessage("");
    try {
      const response = await fetch(`/api/garden-locations/${location.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete");
      }
      setLocations((current) =>
        current.filter((item) => item.id !== location.id),
      );
      if (editingId === location.id) {
        setEditingId(null);
      }
      setStatusMessage("Garden location removed.");
    } catch {
      setStatusMessage("Delete failed. Try again.");
    } finally {
      setIsDeletingId(null);
    }
  };

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">Settings / Garden</span>
            {isAuthed && (
              <Link className="authGhostButton" href="/settings">
                Back to settings
              </Link>
            )}
          </div>
          <h1>Garden settings.</h1>
          <p>
            Track each growing space so Garden AI can remember what you have in
            the ground, on the patio, or in trays.
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
            <h2>Log in to update your garden settings.</h2>
            <p>Sign in to save your garden locations.</p>
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
          <div className="settingsStack">
            <section className="settingsPanel" aria-live="polite">
              <div className="profileHeader">
                <h3>Add a garden location</h3>
                <div className="profileActions">
                  <button
                    type="button"
                    className="profileSaveButton"
                    onClick={addLocation}
                    disabled={isSaving || isLoading || !canAdd}
                  >
                    {isSaving ? "Saving" : "Add location"}
                  </button>
                </div>
              </div>
              <div className="profileBody">
                <div className="profileFields">
                  <label>
                    Location name
                    <input
                      type="text"
                      value={newDraft.name}
                      onChange={(event) =>
                        updateNewDraft("name", event.target.value)
                      }
                      placeholder="Backyard, side yard, patio..."
                      disabled={isLoading}
                    />
                  </label>
                  <label>
                    Type
                    <select
                      value={newDraft.settingType}
                      onChange={(event) =>
                        updateNewDraft("settingType", event.target.value)
                      }
                      disabled={isLoading}
                    >
                      <option value="">Select</option>
                      {typeOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="profileGroup">
                    <span className="profileGroupLabel">Sun amount</span>
                    <div className="checkboxGroup" role="group">
                      {sunOptions.map((option) => (
                        <label key={option} className="checkboxOption">
                          <input
                            type="checkbox"
                            checked={newDraft.sunAmount.includes(option)}
                            onChange={() => toggleNewSunAmount(option)}
                            disabled={isLoading}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label>
                    Soil type
                    <input
                      type="text"
                      value={newDraft.soilType}
                      onChange={(event) =>
                        updateNewDraft("soilType", event.target.value)
                      }
                      placeholder="Loam, sandy, clay..."
                      disabled={isLoading}
                    />
                  </label>
                  <label>
                    Soil pH
                    <input
                      type="text"
                      value={newDraft.soilPh}
                      onChange={(event) =>
                        updateNewDraft("soilPh", event.target.value)
                      }
                      placeholder="6.2, neutral, acidic..."
                      disabled={isLoading}
                    />
                  </label>
                  <label className="profileNotes">
                    Notes
                    <textarea
                      value={newDraft.notes}
                      onChange={(event) =>
                        updateNewDraft("notes", event.target.value)
                      }
                      placeholder="Soil mix, key crops, notes..."
                      rows={3}
                      disabled={isLoading}
                    />
                  </label>
                </div>
                {isLoading && (
                  <div className="profileFooter">Loading locations...</div>
                )}
                {statusMessage && (
                  <div className="profileFooter">{statusMessage}</div>
                )}
              </div>
            </section>

            <section className="settingsPanel">
              <div className="profileHeader">
                <h3>Saved locations</h3>
              </div>
              <div className="profileBody">
                {locations.length === 0 && !isLoading && (
                  <div className="profileFooter">
                    Add a location to start tracking your garden spaces.
                  </div>
                )}
                <div className="gardenList">
                  {locations.map((location) => {
                    const isEditing = editingId === location.id;
                    const draft = drafts[location.id];
                    return (
                      <div key={location.id} className="gardenCard">
                        <div className="gardenMeta">
                          <span className="gardenPill">
                            {location.settingType}
                          </span>
                        </div>
                        <div className="profileFields">
                          <label>
                            Name
                            <input
                              type="text"
                              value={isEditing ? draft?.name ?? "" : location.name}
                              onChange={(event) =>
                                updateDraft(
                                  location.id,
                                  "name",
                                  event.target.value,
                                )
                              }
                              disabled={!isEditing}
                            />
                          </label>
                          <label>
                            Type
                            <select
                              value={
                                isEditing
                                  ? draft?.settingType ?? ""
                                  : location.settingType
                              }
                              onChange={(event) =>
                                updateDraft(
                                  location.id,
                                  "settingType",
                                  event.target.value,
                                )
                              }
                              disabled={!isEditing}
                            >
                              <option value="">Select</option>
                              {typeOptions.map((option) => (
                                <option key={option} value={option}>
                                  {option}
                                </option>
                              ))}
                            </select>
                          </label>
                          <div className="profileGroup">
                            <span className="profileGroupLabel">Sun amount</span>
                            <div className="checkboxGroup" role="group">
                              {sunOptions.map((option) => (
                                <label key={option} className="checkboxOption">
                                  <input
                                    type="checkbox"
                                    checked={
                                      (isEditing
                                        ? draft?.sunAmount
                                        : location.sunAmount
                                      )?.includes(option) ?? false
                                    }
                                    onChange={() =>
                                      toggleDraftSunAmount(location.id, option)
                                    }
                                    disabled={!isEditing}
                                  />
                                  <span>{option}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                          <label>
                            Soil type
                            <input
                              type="text"
                              value={
                                isEditing
                                  ? draft?.soilType ?? ""
                                  : location.soilType ?? ""
                              }
                              onChange={(event) =>
                                updateDraft(
                                  location.id,
                                  "soilType",
                                  event.target.value,
                                )
                              }
                              disabled={!isEditing}
                            />
                          </label>
                          <label>
                            Soil pH
                            <input
                              type="text"
                              value={
                                isEditing
                                  ? draft?.soilPh ?? ""
                                  : location.soilPh ?? ""
                              }
                              onChange={(event) =>
                                updateDraft(
                                  location.id,
                                  "soilPh",
                                  event.target.value,
                                )
                              }
                              disabled={!isEditing}
                            />
                          </label>
                          <label className="profileNotes">
                            Notes
                            <textarea
                              value={
                                isEditing ? draft?.notes ?? "" : location.notes
                              }
                              onChange={(event) =>
                                updateDraft(
                                  location.id,
                                  "notes",
                                  event.target.value,
                                )
                              }
                              rows={3}
                              disabled={!isEditing}
                            />
                          </label>
                        </div>
                        <div className="gardenActions">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                className="gardenButton"
                                onClick={() => saveEdits(location)}
                              >
                                Save
                              </button>
                              <button
                                type="button"
                                className="gardenButtonSecondary"
                                onClick={cancelEditing}
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="gardenButton"
                                onClick={() => startEditing(location)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="gardenButtonDanger"
                                onClick={() => deleteLocation(location)}
                                disabled={isDeletingId === location.id}
                              >
                                {isDeletingId === location.id ? "Deleting" : "Delete"}
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
