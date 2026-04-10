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
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    const lecture = await env.DB.prepare(`
      SELECT
        id,
        title,
        cover_image_url
      FROM lectures
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first();

    if (!lecture) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const filesResult = await env.DB.prepare(`
      SELECT
        id,
        lecture_id,
        file_name,
        file_url,
        thumbnail_url
      FROM lecture_files
      WHERE lecture_id = ?
      ORDER BY created_at DESC, id DESC
    `)
      .bind(id)
      .all();

    const files = filesResult.results || [];

    const urlsToDelete = new Set();

    if (clean(lecture.cover_image_url)) {
      urlsToDelete.add(clean(lecture.cover_image_url));
    }

    for (const file of files) {
      if (clean(file.file_url)) {
        urlsToDelete.add(clean(file.file_url));
      }
      if (clean(file.thumbnail_url)) {
        urlsToDelete.add(clean(file.thumbnail_url));
      }
    }

    const deletedObjects = [];
    for (const fileUrl of urlsToDelete) {
      const result = await deleteR2ObjectByUrl(
        env.LECTURE_BUCKET,
        env.R2_PUBLIC_BASE_URL,
        fileUrl
      );
      deletedObjects.push(result);
    }

    await env.DB.batch([
      env.DB.prepare(`
        DELETE FROM lecture_files
        WHERE lecture_id = ?
      `).bind(id),

      env.DB.prepare(`
        DELETE FROM lectures
        WHERE id = ?
      `).bind(id),
    ]);

    return json({
      ok: true,
      message: "Lecture deleted successfully from DB and R2.",
      deletedLectureId: id,
      deletedLectureTitle: lecture.title || "",
      deletedFilesCount: files.length,
      deletedObjects,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to delete lecture",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
