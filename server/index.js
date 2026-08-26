// Local development entry point only. In production this app runs as a
// Vercel Function via api/index.js — see that file and server/app.js.
import "dotenv/config";

// BLOB_READ_WRITE_TOKEN is intentionally not required here: without it the
// server still boots and login/gallery-viewing work fine — only uploading
// or deleting a photo will fail until Blob storage is connected.
for (const required of ["SESSION_SECRET", "REDIS_URL"]) {
  if (!process.env[required]) {
    console.error(`Missing ${required} in .env — see .env.example.`);
    process.exit(1);
  }
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.warn("BLOB_READ_WRITE_TOKEN is not set — photo upload/delete will fail until Blob storage is connected.");
}

const { default: app } = await import("./app.js");

const port = process.env.PORT || 3001;
app.listen(port, () => {
  console.log(`MRC Photography API listening on http://localhost:${port}`);
});
