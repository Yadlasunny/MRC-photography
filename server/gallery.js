import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";

import { getRedisClient } from "./redis-client.js";

const GALLERY_KEY = "mrc:gallery";

export const CATEGORIES = {
  wedding: "Wedding",
  birthday: "Birthday",
  "maternity-baby": "Maternity & Baby",
  modeling: "Modeling",
};

export async function readGallery() {
  const redis = await getRedisClient();
  const raw = await redis.get(GALLERY_KEY);
  if (!raw) return [];
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function writeGallery(list) {
  const redis = await getRedisClient();
  await redis.set(GALLERY_KEY, JSON.stringify(list));
}

export async function addPhoto({ url, category, alt }) {
  const list = await readGallery();
  const entry = {
    id: randomUUID(),
    url,
    category,
    categoryLabel: CATEGORIES[category],
    alt: alt || `${CATEGORIES[category]} photo`,
  };
  list.push(entry);
  await writeGallery(list);
  return entry;
}

export async function removePhoto(id) {
  const list = await readGallery();
  const index = list.findIndex((item) => item.id === id);
  if (index === -1) return null;

  const [removed] = list.splice(index, 1);
  await writeGallery(list);

  try {
    await del(removed.url);
  } catch (err) {
    // The gallery entry is already gone; don't fail the request over a
    // blob that may already have been deleted.
    console.error("Failed to delete blob for removed photo:", err);
  }

  return removed;
}
