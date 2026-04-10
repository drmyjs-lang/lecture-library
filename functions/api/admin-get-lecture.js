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

function getExt(value = "") {
  const clean = String(value || "").trim().toLowerCase().split("?")[0].split("#")[0];
  const lastDot = clean.lastIndexOf(".");
  if (lastDot === -1) return "";
  return clean.slice(lastDot + 1);
}

function normalizeType(type = "") {
  const t = String(type || "").trim().toLowerCase();

  if (!t) return "";
  if (["other", "file", "unknown", "bin"].includes(t)) return "";

  const aliases = {
    jpeg: "jpg",
    powerpoint: "ppt",
    powerpointx: "pptx",
    word: "doc",
  };

  return aliases[t] || t;
}

function inferTypeFromExt(ext = "") {
  const e = String(ext || "").trim().toLowerCase();

  const map = {
    pdf: "pdf",
    ppt: "ppt",
    pptx: "pptx",
    doc: "doc",
    docx: "docx",
    xls: "xls",
    xlsx: "xlsx",
    jpg: "jpg",
    jpeg: "jpg",
    png: "png",
    webp: "webp",
    gif: "gif",
    mp4: "mp4",
    mp3: "mp3",
    zip: "zip",
    rar: "rar",
    txt: "txt",
  };

  return map[e] || "";
}

function inferFileType(rawType, fileName, fileUrl) {
  const direct = normalizeType(rawType);
  if (direct) return direct;

  const fromName = inferTypeFromExt(getExt(fileName));
  if (fromName) return fromName;

  const fromUrl = inferTypeFromExt(getExt(fileUrl));
  if (fromUrl) return fromUrl;

  return "file";
}

function normalizeStoredFile(file) {
  return {
    id: file?.id ?? null,
    lecture_id: file?.lecture_id ?? null,
    file_name: String(file?.file_name || "").trim(),
    file_type: inferFileType(file?.file_type, file?.file_name, file?.file_url),
    file_size: Number(file?.file_size || 0),
    file_url: String(file?.file_url || "").trim(),
    thumbnail_url: String(file?.thumbnail_url || "").trim(),
    created_at: file?.created_at || null,
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
        files: (filesResult.results || []).map(normalizeStoredFile),
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
