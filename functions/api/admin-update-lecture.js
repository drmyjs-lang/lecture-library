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

function clean(value) {
  return String(value ?? "").trim();
}

function isValidUrl(value) {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
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
    const lectureDate = clean(body.lecture_date);
    const fileUrl = clean(body.file_url);
    const coverImage = clean(body.cover_image);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    if (!title) {
      return json({ ok: false, error: "Title is required." }, 400);
    }

    if (fileUrl && !isValidUrl(fileUrl)) {
      return json({ ok: false, error: "Invalid file URL." }, 400);
    }

    if (coverImage && !isValidUrl(coverImage)) {
      return json({ ok: false, error: "Invalid cover image URL." }, 400);
    }

    const existing = await env.DB
      .prepare("SELECT id FROM lectures WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const result = await env.DB
      .prepare(`
        UPDATE lectures
        SET
          title = ?,
          description = ?,
          lecture_date = ?,
          file_url = ?,
          cover_image = ?
        WHERE id = ?
      `)
      .bind(
        title,
        description,
        lectureDate,
        fileUrl,
        coverImage,
        id
      )
      .run();

    if (!result.success) {
      return json({ ok: false, error: "Failed to update lecture." }, 500);
    }

    return json({
      ok: true,
      message: "Lecture updated successfully.",
      updatedId: id,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Update failed.",
        details: err?.message || "Unknown error",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
