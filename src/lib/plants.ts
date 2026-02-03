export type PlantRecord = {
  id: string;
  name: string;
  variety: string;
  location: string;
  status: string;
  nextTask: string;
  notes: string;
};

export type PlantInput = Omit<PlantRecord, "id">;

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

export const fetchPlants = async () => {
  const response = await fetch("/api/plants");
  const payload = await parseResponse<{ plants: PlantRecord[] }>(response);
  return payload.plants ?? [];
};

export const fetchPlantById = async (id: string) => {
  const response = await fetch(`/api/plants/${id}`);
  const payload = await parseResponse<{ plant: PlantRecord }>(response);
  return payload.plant;
};

export const createPlant = async (plant: PlantInput) => {
  const response = await fetch("/api/plants", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plant),
  });
  const payload = await parseResponse<{ plant: PlantRecord }>(response);
  return payload.plant;
};

export const updatePlant = async (plant: PlantRecord) => {
  const response = await fetch(`/api/plants/${plant.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(plant),
  });
  const payload = await parseResponse<{ plant: PlantRecord }>(response);
  return payload.plant;
};

export const deletePlant = async (id: string) => {
  const response = await fetch(`/api/plants/${id}`, { method: "DELETE" });
  await parseResponse<{ ok: true }>(response);
};
