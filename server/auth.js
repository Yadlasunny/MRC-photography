import bcrypt from "bcryptjs";

import { readEnvFile, writeEnvFile, setEnvValue } from "./env-file.js";

export function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  res.status(401).json({ error: "Not signed in." });
}

export async function login(req, res) {
  const { username, password } = req.body || {};

  if (typeof username !== "string" || typeof password !== "string") {
    return res.status(400).json({ error: "Username and password are required." });
  }

  const validUsername = username === process.env.ADMIN_USERNAME;
  // Always run bcrypt.compare, even on a bad username, so response timing
  // doesn't reveal whether the username was correct.
  const hash = validUsername ? process.env.ADMIN_PASSWORD_HASH : "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinva";
  const validPassword = await bcrypt.compare(password, hash);

  if (!validUsername || !validPassword) {
    return res.status(401).json({ error: "Incorrect username or password." });
  }

  req.session.regenerate((err) => {
    if (err) return res.status(500).json({ error: "Could not start session." });
    req.session.authenticated = true;
    req.session.save((saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Could not save session." });
      res.json({ authenticated: true });
    });
  });
}

export function logout(req, res) {
  req.session.destroy(() => {
    res.clearCookie("mrc.sid");
    res.json({ authenticated: false });
  });
}

export function sessionStatus(req, res) {
  res.json({ authenticated: !!req.session?.authenticated });
}

export async function changePassword(req, res) {
  const { currentPassword, newPassword } = req.body || {};

  if (typeof currentPassword !== "string" || typeof newPassword !== "string") {
    return res.status(400).json({ error: "Current and new password are required." });
  }
  if (newPassword.length < 8) {
    return res.status(400).json({ error: "New password must be at least 8 characters." });
  }

  const validCurrent = await bcrypt.compare(currentPassword, process.env.ADMIN_PASSWORD_HASH);
  if (!validCurrent) {
    return res.status(401).json({ error: "Current password is incorrect." });
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  const envContents = await readEnvFile();
  await writeEnvFile(setEnvValue(envContents, "ADMIN_PASSWORD_HASH", newHash));
  process.env.ADMIN_PASSWORD_HASH = newHash;

  res.json({ success: true });
}
