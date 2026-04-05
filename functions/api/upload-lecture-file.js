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

  return "bin";
}

function detectSimpleType(ext) {
  const value = String(ext || "").toLowerCase();
  if (value === "pdf") return "pdf";
  if (value === "ppt") return "ppt";
  if (value === "pptx") return "pptx";
  if (value === "doc") return "doc";
  if (value === "docx") return "docx";
  return "other";
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

    const maxSize = 250 * 1024 * 1024;
    if ((file.size || 0) > maxSize) {
      return json({ ok: false, error: "File is too large. Max 250 MB." }, 400);
    }

    const ext = getExtension(file);
    const safeBaseName = sanitizeName(
      String(file.name || "lecture-file").replace(/\.[^.]+$/, "")
    ) || "lecture-file";

    const randomPart = crypto.randomUUID();
    const key = `lecture-files/${Date.now()}-${randomPart}-${safeBaseName}.${ext}`;

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
    const simpleType = detectSimpleType(ext);

    return json({
      ok: true,
      key,
      file_url: fileUrl,
      file_name: file.name || "",
      file_type: simpleType,
      file_size: file.size || 0,
      thumbnail_url: "",
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to upload lecture file.",
      },
      500
    );
  }
}
