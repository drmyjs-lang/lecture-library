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

function extractObjectKeyFromPublicUrl(baseUrl, fileUrl) {
  const base = clean(baseUrl).replace(/\/+$/, "");
  const url = clean(fileUrl);

  if (!base || !url) return "";

  const prefix = `${base}/`;
  if (!url.startsWith(prefix)) return "";

  const key = url.slice(prefix.length);
  return decodeURIComponent(key);
}

async function deleteR2ObjectByUrl(bucket, publicBaseUrl, fileUrl) {
  const key = extractObjectKeyFromPublicUrl(publicBaseUrl, fileUrl);

  if (!key) {
    return {
      ok: true,
      skipped: true,
      url: fileUrl || "",
      key: "",
      reason: "URL is empty or not under R2_PUBLIC_BASE_URL",
    };
  }

  await bucket.delete(key);

  return {
    ok: true,
    skipped: false,
    url: fileUrl,
    key,
  };
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

    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid file id." }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT
        id,
        lecture_id,
        file_name,
        file_url,
        thumbnail_url
      FROM lecture_files
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first();

    if (!existing) {
      return json({ ok: false, error: "File not found." }, 404);
    }

    const deletedObjects = [];

    if (clean(existing.file_url)) {
      const result = await deleteR2ObjectByUrl(
        env.LECTURE_BUCKET,
        env.R2_PUBLIC_BASE_URL,
        existing.file_url
      );
      deletedObjects.push(result);
    }

    if (clean(existing.thumbnail_url)) {
      const result = await deleteR2ObjectByUrl(
        env.LECTURE_BUCKET,
        env.R2_PUBLIC_BASE_URL,
        existing.thumbnail_url
      );
      deletedObjects.push(result);
    }

    const dbResult = await env.DB.prepare(`
      DELETE FROM lecture_files
      WHERE id = ?
    `)
      .bind(id)
      .run();

    if (!dbResult.success) {
      return json({ ok: false, error: "Failed to delete file from database." }, 500);
    }

    return json({
      ok: true,
      message: "File deleted successfully from DB and R2.",
      deletedId: id,
      lectureId: existing.lecture_id,
      fileName: existing.file_name || "",
      deletedObjects,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to delete file",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
