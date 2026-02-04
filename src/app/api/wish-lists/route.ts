import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { wishListItems } from "@/db/schema";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type WishListPayload = {
  season?: string;
  name?: string;
  timing?: string;
};

const allowedSeasons = new Set(["spring", "summer", "fall", "winter"]);

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

  const items = await db
    .select({
      id: wishListItems.id,
      season: wishListItems.season,
      name: wishListItems.name,
      timing: wishListItems.timing,
      createdAt: wishListItems.createdAt,
    })
    .from(wishListItems)
    .where(eq(wishListItems.userId, userId))
    .orderBy(desc(wishListItems.createdAt));

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      season: item.season,
      name: item.name,
      timing: item.timing,
    })),
  });
}

export async function POST(request: Request) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const body = (await request.json()) as WishListPayload;
  const season = body.season?.trim();
  const name = body.name?.trim();
  const timing = body.timing?.trim();

  if (!season || !name || !timing) {
    return NextResponse.json(
      { error: "Season, name, and timing are required." },
      { status: 400 },
    );
  }

  if (!allowedSeasons.has(season)) {
    return NextResponse.json(
      { error: "Season is invalid." },
      { status: 400 },
    );
  }

  const [item] = await db
    .insert(wishListItems)
    .values({
      userId,
      season,
      name,
      timing,
      updatedAt: new Date(),
    })
    .returning({
      id: wishListItems.id,
      season: wishListItems.season,
      name: wishListItems.name,
      timing: wishListItems.timing,
    });

  return NextResponse.json({ item });
}
