import { randomUUID } from "node:crypto";
import { del } from "@vercel/blob";

import { getRedisClient } from "./redis-client.js";

const GALLERY_KEY = "mrc:gallery";
const CATEGORIES_KEY = "mrc:categories";

const DEFAULT_CATEGORIES = {
  wedding: "Wedding",
  birthday: "Birthday",
  "maternity-baby": "Baby",
  modeling: "Modeling",
};

function slugify(label) {
  return label
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export async function readCategories() {
  const redis = await getRedisClient();
  const raw = await redis.get(CATEGORIES_KEY);
  if (!raw) {
    await redis.set(CATEGORIES_KEY, JSON.stringify(DEFAULT_CATEGORIES));
    return { ...DEFAULT_CATEGORIES };
  }
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

export async function addCategory(label) {
  const key = slugify(label);
  if (!key) throw new Error("Category name is required.");

  const categories = await readCategories();
  if (categories[key]) throw new Error("A category with that name already exists.");

  categories[key] = label.trim();
  const redis = await getRedisClient();
  await redis.set(CATEGORIES_KEY, JSON.stringify(categories));
  return { key, label: categories[key] };
}

export async function removeCategory(key) {
  const categories = await readCategories();
  if (!categories[key]) return null;

  const gallery = await readGallery();
  if (gallery.some((photo) => photo.category === key)) {
    throw new Error("Remove or move all photos in this category before deleting it.");
  }

  const label = categories[key];
  delete categories[key];
  const redis = await getRedisClient();
  await redis.set(CATEGORIES_KEY, JSON.stringify(categories));
  return { key, label };
}

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
  const categories = await readCategories();
  const list = await readGallery();
  const entry = {
    id: randomUUID(),
    url,
    category,
    categoryLabel: categories[category],
    alt: alt || `${categories[category]} photo`,
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
