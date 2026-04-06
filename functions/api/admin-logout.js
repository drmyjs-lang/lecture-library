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

function clearCookie(name) {
  return [
    `${name}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Secure",
    "Max-Age=0",
  ].join("; ");
}

async function handleLogout() {
  return json(
    {
      ok: true,
      message: "Logged out successfully.",
    },
    200,
    {
      "Set-Cookie": clearCookie("__lecture_admin"),
    }
  );
}

export async function onRequestPost() {
  return handleLogout();
}

export async function onRequestGet() {
  return handleLogout();
}
