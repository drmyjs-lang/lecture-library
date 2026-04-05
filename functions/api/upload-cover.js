function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

function sanitizeName(name) {
  return String(name || "file")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");
}

function getExtension(file) {
  const original = String(file?.name || "");
  const fromName = original.includes(".") ? original.split(".").pop().toLowerCase() : "";
  if (fromName) return fromName;

  const type = String(file?.type || "").toLowerCase();
  if (type === "image/jpeg") return "jpg";
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "bin";
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return json({ ok: false, error: "No file uploaded." }, 400);
    }

    if (!String(file.type || "").startsWith("image/")) {
      return json({ ok: false, error: "Only image files are allowed." }, 400);
    }

    const maxSize = 10 * 1024 * 1024;
    if ((file.size || 0) > maxSize) {
      return json({ ok: false, error: "Cover image is too large. Max 10 MB." }, 400);
    }

    const ext = getExtension(file);
    const safeBaseName = sanitizeName(
      String(file.name || "cover").replace(/\.[^.]+$/, "")
    ) || "cover";

    const randomPart = crypto.randomUUID();
    const key = `covers/${Date.now()}-${randomPart}-${safeBaseName}.${ext}`;

    const bytes = await file.arrayBuffer();

    await env.LECTURE_BUCKET.put(key, bytes, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        originalName: String(file.name || ""),
        uploadedAt: new Date().toISOString(),
      },
    });

    const publicBase = String(env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
    if (!publicBase) {
      return json(
        {
          ok: false,
          error: "Upload succeeded, but R2_PUBLIC_BASE_URL is not configured yet.",
          key,
        },
        500
      );
    }

    const fileUrl = `${publicBase}/${key}`;

    return json({
      ok: true,
      key,
      file_url: fileUrl,
      file_name: file.name || "",
      file_type: file.type || "",
      file_size: file.size || 0,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to upload cover image.",
      },
      500
    );
  }
}
