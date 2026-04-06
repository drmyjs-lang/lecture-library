function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers,
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

    const item = await env.DB
      .prepare(`
        SELECT id, title, description, lecture_date, file_url, cover_image, created_at
        FROM lectures
        WHERE id = ?
      `)
      .bind(id)
      .first();

    if (!item) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    return json({ ok: true, item });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Failed to load lecture.",
        details: err?.message || "Unknown error",
      },
      500
    );
  }
}
