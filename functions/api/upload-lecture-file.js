function corsHeaders() {
  return {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: corsHeaders(),
  });
}

function sanitizeName(name) {
  return String(name || "file")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "")
    .replace(/-+/g, "-");
}

function getExtension(fileName) {
  const original = String(fileName || "");
  const fromName = original.includes(".") ? original.split(".").pop().toLowerCase() : "";
  return fromName || "bin";
}

function detectSimpleType(fileName) {
  const ext = getExtension(fileName);
  if (ext === "pdf") return "pdf";
  if (ext === "ppt") return "ppt";
  if (ext === "pptx") return "pptx";
  if (ext === "doc") return "doc";
  if (ext === "docx") return "docx";
  return "other";
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(),
  });
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action === "create") {
      const body = await request.json();
      const fileName = String(body.fileName || "").trim();
      const fileType = String(body.fileType || "application/octet-stream").trim();

      if (!fileName) {
        return json({ ok: false, error: "fileName is required." }, 400);
      }

      const ext = getExtension(fileName);
      const safeBaseName =
        sanitizeName(String(fileName).replace(/\.[^.]+$/, "")) || "lecture-file";

      const randomPart = crypto.randomUUID();
      const key = `lecture-files/${Date.now()}-${randomPart}-${safeBaseName}.${ext}`;

      const multipartUpload = await env.LECTURE_BUCKET.createMultipartUpload(key, {
        httpMetadata: {
          contentType: fileType || "application/octet-stream",
        },
        customMetadata: {
          originalName: fileName,
          uploadedAt: new Date().toISOString(),
        },
      });

      return json({
        ok: true,
        key: multipartUpload.key,
        uploadId: multipartUpload.uploadId,
      });
    }

    if (action === "complete") {
      const body = await request.json();
      const key = String(body.key || "").trim();
      const uploadId = String(body.uploadId || "").trim();
      const fileName = String(body.fileName || "").trim();
      const fileSize = Number(body.fileSize || 0);
      const parts = Array.isArray(body.parts) ? body.parts : [];

      if (!key || !uploadId) {
        return json({ ok: false, error: "key and uploadId are required." }, 400);
      }

      if (!parts.length) {
        return json({ ok: false, error: "No uploaded parts provided." }, 400);
      }

      const multipartUpload = env.LECTURE_BUCKET.resumeMultipartUpload(key, uploadId);
      await multipartUpload.complete(parts);

      const publicBase = String(env.R2_PUBLIC_BASE_URL || "").trim().replace(/\/+$/, "");
      if (!publicBase) {
        return json(
          {
            ok: false,
            error: "Upload completed, but R2_PUBLIC_BASE_URL is not configured.",
          },
          500
        );
      }

      return json({
        ok: true,
        key,
        file_url: `${publicBase}/${key}`,
        file_name: fileName,
        file_type: detectSimpleType(fileName),
        file_size: fileSize,
        thumbnail_url: "",
      });
    }

    return json({ ok: false, error: "Unknown action." }, 400);
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Multipart upload failed.",
      },
      500
    );
  }
}

export async function onRequestPut(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action !== "upload-part") {
      return json({ ok: false, error: "Unknown action." }, 400);
    }

    const key = String(url.searchParams.get("key") || "").trim();
    const uploadId = String(url.searchParams.get("uploadId") || "").trim();
    const partNumber = Number(url.searchParams.get("partNumber") || 0);

    if (!key || !uploadId || !partNumber) {
      return json(
        { ok: false, error: "key, uploadId, and partNumber are required." },
        400
      );
    }

    if (!request.body) {
      return json({ ok: false, error: "Missing request body." }, 400);
    }

    const multipartUpload = env.LECTURE_BUCKET.resumeMultipartUpload(key, uploadId);
    const uploadedPart = await multipartUpload.uploadPart(partNumber, request.body);

    return json({
      ok: true,
      part: uploadedPart,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to upload part.",
      },
      500
    );
  }
}

export async function onRequestDelete(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);
    const action = url.searchParams.get("action");

    if (action !== "abort") {
      return json({ ok: false, error: "Unknown action." }, 400);
    }

    const key = String(url.searchParams.get("key") || "").trim();
    const uploadId = String(url.searchParams.get("uploadId") || "").trim();

    if (!key || !uploadId) {
      return json({ ok: false, error: "key and uploadId are required." }, 400);
    }

    const multipartUpload = env.LECTURE_BUCKET.resumeMultipartUpload(key, uploadId);
    await multipartUpload.abort();

    return json({ ok: true });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to abort multipart upload.",
      },
      500
    );
  }
}
