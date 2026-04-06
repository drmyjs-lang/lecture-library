function getCookie(request, name) {
  const cookieHeader = request.headers.get("Cookie") || "";
  const cookies = cookieHeader.split(";");

  for (const item of cookies) {
    const [key, ...rest] = item.trim().split("=");
    if (key === name) {
      return rest.join("=");
    }
  }

  return null;
}

function isLoggedIn(request) {
  return getCookie(request, "__lecture_admin") === "1";
}

function redirect(url) {
  return Response.redirect(url.toString(), 302);
}

export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  const loggedIn = isLoggedIn(request);

  const isLoginPage =
    path === "/admin/login" ||
    path === "/admin/login/" ||
    path === "/admin/login/index.html";

  const isAdminApi =
    path === "/api/admin-login" ||
    path === "/api/admin-logout";

  const isAdminArea = path.startsWith("/admin");

  if (isAdminApi) {
    return next();
  }

  if (!isAdminArea) {
    return next();
  }

  if (isLoginPage) {
    if (loggedIn) {
      return redirect(new URL("/admin/", url));
    }
    return next();
  }

  if (!loggedIn) {
    const loginUrl = new URL("/admin/login/", url);
    loginUrl.searchParams.set("next", path);
    return redirect(loginUrl);
  }

  return next();
}
