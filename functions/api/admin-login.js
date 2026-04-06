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
    let body = {};

    if (contentType.includes("application/json")) {
      body = await request.json();
    } else {
      const form = await request.formData();
      body = {
        username: form.get("username"),
        password: form.get("password"),
      };
    }

    const username = String(body.username || "").trim();
    const password = String(body.password || "");

    const adminUser = String(env.ADMIN_USERNAME || "").trim();
    const adminPass = String(env.ADMIN_PASSWORD || "");

    if (!adminUser || !adminPass) {
      return json(
        { ok: false, error: "Admin credentials are not configured on the server." },
        500
      );
    }

    if (!username || !password) {
      return json(
        { ok: false, error: "Username and password are required." },
        400
      );
    }

    const userOk = safeEqual(username, adminUser);
    const passOk = safeEqual(password, adminPass);

    if (!userOk || !passOk) {
      return json(
        { ok: false, error: "Invalid username or password." },
        401
      );
    }

    const cookie = buildCookie("__lecture_admin", "1", 60 * 60 * 12); // 12 hours

    return json(
      {
        ok: true,
        message: "Login successful.",
      },
      200,
      {
        "Set-Cookie": cookie,
      }
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
