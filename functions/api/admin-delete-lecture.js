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

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!isLoggedIn(request)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid file id." }, 400);
    }

    const existing = await env.DB.prepare(`
      SELECT id, lecture_id, file_name
      FROM lecture_files
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first();

    if (!existing) {
      return json({ ok: false, error: "File not found." }, 404);
    }

    const result = await env.DB.prepare(`
      DELETE FROM lecture_files
      WHERE id = ?
    `)
      .bind(id)
      .run();

    if (!result.success) {
      return json({ ok: false, error: "Failed to delete file." }, 500);
    }

    return json({
      ok: true,
      message: "File deleted successfully.",
      deletedId: id,
      lectureId: existing.lecture_id,
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
