import "dotenv/config";

import express from "express";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

import { requireAuth, login, logout, sessionStatus } from "./auth.js";
import { readGallery, addPhoto, removePhoto, readCategories, addCategory, removeCategory } from "./gallery.js";
import { handleBlobUpload } from "./blob-upload.js";

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "https://*.vercel-storage.com"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'", "https://*.vercel-storage.com"],
      },
    },
  })
);
app.use(express.json());
app.use(cookieParser());

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many upload attempts. Try again in a few minutes." },
});

// ---- Auth ----
app.post("/api/login", loginLimiter, login);
app.post("/api/logout", logout);
app.get("/api/session", sessionStatus);

// ---- Gallery ----
app.get("/api/gallery", async (req, res) => {
  res.json(await readGallery());
});

// Public so the site's gallery filter buttons can reflect whatever
// categories the admin has created, not just the ones baked into the HTML.
app.get("/api/gallery/categories", async (req, res) => {
  res.json(await readCategories());
});

app.post("/api/gallery/categories", requireAuth, async (req, res) => {
  const { label } = req.body || {};
  if (typeof label !== "string" || !label.trim()) {
    return res.status(400).json({ error: "Category name is required." });
  }

  try {
    const category = await addCategory(label);
    res.status(201).json(category);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/gallery/categories/:key", requireAuth, async (req, res) => {
  try {
    const removed = await removeCategory(req.params.key);
    if (!removed) return res.status(404).json({ error: "Category not found." });
    res.json({ removed });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Issues a token so the browser can upload the photo file directly to
// Vercel Blob; the gallery metadata is saved afterward via POST /api/gallery.
app.post("/api/blob-upload", requireAuth, uploadLimiter, handleBlobUpload);

app.post("/api/gallery", requireAuth, async (req, res) => {
  const { url, category, alt } = req.body || {};

  if (typeof url !== "string" || !url) {
    return res.status(400).json({ error: "Photo URL is required." });
  }
  const categories = await readCategories();
  if (!Object.keys(categories).includes(category)) {
    return res.status(400).json({ error: "Unknown category." });
  }

  const entry = await addPhoto({ url, category, alt });
  res.status(201).json(entry);
});

app.delete("/api/gallery/:id", requireAuth, async (req, res) => {
  const removed = await removePhoto(req.params.id);
  if (!removed) return res.status(404).json({ error: "Photo not found." });
  res.json({ removed });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

export default app;
