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

function getExtFromName(name = "") {
  const value = String(name || "").trim();
  const idx = value.lastIndexOf(".");
  if (idx === -1) return "";
  return value.slice(idx + 1).toLowerCase();
}

function inferFileType(file) {
  const ext = getExtFromName(file?.name || "");
  if (ext) return ext;

  const contentType = String(file?.type || "").toLowerCase();

  if (contentType.includes("pdf")) return "pdf";
  if (contentType.includes("presentation")) return "pptx";
  if (contentType.includes("powerpoint")) return "ppt";
  if (contentType.includes("wordprocessingml")) return "docx";
  if (contentType.includes("msword")) return "doc";
  if (contentType.includes("image/jpeg")) return "jpg";
  if (contentType.includes("image/png")) return "png";
  if (contentType.includes("image/webp")) return "webp";
  return "file";
}

function buildObjectKey(lectureId, file) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const ext = getExtFromName(file?.name || "") || "bin";

  return `lecture-files/${year}/${month}/${lectureId}-${stamp}-${rand}.${ext}`;
}

function buildPublicUrl(baseUrl, key) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const encodedKey = String(key)
    .split("/")
    .map((part) => encodeURIComponent(part))
    .join("/");

  return `${base}/${encodedKey}`;
}

async function uploadFileToR2(bucket, baseUrl, lectureId, file) {
  const key = buildObjectKey(lectureId, file);
  const buffer = await file.arrayBuffer();

  await bucket.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream",
    },
  });

  return buildPublicUrl(baseUrl, key);
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

    if (!env.LECTURE_BUCKET) {
      return json({ ok: false, error: "LECTURE_BUCKET binding is missing." }, 500);
    }

    if (!env.R2_PUBLIC_BASE_URL) {
      return json({ ok: false, error: "R2_PUBLIC_BASE_URL is missing." }, 500);
    }

    const form = await request.formData();
    const lectureId = Number(form.get("lecture_id"));

    if (!Number.isInteger(lectureId) || lectureId <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    const lecture = await env.DB.prepare(`
      SELECT id
      FROM lectures
      WHERE id = ?
      LIMIT 1
    `)
      .bind(lectureId)
      .first();

    if (!lecture) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    const files = form.getAll("files");

    if (!files.length) {
      return json({ ok: false, error: "No files selected." }, 400);
    }

    const validFiles = files.filter(
      (file) =>
        file &&
        typeof file === "object" &&
        typeof file.arrayBuffer === "function" &&
        Number(file.size || 0) > 0
    );

    if (!validFiles.length) {
      return json({ ok: false, error: "No valid files selected." }, 400);
    }

    const maxRow = await env.DB.prepare(`
      SELECT COALESCE(MAX(sort_order), 0) AS max_sort
      FROM lecture_files
      WHERE lecture_id = ?
    `)
      .bind(lectureId)
      .first();

    let nextSort = Number(maxRow?.max_sort || 0);

    const inserted = [];

    for (const file of validFiles) {
      const fileUrl = await uploadFileToR2(
        env.LECTURE_BUCKET,
        env.R2_PUBLIC_BASE_URL,
        lectureId,
        file
      );

      const fileName = clean(file.name) || `file-${Date.now()}`;
      const fileType = inferFileType(file);
      const fileSize = Number(file.size || 0);

      nextSort += 1;

      const result = await env.DB.prepare(`
        INSERT INTO lecture_files (
          lecture_id,
          file_name,
          file_type,
          file_size,
          file_url,
          thumbnail_url,
          sort_order
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
        .bind(
          lectureId,
          fileName,
          fileType,
          fileSize,
          fileUrl,
          "",
          nextSort
        )
        .run();

      const fileId = result.meta?.last_row_id;

      inserted.push({
        id: fileId,
        lecture_id: lectureId,
        file_name: fileName,
        file_type: fileType,
        file_size: fileSize,
        file_url: fileUrl,
        thumbnail_url: "",
        sort_order: nextSort,
      });
    }

    return json({
      ok: true,
      message: "Files added successfully.",
      lecture_id: lectureId,
      files: inserted,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to add files",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
