import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { getServerSession } from "next-auth";

import { db } from "@/db";
import { chats, messages, userProfiles } from "@/db/schema";
import { authOptions } from "@/lib/auth";

type ChatPayload = {
  message?: string;
  chatId?: string;
};

const OLLAMA_HOST = process.env.OLLAMA_HOST ?? "http://127.0.0.1:11434";
const OLLAMA_MODEL = process.env.OLLAMA_MODEL ?? "llama3";
const OLLAMA_MAX_HISTORY = Number.parseInt(
  process.env.OLLAMA_MAX_HISTORY ?? "20",
  10,
);

const baseSystemPrompt = [
  "You are Garden AI, a friendly, practical gardening assistant.",
  "Give concise, actionable guidance with clear next steps.",
  "When details are missing, ask for plant type, light, temperature, and last watering.",
].join(" ");

type OllamaMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OllamaChatResponse = {
  message?: {
    role: "assistant";
    content: string;
  };
};

export const runtime = "nodejs";

const getChatTitle = (message: string) => {
  const trimmed = message.trim().replace(/\s+/g, " ");
  if (trimmed.length <= 48) return trimmed;
  return `${trimmed.slice(0, 45)}...`;
};

const formatProfileContext = (profile?: {
  location: string | null;
  sunlight: string[] | null;
  gardenEnvironment: string | null;
  hardinessZone: string | null;
  gardenType: string[] | null;
  irrigationStyle: string[] | null;
  notes: string | null;
}) => {
  if (!profile) return null;
  const details = [
    profile.location ? `Location: ${profile.location}` : null,
    profile.sunlight?.length
      ? `Sunlight: ${profile.sunlight.join(", ")}`
      : null,
    profile.gardenEnvironment
      ? `Environment: ${profile.gardenEnvironment}`
      : null,
    profile.hardinessZone ? `Hardiness zone: ${profile.hardinessZone}` : null,
    profile.gardenType?.length
      ? `Garden type: ${profile.gardenType.join(", ")}`
      : null,
    profile.irrigationStyle?.length
      ? `Irrigation: ${profile.irrigationStyle.join(", ")}`
      : null,
    profile.notes ? `Notes: ${profile.notes}` : null,
  ].filter(Boolean);

  if (!details.length) return null;
  return `User profile: ${details.join(" | ")}.`;
};

const hasProfilePreferences = (profile?: {
  location: string | null;
  sunlight: string[] | null;
  gardenEnvironment: string | null;
  hardinessZone: string | null;
  gardenType: string[] | null;
  irrigationStyle: string[] | null;
}) => {
  if (!profile) return false;
  const hasValue = (value?: string | null) =>
    typeof value === "string" && value.trim().length > 0;
  const hasList = (value?: string[] | null) =>
    Array.isArray(value) && value.length > 0;

  return (
    hasValue(profile.location) ||
    hasList(profile.sunlight) ||
    hasValue(profile.gardenEnvironment) ||
    hasValue(profile.hardinessZone) ||
    hasList(profile.gardenType) ||
    hasList(profile.irrigationStyle)
  );
};

const getTodayContext = () => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  return `Today is ${formatter.format(now)}.`;
};

export async function POST(request: Request) {
  const body = (await request.json()) as ChatPayload;
  const message = body.message?.trim();
  const session = await getServerSession(authOptions);
  const userId = session?.user?.id ?? null;

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!message) {
    return NextResponse.json({
      reply:
        "Tell me what you are growing and what you are noticing (leaf color, soil moisture, pests, or growth).",
    });
  }

  let chatId = body.chatId ?? null;

  if (chatId) {
    const existingChat = await db
      .select({ id: chats.id })
      .from(chats)
      .where(and(eq(chats.id, chatId), eq(chats.userId, userId)))
      .limit(1);

    if (!existingChat.length) {
      chatId = null;
    }
  }

  if (!chatId) {
    const [createdChat] = await db
      .insert(chats)
      .values({
        title: getChatTitle(message),
        userId,
        updatedAt: new Date(),
      })
      .returning({ id: chats.id });

    chatId = createdChat?.id ?? null;
  }

  if (!chatId) {
    return NextResponse.json({
      reply:
        "I ran into trouble starting a new chat. Please refresh and try again.",
    });
  }

  const historyLimit = Number.isFinite(OLLAMA_MAX_HISTORY)
    ? Math.max(0, OLLAMA_MAX_HISTORY)
    : 20;
  const history = await db
    .select({ role: messages.role, content: messages.content })
    .from(messages)
    .where(eq(messages.chatId, chatId))
    .orderBy(desc(messages.createdAt))
    .limit(historyLimit);

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

  const profileContext = formatProfileContext(profile);
  const shouldNudgePreferences = !hasProfilePreferences(profile);
  const systemPrompt = [
    baseSystemPrompt,
    getTodayContext(),
    profileContext,
    "Infer hardiness zone from the user's location when possible.",
    "Infer typical temperature ranges from the user's location when possible.",
    "When asking follow-up questions, prioritize missing details and avoid repeating profile info.",
  ]
    .filter(Boolean)
    .join(" ");

  const ollamaMessages: OllamaMessage[] = [
    { role: "system", content: systemPrompt },
    ...history
      .slice()
      .reverse()
      .map((entry) => ({
        role: entry.role,
        content: entry.content,
      })),
    { role: "user", content: message },
  ];

  try {
    await db.insert(messages).values({
      chatId,
      role: "user",
      content: message,
    });

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    const ollamaResponse = await fetch(`${OLLAMA_HOST}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: ollamaMessages,
        stream: false,
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama error: ${ollamaResponse.status}`);
    }

    const data = (await ollamaResponse.json()) as OllamaChatResponse;
    const reply =
      data.message?.content?.trim() ||
      "I couldn't craft a reply. Try adding details like sunlight hours and last watering.";
    const nudgedReply = shouldNudgePreferences
      ? `${reply}\n\nTip: Set your profile settings (location, sunlight, and garden type) to get more tailored advice.`
      : reply;

    await db.insert(messages).values({
      chatId,
      role: "assistant",
      content: nudgedReply,
    });

    return NextResponse.json({ reply: nudgedReply, chatId });
  } catch {
    return NextResponse.json({
      reply:
        "I couldn't reach the local Ollama service. Make sure it is running and try again.",
      chatId,
    });
  }
}
