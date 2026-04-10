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

    if (!env.DB) {
      return json({ ok: false, error: "DB binding is missing." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    const lecture = await env.DB.prepare(`
      SELECT id, title
      FROM lectures
      WHERE id = ?
      LIMIT 1
    `)
      .bind(id)
      .first();

    if (!lecture) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const filesCountRow = await env.DB.prepare(`
      SELECT COUNT(*) AS count
      FROM lecture_files
      WHERE lecture_id = ?
    `)
      .bind(id)
      .first();

    const filesCount = Number(filesCountRow?.count || 0);

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
      message: "Lecture deleted successfully.",
      deletedLectureId: id,
      deletedLectureTitle: lecture.title || "",
      deletedFilesCount: filesCount,
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
