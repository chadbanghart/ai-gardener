"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import type { PlantRecord } from "@/lib/plants";
import { fetchPlants } from "@/lib/plants";

export default function MyGardenPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plants, setPlants] = useState<PlantRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const today = new Date();
  const [monthOffset, setMonthOffset] = useState(0);
  const [showWaterReminders, setShowWaterReminders] = useState(true);
  const [showFertilizeReminders, setShowFertilizeReminders] = useState(true);
  const [showPruneReminders, setShowPruneReminders] = useState(true);
  const activeMonth = new Date(
    today.getFullYear(),
    today.getMonth() + monthOffset,
    1,
  );
  const calendarYear = activeMonth.getFullYear();
  const calendarMonth = activeMonth.getMonth();
  const startOfToday = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate(),
  );
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

  const latestDate = (dates: string[]) =>
    dates.length ? [...dates].sort().at(-1) ?? "" : "";

  const addDays = (value: Date, days: number) => {
    const next = new Date(value);
    next.setDate(next.getDate() + days);
    return next;
  };

  const reminderHorizon = addDays(startOfToday, MAX_REMINDER_DAYS);

  const reminderDatesInRange = (base: Date, intervalDays: number) => {
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

  const calendarEvents = useMemo(() => {
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

    plants.forEach((plant) => {
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
          const dates = reminderDatesInRange(base, interval);
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
          const dates = reminderDatesInRange(base, interval);
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
          const dates = reminderDatesInRange(base, interval);
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
  }, [
    plants,
    showWaterReminders,
    showFertilizeReminders,
    showPruneReminders,
    startOfToday,
  ]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, typeof calendarEvents>();
    calendarEvents.forEach((event) => {
      const list = map.get(event.date) ?? [];
      list.push(event);
      map.set(event.date, list);
    });
    return map;
  }, [calendarEvents]);

  const upcomingReminders = useMemo(
    () =>
      calendarEvents
        .filter((event) => event.isReminder)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(0, 5),
    [calendarEvents],
  );

  const monthStart = new Date(calendarYear, calendarMonth, 1);
  const monthEnd = new Date(calendarYear, calendarMonth + 1, 0);
  const daysInMonth = monthEnd.getDate();
  const startWeekday = monthStart.getDay();
  const calendarDays = Array.from(
    { length: startWeekday + daysInMonth },
    (_, index) =>
      index < startWeekday ? null : index - startWeekday + 1,
  );

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

        <section className="gardenSection" aria-labelledby="care-calendar">
          <div className="sectionHeader">
            <div>
              <p className="sectionEyebrow">Care calendar</p>
              <h2 id="care-calendar">Care calendar</h2>
            </div>
            <p className="sectionHint">
              Reminders use default cadences of 7 days for watering and 30 days
              for fertilizing; pruning reminders only appear when a plant has a
              pruning cadence set.
            </p>
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
                  <span className="calendarLegendItem reminder-water">
                    Water
                  </span>
                  <span className="calendarLegendItem reminder-fertilize">
                    Fertilize
                  </span>
                  <span className="calendarLegendItem reminder-prune">
                    Prune
                  </span>
                  <span className="calendarLegendItem planted">Planted</span>
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
                return (
                  <div key={dateKey} className="calendarCell">
                    <div className="calendarDay">{day}</div>
                    <div className="calendarEvents">
                      {events.map((event, eventIndex) => (
                        <span
                          key={`${event.kind}-${eventIndex}`}
                          className={`calendarEvent ${event.kind}`}
                          title={`${event.label} · ${event.plantName}`}
                        >
                          {event.plantName}
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
              <div
                className="calendarFilters"
                role="group"
                aria-label="Care filters"
              >
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
              </div>
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
