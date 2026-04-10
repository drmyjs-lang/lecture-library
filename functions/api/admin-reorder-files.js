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

    const lectureId = Number(body.lecture_id);
    const orderedIds = Array.isArray(body.ordered_ids) ? body.ordered_ids.map(Number) : [];

    if (!Number.isInteger(lectureId) || lectureId <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    if (!orderedIds.length) {
      return json({ ok: false, error: "ordered_ids is required." }, 400);
    }

    const filesResult = await env.DB.prepare(`
      SELECT id
      FROM lecture_files
      WHERE lecture_id = ?
      ORDER BY sort_order ASC, created_at DESC, id DESC
    `)
      .bind(lectureId)
      .all();

    const existingIds = (filesResult.results || []).map((x) => Number(x.id)).sort((a, b) => a - b);
    const incomingIds = [...orderedIds].sort((a, b) => a - b);

    if (existingIds.length !== incomingIds.length) {
      return json({ ok: false, error: "ordered_ids does not match lecture files." }, 400);
    }

    for (let i = 0; i < existingIds.length; i++) {
      if (existingIds[i] !== incomingIds[i]) {
        return json({ ok: false, error: "ordered_ids contains invalid file ids." }, 400);
      }
    }

    const statements = orderedIds.map((fileId, index) =>
      env.DB.prepare(`
        UPDATE lecture_files
        SET sort_order = ?
        WHERE id = ? AND lecture_id = ?
      `).bind(index + 1, fileId, lectureId)
    );

    await env.DB.batch(statements);

    return json({
      ok: true,
      message: "Files reordered successfully.",
      lecture_id: lectureId,
      ordered_ids: orderedIds,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to reorder files",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
