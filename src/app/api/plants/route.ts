import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { chats, plants } from "@/db/schema";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type PlantPayload = {
  name?: string;
  variety?: string;
  location?: string;
  status?: string;
  nextTask?: string;
  chatId?: string | null;
  plantedOn?: string | null;
  wateredDates?: string[] | null;
  fertilizedDates?: string[] | null;
  prunedDates?: string[] | null;
  waterIntervalDays?: number | string | null;
  fertilizeIntervalDays?: number | string | null;
  pruneIntervalDays?: number | string | null;
  notes?: string;
};

const normalizeField = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const parseDateValue = (value?: string | null) => {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const [year, month, day] = trimmed.split("-").map(Number);
  if (year && month && day) {
    return new Date(Date.UTC(year, month - 1, day));
  }
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
};

const parseDateList = (value?: string[] | null) => {
  if (!Array.isArray(value)) return null;
  return value
    .map((entry) => parseDateValue(entry))
    .filter((entry): entry is Date => entry !== null);
};

const parseIntervalDays = (value?: number | string | null) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed =
    typeof value === "number" ? value : Number.parseInt(value, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return null;
  return parsed;
};

const resolveChatId = async (
  chatId: string | null | undefined,
  userId: string,
) => {
  if (chatId === undefined) {
    return { value: undefined };
  }
  const trimmed = chatId?.trim();
  if (!trimmed) {
    return { value: null };
  }
  const [chat] = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, trimmed), eq(chats.userId, userId)))
    .limit(1);
  if (!chat) {
    return {
      error: NextResponse.json({ error: "Chat not found." }, { status: 400 }),
    };
  }
  return { value: chat.id };
};

const formatDateValue = (value: Date | string) => {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  const parsed = new Date(value);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return value.trim().slice(0, 10);
};

const buildPlantResponse = (plant: {
  id: string;
  chatId: string | null;
  name: string;
  variety: string | null;
  location: string | null;
  status: string | null;
  nextTask: string | null;
  plantedOn: Date | string | null;
  wateredDates: Array<Date | string> | null;
  fertilizedDates: Array<Date | string> | null;
  prunedDates: Array<Date | string> | null;
  waterIntervalDays: number | null;
  fertilizeIntervalDays: number | null;
  pruneIntervalDays: number | null;
  notes: string | null;
}) => ({
  id: plant.id,
  chatId: plant.chatId ?? "",
  name: plant.name,
  variety: plant.variety ?? "",
  location: plant.location ?? "",
  status: plant.status ?? "",
  nextTask: plant.nextTask ?? "",
  plantedOn: plant.plantedOn ? formatDateValue(plant.plantedOn) : "",
  wateredDates: plant.wateredDates?.map(formatDateValue) ?? [],
  fertilizedDates: plant.fertilizedDates?.map(formatDateValue) ?? [],
  prunedDates: plant.prunedDates?.map(formatDateValue) ?? [],
  waterIntervalDays: plant.waterIntervalDays ?? null,
  fertilizeIntervalDays: plant.fertilizeIntervalDays ?? null,
  pruneIntervalDays: plant.pruneIntervalDays ?? null,
  notes: plant.notes ?? "",
});

const requireUserId = async () => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return {
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }
  return { userId };
};

export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const plantList = await db
    .select({
      id: plants.id,
      chatId: plants.chatId,
      name: plants.name,
      variety: plants.variety,
      location: plants.location,
      status: plants.status,
      nextTask: plants.nextTask,
      plantedOn: plants.plantedOn,
      wateredDates: plants.wateredDates,
      fertilizedDates: plants.fertilizedDates,
      prunedDates: plants.prunedDates,
      waterIntervalDays: plants.waterIntervalDays,
      fertilizeIntervalDays: plants.fertilizeIntervalDays,
      pruneIntervalDays: plants.pruneIntervalDays,
      notes: plants.notes,
      updatedAt: plants.updatedAt,
    })
    .from(plants)
    .where(eq(plants.userId, userId))
    .orderBy(desc(plants.updatedAt));

  return NextResponse.json({
    plants: plantList.map((plant) => buildPlantResponse(plant)),
  });
}

export async function POST(request: Request) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const body = (await request.json()) as PlantPayload;
  const name = body.name?.trim();

  if (!name) {
    return NextResponse.json(
      { error: "Name is required." },
      { status: 400 },
    );
  }

  const { value: chatId, error: chatError } = await resolveChatId(
    body.chatId,
    userId,
  );
  if (chatError) return chatError;

  const payload = {
    userId,
    chatId: chatId ?? null,
    name,
    variety: normalizeField(body.variety),
    location: normalizeField(body.location),
    status: normalizeField(body.status),
    nextTask: normalizeField(body.nextTask),
    plantedOn: parseDateValue(body.plantedOn),
    wateredDates: parseDateList(body.wateredDates),
    fertilizedDates: parseDateList(body.fertilizedDates),
    prunedDates: parseDateList(body.prunedDates),
    waterIntervalDays: parseIntervalDays(body.waterIntervalDays),
    fertilizeIntervalDays: parseIntervalDays(body.fertilizeIntervalDays),
    pruneIntervalDays: parseIntervalDays(body.pruneIntervalDays),
    notes: normalizeField(body.notes),
    updatedAt: new Date(),
  };

  const [plant] = await db
    .insert(plants)
    .values(payload)
    .returning({
      id: plants.id,
      chatId: plants.chatId,
      name: plants.name,
      variety: plants.variety,
      location: plants.location,
      status: plants.status,
      nextTask: plants.nextTask,
      plantedOn: plants.plantedOn,
      wateredDates: plants.wateredDates,
      fertilizedDates: plants.fertilizedDates,
      prunedDates: plants.prunedDates,
      waterIntervalDays: plants.waterIntervalDays,
      fertilizeIntervalDays: plants.fertilizeIntervalDays,
      pruneIntervalDays: plants.pruneIntervalDays,
      notes: plants.notes,
    });

  return NextResponse.json({ plant: buildPlantResponse(plant) });
}
