import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

import express from "express";
import session from "express-session";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import multer from "multer";

import { requireAuth, login, logout, sessionStatus } from "./auth.js";
import { readGallery, addPhoto, removePhoto, IMAGES_DIR, CATEGORIES } from "./gallery.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const isProd = process.env.NODE_ENV === "production";

for (const required of ["SESSION_SECRET", "ADMIN_USERNAME", "ADMIN_PASSWORD_HASH"]) {
  if (!process.env[required]) {
    console.error(`Missing ${required} in .env — run "node scripts/set-admin-password.js" first.`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1);
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
      },
    },
  })
);
app.use(express.json());

app.use(
  session({
    name: "mrc.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: isProd,
      maxAge: 1000 * 60 * 60 * 8, // 8 hours
    },
  })
);

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many login attempts. Try again in a few minutes." },
});

const upload = multer({
  storage: multer.diskStorage({
    destination: IMAGES_DIR,
    filename: (req, file, cb) => {
      const ext = { "image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp" }[file.mimetype] || "";
      cb(null, `${randomUUID()}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ---- Auth ----
app.post("/api/login", loginLimiter, login);
app.post("/api/logout", logout);
app.get("/api/session", sessionStatus);

// ---- Gallery ----
app.get("/api/gallery", async (req, res) => {
  res.json(await readGallery());
});

app.get("/api/gallery/categories", requireAuth, (req, res) => {
  res.json(CATEGORIES);
});

app.post("/api/gallery", requireAuth, upload.single("photo"), async (req, res) => {
  const { category, alt } = req.body;

  if (!req.file) {
    return res.status(400).json({ error: "Photo file is required (jpeg, png, or webp, up to 8MB)." });
  }
  if (!Object.keys(CATEGORIES).includes(category)) {
    return res.status(400).json({ error: "Unknown category." });
  }

  const entry = await addPhoto({ filename: req.file.filename, category, alt });
  res.status(201).json(entry);
});

app.delete("/api/gallery/:id", requireAuth, async (req, res) => {
  const removed = await removePhoto(req.params.id);
  if (!removed) return res.status(404).json({ error: "Photo not found." });
  res.json({ removed });
});

// Uploaded (and seed) photos always come from disk, not the Vite build output.
app.use("/assets/images", express.static(IMAGES_DIR));

if (isProd) {
  const distDir = path.join(rootDir, "dist");
  app.use(express.static(distDir));
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === "LIMIT_FILE_SIZE" ? "Photo must be under 8MB." : err.message;
    return res.status(400).json({ error: message });
  }
  console.error(err);
  res.status(500).json({ error: "Something went wrong." });
});

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`MRC Photography API listening on http://localhost:${port}`);
});
