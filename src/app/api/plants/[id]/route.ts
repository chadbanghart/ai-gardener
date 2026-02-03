import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { plants } from "@/db/schema";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type PlantPayload = {
  name?: string;
  variety?: string;
  location?: string;
  status?: string;
  nextTask?: string;
  notes?: string;
};

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
};

const normalizeField = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const buildPlantResponse = (plant: {
  id: string;
  name: string;
  variety: string | null;
  location: string | null;
  status: string | null;
  nextTask: string | null;
  notes: string | null;
}) => ({
  id: plant.id,
  name: plant.name,
  variety: plant.variety ?? "",
  location: plant.location ?? "",
  status: plant.status ?? "",
  nextTask: plant.nextTask ?? "",
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

export async function GET(_request: Request, { params }: RouteParams) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await params;
  const [plant] = await db
    .select({
      id: plants.id,
      name: plants.name,
      variety: plants.variety,
      location: plants.location,
      status: plants.status,
      nextTask: plants.nextTask,
      notes: plants.notes,
    })
    .from(plants)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    .limit(1);

  if (!plant) {
    return NextResponse.json({ error: "Plant not found." }, { status: 404 });
  }

  return NextResponse.json({ plant: buildPlantResponse(plant) });
}

export async function PUT(request: Request, { params }: RouteParams) {
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

  const payload = {
    name,
    variety: normalizeField(body.variety),
    location: normalizeField(body.location),
    status: normalizeField(body.status),
    nextTask: normalizeField(body.nextTask),
    notes: normalizeField(body.notes),
    updatedAt: new Date(),
  };

  const { id } = await params;
  const [plant] = await db
    .update(plants)
    .set(payload)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    .returning({
      id: plants.id,
      name: plants.name,
      variety: plants.variety,
      location: plants.location,
      status: plants.status,
      nextTask: plants.nextTask,
      notes: plants.notes,
    });

  if (!plant) {
    return NextResponse.json({ error: "Plant not found." }, { status: 404 });
  }

  return NextResponse.json({ plant: buildPlantResponse(plant) });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await params;
  const deleted = await db
    .delete(plants)
    .where(and(eq(plants.id, id), eq(plants.userId, userId)))
    .returning({ id: plants.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Plant not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
