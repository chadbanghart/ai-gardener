import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { userProfiles } from "@/db/schema";
import { authOptions } from "@/lib/auth";

type ProfilePayload = {
  location?: string;
  gardenEnvironment?: string;
  hardinessZone?: string;
  experienceLevel?: string;
  notes?: string;
};

const normalizeField = (value?: string | null) => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

const buildProfileResponse = (profile?: {
  location: string | null;
  gardenEnvironment: string | null;
  hardinessZone: string | null;
  experienceLevel: string | null;
  notes: string | null;
}) => ({
  location: profile?.location ?? "",
  gardenEnvironment: profile?.gardenEnvironment ?? "",
  hardinessZone: profile?.hardinessZone ?? "",
  experienceLevel: profile?.experienceLevel ?? "",
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
      gardenEnvironment: userProfiles.gardenEnvironment,
      hardinessZone: userProfiles.hardinessZone,
      experienceLevel: userProfiles.experienceLevel,
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
    gardenEnvironment: normalizeField(body.gardenEnvironment),
    hardinessZone: normalizeField(body.hardinessZone),
    experienceLevel: normalizeField(body.experienceLevel),
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
