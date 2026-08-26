// Local development entry point only. In production this app runs as a
// Vercel Function via api/index.js — see that file and server/app.js.
import "dotenv/config";

for (const required of ["SESSION_SECRET", "UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN", "BLOB_READ_WRITE_TOKEN"]) {
  if (!process.env[required]) {
    console.error(`Missing ${required} in .env — see .env.example.`);
    process.exit(1);
  }
}

const { default: app } = await import("./app.js");

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`MRC Photography API listening on http://localhost:${port}`);
});
