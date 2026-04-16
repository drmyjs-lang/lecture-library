function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeBaseUrl(value) {
  return clean(value).replace(/\/+$/, "");
}

function isAllowedUrl(env, fileUrl) {
  const rawTarget = clean(fileUrl);
  const rawBase = normalizeBaseUrl(env.R2_PUBLIC_BASE_URL);

  if (!rawTarget || !rawBase) return false;

  try {
    const targetUrl = new URL(rawTarget);
    const baseUrl = new URL(rawBase);

    if (targetUrl.origin !== baseUrl.origin) return false;

    const basePath = baseUrl.pathname.replace(/\/+$/, "");
    return targetUrl.pathname.startsWith(basePath + "/") || targetUrl.pathname === basePath;
  } catch {
    return false;
  }
}

export async function onRequestGet(context) {
  try {
    const { request, env } = context;

    if (!env.R2_PUBLIC_BASE_URL) {
      return json({ ok: false, error: "R2_PUBLIC_BASE_URL is missing." }, 500);
    }

    const url = new URL(request.url);
    const target = clean(url.searchParams.get("url"));

    if (!target) {
      return json({ ok: false, error: "Missing file url." }, 400);
    }

    if (!isAllowedUrl(env, target)) {
      return json(
        {
          ok: false,
          error: "URL is not allowed.",
          target,
          allowedBase: clean(env.R2_PUBLIC_BASE_URL),
        },
        403
      );
    }

    const forwardHeaders = new Headers();
    const range = request.headers.get("Range");
    if (range) forwardHeaders.set("Range", range);

    const upstream = await fetch(target, {
      method: "GET",
      headers: forwardHeaders,
      redirect: "follow",
    });

    if (!upstream.ok && upstream.status !== 206) {
      return json(
        { ok: false, error: `Upstream fetch failed with status ${upstream.status}.` },
        502
      );
    }

    const headers = new Headers();

    headers.set(
      "Content-Type",
      upstream.headers.get("Content-Type") || "application/octet-stream"
    );

    const contentLength = upstream.headers.get("Content-Length");
    if (contentLength) headers.set("Content-Length", contentLength);

    const acceptRanges = upstream.headers.get("Accept-Ranges");
    if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

    const contentRange = upstream.headers.get("Content-Range");
    if (contentRange) headers.set("Content-Range", contentRange);

    const contentDisposition = upstream.headers.get("Content-Disposition");
    if (contentDisposition) headers.set("Content-Disposition", contentDisposition);

    const etag = upstream.headers.get("ETag");
    if (etag) headers.set("ETag", etag);

    const lastModified = upstream.headers.get("Last-Modified");
    if (lastModified) headers.set("Last-Modified", lastModified);

    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("X-Content-Type-Options", "nosniff");

    return new Response(upstream.body, {
      status: upstream.status,
      headers,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        error: error.message || "Failed to proxy file.",
      },
      500
    );
  }
}
