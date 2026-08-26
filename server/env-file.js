import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

export const envPath = path.join(rootDir, ".env");
export const envExamplePath = path.join(rootDir, ".env.example");

export function setEnvValue(contents, key, value) {
  const line = `${key}=${value}`;
  const pattern = new RegExp(`^${key}=.*$`, "m");
  if (pattern.test(contents)) return contents.replace(pattern, line);
  return `${contents.trim()}\n${line}\n`;
}

export async function readEnvFile() {
  return fs.readFile(envPath, "utf8");
}

export async function writeEnvFile(contents) {
  await fs.writeFile(envPath, contents);
}
