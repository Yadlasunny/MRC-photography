// Sets the admin username + password, hashes the password with bcrypt, and
// writes both into .env (creating it from .env.example if it doesn't exist
// yet).
//
// Interactive:     node scripts/set-admin-password.js
// Non-interactive:  printf "username\npassword\n" | node scripts/set-admin-password.js
import readline from "node:readline";
import fs from "node:fs";
import bcrypt from "bcryptjs";

import { envPath, envExamplePath, setEnvValue } from "../server/env-file.js";

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
  if (!fs.existsSync(envPath)) {
    fs.copyFileSync(envExamplePath, envPath);
  }

  let envContents = fs.readFileSync(envPath, "utf8");

  const { username, password } = await promptCredentials();

  if (!username) {
    throw new Error("Username cannot be empty.");
  }
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

main().catch((err) => {
  console.error("Failed to set admin password:", err.message);
  process.exitCode = 1;
});
