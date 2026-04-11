function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function clean(value) {
  return String(value ?? "").trim();
}

function isAllowedUrl(env, fileUrl) {
  const url = clean(fileUrl);
  const base = clean(env.R2_PUBLIC_BASE_URL).replace(/\/+$/, "");
  if (!url || !base) return false;
  return url.startsWith(`${base}/`);
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
      return json({ ok: false, error: "URL is not allowed." }, 403);
    }

    const upstream = await fetch(target);

    if (!upstream.ok) {
      return json({ ok: false, error: `Upstream fetch failed with status ${upstream.status}.` }, 502);
    }

    const headers = new Headers();
    headers.set("Content-Type", upstream.headers.get("Content-Type") || "application/octet-stream");
    headers.set("Cache-Control", "public, max-age=3600");

    return new Response(upstream.body, {
      status: 200,
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
