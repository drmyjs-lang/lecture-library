function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";");

  for (const item of cookies) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) return rest.join("=");
  }

  return null;
}

function isLoggedIn(request) {
  return getCookie(request, "__lecture_admin") === "1";
}

function clean(value) {
  return String(value ?? "").trim();
}

function getExtFromName(name = "") {
  const value = String(name || "").trim();
  const idx = value.lastIndexOf(".");
  if (idx === -1) return "";
  return value.slice(idx + 1).toLowerCase();
}

function getExtFromType(type = "") {
  const value = String(type || "").toLowerCase();

  if (value.includes("jpeg")) return "jpg";
  if (value.includes("jpg")) return "jpg";
  if (value.includes("png")) return "png";
  if (value.includes("webp")) return "webp";
  if (value.includes("gif")) return "gif";
  if (value.includes("svg")) return "svg";

  return "";
}

function buildObjectKey(lectureId, file) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);

  const ext =
    getExtFromName(file?.name || "") ||
    getExtFromType(file?.type || "") ||
    "bin";

  return `lecture-covers/${year}/${month}/${lectureId}-${stamp}-${rand}.${ext}`;
}

function buildPublicUrl(baseUrl, key) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const encodedKey = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${base}/${encodedKey}`;
}

async function uploadCoverToR2(bucket, baseUrl, lectureId, file) {
  const key = buildObjectKey(lectureId, file);
  const buffer = await file.arrayBuffer();

  await bucket.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return buildPublicUrl(baseUrl, key);
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!isLoggedIn(request)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    if (!env.DB) {
      return json({ ok: false, error: "DB binding is missing." }, 500);
    }

    if (!env.LECTURE_BUCKET) {
      return json({ ok: false, error: "LECTURE_BUCKET binding is missing." }, 500);
    }

    if (!env.R2_PUBLIC_BASE_URL) {
      return json({ ok: false, error: "R2_PUBLIC_BASE_URL is missing." }, 500);
    }

    const form = await request.formData();
    const lectureId = Number(form.get("lecture_id"));
    const coverFile = form.get("cover");

    if (!Number.isInteger(lectureId) || lectureId <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    const lecture = await env.DB.prepare(`
      SELECT id, cover_image_url
      FROM lectures
      WHERE id = ?
      LIMIT 1
    `)
      .bind(lectureId)
      .first();

    if (!lecture) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    if (
      !coverFile ||
      typeof coverFile !== "object" ||
      typeof coverFile.arrayBuffer !== "function" ||
      Number(coverFile.size || 0) <= 0
    ) {
      return json({ ok: false, error: "No valid cover image selected." }, 400);
    }

    const contentType = clean(coverFile.type).toLowerCase();
    if (!contentType.startsWith("image/")) {
      return json({ ok: false, error: "Cover must be an image file." }, 400);
    }

    const coverUrl = await uploadCoverToR2(
      env.LECTURE_BUCKET,
      env.R2_PUBLIC_BASE_URL,
      lectureId,
      coverFile
    );

    const result = await env.DB.prepare(`
      UPDATE lectures
      SET
        cover_image_url = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(coverUrl, lectureId)
      .run();

    if (!result.success) {
      return json({ ok: false, error: "Failed to update cover image." }, 500);
    }

    return json({
      ok: true,
      message: "Cover uploaded successfully.",
      lecture_id: lectureId,
      cover_image_url: coverUrl,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to upload cover",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
