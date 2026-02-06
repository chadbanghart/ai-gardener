import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { gardenLocations } from "@/db/schema";
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

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
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

export async function PUT(request: Request, { params }: RouteParams) {
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

  const { id } = await params;
  const [location] = await db
    .update(gardenLocations)
    .set({
      name,
      settingType,
      soilType,
      soilPh,
      sunAmount,
      notes,
      updatedAt: new Date(),
    })
    .where(and(eq(gardenLocations.id, id), eq(gardenLocations.userId, userId)))
    .returning({
      id: gardenLocations.id,
      name: gardenLocations.name,
      settingType: gardenLocations.settingType,
      soilType: gardenLocations.soilType,
      soilPh: gardenLocations.soilPh,
      sunAmount: gardenLocations.sunAmount,
      notes: gardenLocations.notes,
    });

  if (!location) {
    return NextResponse.json(
      { error: "Garden location not found." },
      { status: 404 },
    );
  }

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

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await params;
  const deleted = await db
    .delete(gardenLocations)
    .where(and(eq(gardenLocations.id, id), eq(gardenLocations.userId, userId)))
    .returning({ id: gardenLocations.id });

  if (!deleted.length) {
    return NextResponse.json(
      { error: "Garden location not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true });
}
