import { handleUpload } from "@vercel/blob/client";

import { readCategories } from "./gallery.js";

const MAX_UPLOAD_MB = 50;

// Issues a short-lived token so the browser can upload the photo directly
// to Vercel Blob, bypassing the ~4.5MB request body limit that would
// otherwise apply if the file were sent through this server.
export async function handleBlobUpload(req, res) {
  try {
    const jsonResponse = await handleUpload({
      body: req.body,
      request: req,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        let category = "";
        try {
          category = JSON.parse(clientPayload || "{}").category;
        } catch {
          // falls through to the validation below
        }
        const categories = await readCategories();
        if (!Object.keys(categories).includes(category)) {
          throw new Error("Unknown category.");
        }

        return {
          allowedContentTypes: ["image/jpeg", "image/png", "image/webp"],
          addRandomSuffix: true,
          maximumSizeInBytes: MAX_UPLOAD_MB * 1024 * 1024,
          // On Vercel this is inferred automatically from VERCEL_URL. Locally
          // there's no public URL for Blob to call back - onUploadCompleted
          // is a no-op anyway (metadata is saved via a separate client
          // request), so any syntactically valid URL satisfies the SDK here.
          ...(process.env.VERCEL ? {} : { callbackUrl: "http://localhost/unused" }),
        };
      },
      onUploadCompleted: async () => {
        // Metadata (category/alt) is saved separately by the client via
        // POST /api/gallery once the upload resolves, so nothing to do here.
      },
    });
    res.json(jsonResponse);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}
