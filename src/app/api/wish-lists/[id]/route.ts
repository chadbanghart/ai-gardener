import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { wishListItems } from "@/db/schema";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type WishListPayload = {
  name?: string;
  timing?: string;
};

type RouteParams = {
  params: Promise<{
    id: string;
  }>;
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

  const body = (await request.json()) as WishListPayload;
  const name = body.name?.trim();
  const timing = body.timing?.trim();

  if (!name || !timing) {
    return NextResponse.json(
      { error: "Name and timing are required." },
      { status: 400 },
    );
  }

  const { id } = await params;
  const [item] = await db
    .update(wishListItems)
    .set({
      name,
      timing,
      updatedAt: new Date(),
    })
    .where(and(eq(wishListItems.id, id), eq(wishListItems.userId, userId)))
    .returning({
      id: wishListItems.id,
      season: wishListItems.season,
      name: wishListItems.name,
      timing: wishListItems.timing,
    });

  if (!item) {
    return NextResponse.json({ error: "Wish not found." }, { status: 404 });
  }

  return NextResponse.json({ item });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const { userId, error } = await requireUserId();
  if (error) return error;

  const { id } = await params;
  const deleted = await db
    .delete(wishListItems)
    .where(and(eq(wishListItems.id, id), eq(wishListItems.userId, userId)))
    .returning({ id: wishListItems.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Wish not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
