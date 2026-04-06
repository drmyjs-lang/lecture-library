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

function safeEqual(a, b) {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

function clean(v) {
  return String(v ?? "").trim().normalize("NFKC");
}

function buildCookie(name, value, maxAge) {
  const parts = [
    `${name}=${value}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
  ];

  if (typeof maxAge === "number") {
    parts.push(`Max-Age=${maxAge}`);
  }

  return parts.join("; ");
}

export async function onRequestPost(context) {
  try {
    const { request, env } = context;

    const contentType = request.headers.get("content-type") || "";
    let rawPassword = "";

    if (contentType.includes("application/json")) {
      const body = await request.json();
      rawPassword = body.password;
    } else {
      const form = await request.formData();
      rawPassword = form.get("password");
    }

    const password = clean(rawPassword);
    const adminPass = clean(env.ADMIN_PASSWORD);

    if (!adminPass) {
      return json(
        { ok: false, error: "Admin password is not configured on the server." },
        500
      );
    }

    if (!password) {
      return json(
        { ok: false, error: "Password is required." },
        400
      );
    }

    if (!safeEqual(password, adminPass)) {
      return json(
        { ok: false, error: "Invalid password." },
        401
      );
    }

    const cookie = buildCookie("__lecture_admin", "1", 60 * 60 * 12);

    return json(
      { ok: true, message: "Login successful." },
      200,
      { "Set-Cookie": cookie }
    );
  } catch (err) {
    return json(
      {
        ok: false,
        error: "Login failed.",
        details: err?.message || "Unknown error",
      },
      500
    );
  }
}

export async function onRequestGet() {
  return json({ ok: false, error: "Method not allowed." }, 405);
}
