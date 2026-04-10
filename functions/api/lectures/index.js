function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function slugify(text) {
  return String(text || "")
    .toLowerCase()
    .trim()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9\u0600-\u06FF]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
}

async function generateUniqueSlug(DB, title) {
  const base = slugify(title) || `lecture-${Date.now()}`;
  let slug = base;
  let counter = 2;

  while (true) {
    const exists = await DB.prepare(
      "SELECT id FROM lectures WHERE slug = ? LIMIT 1"
    )
      .bind(slug)
      .first();

    if (!exists) return slug;

    slug = `${base}-${counter}`;
    counter++;
  }
}

function normalizeSort(sort) {
  return sort === "oldest" ? "ASC" : "DESC";
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
    sort_order: Number(file?.sort_order || 0),
    created_at: file?.created_at || null,
  };
}

function validateFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .filter((f) => f && typeof f === "object")
    .map((f) => {
      const file_name = String(f.file_name || "").trim();
      const file_url = String(f.file_url || "").trim();

      return {
        file_name,
        file_type: inferFileType(f.file_type, file_name, file_url),
        file_size: Number(f.file_size || 0),
        file_url,
        thumbnail_url: String(f.thumbnail_url || "").trim(),
      };
    })
    .filter((f) => f.file_name && f.file_url);
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;
    const url = new URL(request.url);

    const q = (url.searchParams.get("q") || "").trim();
    const sort = normalizeSort(url.searchParams.get("sort"));
    const publishedOnly = url.searchParams.get("published") !== "all";

    let lecturesQuery = `
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
      WHERE 1 = 1
    `;

    const binds = [];

    if (publishedOnly) {
      lecturesQuery += ` AND is_published = 1 `;
    }

    if (q) {
      lecturesQuery += `
        AND (
          title LIKE ?
          OR description LIKE ?
          OR speaker LIKE ?
        )
      `;
      const like = `%${q}%`;
      binds.push(like, like, like);
    }

    lecturesQuery += `
      ORDER BY lecture_date ${sort}, created_at ${sort}
    `;

    const lectures = await env.DB.prepare(lecturesQuery).bind(...binds).all();
    const items = lectures.results || [];

    if (!items.length) {
      return json({
        ok: true,
        items: [],
        count: 0,
      });
    }

    const lectureIds = items.map((x) => x.id);
    const placeholders = lectureIds.map(() => "?").join(",");

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
      WHERE lecture_id IN (${placeholders})
      ORDER BY sort_order ASC, created_at DESC, id DESC
    `)
      .bind(...lectureIds)
      .all();

    const files = (filesResult.results || []).map(normalizeStoredFile);
    const filesByLectureId = new Map();

    for (const file of files) {
      if (!filesByLectureId.has(file.lecture_id)) {
        filesByLectureId.set(file.lecture_id, []);
      }
      filesByLectureId.get(file.lecture_id).push(file);
    }

    const merged = items.map((lecture) => ({
      ...lecture,
      files: filesByLectureId.get(lecture.id) || [],
    }));

    return json({
      ok: true,
      items: merged,
      count: merged.length,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to load lectures",
      },
      500
    );
  }
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      return json(
        {
          ok: false,
          error: "Content-Type must be application/json",
        },
        400
      );
    }

    const body = await request.json();

    const title = String(body.title || "").trim();
    const description = String(body.description || "").trim();
    const speaker = String(body.speaker || "").trim();
    const lectureDate = String(body.lecture_date || "").trim();
    const coverImageUrl = String(body.cover_image_url || "").trim();
    const isPublished = body.is_published === false ? 0 : 1;
    const files = validateFiles(body.files);

    if (!title) {
      return json({ ok: false, error: "Title is required" }, 400);
    }

    if (!lectureDate) {
      return json({ ok: false, error: "Lecture date is required" }, 400);
    }

    const slug = await generateUniqueSlug(env.DB, title);

    const insertLecture = await env.DB.prepare(`
      INSERT INTO lectures (
        title,
        description,
        speaker,
        lecture_date,
        slug,
        cover_image_url,
        is_published
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
      .bind(
        title,
        description,
        speaker,
        lectureDate,
        slug,
        coverImageUrl,
        isPublished
      )
      .run();

    const lectureId = insertLecture.meta?.last_row_id;

    if (!lectureId) {
      return json({ ok: false, error: "Failed to create lecture" }, 500);
    }

    if (files.length) {
      const statements = files.map((file, index) =>
        env.DB.prepare(`
          INSERT INTO lecture_files (
            lecture_id,
            file_name,
            file_type,
            file_size,
            file_url,
            thumbnail_url,
            sort_order
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `).bind(
          lectureId,
          file.file_name,
          file.file_type,
          Number.isFinite(file.file_size) ? file.file_size : 0,
          file.file_url,
          file.thumbnail_url,
          index + 1
        )
      );

      await env.DB.batch(statements);
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
      .bind(lectureId)
      .first();

    const insertedFilesRaw = await env.DB.prepare(`
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
      .bind(lectureId)
      .all();

    const insertedFiles = (insertedFilesRaw.results || []).map(normalizeStoredFile);

    return json(
      {
        ok: true,
        item: {
          ...lecture,
          files: insertedFiles,
        },
      },
      201
    );
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to create lecture",
      },
      500
    );
  }
}
