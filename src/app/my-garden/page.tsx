"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEffect, useState } from "react";

import type { PlantRecord } from "@/lib/plants";
import { fetchPlants } from "@/lib/plants";

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

export default function MyGardenPage() {
  const { status } = useSession();
  const router = useRouter();
  const [plants, setPlants] = useState<PlantRecord[] | null>(null);
  const [error, setError] = useState("");
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
    return Array.from(map.entries()).sort(([a], [b]) =>
      a.localeCompare(b),
    );
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
    const remindersByKind = new Map<
      string,
      typeof calendarEvents
    >();
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

    return results
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
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
              Add plant
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
                            <strong>{locationLabel}</strong>
                          </div>
                          <div className="plantMeta">
                            <span>Next task</span>
                            <strong>
                              {nextTaskForPlant(plant, startOfToday)}
                            </strong>
                          </div>
                        </Link>
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
                            {abbreviateName(event.plantName)}
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
      </div>
    </div>
  );
}
