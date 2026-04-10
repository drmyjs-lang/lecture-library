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

function validateFiles(files) {
  if (!Array.isArray(files)) return [];

  return files
    .filter((f) => f && typeof f === "object")
    .map((f) => ({
      file_name: String(f.file_name || "").trim(),
      file_type: String(f.file_type || "").trim().toLowerCase(),
      file_size: Number(f.file_size || 0),
      file_url: String(f.file_url || "").trim(),
      thumbnail_url: String(f.thumbnail_url || "").trim(),
    }))
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
        created_at
      FROM lecture_files
      WHERE lecture_id IN (${placeholders})
      ORDER BY created_at DESC, id DESC
    `)
      .bind(...lectureIds)
      .all();

    const files = filesResult.results || [];
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
      const statements = files.map((file) =>
        env.DB.prepare(`
          INSERT INTO lecture_files (
            lecture_id,
            file_name,
            file_type,
            file_size,
            file_url,
            thumbnail_url
          ) VALUES (?, ?, ?, ?, ?, ?)
        `).bind(
          lectureId,
          file.file_name,
          file.file_type,
          Number.isFinite(file.file_size) ? file.file_size : 0,
          file.file_url,
          file.thumbnail_url
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

    const insertedFiles = await env.DB.prepare(`
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
      .bind(lectureId)
      .all();

    return json(
      {
        ok: true,
        item: {
          ...lecture,
          files: insertedFiles.results || [],
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
