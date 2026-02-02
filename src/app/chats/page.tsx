"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type Message = {
  role: "user" | "assistant";
  content: string;
  id?: string;
};

type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

type ProfileSettings = {
  location: string;
  sunlight: string[];
  gardenEnvironment: string;
  hardinessZone: string;
  gardenType: string[];
  irrigationStyle: string[];
  notes: string;
};

const starterPrompts = [
  "When should I water tomatoes?",
  "My basil leaves are yellowing. What should I check?",
  "How much sun do cucumbers need?",
  "What is an easy compost mix for beginners?",
];

const emptyProfile: ProfileSettings = {
  location: "",
  sunlight: [],
  gardenEnvironment: "",
  hardinessZone: "",
  gardenType: [],
  irrigationStyle: [],
  notes: "",
};

const welcomeMessage: Message = {
  role: "assistant",
  content:
    "Hi! I'm your AI garden helper. Tell me about your plants, space, and goals, and I'll suggest the next best step.",
};

export default function Home() {
  const { status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAuthed = status === "authenticated";
  const [messages, setMessages] = useState<Message[]>([welcomeMessage]);
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isListLoading, setIsListLoading] = useState(false);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [profile, setProfile] = useState<ProfileSettings>(emptyProfile);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  const [isProfileSaving, setIsProfileSaving] = useState(false);
  const [profileStatus, setProfileStatus] = useState("");
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [editingChatId, setEditingChatId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [editingOriginalTitle, setEditingOriginalTitle] = useState("");
  const [isTitleSaving, setIsTitleSaving] = useState(false);
  const hasHandledStartNew = useRef(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const startNew = searchParams.get("new") === "1";

  const loadChatMessages = useCallback(async (chatId: string) => {
    setIsHistoryLoading(true);
    try {
      const response = await fetch(`/api/chats/${chatId}`);
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error("Failed to load chat");
      }
      const data = (await response.json()) as { messages?: Message[] };
      const nextMessages = Array.isArray(data.messages)
        ? data.messages
        : [];

      setActiveChatId(chatId);
      setMessages(nextMessages.length ? nextMessages : [welcomeMessage]);
    } catch {
      setMessages([welcomeMessage]);
      setActiveChatId(null);
    } finally {
      setIsHistoryLoading(false);
    }
  }, []);

  const loadChats = useCallback(async (selectFirst: boolean) => {
    setIsListLoading(true);
    try {
      const response = await fetch("/api/chats");
      if (!response.ok) {
        if (response.status === 401) {
          setChats([]);
          return;
        }
        throw new Error("Failed to load chats");
      }
      const data = (await response.json()) as { chats?: ChatSummary[] };
      const nextChats = Array.isArray(data.chats) ? data.chats : [];
      setChats(nextChats);

      if (selectFirst && nextChats.length > 0) {
        await loadChatMessages(nextChats[0].id);
      }

      if (nextChats.length === 0) {
        setActiveChatId(null);
        setMessages([welcomeMessage]);
      }
    } catch {
      setChats([]);
    } finally {
      setIsListLoading(false);
    }
  }, [loadChatMessages]);

  const loadProfile = useCallback(async () => {
    setIsProfileLoading(true);
    try {
      const response = await fetch("/api/profile");
      if (!response.ok) {
        if (response.status === 401) {
          return;
        }
        throw new Error("Failed to load profile");
      }
      const data = (await response.json()) as {
        profile?: Partial<ProfileSettings>;
      };
      setProfile({ ...emptyProfile, ...(data.profile ?? {}) });
    } catch {
      setProfile(emptyProfile);
    } finally {
      setIsProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthed) {
      const shouldStartNew = startNew && !hasHandledStartNew.current;
      const shouldSelectFirst = !startNew && !hasHandledStartNew.current;
      void loadChats(shouldSelectFirst);
      void loadProfile();

      if (shouldStartNew) {
        hasHandledStartNew.current = true;
        setActiveChatId(null);
        setMessages([welcomeMessage]);
        setInput("");
        requestAnimationFrame(() => {
          inputRef.current?.focus({ preventScroll: true });
        });
        router.replace("/chats");
      }

      return;
    }

    if (status === "unauthenticated") {
      setChats([]);
      setActiveChatId(null);
      setMessages([welcomeMessage]);
      setProfile(emptyProfile);
      setIsProfileOpen(false);
      setProfileStatus("");
      router.replace("/");
    }
  }, [isAuthed, startNew, status, router, loadChats, loadProfile]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading || !isAuthed) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const nextHistory = [...messages, userMessage];

    setMessages(nextHistory);
    setInput("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: trimmed, chatId: activeChatId }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Unauthorized");
        }
        throw new Error("Request failed");
      }

      const data = (await response.json()) as {
        reply?: string;
        chatId?: string;
      };
      const reply =
        typeof data.reply === "string"
          ? data.reply
          : "I ran into trouble crafting a reply. Try again with more detail.";

      if (data.chatId && data.chatId !== activeChatId) {
        setActiveChatId(data.chatId);
      }

      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
      await loadChats(false);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Sorry, I couldn't respond. Try again with details like plant type, sun hours, and last watering.",
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePromptClick = (prompt: string) => {
    setInput(prompt);
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleNewChat = () => {
    setActiveChatId(null);
    setMessages([welcomeMessage]);
    setInput("");
    inputRef.current?.focus({ preventScroll: true });
  };

  const handleDeleteChat = async (chatId: string) => {
    if (!isAuthed) return;
    try {
      const response = await fetch(`/api/chats/${chatId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Failed to delete chat");
      }

      const shouldSelectFirst = chatId === activeChatId;
      if (shouldSelectFirst) {
        setActiveChatId(null);
        setMessages([welcomeMessage]);
      }
      await loadChats(shouldSelectFirst);
    } catch {
      // Optional: surface a toast or inline error later.
    }
  };

  const startEditTitle = (chat: ChatSummary) => {
    setEditingChatId(chat.id);
    setEditingTitle(chat.title);
    setEditingOriginalTitle(chat.title);
  };

  const cancelEditTitle = () => {
    setEditingChatId(null);
    setEditingTitle("");
    setEditingOriginalTitle("");
    setIsTitleSaving(false);
  };

  const saveChatTitle = async () => {
    if (!editingChatId || isTitleSaving || !isAuthed) return;
    const nextTitle = editingTitle.trim();
    if (!nextTitle) return;
    if (nextTitle === editingOriginalTitle) {
      cancelEditTitle();
      return;
    }
    setIsTitleSaving(true);
    try {
      const response = await fetch(`/api/chats/${editingChatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: nextTitle }),
      });
      if (!response.ok) {
        throw new Error("Failed to update chat title");
      }
      const data = (await response.json()) as {
        chat?: ChatSummary;
      };
      if (data.chat) {
        setChats((prev) =>
          [...prev]
            .map((chat) =>
              chat.id === data.chat?.id ? { ...chat, ...data.chat } : chat,
            )
            .sort(
              (a, b) =>
                new Date(b.updatedAt).getTime() -
                new Date(a.updatedAt).getTime(),
            ),
        );
      }
      cancelEditTitle();
    } catch {
      setEditingTitle(editingOriginalTitle);
    } finally {
      setIsTitleSaving(false);
    }
  };

  const updateProfileField = (
    field: keyof ProfileSettings,
    value: string,
  ) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const toggleProfileOption = (
    field: "sunlight" | "gardenType" | "irrigationStyle",
    value: string,
  ) => {
    setProfile((prev) => {
      const current = new Set(prev[field]);
      if (current.has(value)) {
        current.delete(value);
      } else {
        current.add(value);
      }
      return { ...prev, [field]: Array.from(current) };
    });
  };

  const handleProfileSave = async () => {
    if (isProfileSaving || !isAuthed) return;
    setIsProfileSaving(true);
    setProfileStatus("");
    try {
      const response = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!response.ok) {
        throw new Error("Failed to save profile");
      }
      const data = (await response.json()) as {
        profile?: Partial<ProfileSettings>;
      };
      setProfile({ ...emptyProfile, ...(data.profile ?? {}) });
      setProfileStatus("Saved");
    } catch {
      setProfileStatus("Save failed");
    } finally {
      setIsProfileSaving(false);
    }
  };

  const showPrompts = isAuthed && !activeChatId && messages.length === 1;

  const sunlightOptions = [
    "Direct sunlight",
    "Partial sun",
    "Shade",
    "Mixed",
  ];
  const gardenTypeOptions = [
    "In-ground beds",
    "Raised beds",
    "Containers",
    "Hydroponic",
    "Mixed",
  ];
  const irrigationOptions = [
    "Hand watering",
    "Drip",
    "Sprinkler",
    "Self-watering",
  ];
  const trimmedEditingTitle = editingTitle.trim();

  return (
    <div className="page">
      <div className="shell">
        <header className="hero">
          <div className="heroTop">
            <span className="eyebrow">AI Garden Assistant</span>
          </div>
          <h1>Grow a calmer, greener garden.</h1>
          <p>
            A free, hobby-grade chat companion for watering, soil, pests, and
            seasonal care.
          </p>
        </header>

        {isAuthed ? (
          <div className="chatLayout">
            <aside className="historyPanel">
              <div className="historyHeader">
                <h2>Chat history</h2>
                <button
                  type="button"
                  className="newChatButton"
                  onClick={handleNewChat}
                  disabled={!isAuthed}
                >
                  New chat
                </button>
              </div>

              <div className="historyList" role="list">
                {isListLoading && (
                  <div className="historyHint">Loading chats...</div>
                )}
                {!isListLoading && chats.length === 0 && (
                  <div className="historyHint">
                    No chats yet. Start a conversation to see it here.
                  </div>
                )}
                {!isListLoading &&
                  chats.map((chat) => (
                    <div
                      key={chat.id}
                      className={`historyItem ${
                        chat.id === activeChatId ? "active" : ""
                      } ${editingChatId === chat.id ? "editing" : ""}`}
                    >
                      {editingChatId === chat.id ? (
                        <div className="historyItemMain historyItemEditing">
                          <input
                            type="text"
                            className="historyTitleInput"
                            value={editingTitle}
                            onChange={(event) =>
                              setEditingTitle(event.target.value)
                            }
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                void saveChatTitle();
                              }
                              if (event.key === "Escape") {
                                event.preventDefault();
                                cancelEditTitle();
                              }
                            }}
                            aria-label="Edit chat title"
                            disabled={isTitleSaving}
                          />
                          <span className="historyMeta">
                            {new Date(chat.updatedAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="historyItemMain"
                          onClick={() => loadChatMessages(chat.id)}
                        >
                          <span className="historyTitle">{chat.title}</span>
                          <span className="historyMeta">
                            {new Date(chat.updatedAt).toLocaleDateString(
                              undefined,
                              {
                                month: "short",
                                day: "numeric",
                              },
                            )}
                          </span>
                        </button>
                      )}
                      <div className="historyActions">
                        {editingChatId === chat.id ? (
                          <>
                            <button
                              type="button"
                              className="historyActionButton historySaveButton"
                              onClick={(event) => {
                                event.stopPropagation();
                                void saveChatTitle();
                              }}
                              aria-label={`Save title for ${chat.title}`}
                              disabled={isTitleSaving || !trimmedEditingTitle}
                            >
                              <Check
                                size={16}
                                strokeWidth={1.6}
                                aria-hidden="true"
                              />
                            </button>
                            <button
                              type="button"
                              className="historyActionButton historyCancelButton"
                              onClick={(event) => {
                                event.stopPropagation();
                                cancelEditTitle();
                              }}
                              aria-label={`Cancel editing ${chat.title}`}
                              disabled={isTitleSaving}
                            >
                              <X size={16} strokeWidth={1.6} aria-hidden="true" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="historyActionButton historyEditButton"
                            onClick={(event) => {
                              event.stopPropagation();
                              startEditTitle(chat);
                            }}
                            aria-label={`Edit chat ${chat.title}`}
                          >
                            <Pencil
                              size={16}
                              strokeWidth={1.6}
                              aria-hidden="true"
                            />
                          </button>
                        )}
                        <button
                          type="button"
                          className="historyActionButton historyDeleteButton"
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleDeleteChat(chat.id);
                          }}
                          aria-label={`Delete chat ${chat.title}`}
                        >
                          <Trash2 size={16} strokeWidth={1.6} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            </aside>

            <section className="chatPanel">
              {showPrompts && (
                <div className="promptRow">
                  {starterPrompts.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      className="promptChip"
                      onClick={() => handlePromptClick(prompt)}
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              )}

              <div
                className="messageList"
                role="log"
                aria-live="polite"
                aria-busy={isHistoryLoading}
              >
                {messages.map((message, index) => (
                  <div
                    key={message.id ?? `${message.role}-${index}`}
                    className={`message ${message.role}`}
                  >
                    <span className="messageRole">
                      {message.role === "user" ? "You" : "Garden AI"}
                    </span>
                    <p>{message.content}</p>
                  </div>
                ))}
                {isLoading && (
                  <div className="message assistant" aria-busy="true">
                    <span className="messageRole">Garden AI</span>
                    <div className="typingDots" aria-label="Garden AI is typing">
                      <span />
                      <span />
                      <span />
                    </div>
                  </div>
                )}
              </div>

              <form className="composer" onSubmit={handleSubmit}>
                <input
                  ref={inputRef}
                  type="text"
                  name="message"
                  placeholder="Ask about your plant, season, or problem..."
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  aria-label="Message"
                  disabled={!isAuthed}
                />
                <button type="submit" disabled={isLoading || !isAuthed}>
                  {isLoading ? "Sending" : "Send"}
                </button>
              </form>

              <p className="helperText">
                This hobby app uses your local Ollama model, so it stays private
                and offline-friendly.
              </p>
            </section>
          </div>
        ) : (
          <section className="landing">
            <div className="landingIntro">
              <h2>Plan, plant, and keep every conversation.</h2>
              <p>
                Garden AI keeps your growing notes in one place. Create a
                profile with your climate and garden type, then get tailored
                advice for soil, pests, watering, and seasonal timing.
              </p>
              <div className="landingActions">
                <Link className="authButton" href="/signup">
                  Sign up
                </Link>
                <Link className="authGhostButton" href="/login">
                  Log in
                </Link>
              </div>
            </div>
            <div className="landingHighlights">
              <div className="highlightCard">
                <h3>Guided by your garden</h3>
                <p>
                  Save sunlight, irrigation style, and notes once and Garden AI
                  keeps your context ready for every chat.
                </p>
              </div>
              <div className="highlightCard">
                <h3>Local-first by design</h3>
                <p>
                  Uses your local Ollama model, so your garden planning stays
                  private and offline-friendly.
                </p>
              </div>
              <div className="highlightCard">
                <h3>Season-ready prompts</h3>
                <p>
                  Quick starter prompts cover watering schedules, leaf
                  yellowing, and compost basics.
                </p>
              </div>
            </div>
          </section>
        )}

        {isAuthed && isProfileOpen && (
          <div
            className="modalOverlay"
            role="dialog"
            aria-modal="true"
            onClick={() => {
              setProfileStatus("");
              setIsProfileOpen(false);
            }}
          >
            <div
              className="modalPanel"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="profileHeader">
                <h3>Profile settings</h3>
                <div className="profileActions">
                  <button
                    type="button"
                    className="profileSaveButton"
                    onClick={handleProfileSave}
                    disabled={isProfileSaving || isProfileLoading}
                  >
                    {isProfileSaving ? "Saving" : "Save"}
                  </button>
                  <button
                    type="button"
                    className="profileCloseButton"
                    onClick={() => {
                      setProfileStatus("");
                      setIsProfileOpen(false);
                    }}
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="profileBody">
                <div className="profileFields">
                  <label>
                    Location
                    <input
                      type="text"
                      value={profile.location}
                      onChange={(event) =>
                        updateProfileField("location", event.target.value)
                      }
                      placeholder="City, region, or zone"
                      disabled={isProfileLoading}
                    />
                  </label>
                  <label>
                    Environment
                    <select
                      value={profile.gardenEnvironment}
                      onChange={(event) =>
                        updateProfileField(
                          "gardenEnvironment",
                          event.target.value,
                        )
                      }
                      disabled={isProfileLoading}
                    >
                      <option value="">Select</option>
                      <option value="Outdoor">Outdoor</option>
                      <option value="Indoor">Indoor</option>
                      <option value="Both">Both</option>
                    </select>
                  </label>
                  <div className="profileGroup">
                    <span className="profileGroupLabel">Sunlight</span>
                    <div className="checkboxGroup" role="group">
                      {sunlightOptions.map((option) => (
                        <label key={option} className="checkboxOption">
                          <input
                            type="checkbox"
                            checked={profile.sunlight.includes(option)}
                            onChange={() =>
                              toggleProfileOption("sunlight", option)
                            }
                            disabled={isProfileLoading}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="profileGroup">
                    <span className="profileGroupLabel">Garden type</span>
                    <div className="checkboxGroup" role="group">
                      {gardenTypeOptions.map((option) => (
                        <label key={option} className="checkboxOption">
                          <input
                            type="checkbox"
                            checked={profile.gardenType.includes(option)}
                            onChange={() =>
                              toggleProfileOption("gardenType", option)
                            }
                            disabled={isProfileLoading}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="profileGroup">
                    <span className="profileGroupLabel">Irrigation</span>
                    <div className="checkboxGroup" role="group">
                      {irrigationOptions.map((option) => (
                        <label key={option} className="checkboxOption">
                          <input
                            type="checkbox"
                            checked={profile.irrigationStyle.includes(option)}
                            onChange={() =>
                              toggleProfileOption("irrigationStyle", option)
                            }
                            disabled={isProfileLoading}
                          />
                          <span>{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="profileNotes">
                    Other notes
                    <textarea
                      value={profile.notes}
                      onChange={(event) =>
                        updateProfileField("notes", event.target.value)
                      }
                      placeholder="Compost, soil mix, goals..."
                      rows={3}
                      disabled={isProfileLoading}
                    />
                  </label>
                </div>
                {isProfileLoading && (
                  <div className="profileFooter">Loading profile...</div>
                )}
                {profileStatus && (
                  <div className="profileFooter">{profileStatus}</div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
