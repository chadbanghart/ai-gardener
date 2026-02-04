"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import type { ChatSummary } from "@/lib/chats";
import { fetchChatSummaries } from "@/lib/chats";
import type { PlantRecord } from "@/lib/plants";
import {
  deletePlant,
  fetchPlantById,
  fetchPlants,
  updatePlant,
} from "@/lib/plants";

export default function PlantDetailPage() {
  const { status } = useSession();
  const router = useRouter();
  const params = useParams();
  const [plant, setPlant] = useState<PlantRecord | null>(null);
  const [draft, setDraft] = useState<PlantRecord | null>(null);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; id?: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [locationOptions, setLocationOptions] = useState<string[]>([]);
  const [locationMode, setLocationMode] = useState<"select" | "new">("select");
  const [newLocation, setNewLocation] = useState("");
  const [hasTouchedLocation, setHasTouchedLocation] = useState(false);
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

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchChatSummaries()
      .then(setChats)
      .catch(() => setChats([]));
  }, [status]);

  useEffect(() => {
    if (status !== "authenticated") return;
    fetchPlants()
      .then((plants) => {
        const unique = Array.from(
          new Set(
            plants
              .map((entry) => entry.location.trim())
              .filter((entry) => entry.length > 0),
          ),
        ).sort((a, b) => a.localeCompare(b));
        setLocationOptions(unique);
      })
      .catch(() => setLocationOptions([]));
  }, [status]);

  useEffect(() => {
    if (!isEditing) return;
    setHasTouchedLocation(false);
  }, [isEditing]);

  const resolvedLocationMode = useMemo(() => {
    if (!isEditing) return locationMode;
    if (hasTouchedLocation) return locationMode;
    if (!locationOptions.length) return "new";
    const current = draft?.location.trim() ?? "";
    if (current && locationOptions.includes(current)) return "select";
    if (current) return "new";
    return "select";
  }, [
    isEditing,
    hasTouchedLocation,
    locationMode,
    locationOptions,
    draft?.location,
  ]);

  const resolvedNewLocation =
    isEditing &&
    !hasTouchedLocation &&
    resolvedLocationMode === "new" &&
    draft
      ? draft.location
      : newLocation;

  const linkedChatTitle = useMemo(() => {
    if (!plant?.chatId) return "";
    return chats.find((chat) => chat.id === plant.chatId)?.title ?? "";
  }, [chats, plant?.chatId]);

  useEffect(() => {
    if (!isChatOpen || !plant?.chatId) return;
    setIsChatLoading(true);
    setChatError("");
    fetch(`/api/chats/${plant.chatId}`)
      .then(async (response) => {
        if (!response.ok) {
          if (response.status === 401) return { messages: [] };
          throw new Error("Failed to load chat.");
        }
        return (await response.json()) as {
          messages?: Array<{
            role: "user" | "assistant";
            content: string;
            id?: string;
          }>;
        };
      })
      .then((data) => {
        const nextMessages = Array.isArray(data.messages)
          ? data.messages
          : [];
        setChatMessages(nextMessages);
      })
      .catch(() => {
        setChatMessages([]);
        setChatError("Could not load chat. Try again.");
      })
      .finally(() => {
        setIsChatLoading(false);
        requestAnimationFrame(() => {
          chatInputRef.current?.focus({ preventScroll: true });
        });
      });
  }, [isChatOpen, plant?.chatId]);

  useEffect(() => {
    if (!isChatOpen) return;
    const node = chatListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatMessages, isChatOpen]);

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

  const handleLocationSelect = (value: string) => {
    setHasTouchedLocation(true);
    if (value === "__new__") {
      setLocationMode("new");
      if (draft && !newLocation.trim()) {
        setNewLocation(draft.location);
        updateField("location", draft.location);
      } else {
        updateField("location", newLocation);
      }
      return;
    }
    setLocationMode("select");
    updateField("location", value);
  };

  const handleNewLocationChange = (value: string) => {
    setHasTouchedLocation(true);
    setNewLocation(value);
    updateField("location", value);
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

  const handleChatToggle = () => {
    if (!plant?.chatId) return;
    setIsChatOpen((prev) => !prev);
  };

  const handleChatSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatSending || !plant?.chatId) return;
    setIsChatSending(true);
    setChatError("");
    setChatInput("");

    const userMessage = { role: "user" as const, content: trimmed };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, chatId: plant.chatId }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Request failed");
      }
      const data = (await response.json()) as {
        reply?: string;
      };
      const reply =
        typeof data.reply === "string"
          ? data.reply
          : "I ran into trouble crafting a reply. Try again with more detail.";
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: reply },
      ]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't respond. Try again with details like plant type, sun hours, and last watering.",
        },
      ]);
    } finally {
      setIsChatSending(false);
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
                  <select
                    value={
                      resolvedLocationMode === "new"
                        ? "__new__"
                        : draft.location || ""
                    }
                    onChange={(event) =>
                      handleLocationSelect(event.target.value)
                    }
                  >
                    <option value="">
                      {locationOptions.length
                        ? "Select a location"
                        : "No saved locations"}
                    </option>
                    {locationOptions.map((location) => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                    <option value="__new__">Add a new location</option>
                  </select>
                  {resolvedLocationMode === "new" && (
                    <input
                      type="text"
                      value={resolvedNewLocation}
                      onChange={(event) =>
                        handleNewLocationChange(event.target.value)
                      }
                      placeholder="Raised bed 2, Balcony pots"
                    />
                  )}
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
                  Related chat (optional)
                  <select
                    value={draft.chatId}
                    onChange={(event) =>
                      updateField("chatId", event.target.value)
                    }
                  >
                    <option value="">No chat linked</option>
                    {chats.map((chat) => (
                      <option key={chat.id} value={chat.id}>
                        {chat.title}
                      </option>
                    ))}
                  </select>
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
              {plant?.chatId ? (
                <button
                  type="button"
                  className="highlightCard highlightCardButton"
                  onClick={() => setIsChatOpen(true)}
                >
                  <h3>Related chat</h3>
                  <p>{linkedChatTitle || "Open chat"}</p>
                  <span className="highlightHint">View conversation</span>
                </button>
              ) : (
                <div className="highlightCard">
                  <h3>Related chat</h3>
                  <p>Not linked</p>
                </div>
              )}
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
      {plant?.chatId && (
        <div className={`floatingChat ${isChatOpen ? "open" : ""}`}>
          {!isChatOpen && (
            <button
              type="button"
              className="floatingChatButton"
              onClick={handleChatToggle}
            >
              Open chat
            </button>
          )}
          {isChatOpen && (
            <div className="floatingChatPanel" role="dialog" aria-live="polite">
              <div className="floatingChatHeader">
                <div>
                  <p className="floatingChatEyebrow">Related chat</p>
                  <h4>{linkedChatTitle || "Garden chat"}</h4>
                </div>
                <button
                  type="button"
                  className="floatingChatClose"
                  onClick={handleChatToggle}
                >
                  Close
                </button>
              </div>
              <div className="floatingChatBody">
                <div className="messageList" ref={chatListRef}>
                  {isChatLoading ? (
                    <div className="message assistant" aria-busy="true">
                      <span className="messageRole">Garden AI</span>
                      <div className="typingDots">
                        <span />
                        <span />
                        <span />
                      </div>
                    </div>
                  ) : chatMessages.length === 0 ? (
                    <div className="message assistant">
                      <span className="messageRole">Garden AI</span>
                      <p>No messages yet. Say hello to start the chat.</p>
                    </div>
                  ) : (
                    chatMessages.map((message, index) => (
                      <div
                        key={message.id ?? `${message.role}-${index}`}
                        className={`message ${message.role}`}
                      >
                        <span className="messageRole">
                          {message.role === "user" ? "You" : "Garden AI"}
                        </span>
                        <p>{message.content}</p>
                      </div>
                    ))
                  )}
                </div>
                {chatError && <p className="helperText">{chatError}</p>}
                <form className="composer" onSubmit={handleChatSubmit}>
                  <input
                    ref={chatInputRef}
                    type="text"
                    name="message"
                    placeholder="Ask about this plant..."
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                  />
                  <button type="submit" disabled={isChatSending}>
                    {isChatSending ? "Sending..." : "Send"}
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
