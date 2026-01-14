import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { authOptions } from "@/lib/auth";

type ProfilePayload = {
  location?: string;
  sunlight?: string[];
  gardenEnvironment?: string;
  hardinessZone?: string;
  gardenType?: string[];
  irrigationStyle?: string[];
  notes?: string;
};

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

const buildProfileResponse = (profile?: {
  location: string | null;
  sunlight: string[] | null;
  gardenEnvironment: string | null;
  hardinessZone: string | null;
  gardenType: string[] | null;
  irrigationStyle: string[] | null;
  notes: string | null;
}) => ({
  location: profile?.location ?? "",
  sunlight: profile?.sunlight ?? [],
  gardenEnvironment: profile?.gardenEnvironment ?? "",
  hardinessZone: profile?.hardinessZone ?? "",
  gardenType: profile?.gardenType ?? [],
  irrigationStyle: profile?.irrigationStyle ?? [],
  notes: profile?.notes ?? "",
});

const requireUserId = async () => {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;
  if (!userId) {
    return { error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }) };
  }
  return { userId };
};

export async function GET() {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const [profile] = await db
    .select({
      location: userProfiles.location,
      sunlight: userProfiles.sunlight,
      gardenEnvironment: userProfiles.gardenEnvironment,
      hardinessZone: userProfiles.hardinessZone,
      gardenType: userProfiles.gardenType,
      irrigationStyle: userProfiles.irrigationStyle,
      notes: userProfiles.notes,
    })
    .from(userProfiles)
    .where(eq(userProfiles.userId, userId))
    .limit(1);

  return NextResponse.json({ profile: buildProfileResponse(profile) });
}

export async function PUT(request: Request) {
  const { userId, error } = await requireUserId();
  if (error) return error;
  const body = (await request.json()) as ProfilePayload;

  const payload = {
    location: normalizeField(body.location),
    sunlight: normalizeList(body.sunlight),
    gardenEnvironment: normalizeField(body.gardenEnvironment),
    hardinessZone: normalizeField(body.hardinessZone),
    gardenType: normalizeList(body.gardenType),
    irrigationStyle: normalizeList(body.irrigationStyle),
    notes: normalizeField(body.notes),
  };

  await db
    .insert(userProfiles)
    .values({ userId, ...payload, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userProfiles.userId,
      set: { ...payload, updatedAt: new Date() },
    });

  return NextResponse.json({ profile: buildProfileResponse(payload) });
}
