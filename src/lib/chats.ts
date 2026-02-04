export type ChatSummary = {
  id: string;
  title: string;
  updatedAt: string;
};

const parseResponse = async <T>(response: Response): Promise<T> => {
  const payload = (await response.json().catch(() => ({}))) as T & {
    error?: string;
  };

  if (!response.ok) {
    const message =
      typeof payload?.error === "string" && payload.error.length
        ? payload.error
        : "Request failed.";
    throw new Error(message);
  }

  return payload;
};

export const fetchChatSummaries = async () => {
  const response = await fetch("/api/chats");
  const payload = await parseResponse<{ chats?: ChatSummary[] }>(response);
  return Array.isArray(payload.chats) ? payload.chats : [];
};
