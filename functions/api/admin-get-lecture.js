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

async function getLectureColumns(env) {
  const result = await env.DB.prepare("PRAGMA table_info(lectures)").all();
  const rows = Array.isArray(result?.results) ? result.results : [];
  return rows.map(row => row.name);
}

function pickColumn(columns, candidates) {
  for (const name of candidates) {
    if (columns.includes(name)) return name;
  }
  return null;
}

function pickValue(row, keys) {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return "";
}

function normalizeLecture(row) {
  return {
    id: row?.id ?? "",
    title: pickValue(row, ["title", "name"]),
    description: pickValue(row, ["description", "desc", "details", "summary"]),
    lecture_date: pickValue(row, ["lecture_date", "lectureDate", "date"]),
    file_url: pickValue(row, [
      "file_url",
      "fileUrl",
      "public_url",
      "publicUrl",
      "file_link",
      "fileLink",
      "file"
    ]),
    cover_image: pickValue(row, [
      "cover_image",
      "coverImage",
      "thumbnail_url",
      "thumbnailUrl",
      "cover_url",
      "coverUrl",
      "image_url",
      "imageUrl"
    ]),
    created_at: pickValue(row, ["created_at", "createdAt"])
  };
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

    const columns = await getLectureColumns(env);

    if (!columns.includes("id")) {
      return json({ ok: false, error: "Lectures table is missing id column." }, 500);
    }

    const row = await env.DB
      .prepare("SELECT * FROM lectures WHERE id = ?")
      .bind(id)
      .first();

    if (!row) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const item = normalizeLecture(row);

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
