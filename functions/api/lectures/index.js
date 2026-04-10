<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>لوحة إدارة مكتبة المحاضرات</title>
  <style>
    :root{
      --bg:#f3f6fb;
      --card:#ffffff;
      --text:#14213d;
      --muted:#6b7280;
      --line:#e5e7eb;
      --blue:#2563eb;
      --blue2:#1d4ed8;
      --red:#dc2626;
      --green:#16a34a;
      --shadow:0 10px 30px rgba(0,0,0,.08);
      --radius:18px;
    }

    *{box-sizing:border-box}

    body{
      margin:0;
      font-family:Tahoma, Arial, sans-serif;
      background:var(--bg);
      color:var(--text);
    }

    .wrap{
      max-width:1150px;
      margin:40px auto;
      padding:0 16px;
    }

    .topbar{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:18px 20px;
      display:flex;
      gap:12px;
      align-items:center;
      justify-content:space-between;
      flex-wrap:wrap;
      margin-bottom:20px;
    }

    .title h1{
      margin:0;
      font-size:30px;
    }

    .title p{
      margin:8px 0 0;
      color:var(--muted);
      font-size:15px;
    }

    .actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    button,
    a.btn{
      border:none;
      border-radius:14px;
      padding:12px 18px;
      font-size:15px;
      cursor:pointer;
      text-decoration:none;
      display:inline-flex;
      align-items:center;
      justify-content:center;
      gap:8px;
      font-family:inherit;
      transition:0.15s ease;
    }

    .btn-light{
      background:#eef2ff;
      color:var(--blue);
    }

    .btn-light:hover{
      background:#e0e7ff;
    }

    .btn-danger{
      background:#fee2e2;
      color:var(--red);
    }

    .btn-danger:hover{
      background:#fecaca;
    }

    .btn-success{
      background:#dcfce7;
      color:var(--green);
    }

    .btn-success:hover{
      background:#bbf7d0;
    }

    .card{
      background:var(--card);
      border:1px solid var(--line);
      border-radius:var(--radius);
      box-shadow:var(--shadow);
      padding:20px;
      margin-bottom:20px;
    }

    .toolbar{
      display:grid;
      grid-template-columns:1.5fr auto;
      gap:14px;
      align-items:center;
      margin-bottom:18px;
    }

    .search{
      width:100%;
      border:1px solid var(--line);
      background:#fff;
      border-radius:14px;
      padding:13px 15px;
      font-size:15px;
      outline:none;
      font-family:inherit;
    }

    .search:focus{
      border-color:var(--blue);
    }

    .count-box{
      display:flex;
      align-items:center;
      justify-content:flex-end;
      gap:10px;
      flex-wrap:wrap;
    }

    .badge{
      background:#eef2ff;
      color:var(--blue);
      border:1px solid #c7d2fe;
      border-radius:999px;
      padding:10px 14px;
      font-size:14px;
      white-space:nowrap;
    }

    .status{
      display:none;
      margin-bottom:16px;
      padding:14px 16px;
      border-radius:14px;
      font-size:15px;
    }

    .status.show{display:block}

    .status.ok{
      background:#dcfce7;
      color:#166534;
      border:1px solid #bbf7d0;
    }

    .status.err{
      background:#fee2e2;
      color:#991b1b;
      border:1px solid #fecaca;
    }

    .empty{
      color:var(--muted);
      text-align:center;
      padding:30px 10px;
      border:1px dashed var(--line);
      border-radius:14px;
      background:#fafafa;
    }

    .list{
      display:grid;
      gap:14px;
    }

    .lecture{
      border:1px solid var(--line);
      border-radius:16px;
      padding:16px;
      display:grid;
      grid-template-columns:140px 1fr;
      gap:16px;
      align-items:start;
      background:#fff;
    }

    .thumb{
      width:140px;
      height:140px;
      border-radius:14px;
      border:1px solid var(--line);
      background:#f8fafc center/cover no-repeat;
      overflow:hidden;
      display:flex;
      align-items:center;
      justify-content:center;
      color:#9ca3af;
      font-size:13px;
      text-align:center;
      padding:8px;
    }

    .lecture h3{
      margin:0 0 8px;
      font-size:22px;
      line-height:1.5;
    }

    .meta{
      color:var(--muted);
      font-size:14px;
      display:grid;
      gap:6px;
      margin-bottom:12px;
    }

    .desc{
      font-size:15px;
      line-height:1.9;
      margin-bottom:14px;
      white-space:pre-wrap;
    }

    .lecture-actions{
      display:flex;
      gap:10px;
      flex-wrap:wrap;
    }

    .loading{
      text-align:center;
      color:var(--muted);
      padding:20px;
    }

    .small{
      color:var(--muted);
      font-size:13px;
      word-break:break-word;
    }

    @media (max-width:820px){
      .toolbar{
        grid-template-columns:1fr;
      }

      .count-box{
        justify-content:flex-start;
      }
    }

    @media (max-width:700px){
      .lecture{
        grid-template-columns:1fr;
      }

      .thumb{
        width:100%;
        height:190px;
      }
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="topbar">
      <div class="title">
        <h1>لوحة إدارة مكتبة المحاضرات</h1>
        <p>عرض وإدارة المحاضرات مع البحث والتعديل والحذف.</p>
      </div>

      <div class="actions">
        <a class="btn btn-light" href="/admin/lecture-upload/">رفع محاضرة جديدة</a>
        <a class="btn btn-light" href="/" target="_blank" rel="noopener">فتح المكتبة العامة</a>
        <button id="logoutBtn" class="btn-danger" type="button">تسجيل الخروج</button>
      </div>
    </div>

    <div id="status" class="status"></div>

    <div class="card">
      <div class="toolbar">
        <input
          id="searchInput"
          class="search"
          type="text"
          placeholder="ابحث بالعنوان أو الوصف أو التاريخ أو المتحدث..."
        />

        <div class="count-box">
          <div id="countBadge" class="badge">إجمالي المحاضرات: 0</div>
          <div id="filteredBadge" class="badge">المعروض: 0</div>
        </div>
      </div>

      <div id="loading" class="loading">جاري تحميل المحاضرات...</div>
      <div id="empty" class="empty" style="display:none;">لا توجد محاضرات حاليًا.</div>
      <div id="list" class="list"></div>
    </div>
  </div>

  <script>
    const statusBox = document.getElementById("status");
    const listEl = document.getElementById("list");
    const loadingEl = document.getElementById("loading");
    const emptyEl = document.getElementById("empty");
    const logoutBtn = document.getElementById("logoutBtn");
    const searchInput = document.getElementById("searchInput");
    const countBadge = document.getElementById("countBadge");
    const filteredBadge = document.getElementById("filteredBadge");

    let allLectures = [];

    function showStatus(message, type = "ok") {
      statusBox.textContent = message;
      statusBox.className = `status show ${type}`;
    }

    function hideStatus() {
      statusBox.textContent = "";
      statusBox.className = "status";
    }

    function escapeHtml(value) {
      return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }

    function formatDate(value) {
      if (!value) return "—";
      try {
        return new Date(value).toLocaleString("ar-SA");
      } catch {
        return value;
      }
    }

    function pickFirstValue(...values) {
      for (const value of values) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          return value;
        }
      }
      return "";
    }

    function normalizeLecture(item) {
      const files = Array.isArray(item?.files) ? item.files : [];
      const firstFile = files.length ? files[0] : null;

      return {
        id: pickFirstValue(item?.id, item?.ID),
        title: pickFirstValue(item?.title, item?.name),
        description: pickFirstValue(item?.description, item?.desc, item?.details, item?.summary),
        speaker: pickFirstValue(item?.speaker),
        lecture_date: pickFirstValue(item?.lecture_date, item?.lectureDate, item?.date),
        created_at: pickFirstValue(item?.created_at, item?.createdAt),
        cover_image: pickFirstValue(
          item?.cover_image,
          item?.coverImage,
          item?.cover_image_url,
          item?.thumbnail_url,
          firstFile?.thumbnail_url
        ),
        file_url: pickFirstValue(
          item?.file_url,
          item?.fileUrl,
          firstFile?.file_url
        ),
        file_name: pickFirstValue(
          item?.file_name,
          firstFile?.file_name
        ),
        file_type: pickFirstValue(
          item?.file_type,
          firstFile?.file_type
        ),
        files
      };
    }

    function sortLectures(items) {
      return [...items]
        .map(normalizeLecture)
        .sort((a, b) => {
          const aDate = new Date(a.created_at || a.lecture_date || 0).getTime();
          const bDate = new Date(b.created_at || b.lecture_date || 0).getTime();
          return bDate - aDate;
        });
    }

    function updateCounts(filteredItems) {
      countBadge.textContent = `إجمالي المحاضرات: ${allLectures.length}`;
      filteredBadge.textContent = `المعروض: ${filteredItems.length}`;
    }

    function buildSearchText(item) {
      const x = normalizeLecture(item);
      return [
        x.title || "",
        x.description || "",
        x.lecture_date || "",
        x.speaker || "",
        x.file_name || "",
        x.file_url || ""
      ].join(" ").toLowerCase();
    }

    function getFilteredLectures() {
      const q = searchInput.value.trim().toLowerCase();

      if (!q) return sortLectures(allLectures);

      return sortLectures(
        allLectures.filter(item => buildSearchText(item).includes(q))
      );
    }

    function renderLectures(items) {
      loadingEl.style.display = "none";
      listEl.innerHTML = "";
      updateCounts(items);

      if (!Array.isArray(items) || items.length === 0) {
        emptyEl.style.display = "block";
        return;
      }

      emptyEl.style.display = "none";

      for (const rawItem of items) {
        const item = normalizeLecture(rawItem);

        const article = document.createElement("article");
        article.className = "lecture";

        const cover = item.cover_image || "";
        const thumbStyle = cover
          ? `background-image:url('${String(cover).replaceAll("'", "%27")}')`
          : "";

        const fileUrl = item.file_url || "";
        const fileName = item.file_name || "";
        const safeFileUrl = escapeHtml(fileUrl);
        const safeFileName = escapeHtml(fileName || fileUrl);

        article.innerHTML = `
          <div class="thumb" style="${thumbStyle}">
            ${cover ? "" : "بدون صورة"}
          </div>

          <div>
            <h3>${escapeHtml(item.title || "بدون عنوان")}</h3>

            <div class="meta">
              <div><strong>التاريخ:</strong> ${escapeHtml(item.lecture_date || "—")}</div>
              <div><strong>المتحدث:</strong> ${escapeHtml(item.speaker || "—")}</div>
              <div><strong>أضيفت في:</strong> ${escapeHtml(formatDate(item.created_at))}</div>
              <div><strong>المعرف:</strong> ${escapeHtml(item.id || "—")}</div>
              <div class="small"><strong>اسم الملف:</strong> ${fileName ? safeFileName : "—"}</div>
              <div class="small"><strong>رابط الملف:</strong> ${fileUrl ? safeFileUrl : "—"}</div>
            </div>

            <div class="desc">${escapeHtml(item.description || "لا يوجد وصف.")}</div>

            <div class="lecture-actions">
              <button
                class="btn-light"
                type="button"
                onclick="window.location.href='/admin/edit-lecture/?id=${Number(item.id)}'">
                تعديل
              </button>

              <button
                class="btn-danger"
                type="button"
                onclick="deleteLecture(${Number(item.id)})">
                حذف
              </button>

              ${
                fileUrl
                  ? `
                    <a class="btn btn-success" href="${safeFileUrl}" target="_blank" rel="noopener">
                      فتح الملف
                    </a>
                    <button class="btn-light" type="button" onclick='copyText(${JSON.stringify(fileUrl)})'>
                      نسخ الرابط
                    </button>
                  `
                  : `
                    <button class="btn-light" type="button" disabled>
                      لا يوجد ملف
                    </button>
                  `
              }
            </div>
          </div>
        `;

        listEl.appendChild(article);
      }
    }

    function applyFilter() {
      renderLectures(getFilteredLectures());
    }

    async function loadLectures() {
      try {
        hideStatus();
        loadingEl.style.display = "block";
        emptyEl.style.display = "none";
        listEl.innerHTML = "";

        const res = await fetch("/api/lectures");
        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "تعذر تحميل المحاضرات.");
        }

        allLectures = Array.isArray(data.items) ? data.items : [];
        applyFilter();
      } catch (err) {
        loadingEl.style.display = "none";
        updateCounts([]);
        showStatus(err.message || "حدث خطأ أثناء تحميل المحاضرات.", "err");
      }
    }

    async function deleteLecture(id) {
      const ok = window.confirm("هل أنت متأكد من حذف هذه المحاضرة؟");
      if (!ok) return;

      try {
        const res = await fetch("/api/admin-delete-lecture", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ id })
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "تعذر حذف المحاضرة.");
        }

        allLectures = allLectures.filter(item => Number(normalizeLecture(item).id) !== Number(id));
        applyFilter();
        showStatus("تم حذف المحاضرة بنجاح.", "ok");
      } catch (err) {
        showStatus(err.message || "حدث خطأ أثناء حذف المحاضرة.", "err");
      }
    }

    async function logout() {
      try {
        logoutBtn.disabled = true;

        const res = await fetch("/api/admin-logout", {
          method: "POST"
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data?.error || "تعذر تسجيل الخروج.");
        }

        window.location.href = "/admin/login/";
      } catch (err) {
        showStatus(err.message || "حدث خطأ أثناء تسجيل الخروج.", "err");
      } finally {
        logoutBtn.disabled = false;
      }
    }

    async function copyText(value) {
      try {
        await navigator.clipboard.writeText(String(value || ""));
        showStatus("تم نسخ الرابط.", "ok");
      } catch {
        showStatus("تعذر نسخ الرابط.", "err");
      }
    }

    searchInput.addEventListener("input", applyFilter);
    logoutBtn.addEventListener("click", logout);

    window.deleteLecture = deleteLecture;
    window.copyText = copyText;

    loadLectures();
  </script>
</body>
</html>
