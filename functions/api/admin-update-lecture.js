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

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function generateUniqueSlug(DB, title, excludeId) {
  const base = slugify(title) || `lecture-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (true) {
    const exists = await DB.prepare(
      "SELECT id FROM lectures WHERE slug = ? AND id != ? LIMIT 1"
    )
      .bind(slug, excludeId)
      .first();

    if (!exists) return slug;

    slug = `${base}-${counter}`;
    counter++;
  }
}

function clean(value) {
  return String(value ?? "").trim();
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!isLoggedIn(request)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const body = await request.json().catch(() => ({}));

    const id = Number(body.id);
    const title = clean(body.title);
    const description = clean(body.description);
    const speaker = clean(body.speaker);
    const lectureDate = clean(body.lecture_date);
    const coverImageUrl = clean(body.cover_image_url);
    const isPublished = body.is_published === false || body.is_published === 0 ? 0 : 1;

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    if (!title) {
      return json({ ok: false, error: "Title is required." }, 400);
    }

    if (!lectureDate) {
      return json({ ok: false, error: "Lecture date is required." }, 400);
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM lectures WHERE id = ? LIMIT 1"
    )
      .bind(id)
      .first();

    if (!existing) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const slug = await generateUniqueSlug(env.DB, title, id);

    const result = await env.DB.prepare(`
      UPDATE lectures
      SET
        title = ?,
        description = ?,
        speaker = ?,
        lecture_date = ?,
        slug = ?,
        cover_image_url = ?,
        is_published = ?,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `)
      .bind(
        title,
        description,
        speaker,
        lectureDate,
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
      id,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to update lecture",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
