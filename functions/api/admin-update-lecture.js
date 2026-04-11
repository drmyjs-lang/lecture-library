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

function slugify(text) {
  return clean(text)
    .toLowerCase()
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[^\u0600-\u06FFa-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "lecture";
}

function normalizePublished(value) {
  return Number(value) === 1 ? 1 : 0;
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

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, error: "Invalid JSON body." }, 400);
    }

    const id = Number(body?.id);
    const title = clean(body?.title);
    const speaker = clean(body?.speaker);
    const lectureDate = clean(body?.lecture_date);
    const description = clean(body?.description);
    const coverImageUrl = clean(body?.cover_image_url);
    const isPublished = normalizePublished(body?.is_published);
    const slug = slugify(title);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    if (!title) {
      return json({ ok: false, error: "Title is required." }, 400);
    }

    if (!lectureDate) {
      return json({ ok: false, error: "Lecture date is required." }, 400);
    }

    const lecture = await env.DB.prepare(`
      SELECT id
      FROM lectures
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first();

    if (!lecture) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const result = await env.DB.prepare(`
      UPDATE lectures
      SET
        title = ?,
        speaker = ?,
        lecture_date = ?,
        description = ?,
        slug = ?,
        cover_image_url = ?,
        is_published = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(
        title,
        speaker,
        lectureDate,
        description,
        slug,
        coverImageUrl,
        isPublished,
        id
      )
      .run();

    if (!result.success) {
      return json({ ok: false, error: "Failed to update lecture." }, 500);
    }

    return json({
      ok: true,
      message: "Lecture updated successfully.",
      item: {
        id,
        title,
        speaker,
        lecture_date: lectureDate,
        description,
        slug,
        cover_image_url: coverImageUrl,
        is_published: isPublished,
      },
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to update lecture.",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
