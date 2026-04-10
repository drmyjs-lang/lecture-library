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

export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    if (!isLoggedIn(request)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const url = new URL(request.url);
    const id = Number(url.searchParams.get("id"));

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    const lecture = await env.DB.prepare(`
      SELECT
        id,
        title,
        description,
        speaker,
        lecture_date,
        slug,
        cover_image_url,
        is_published,
        created_at,
        updated_at
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
        file_type,
        file_size,
        file_url,
        thumbnail_url,
        created_at
      FROM lecture_files
      WHERE lecture_id = ?
      ORDER BY created_at DESC, id DESC
    `)
      .bind(id)
      .all();

    return json({
      ok: true,
      item: {
        ...lecture,
        files: filesResult.results || [],
      },
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to load lecture",
      },
      500
    );
  }
}
