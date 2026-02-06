import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { gardenLocations, plants } from "@/db/schema";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type GardenLocationPayload = {
  name?: string;
  settingType?: string;
  soilType?: string;
  soilPh?: string;
  sunAmount?: string[];
  notes?: string;
};

const allowedTypes = new Set([
  "Raised bed",
  "In-ground bed",
  "Container",
  "Seedling starter",
  "Trees",
  "Other",
]);

const allowedSunAmounts = new Set([
  "Full sun",
  "Part sun",
  "Part shade",
  "Shade",
  "Mixed",
]);

const normalizeField = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const normalizeList = (value?: string[] | null) => {
  const filtered = Array.isArray(value)
    ? value.map((entry) => entry.trim()).filter(Boolean)
    : [];
  return filtered.length ? filtered : null;
};

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

  const locations = await db
    .select({
      id: gardenLocations.id,
      name: gardenLocations.name,
      settingType: gardenLocations.settingType,
      soilType: gardenLocations.soilType,
      soilPh: gardenLocations.soilPh,
      sunAmount: gardenLocations.sunAmount,
      notes: gardenLocations.notes,
      createdAt: gardenLocations.createdAt,
    })
    .from(gardenLocations)
    .where(eq(gardenLocations.userId, userId))
    .orderBy(desc(gardenLocations.createdAt));

  const existingNames = new Set(
    locations.map((location) => location.name.trim().toLowerCase()),
  );

  const plantLocations = await db
    .select({ location: plants.location })
    .from(plants)
    .where(eq(plants.userId, userId));

  const missingNames = Array.from(
    new Set(
      plantLocations
        .map((item) => item.location?.trim())
        .filter((value): value is string => Boolean(value)),
    ),
  ).filter((name) => !existingNames.has(name.toLowerCase()));

  if (missingNames.length) {
    await db.insert(gardenLocations).values(
      missingNames.map((name) => ({
        userId,
        name,
        settingType: "Other",
        notes: null,
        updatedAt: new Date(),
      })),
    );

    const refreshed = await db
      .select({
        id: gardenLocations.id,
        name: gardenLocations.name,
        settingType: gardenLocations.settingType,
        soilType: gardenLocations.soilType,
        soilPh: gardenLocations.soilPh,
        sunAmount: gardenLocations.sunAmount,
        notes: gardenLocations.notes,
        createdAt: gardenLocations.createdAt,
      })
      .from(gardenLocations)
      .where(eq(gardenLocations.userId, userId))
      .orderBy(desc(gardenLocations.createdAt));

    return NextResponse.json({
      locations: refreshed.map((location) => ({
        id: location.id,
        name: location.name,
        settingType: location.settingType,
        soilType: location.soilType ?? "",
        soilPh: location.soilPh ?? "",
        sunAmount: location.sunAmount ?? [],
        notes: location.notes ?? "",
      })),
    });
  }

  return NextResponse.json({
    locations: locations.map((location) => ({
      id: location.id,
      name: location.name,
      settingType: location.settingType,
      soilType: location.soilType ?? "",
      soilPh: location.soilPh ?? "",
      sunAmount: location.sunAmount ?? [],
      notes: location.notes ?? "",
    })),
  });
}

export async function POST(request: Request) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const body = (await request.json()) as GardenLocationPayload;
  const name = body.name?.trim();
  const settingType = body.settingType?.trim();
  const soilType = normalizeField(body.soilType);
  const soilPh = normalizeField(body.soilPh);
  const sunAmount = normalizeList(body.sunAmount);
  const notes = normalizeField(body.notes);

  if (!name || !settingType) {
    return NextResponse.json(
      { error: "Name and type are required." },
      { status: 400 },
    );
  }

  if (!allowedTypes.has(settingType)) {
    return NextResponse.json({ error: "Type is invalid." }, { status: 400 });
  }

  if (
    sunAmount &&
    sunAmount.some((value) => !allowedSunAmounts.has(value))
  ) {
    return NextResponse.json(
      { error: "Sun amount is invalid." },
      { status: 400 },
    );
  }

  const [location] = await db
    .insert(gardenLocations)
    .values({
      userId,
      name,
      settingType,
      soilType,
      soilPh,
      sunAmount,
      notes,
      updatedAt: new Date(),
    })
    .returning({
      id: gardenLocations.id,
      name: gardenLocations.name,
      settingType: gardenLocations.settingType,
      soilType: gardenLocations.soilType,
      soilPh: gardenLocations.soilPh,
      sunAmount: gardenLocations.sunAmount,
      notes: gardenLocations.notes,
    });

  return NextResponse.json({
    location: {
      ...location,
      soilType: location.soilType ?? "",
      soilPh: location.soilPh ?? "",
      sunAmount: location.sunAmount ?? [],
      notes: location.notes ?? "",
    },
  });
}
