import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

export const IMAGES_DIR = path.join(rootDir, "assets", "images");
const GALLERY_FILE = path.join(rootDir, "data", "gallery.json");

export const CATEGORIES = {
  wedding: "Wedding",
  birthday: "Birthday",
  "maternity-baby": "Maternity & Baby",
  modeling: "Modeling",
};

export async function readGallery() {
  const raw = await fs.readFile(GALLERY_FILE, "utf8");
  return JSON.parse(raw);
}

export async function writeGallery(list) {
  await fs.writeFile(GALLERY_FILE, JSON.stringify(list, null, 2));
}

export async function addPhoto({ filename, category, alt }) {
  const list = await readGallery();
  const entry = {
    id: randomUUID(),
    filename,
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

  const filePath = path.join(IMAGES_DIR, removed.filename);
  try {
    await fs.unlink(filePath);
  } catch (err) {
    if (err.code !== "ENOENT") throw err;
  }

  return removed;
}
