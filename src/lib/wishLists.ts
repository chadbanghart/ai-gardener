export type WishListItem = {
  id: string;
  season: string;
  name: string;
  timing: string;
};

type WishListItemInput = Omit<WishListItem, "id">;

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

export const fetchWishListItems = async () => {
  const response = await fetch("/api/wish-lists");
  const payload = await parseResponse<{ items: WishListItem[] }>(response);
  return payload.items ?? [];
};

export const createWishListItem = async (item: WishListItemInput) => {
  const response = await fetch("/api/wish-lists", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(item),
  });
  const payload = await parseResponse<{ item: WishListItem }>(response);
  return payload.item;
};

export const updateWishListItem = async (
  id: string,
  updates: Pick<WishListItem, "name" | "timing">,
) => {
  const response = await fetch(`/api/wish-lists/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(updates),
  });
  const payload = await parseResponse<{ item: WishListItem }>(response);
  return payload.item;
};

export const deleteWishListItem = async (id: string) => {
  const response = await fetch(`/api/wish-lists/${id}`, {
    method: "DELETE",
  });
  await parseResponse<{ ok: true }>(response);
};
