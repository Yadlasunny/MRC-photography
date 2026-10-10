import crypto from "node:crypto";

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

// Fixed-length digests so timingSafeEqual never short-circuits on length,
// which would otherwise leak how many characters matched via timing.
function safeEqual(a, b) {
  const bufA = crypto.createHash("sha256").update(String(a)).digest();
  const bufB = crypto.createHash("sha256").update(String(b)).digest();
  return crypto.timingSafeEqual(bufA, bufB);
}

export function requireAuth(req, res, next) {
  if (isValidToken(req.cookies?.[COOKIE_NAME])) return next();
  res.status(401).json({ error: "Not signed in." });
}

export function login(req, res) {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const validUsername = safeEqual(username, process.env.ADMIN_USERNAME || "");
  const validPassword = safeEqual(password, process.env.ADMIN_PASSWORD || "");

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
