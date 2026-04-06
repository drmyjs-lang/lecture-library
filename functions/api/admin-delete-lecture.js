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
    if (key === name) {
      return rest.join("=");
    }
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
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    const existing = await env.DB
      .prepare("SELECT id, title FROM lectures WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const result = await env.DB
      .prepare("DELETE FROM lectures WHERE id = ?")
      .bind(id)
      .run();

    if (!result.success) {
      return json({ ok: false, error: "Failed to delete lecture." }, 500);
    }

    return json({
      ok: true,
      message: "Lecture deleted successfully.",
      deletedId: id,
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Delete failed.",
        details: err?.message || "Unknown error",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
