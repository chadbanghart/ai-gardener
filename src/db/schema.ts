import {
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

export const messageRole = pgEnum("message_role", [
  "system",
  "user",
  "assistant",
]);

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const userProfiles = pgTable("user_profiles", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull()
    .unique(),
  location: text("location"),
  sunlight: text("sunlight").array(),
  gardenEnvironment: text("garden_environment"),
  tempRange: text("temp_range"),
  hardinessZone: text("hardiness_zone"),
  gardenType: text("garden_type").array(),
  irrigationStyle: text("irrigation_style").array(),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const plants = pgTable("plants", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .references(() => users.id, { onDelete: "cascade" })
    .notNull(),
  name: text("name").notNull(),
  variety: text("variety"),
  location: text("location"),
  status: text("status"),
  nextTask: text("next_task"),
  plantedOn: timestamp("planted_on", { withTimezone: true }),
  wateredDates: timestamp("watered_dates", { withTimezone: true }).array(),
  fertilizedDates: timestamp("fertilized_dates", { withTimezone: true }).array(),
  prunedDates: timestamp("pruned_dates", { withTimezone: true }).array(),
  waterIntervalDays: integer("water_interval_days"),
  fertilizeIntervalDays: integer("fertilize_interval_days"),
  pruneIntervalDays: integer("prune_interval_days"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const chats = pgTable("chats", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const messages = pgTable("messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  chatId: uuid("chat_id")
    .references(() => chats.id, { onDelete: "cascade" })
    .notNull(),
  role: messageRole("role").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
