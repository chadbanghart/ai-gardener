"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import type { PlantRecord } from "@/lib/plants";
import { deletePlant, fetchPlants } from "@/lib/plants";
import { fetchChatSummaries, type ChatSummary } from "@/lib/chats";
import {
  createWishListItem,
  deleteWishListItem,
  fetchWishListItems,
  type WishListItem,
  updateWishListItem,
} from "@/lib/wishLists";

type NextReminder = { date: string; plantName: string };

const MAX_REMINDER_DAYS = 60;
const WATER_INTERVAL_DAYS = 7;
const FERTILIZE_INTERVAL_DAYS = 30;

const parseLocalDate = (value: string) => {
  const trimmed = value.includes("T") ? value.slice(0, 10) : value;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatDateKey = (value: Date) =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getDate()).padStart(2, "0")}`;

const formatDisplayDate = (value: string) => {
  const parsed = parseLocalDate(value);
  return parsed
    ? parsed.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      })
    : value;
};

const formatShortDate = (value: Date) =>
  value.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

const abbreviateName = (value: string, maxLength = 9) =>
  value.length > maxLength ? `${value.slice(0, maxLength - 1)}…` : value;

const reminderInitial = (value: string) => {
  const trimmed = value.trim();
  return trimmed ? trimmed[0].toUpperCase() : "?";
};

const latestDate = (dates: string[]) =>
  dates.length ? ([...dates].sort().at(-1) ?? "") : "";

const addDays = (value: Date, days: number) => {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
};

const nextDueDate = (
  baseValue: string | null,
  intervalDays: number | null,
  startOfToday: Date,
) => {
  if (!baseValue || !intervalDays) return null;
  const base = parseLocalDate(baseValue);
  if (!base) return null;
  let next = addDays(base, intervalDays);
  while (next < startOfToday) {
    next = addDays(next, intervalDays);
  }
  return next;
};

const formatTaskLabel = (task: string, date: Date, startOfToday: Date) => {
  const dateKey = formatDateKey(date);
  const todayKey = formatDateKey(startOfToday);
  return dateKey === todayKey
    ? `${task} today`
    : `${task} on ${formatShortDate(date)}`;
};

const nextTaskForPlant = (plant: PlantRecord, startOfToday: Date) => {
  const tasks: Array<{ label: string; date: Date }> = [];
  const waterBase = latestDate(plant.wateredDates) || plant.plantedOn;
  const fertilizeBase = latestDate(plant.fertilizedDates) || plant.plantedOn;
  const pruneBase = latestDate(plant.prunedDates) || plant.plantedOn;

  const waterNext = nextDueDate(
    waterBase,
    plant.waterIntervalDays ?? WATER_INTERVAL_DAYS,
    startOfToday,
  );
  if (waterNext) {
    tasks.push({ label: "Water", date: waterNext });
  }

  const fertilizeNext = nextDueDate(
    fertilizeBase,
    plant.fertilizeIntervalDays ?? FERTILIZE_INTERVAL_DAYS,
    startOfToday,
  );
  if (fertilizeNext) {
    tasks.push({ label: "Fertilize", date: fertilizeNext });
  }

  const pruneNext = nextDueDate(
    pruneBase,
    plant.pruneIntervalDays ?? null,
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

const reminderDatesInRange = (
  base: Date,
  intervalDays: number,
  startOfToday: Date,
  reminderHorizon: Date,
) => {
  const dates: Date[] = [];
  let next = addDays(base, intervalDays);
  while (next < startOfToday) {
    next = addDays(next, intervalDays);
  }
  while (next <= reminderHorizon) {
    dates.push(next);
    next = addDays(next, intervalDays);
  }
  return dates;
};

const wishLists = [
  {
    id: "spring",
    season: "Spring",
    note: "Soil warming",
  },
  {
    id: "summer",
    season: "Summer",
    note: "Heat lovers",
  },
  {
    id: "fall",
    season: "Fall",
    note: "Cool-season harvest",
  },
  {
    id: "winter",
    season: "Winter",
    note: "Indoor starts",
  },
];

export default function MyGardenPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plants, setPlants] = useState<PlantRecord[] | null>(null);
  const [error, setError] = useState("");
  const [deletingPlantId, setDeletingPlantId] = useState<string | null>(null);
  const [wishListsData, setWishListsData] = useState<
    Record<string, WishListItem[]>
  >(
    wishLists.reduce(
      (acc, list) => ({ ...acc, [list.id]: [] }),
      {} as Record<string, WishListItem[]>,
    ),
  );
  const [wishDrafts, setWishDrafts] = useState<
    Record<string, { name: string; timing: string }>
  >(
    wishLists.reduce(
      (acc, list) => ({ ...acc, [list.id]: { name: "", timing: "" } }),
      {} as Record<string, { name: string; timing: string }>,
    ),
  );
  const [wishFormsOpen, setWishFormsOpen] = useState<Record<string, boolean>>(
    wishLists.reduce(
      (acc, list) => ({ ...acc, [list.id]: false }),
      {} as Record<string, boolean>,
    ),
  );
  const summerCardRef = useRef<HTMLElement | null>(null);
  const [wishCardMinHeight, setWishCardMinHeight] = useState<number | null>(
    null,
  );
  const [wishError, setWishError] = useState("");
  const [wishEditingId, setWishEditingId] = useState<string | null>(null);
  const [wishEditDrafts, setWishEditDrafts] = useState<
    Record<string, { name: string; timing: string }>
  >({});
  const [wishDeletingId, setWishDeletingId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<
    Array<{ role: "user" | "assistant"; content: string; id?: string }>
  >([]);
  const [chatInput, setChatInput] = useState("");
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [isChatSending, setIsChatSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [isFooterVisible, setIsFooterVisible] = useState(false);
  const [chatSummaries, setChatSummaries] = useState<ChatSummary[]>([]);
  const [isChatListOpen, setIsChatListOpen] = useState(false);
  const [isChatListLoading, setIsChatListLoading] = useState(false);
  const [chatListError, setChatListError] = useState("");
  const chatListRef = useRef<HTMLDivElement>(null);
  const chatInputRef = useRef<HTMLInputElement>(null);
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [showWaterReminders, setShowWaterReminders] = useState(true);
  const [showFertilizeReminders, setShowFertilizeReminders] = useState(true);
  const [showPruneReminders, setShowPruneReminders] = useState(true);
  const [locationFilter, setLocationFilter] = useState("all");
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  const todayDate = today.getDate();
  const startOfToday = new Date(todayYear, todayMonth, todayDate);
  const hasWaterFeature = (plants ?? []).some(
    (plant) => plant.plantedOn || plant.wateredDates.length > 0,
  );
  const hasFertilizeFeature = (plants ?? []).some(
    (plant) => plant.plantedOn || plant.fertilizedDates.length > 0,
  );
  const hasPruneFeature = (plants ?? []).some(
    (plant) => plant.pruneIntervalDays != null || plant.prunedDates.length > 0,
  );
  const hasPlantedFeature = (plants ?? []).some((plant) => plant.plantedOn);
  const hasAnyCareFilters =
    hasWaterFeature || hasFertilizeFeature || hasPruneFeature;
  const reminderHorizon = addDays(startOfToday, MAX_REMINDER_DAYS);
  const activeMonth = new Date(todayYear, todayMonth + monthOffset, 1);
  const calendarYear = activeMonth.getFullYear();
  const calendarMonth = activeMonth.getMonth();
  const calendarEvents = (() => {
    const events: Array<{
      date: string;
      label: string;
      plantName: string;
      kind:
        | "planted"
        | "watered"
        | "fertilized"
        | "reminder-water"
        | "reminder-fertilize"
        | "pruned"
        | "reminder-prune";
      isReminder?: boolean;
    }> = [];
    (plants ?? []).forEach((plant) => {
      if (plant.plantedOn) {
        events.push({
          date: plant.plantedOn,
          label: "Planted",
          plantName: plant.name,
          kind: "planted",
        });
      }

      plant.wateredDates.forEach((date) => {
        events.push({
          date,
          label: "Watered",
          plantName: plant.name,
          kind: "watered",
        });
      });

      plant.fertilizedDates.forEach((date) => {
        events.push({
          date,
          label: "Fertilized",
          plantName: plant.name,
          kind: "fertilized",
        });
      });

      plant.prunedDates.forEach((date) => {
        events.push({
          date,
          label: "Pruned",
          plantName: plant.name,
          kind: "pruned",
        });
      });

      const waterBase = latestDate(plant.wateredDates) || plant.plantedOn;
      const fertilizeBase =
        latestDate(plant.fertilizedDates) || plant.plantedOn;
      const pruneBase = latestDate(plant.prunedDates) || plant.plantedOn;

      if (waterBase && showWaterReminders) {
        const base = parseLocalDate(waterBase);
        if (base) {
          const interval = plant.waterIntervalDays ?? WATER_INTERVAL_DAYS;
          const dates = reminderDatesInRange(
            base,
            interval,
            startOfToday,
            reminderHorizon,
          );
          dates.forEach((next) => {
            events.push({
              date: formatDateKey(next),
              label: "Water reminder",
              plantName: plant.name,
              kind: "reminder-water",
              isReminder: true,
            });
          });
        }
      }

      if (fertilizeBase && showFertilizeReminders) {
        const base = parseLocalDate(fertilizeBase);
        if (base) {
          const interval =
            plant.fertilizeIntervalDays ?? FERTILIZE_INTERVAL_DAYS;
          const dates = reminderDatesInRange(
            base,
            interval,
            startOfToday,
            reminderHorizon,
          );
          dates.forEach((next) => {
            events.push({
              date: formatDateKey(next),
              label: "Fertilize reminder",
              plantName: plant.name,
              kind: "reminder-fertilize",
              isReminder: true,
            });
          });
        }
      }

      if (pruneBase && showPruneReminders) {
        const base = parseLocalDate(pruneBase);
        const interval = plant.pruneIntervalDays ?? null;
        if (base && interval) {
          const dates = reminderDatesInRange(
            base,
            interval,
            startOfToday,
            reminderHorizon,
          );
          dates.forEach((next) => {
            events.push({
              date: formatDateKey(next),
              label: "Prune reminder",
              plantName: plant.name,
              kind: "reminder-prune",
              isReminder: true,
            });
          });
        }
      }
    });

    return events;
  })();

  const plantsByLocation = (() => {
    const map = new Map<string, PlantRecord[]>();
    (plants ?? []).forEach((plant) => {
      const location = plant.location.trim() || "Unassigned";
      const group = map.get(location) ?? [];
      group.push(plant);
      map.set(location, group);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  })();

  const locationOptions = plantsByLocation.map(([location]) => location);
  const filteredLocations =
    locationFilter === "all"
      ? plantsByLocation
      : plantsByLocation.filter(([location]) => location === locationFilter);

  const eventsByDate = (() => {
    const map = new Map<string, typeof calendarEvents>();
    calendarEvents.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  })();

  const upcomingReminders = (() => {
    const remindersByKind = new Map<string, typeof calendarEvents>();
    calendarEvents
      .filter((event) => event.isReminder)
      .forEach((event) => {
        const list = remindersByKind.get(event.kind) ?? [];
        list.push(event);
        remindersByKind.set(event.kind, list);
      });

    const categories = [
      {
        kind: "reminder-water" as const,
        label: "Water reminder",
        enabled: showWaterReminders,
        getBase: (plant: PlantRecord) =>
          latestDate(plant.wateredDates) || plant.plantedOn,
        getInterval: (plant: PlantRecord) =>
          plant.waterIntervalDays ?? WATER_INTERVAL_DAYS,
      },
      {
        kind: "reminder-fertilize" as const,
        label: "Fertilize reminder",
        enabled: showFertilizeReminders,
        getBase: (plant: PlantRecord) =>
          latestDate(plant.fertilizedDates) || plant.plantedOn,
        getInterval: (plant: PlantRecord) =>
          plant.fertilizeIntervalDays ?? FERTILIZE_INTERVAL_DAYS,
      },
      {
        kind: "reminder-prune" as const,
        label: "Prune reminder",
        enabled: showPruneReminders,
        getBase: (plant: PlantRecord) =>
          latestDate(plant.prunedDates) || plant.plantedOn,
        getInterval: (plant: PlantRecord) => plant.pruneIntervalDays ?? null,
      },
    ];

    const results: typeof calendarEvents = [];

    categories.forEach((category) => {
      if (!category.enabled) return;
      const existing = remindersByKind.get(category.kind) ?? [];
      if (existing.length > 0) {
        results.push(...existing);
        return;
      }

      let nextReminder: NextReminder | null = null;

      (plants ?? []).forEach((plant) => {
        const base = category.getBase(plant);
        const interval = category.getInterval(plant);
        const next = nextDueDate(base, interval, startOfToday);
        if (!next) return;
        if (next <= reminderHorizon) return;
        const dateKey = formatDateKey(next);
        if (!nextReminder || dateKey < nextReminder.date) {
          nextReminder = { date: dateKey, plantName: plant.name };
        }
      });

      if (!nextReminder) return;
      const { date, plantName } = nextReminder;
      results.push({
        date,
        label: category.label,
        plantName,
        kind: category.kind,
        isReminder: true,
      });
    });

    return results.sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5);
  })();

  const monthStart = new Date(calendarYear, calendarMonth, 1);
  const monthEnd = new Date(calendarYear, calendarMonth + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const startWeekday = monthStart.getDay();
  const calendarDays = Array.from(
    { length: startWeekday + daysInMonth },
    (_, index) => (index < startWeekday ? null : index - startWeekday + 1),
  );

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/");
    }
  }, [status, router]);

  useEffect(() => {
    if (status === "authenticated") {
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
          setPlants([]);
        });
    }
  }, [status]);

  useEffect(() => {
    if (status === "authenticated") {
      fetchWishListItems()
        .then((items) => {
          const grouped = wishLists.reduce(
            (acc, list) => ({ ...acc, [list.id]: [] }),
            {} as Record<string, WishListItem[]>,
          );
          items.forEach((item) => {
            if (grouped[item.season]) {
              grouped[item.season].push(item);
            }
          });
          setWishListsData(grouped);
          setWishError("");
        })
        .catch((err: unknown) => {
          const message =
            err instanceof Error
              ? err.message
              : "Could not load wish lists. Please try again.";
          setWishError(message);
          setWishListsData(
            wishLists.reduce(
              (acc, list) => ({ ...acc, [list.id]: [] }),
              {} as Record<string, WishListItem[]>,
            ),
          );
        });
    }
  }, [status]);

  useEffect(() => {
    if (wishCardMinHeight != null) return;
    const card = summerCardRef.current;
    if (!card) return;
    setWishCardMinHeight(card.offsetHeight);
  }, [wishCardMinHeight]);

  useEffect(() => {
    if (!isChatListOpen || status !== "authenticated") return;
    setIsChatListLoading(true);
    setChatListError("");
    fetchChatSummaries()
      .then(setChatSummaries)
      .catch(() => {
        setChatSummaries([]);
        setChatListError("Could not load chats. Try again.");
      })
      .finally(() => setIsChatListLoading(false));
  }, [isChatListOpen, status]);

  useEffect(() => {
    if (!isChatOpen || !activeChatId) return;
    setIsChatLoading(true);
    setChatError("");
    fetch(`/api/chats/${activeChatId}`)
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
  }, [isChatOpen, activeChatId]);

  useEffect(() => {
    if (!isChatOpen) return;
    const node = chatListRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [chatMessages, isChatOpen]);

  useEffect(() => {
    const footer = document.querySelector(".siteFooter");
    if (!footer || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        setIsFooterVisible(Boolean(entry?.isIntersecting));
      },
      { threshold: 0.1 },
    );
    observer.observe(footer);
    return () => observer.disconnect();
  }, []);

  const activeChatTitle = useMemo(() => {
    if (!activeChatId) return "";
    return chatSummaries.find((chat) => chat.id === activeChatId)?.title ?? "";
  }, [activeChatId, chatSummaries]);

  const handleDeletePlant = async (plant: PlantRecord) => {
    if (deletingPlantId) return;
    const confirmed = window.confirm(
      `Remove ${plant.name} from your garden? This cannot be undone.`,
    );
    if (!confirmed) return;

    setDeletingPlantId(plant.id);
    try {
      await deletePlant(plant.id);
      setPlants((current) =>
        current ? current.filter((item) => item.id !== plant.id) : current,
      );
      setError("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not delete plant. Please try again.";
      setError(message);
    } finally {
      setDeletingPlantId(null);
    }
  };

  const updateWishDraft = (
    listId: string,
    field: "name" | "timing",
    value: string,
  ) => {
    setWishDrafts((current) => ({
      ...current,
      [listId]: {
        ...current[listId],
        [field]: value,
      },
    }));
  };

  const updateWishEditDraft = (
    wishId: string,
    field: "name" | "timing",
    value: string,
  ) => {
    setWishEditDrafts((current) => ({
      ...current,
      [wishId]: {
        ...current[wishId],
        [field]: value,
      },
    }));
  };

  const addWishItem = async (listId: string) => {
    const draft = wishDrafts[listId];
    const name = draft?.name.trim();
    const timing = draft?.timing.trim();
    if (!name || !timing) return;

    try {
      const item = await createWishListItem({
        season: listId,
        name,
        timing,
      });
      setWishListsData((current) => ({
        ...current,
        [listId]: [item, ...(current[listId] ?? [])],
      }));
      setWishDrafts((current) => ({
        ...current,
        [listId]: { name: "", timing: "" },
      }));
      setWishFormsOpen((current) => ({
        ...current,
        [listId]: false,
      }));
      setWishError("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not save wish. Please try again.";
      setWishError(message);
    }
  };

  const startEditingWish = (item: WishListItem) => {
    setWishEditingId(item.id);
    setWishEditDrafts((current) => ({
      ...current,
      [item.id]: { name: item.name, timing: item.timing },
    }));
  };

  const cancelEditingWish = () => {
    setWishEditingId(null);
  };

  const saveWishEdits = async (item: WishListItem) => {
    const draft = wishEditDrafts[item.id];
    const name = draft?.name.trim();
    const timing = draft?.timing.trim();
    if (!name || !timing) return;

    try {
      const updated = await updateWishListItem(item.id, { name, timing });
      setWishListsData((current) => ({
        ...current,
        [item.season]: current[item.season].map((entry) =>
          entry.id === item.id ? updated : entry,
        ),
      }));
      setWishEditingId(null);
      setWishError("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not update wish. Please try again.";
      setWishError(message);
    }
  };

  const removeWishItem = async (item: WishListItem) => {
    if (wishDeletingId) return;
    const confirmed = window.confirm(
      `Remove ${item.name} from your wish list?`,
    );
    if (!confirmed) return;

    setWishDeletingId(item.id);
    try {
      await deleteWishListItem(item.id);
      setWishListsData((current) => ({
        ...current,
        [item.season]: current[item.season].filter(
          (entry) => entry.id !== item.id,
        ),
      }));
      if (wishEditingId === item.id) {
        setWishEditingId(null);
      }
      setWishError("");
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : "Could not delete wish. Please try again.";
      setWishError(message);
    } finally {
      setWishDeletingId(null);
    }
  };

  const handleChatToggle = () => {
    setIsChatOpen((prev) => !prev);
  };

  const handleChatListToggle = () => {
    setIsChatListOpen((prev) => !prev);
  };

  const handleSelectChat = (chatId: string) => {
    setActiveChatId(chatId);
    setChatMessages([]);
    setIsChatListOpen(false);
    if (!isChatOpen) {
      setIsChatOpen(true);
    }
  };

  const handleChatSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    const trimmed = chatInput.trim();
    if (!trimmed || isChatSending) return;
    setIsChatSending(true);
    setChatError("");
    setChatInput("");

    const userMessage = { role: "user" as const, content: trimmed };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: trimmed,
          chatId: activeChatId ?? undefined,
        }),
      });
      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Request failed");
      }
      const data = (await response.json()) as {
        reply?: string;
        chatId?: string | null;
      };
      if (data.chatId && data.chatId !== activeChatId) {
        setActiveChatId(data.chatId);
      }
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
            and seasonal notes.
          </p>
        </header>

        <section className="gardenSection" aria-labelledby="my-plants">
          <div className="sectionHeader">
            <div>
              <p className="sectionEyebrow">My plants</p>
            </div>
          </div>

          <div className="plantActions">
            <label className="locationFilter">
              <span>Filter by location</span>
              <select
                value={locationFilter}
                onChange={(event) => setLocationFilter(event.target.value)}
                aria-label="Filter plants by location"
              >
                <option value="all">All locations</option>
                {locationOptions.map((location) => (
                  <option key={location} value={location}>
                    {location}
                  </option>
                ))}
              </select>
            </label>
            <Link className="authButton" href="/my-garden/plants/new">
              Add Plant
            </Link>
          </div>

          {plants === null ? (
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
                Plant your first plant
              </Link>
            </div>
          ) : (
            <div className="locationGroups">
              {filteredLocations.map(([location, locationPlants]) => (
                <div className="locationGroup" key={location}>
                  <div className="locationHeader">
                    <div>
                      <h3>{location}</h3>
                      <p>{locationPlants.length} plants</p>
                    </div>
                  </div>
                  <div className="plantGrid">
                    {locationPlants.map((plant) => {
                      const locationLabel =
                        plant.location.trim() || "Unassigned";
                      return (
                        <div className="plantCard" key={plant.id}>
                          <button
                            type="button"
                            className="plantDeleteButton"
                            onClick={() => handleDeletePlant(plant)}
                            disabled={deletingPlantId === plant.id}
                            aria-label={`Delete ${plant.name}`}
                          >
                            ×
                          </button>
                          <Link
                            className="plantCardLink"
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
                              <strong>{locationLabel}</strong>
                            </div>
                            <div className="plantMeta">
                              <span>Next task</span>
                              <strong>
                                {nextTaskForPlant(plant, startOfToday)}
                              </strong>
                            </div>
                          </Link>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
          {error && <div className="profileFooter">{error}</div>}
        </section>

        <section className="gardenSection" aria-labelledby="care-calendar">
          <div className="sectionHeader">
            <div>
              <p className="sectionEyebrow">Care calendar</p>
            </div>
          </div>

          <div className="calendarLayout">
            <div className="calendarMain">
              <div className="calendarHeaderRow">
                <div className="calendarNavLeft">
                  <button
                    type="button"
                    className="authGhostButton"
                    onClick={() => setMonthOffset((prev) => prev - 1)}
                    aria-label="Previous month"
                  >
                    ←
                  </button>
                  <button
                    type="button"
                    className="authGhostButton"
                    onClick={() => setMonthOffset(0)}
                    disabled={monthOffset === 0}
                  >
                    This month
                  </button>
                  <button
                    type="button"
                    className="authGhostButton"
                    onClick={() => setMonthOffset((prev) => prev + 1)}
                    aria-label="Next month"
                  >
                    →
                  </button>
                </div>
                <div className="calendarLegendItems">
                  {hasWaterFeature && (
                    <span className="calendarLegendItem reminder-water">
                      Water
                    </span>
                  )}
                  {hasFertilizeFeature && (
                    <span className="calendarLegendItem reminder-fertilize">
                      Fertilize
                    </span>
                  )}
                  {hasPruneFeature && (
                    <span className="calendarLegendItem reminder-prune">
                      Prune
                    </span>
                  )}
                  {hasPlantedFeature && (
                    <span className="calendarLegendItem planted">Planted</span>
                  )}
                </div>
              </div>
              <div className="calendarGrid" role="grid">
                <div className="calendarMonthTitle">
                  {activeMonth.toLocaleDateString(undefined, {
                    month: "long",
                    year: "numeric",
                  })}
                </div>
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                  (label) => (
                    <div key={label} className="calendarWeekday">
                      {label}
                    </div>
                  ),
                )}
                {calendarDays.map((day, index) => {
                  if (!day) {
                    return (
                      <div
                        key={`empty-${index}`}
                        className="calendarCell isEmpty"
                        aria-hidden="true"
                      />
                    );
                  }
                  const dateKey = formatDateKey(
                    new Date(calendarYear, calendarMonth, day),
                  );
                  const events = eventsByDate.get(dateKey) ?? [];
                  const reminderCount = events.filter(
                    (event) => event.isReminder,
                  ).length;
                  const compactReminders = reminderCount > 3;
                  return (
                    <div key={dateKey} className="calendarCell">
                      <div className="calendarDay">{day}</div>
                      <div
                        className={`calendarEvents${
                          compactReminders ? " isCompactReminders" : ""
                        }`}
                      >
                        {events.map((event, eventIndex) => (
                          <span
                            key={`${event.kind}-${eventIndex}`}
                            className={`calendarEvent ${event.kind}${
                              compactReminders && event.isReminder
                                ? " isCompactReminder"
                                : ""
                            }`}
                            title={`${event.label} · ${event.plantName}`}
                          >
                            {compactReminders && event.isReminder
                              ? reminderInitial(event.plantName)
                              : abbreviateName(event.plantName)}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="calendarSidebar">
              <h3>Upcoming reminders</h3>
              {hasAnyCareFilters && (
                <div
                  className="calendarFilters"
                  role="group"
                  aria-label="Care filters"
                >
                  {hasWaterFeature && (
                    <label>
                      <input
                        type="checkbox"
                        checked={showWaterReminders}
                        onChange={(event) =>
                          setShowWaterReminders(event.target.checked)
                        }
                      />
                      Water
                    </label>
                  )}
                  {hasFertilizeFeature && (
                    <label>
                      <input
                        type="checkbox"
                        checked={showFertilizeReminders}
                        onChange={(event) =>
                          setShowFertilizeReminders(event.target.checked)
                        }
                      />
                      Fertilize
                    </label>
                  )}
                  {hasPruneFeature && (
                    <label>
                      <input
                        type="checkbox"
                        checked={showPruneReminders}
                        onChange={(event) =>
                          setShowPruneReminders(event.target.checked)
                        }
                      />
                      Prune
                    </label>
                  )}
                </div>
              )}
              {upcomingReminders.length === 0 ? (
                <p className="calendarEmpty">
                  Add a planted date or care history to see reminders here.
                </p>
              ) : (
                <ul className="calendarReminderList">
                  {upcomingReminders.map((event) => (
                    <li
                      key={`${event.kind}-${event.date}-${event.plantName}`}
                      className={`calendarReminder ${event.kind}`}
                    >
                      <span>{formatDisplayDate(event.date)}</span>
                      <strong>{event.plantName}</strong>
                      <span>{event.label}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>

        <section className="gardenSection" aria-labelledby="wish-lists">
          <div className="sectionHeader">
            <p className="sectionEyebrow">Wish lists</p>
          </div>

          <div className="wishGrid">
            {wishLists.map((list) => (
              <article
                className="wishCard"
                key={list.season}
                ref={list.id === "summer" ? summerCardRef : undefined}
                style={
                  wishCardMinHeight
                    ? { minHeight: `${wishCardMinHeight}px` }
                    : undefined
                }
              >
                <div className="wishSeason">
                  <h3>{list.season}</h3>
                  <span>{list.note}</span>
                </div>
                {wishListsData[list.id].length === 0 ? (
                  <p className="wishEmpty">
                    Add plants you want to try when this season arrives.
                  </p>
                ) : (
                  <ul className="wishList">
                    {wishListsData[list.id].map((plant) => (
                      <li key={plant.id} className="wishItem">
                        {wishEditingId === plant.id ? (
                          <div className="wishItemEdit">
                            <input
                              type="text"
                              value={wishEditDrafts[plant.id]?.name ?? ""}
                              onChange={(event) =>
                                updateWishEditDraft(
                                  plant.id,
                                  "name",
                                  event.target.value,
                                )
                              }
                              placeholder="Plant name"
                            />
                            <input
                              type="text"
                              value={wishEditDrafts[plant.id]?.timing ?? ""}
                              onChange={(event) =>
                                updateWishEditDraft(
                                  plant.id,
                                  "timing",
                                  event.target.value,
                                )
                              }
                              placeholder="Planting time"
                            />
                          </div>
                        ) : (
                          <div className="wishItemInfo">
                            <span>{plant.name}</span>
                            <span className="wishTime">{plant.timing}</span>
                          </div>
                        )}
                        <div className="wishItemActions">
                          {wishEditingId === plant.id ? (
                            <>
                              <button
                                type="button"
                                className="wishMiniButton"
                                onClick={() => saveWishEdits(plant)}
                                disabled={
                                  !wishEditDrafts[plant.id]?.name?.trim() ||
                                  !wishEditDrafts[plant.id]?.timing?.trim()
                                }
                                aria-label="Save"
                                title="Save"
                              >
                                <span aria-hidden="true">✓</span>
                              </button>
                              <button
                                type="button"
                                className="wishMiniGhostButton"
                                onClick={cancelEditingWish}
                                aria-label="Cancel"
                                title="Cancel"
                              >
                                <span aria-hidden="true">×</span>
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                className="wishMiniGhostButton"
                                onClick={() => startEditingWish(plant)}
                                aria-label="Edit"
                                title="Edit"
                              >
                                <span aria-hidden="true">✎</span>
                              </button>
                              <button
                                type="button"
                                className="wishMiniDangerButton"
                                onClick={() => removeWishItem(plant)}
                                disabled={wishDeletingId === plant.id}
                                aria-label="Delete"
                                title="Delete"
                              >
                                <span aria-hidden="true">🗑</span>
                              </button>
                            </>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
                {wishFormsOpen[list.id] ? (
                  <div className="wishForm">
                    <label>
                      Plant
                      <input
                        type="text"
                        value={wishDrafts[list.id].name}
                        onChange={(event) =>
                          updateWishDraft(list.id, "name", event.target.value)
                        }
                        placeholder="e.g. Sweet peas"
                      />
                    </label>
                    <label>
                      Planting time
                      <input
                        type="text"
                        value={wishDrafts[list.id].timing}
                        onChange={(event) =>
                          updateWishDraft(list.id, "timing", event.target.value)
                        }
                        placeholder="e.g. March or mid spring"
                      />
                    </label>
                    <div className="wishFormActions">
                      <button
                        type="button"
                        className="wishAddButton"
                        onClick={() => addWishItem(list.id)}
                        disabled={
                          !wishDrafts[list.id].name.trim() ||
                          !wishDrafts[list.id].timing.trim()
                        }
                        aria-label="Add plant"
                        title="Add plant"
                      >
                        Add Plant
                      </button>
                      <button
                        type="button"
                        className="wishGhostButton"
                        onClick={() =>
                          setWishFormsOpen((current) => ({
                            ...current,
                            [list.id]: false,
                          }))
                        }
                        aria-label="Cancel"
                        title="Cancel"
                      >
                        <span aria-hidden="true">×</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="wishAddButton"
                    onClick={() =>
                      setWishFormsOpen((current) => ({
                        ...current,
                        [list.id]: true,
                      }))
                    }
                    aria-label="Add plant"
                    title="Add plant"
                  >
                    Add Plant
                  </button>
                )}
              </article>
            ))}
          </div>
          {wishError && <div className="profileFooter">{wishError}</div>}
        </section>
      </div>
      <div
        className={`floatingChat ${isChatOpen ? "open" : ""} ${
          isFooterVisible ? "isRaised" : ""
        }`}
      >
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
                <p className="floatingChatEyebrow">Garden chat</p>
                <h4>{activeChatTitle || "Ask while you plan"}</h4>
              </div>
              <div className="floatingChatActions">
                <button
                  type="button"
                  className="floatingChatLink"
                  onClick={handleChatListToggle}
                >
                  View all chats
                </button>
                <button
                  type="button"
                  className="floatingChatClose"
                  onClick={handleChatToggle}
                >
                  Close
                </button>
              </div>
            </div>
            {isChatListOpen && (
              <div className="floatingChatPicker">
                {isChatListLoading ? (
                  <div className="floatingChatPickerState">
                    Loading chats...
                  </div>
                ) : chatListError ? (
                  <div className="floatingChatPickerState">
                    {chatListError}
                  </div>
                ) : chatSummaries.length === 0 ? (
                  <div className="floatingChatPickerState">
                    No chats yet. Start a new one below.
                  </div>
                ) : (
                  <ul className="floatingChatPickerList">
                    {chatSummaries.map((chat) => (
                      <li key={chat.id}>
                        <button
                          type="button"
                          className={`floatingChatPickerItem${
                            chat.id === activeChatId ? " isActive" : ""
                          }`}
                          onClick={() => handleSelectChat(chat.id)}
                        >
                          <span>{chat.title}</span>
                          <small>
                            {new Date(chat.updatedAt).toLocaleDateString(
                              undefined,
                              { month: "short", day: "numeric" },
                            )}
                          </small>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
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
                    <p>No messages yet. Ask about watering, soil, or pests.</p>
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
                  placeholder="Ask about your garden..."
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
    </div>
  );
}
