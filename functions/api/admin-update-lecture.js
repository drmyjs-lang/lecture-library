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

function isValidUrl(value) {
  if (!value) return true;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

function extFromFilename(name = "") {
  const cleanName = String(name || "").trim();
  const idx = cleanName.lastIndexOf(".");
  if (idx === -1) return "";
  return cleanName.slice(idx + 1).toLowerCase();
}

function extFromContentType(type = "") {
  const map = {
    "application/pdf": "pdf",
    "application/vnd.ms-powerpoint": "ppt",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": "pptx",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif"
  };

  return map[String(type || "").toLowerCase()] || "";
}

function buildObjectKey(folder, file) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const stamp = Date.now();
  const random = Math.random().toString(36).slice(2, 8);

  const ext =
    extFromFilename(file?.name) ||
    extFromContentType(file?.type) ||
    "bin";

  return `${folder}/${year}/${month}/${stamp}-${random}.${ext}`;
}

function buildPublicUrl(baseUrl, key) {
  const base = String(baseUrl || "").replace(/\/+$/, "");
  const encodedKey = String(key)
    .split("/")
    .map(part => encodeURIComponent(part))
    .join("/");

  return `${base}/${encodedKey}`;
}

async function uploadToR2(bucket, baseUrl, folder, file) {
  const key = buildObjectKey(folder, file);
  const buffer = await file.arrayBuffer();

  await bucket.put(key, buffer, {
    httpMetadata: {
      contentType: file.type || "application/octet-stream"
    }
  });

  return buildPublicUrl(baseUrl, key);
}

function isRealFile(value) {
  return value && typeof value === "object" && typeof value.arrayBuffer === "function" && Number(value.size || 0) > 0;
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    if (!isLoggedIn(request)) {
      return json({ ok: false, error: "Unauthorized." }, 401);
    }

    const form = await request.formData();

    const id = Number(form.get("id"));
    const title = clean(form.get("title"));
    const description = clean(form.get("description"));
    const lectureDate = clean(form.get("lecture_date"));

    const existingFileUrlFromForm = clean(form.get("existing_file_url"));
    const existingCoverImageFromForm = clean(form.get("existing_cover_image"));

    const removeFile = clean(form.get("remove_file")) === "1";
    const removeCover = clean(form.get("remove_cover")) === "1";

    const lectureFile = form.get("lecture_file");
    const coverFile = form.get("cover_file");

    if (!Number.isInteger(id) || id <= 0) {
      return json({ ok: false, error: "Invalid lecture id." }, 400);
    }

    if (!title) {
      return json({ ok: false, error: "Title is required." }, 400);
    }

    const existing = await env.DB
      .prepare(`
        SELECT id, file_url, cover_image
        FROM lectures
        WHERE id = ?
      `)
      .bind(id)
      .first();

    if (!existing) {
      return json({ ok: false, error: "Lecture not found." }, 404);
    }

    let finalFileUrl = existingFileUrlFromForm || clean(existing.file_url);
    let finalCoverImage = existingCoverImageFromForm || clean(existing.cover_image);

    if (removeFile) {
      finalFileUrl = "";
    }

    if (removeCover) {
      finalCoverImage = "";
    }

    const bucket = env.LECTURE_FILES;
    const publicBaseUrl = clean(env.PUBLIC_R2_BASE_URL);

    if (isRealFile(lectureFile)) {
      if (!bucket) {
        return json({ ok: false, error: "R2 binding LECTURE_FILES is missing." }, 500);
      }
      if (!publicBaseUrl) {
        return json({ ok: false, error: "PUBLIC_R2_BASE_URL is missing." }, 500);
      }

      finalFileUrl = await uploadToR2(bucket, publicBaseUrl, "lectures/files", lectureFile);
    }

    if (isRealFile(coverFile)) {
      if (!bucket) {
        return json({ ok: false, error: "R2 binding LECTURE_FILES is missing." }, 500);
      }
      if (!publicBaseUrl) {
        return json({ ok: false, error: "PUBLIC_R2_BASE_URL is missing." }, 500);
      }

      if (!String(coverFile.type || "").startsWith("image/")) {
        return json({ ok: false, error: "Cover image must be an image file." }, 400);
      }

      finalCoverImage = await uploadToR2(bucket, publicBaseUrl, "lectures/covers", coverFile);
    }

    if (finalFileUrl && !isValidUrl(finalFileUrl)) {
      return json({ ok: false, error: "Invalid final file URL." }, 400);
    }

    if (finalCoverImage && !isValidUrl(finalCoverImage)) {
      return json({ ok: false, error: "Invalid final cover image URL." }, 400);
    }

    const result = await env.DB
      .prepare(`
        UPDATE lectures
        SET
          title = ?,
          description = ?,
          lecture_date = ?,
          file_url = ?,
          cover_image = ?
        WHERE id = ?
      `)
      .bind(
        title,
        description,
        lectureDate,
        finalFileUrl,
        finalCoverImage,
        id
      )
      .run();

    if (!result.success) {
      return json({ ok: false, error: "Failed to update lecture." }, 500);
    }

    return json({
      ok: true,
      message: "Lecture updated successfully.",
      updatedId: id,
      item: {
        id,
        title,
        description,
        lecture_date: lectureDate,
        file_url: finalFileUrl,
        cover_image: finalCoverImage
      }
    });
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Update failed.",
        details: err?.message || "Unknown error"
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
