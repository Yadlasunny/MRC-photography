import crypto from "node:crypto";
import bcrypt from "bcryptjs";

import { getRedisClient } from "./redis-client.js";

const ADMIN_KEY = "mrc:admin";
const COOKIE_NAME = "mrc_auth";
const MAX_AGE_MS = 1000 * 60 * 60 * 8; // 8 hours

// Sessions have to be stateless (a signed, self-contained cookie) rather
// than server-side (like express-session's default MemoryStore) because
// serverless invocations don't share memory between requests.
function sign(payload) {
  return crypto.createHmac("sha256", process.env.SESSION_SECRET).update(payload).digest("base64url");
}

function createToken() {
  const payload = Buffer.from(JSON.stringify({ exp: Date.now() + MAX_AGE_MS })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

function isValidToken(token) {
  if (!token || typeof token !== "string") return false;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return false;

  const expected = sign(payload);
  const actual = Buffer.from(signature);
  const wanted = Buffer.from(expected);
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) return false;

  try {
    const { exp } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    return typeof exp === "number" && Date.now() < exp;
  } catch {
    return false;
  }
}

function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: MAX_AGE_MS,
  };
}

async function readAdmin() {
  const redis = await getRedisClient();
  const raw = await redis.get(ADMIN_KEY);
  if (!raw) return null;
  return typeof raw === "string" ? JSON.parse(raw) : raw;
}

async function writeAdmin(admin) {
  const redis = await getRedisClient();
  await redis.set(ADMIN_KEY, JSON.stringify(admin));
}

export function requireAuth(req, res, next) {
  if (isValidToken(req.cookies?.[COOKIE_NAME])) return next();
  res.status(401).json({ error: "Not signed in." });
}

export async function login(req, res) {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const admin = await readAdmin();
  if (!admin) {
    return res.status(500).json({
      error: "No admin account is set up yet. Run: node scripts/set-admin-password.js",
    });
  }

  const validUsername = username === admin.username;
  // Always run bcrypt.compare, even on a bad username, so response timing
  // doesn't reveal whether the username was correct.
  const hash = validUsername ? admin.passwordHash : "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const validPassword = await bcrypt.compare(password, hash);

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  res.cookie(COOKIE_NAME, createToken(), cookieOptions());
  res.json({ authenticated: true });
}

export function logout(req, res) {
  res.clearCookie(COOKIE_NAME);
  res.json({ authenticated: false });
}

export function sessionStatus(req, res) {
  res.json({ authenticated: isValidToken(req.cookies?.[COOKIE_NAME]) });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const admin = await readAdmin();
  const validCurrent = admin && (await bcrypt.compare(currentPassword, admin.passwordHash));
  if (!validCurrent) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await writeAdmin({ username: admin.username, passwordHash: newHash });

  res.json({ success: true });
}
