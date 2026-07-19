// Interactive setup: prompts for an admin username + password, hashes the
// password with bcrypt, and writes both into .env (creating it from
// .env.example if it doesn't exist yet). Run with: node scripts/set-admin-password.js
import readline from "node:readline";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const envPath = path.join(rootDir, ".env");
const envExamplePath = path.join(rootDir, ".env.example");

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

function ask(question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function askHidden(question) {
  // Only mask keystrokes on a real interactive TTY; piped/redirected stdin
  // (e.g. from a script) doesn't echo characters anyway.
  if (!process.stdin.isTTY) return ask(question);

  return new Promise((resolve) => {
    let masked = false;
    const original = rl._writeToOutput?.bind(rl);
    rl._writeToOutput = (str) => {
      if (!masked) (original ? original(str) : rl.output.write(str));
    };

    rl.question(question, (answer) => {
      rl._writeToOutput = original;
      process.stdout.write("\n");
      resolve(answer);
    });

    masked = true;
  });
}

function setEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) {
    return contents.replace(pattern, line);
  }
  return `${contents.trim()}\n${line}\n`;
}

async function main() {
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
  }

  let envContents = fs.readFileSync(envPath, "utf8");

  const username = (await ask("Admin username: ")).trim();
  if (!username) {
    throw new Error("Username cannot be empty.");
  }

  const password = await askHidden("Admin password (input hidden): ");
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  if (!/SESSION_SECRET=.+/.test(envContents)) {
    const { randomBytes } = await import("node:crypto");
    envContents = setEnvValue(envContents, "SESSION_SECRET", randomBytes(48).toString("hex"));
  }

  const hash = await bcrypt.hash(password, 12);

  envContents = setEnvValue(envContents, "ADMIN_USERNAME", username);
  envContents = setEnvValue(envContents, "ADMIN_PASSWORD_HASH", hash);

  fs.writeFileSync(envPath, envContents);

  console.log(`\nSaved. Admin username "${username}" is set in .env — restart the server for it to take effect.`);
}

main()
  .catch((err) => {
    console.error("Failed to set admin password:", err.message);
    process.exitCode = 1;
  })
  .finally(() => rl.close());
