// Creates or resets the admin account, stored in Upstash Redis (not .env —
// serverless functions can't write to their own filesystem at runtime).
// Needs UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN in the environment;
// for the deployed (production) store, get these locally with:
//   vercel env pull
//
// Interactive:      node scripts/set-admin-password.js
// Non-interactive:   printf "username\npassword\n" | node scripts/set-admin-password.js
import "dotenv/config";
import readline from "node:readline";
import bcrypt from "bcryptjs";

import { redis } from "../server/upstash.js";

const ADMIN_KEY = "mrc:admin";

function ask(rl, question) {
  return new Promise((resolve) => rl.question(question, resolve));
}

function askHidden(rl, question) {
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

// readline's rl.question() is meant for a real TTY: with piped/redirected
// stdin, the whole input arrives as one buffered chunk and a second
// question() call can miss it entirely. So for non-interactive use, read
// the raw stream ourselves instead — first line is the username, second
// is the password.
function readStdinLines() {
  return new Promise((resolve) => {
    let data = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => resolve(data.split(/\r?\n/)));
  });
}

async function promptCredentials() {
  if (!process.stdin.isTTY) {
    const [username = "", password = ""] = await readStdinLines();
    return { username: username.trim(), password };
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  try {
    const username = (await ask(rl, "Admin username: ")).trim();
    const password = await askHidden(rl, "Admin password (input hidden): ");
    return { username, password };
  } finally {
    rl.close();
  }
}

async function main() {
  for (const required of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"]) {
    if (!process.env[required]) {
      throw new Error(`Missing ${required} — run "vercel env pull" first.`);
    }
  }

  const { username, password } = await promptCredentials();

  if (!username) {
    throw new Error("Username cannot be empty.");
  }
  if (!password || password.length < 8) {
    throw new Error("Password must be at least 8 characters.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await redis.set(ADMIN_KEY, JSON.stringify({ username, passwordHash }));

  console.log(`\nSaved. Admin username "${username}" is set — sign in at /admin.html.`);
}

main().catch((err) => {
  console.error("Failed to set admin password:", err.message);
  process.exitCode = 1;
});
