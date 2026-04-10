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

function clean(value) {
  return String(value ?? "").trim();
}

function getExt(value = "") {
  const cleanValue = clean(value).toLowerCase().split("?")[0].split("#")[0];
  const lastDot = cleanValue.lastIndexOf(".");
  if (lastDot === -1) return "";
  return cleanValue.slice(lastDot + 1);
}

function normalizeType(type = "") {
  const t = clean(type).toLowerCase();

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
  const e = clean(ext).toLowerCase();

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

function makePlaceholderCoverDataUrl(label = "Lecture Library") {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="1200" height="675" viewBox="0 0 1200 675">
      <rect width="1200" height="675" fill="#eef2ff"/>
      <rect x="50" y="50" width="1100" height="575" rx="28" fill="#ffffff" stroke="#dbeafe" stroke-width="3"/>
      <circle cx="160" cy="140" r="28" fill="#2563eb" opacity="0.18"/>
      <circle cx="1080" cy="540" r="42" fill="#2563eb" opacity="0.12"/>
      <text x="90" y="250" font-size="34" font-family="Arial, Tahoma, sans-serif" fill="#2563eb">Lecture Library</text>
      <text x="90" y="340" font-size="62" font-weight="700" font-family="Arial, Tahoma, sans-serif" fill="#14213d">${String(label || "Lecture").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</text>
      <text x="90" y="410" font-size="26" font-family="Arial, Tahoma, sans-serif" fill="#6b7280">No custom cover available</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function normalizeStoredFile(file) {
  return {
    id: file?.id ?? null,
    lecture_id: file?.lecture_id ?? null,
    file_name: clean(file?.file_name),
    file_type: inferFileType(file?.file_type, file?.file_name, file?.file_url),
    file_size: Number(file?.file_size || 0),
    file_url: clean(file?.file_url),
    thumbnail_url: clean(file?.thumbnail_url),
    sort_order: Number(file?.sort_order || 0),
    created_at: file?.created_at || null,
  };
}

function resolveLectureCover(storedCoverUrl, files, lectureTitle) {
  const directCover = clean(storedCoverUrl);
  if (directCover) return directCover;

  const list = Array.isArray(files) ? files : [];
  for (const file of list) {
    const thumb = clean(file?.thumbnail_url);
    if (thumb) return thumb;
  }

  return makePlaceholderCoverDataUrl(lectureTitle || "Lecture");
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
        sort_order,
        created_at
      FROM lecture_files
      WHERE lecture_id = ?
      ORDER BY sort_order ASC, created_at DESC, id DESC
    `)
      .bind(id)
      .all();

    const files = (filesResult.results || []).map(normalizeStoredFile);
    const storedCover = clean(lecture.cover_image_url);
    const effectiveCover = resolveLectureCover(storedCover, files, lecture.title);

    return json({
      ok: true,
      item: {
        ...lecture,
        stored_cover_image_url: storedCover,
        effective_cover_image_url: effectiveCover,
        files,
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
