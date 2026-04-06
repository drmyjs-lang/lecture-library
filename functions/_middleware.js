function getCookie(cookieHeader, name) {
  if (!cookieHeader) return null;

  const parts = cookieHeader.split(/;\s*/);
  for (const part of parts) {
    const index = part.indexOf("=");
    if (index === -1) continue;

    const key = part.slice(0, index);
    const value = part.slice(index + 1);

    if (key === name) {
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }

  return null;
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.pathname;

  const isAdminPath = path === "/admin" || path.startsWith("/admin/");
  const isLoginPage =
    path === "/admin/login" ||
    path === "/admin/login/" ||
    path === "/admin/login/index.html";

  const isAllowedApi =
    path === "/api/admin-login" ||
    path === "/api/admin-logout";

  if (!isAdminPath || isLoginPage || isAllowedApi) {
    return context.next();
  }

  const sessionToken = getCookie(
    context.request.headers.get("Cookie"),
    "lecture_admin_session"
  );

  if (
    sessionToken &&
    context.env.ADMIN_SESSION_TOKEN &&
    sessionToken === context.env.ADMIN_SESSION_TOKEN
  ) {
    return context.next();
  }

  const next = path + url.search;
  const loginUrl = new URL("/admin/login/", url.origin);
  loginUrl.searchParams.set("next", next);

  return Response.redirect(loginUrl.toString(), 302);
}
