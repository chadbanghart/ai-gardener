import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { chats, messages } from "@/db/schema";
import { authOptions } from "@/lib/auth";

export const runtime = "nodejs";

type RouteParams = {
  params: Promise<{
    chatId: string;
  }>;
};

export async function GET(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { chatId } = await params;
  const chat = await db
    .select({ id: chats.id })
    .from(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .limit(1);

  if (!chat.length) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  const chatMessages = await db
    .select({
      id: messages.id,
      role: messages.role,
      content: messages.content,
      createdAt: messages.createdAt,
    })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(messages.createdAt);

  return NextResponse.json({ messages: chatMessages });
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { chatId } = await params;
  const deleted = await db
    .delete(chats)
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id });

  if (!deleted.length) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = (await request.json()) as { title?: string };
  const nextTitle = body.title?.trim();

  if (!nextTitle) {
    return NextResponse.json(
      { error: "Title is required." },
      { status: 400 },
    );
  }

  const { chatId } = await params;
  const [updated] = await db
    .update(chats)
    .set({ title: nextTitle, updatedAt: new Date() })
    .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
    .returning({ id: chats.id, title: chats.title, updatedAt: chats.updatedAt });

  if (!updated) {
    return NextResponse.json({ error: "Chat not found." }, { status: 404 });
  }

  return NextResponse.json({ chat: updated });
}
