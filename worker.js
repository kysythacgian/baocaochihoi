// worker.js – Cloudflare Worker (kèm static assets)
// - File tĩnh (index.html, admin.html, ...) do Cloudflare phục vụ trực tiếp.
// - Chỉ các đường dẫn /api/* chạy qua file này (cấu hình run_worker_first trong wrangler.jsonc).
// Hai biến Secret khai báo trên Cloudflare (KHÔNG nằm trong code):
//   WEBAPP_URL      – link Google Apps Script (.../exec)
//   ADMIN_PASSWORD  – mật khẩu trang quản trị

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};
const ADMIN_ACTIONS = ["getStats", "getMonths", "ping"];

function reply(obj, status = 200) {
  return new Response(JSON.stringify(obj), { status, headers: JSON_HEADERS });
}

// So sánh mật khẩu an toàn (không lộ thông tin qua thời gian xử lý)
async function safeEqual(a, b) {
  const enc = new TextEncoder();
  const [ha, hb] = await Promise.all([
    crypto.subtle.digest("SHA-256", enc.encode(String(a ?? ""))),
    crypto.subtle.digest("SHA-256", enc.encode(String(b ?? ""))),
  ]);
  const x = new Uint8Array(ha), y = new Uint8Array(hb);
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

// Apps Script đôi khi trả HTML (lỗi/chưa cấp quyền) -> tránh làm sập proxy
async function readJson(upstream) {
  const text = await upstream.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      success: false,
      error: `Apps Script trả về dữ liệu không hợp lệ (HTTP ${upstream.status}). Kiểm tra lại WEBAPP_URL và quyền truy cập "Anyone".`,
    };
  }
}

async function handleProxy(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return reply({ success: false, error: "Dữ liệu gửi lên không phải JSON" }, 400);
  }

  const isAdminCall = body.action === "login" || ADMIN_ACTIONS.includes(body.action);

  // ── Xác thực admin (làm trước mọi thứ khác) ─────────────────────
  if (isAdminCall) {
    if (!env.ADMIN_PASSWORD) {
      return reply({ success: false, error: "ADMIN_PASSWORD chưa được cấu hình trên server" }, 500);
    }
    if (!(await safeEqual(body.password, env.ADMIN_PASSWORD))) {
      await new Promise((r) => setTimeout(r, 600)); // làm chậm việc dò mật khẩu
      return reply({ success: false, error: "Sai mật khẩu." }, 401);
    }
    if (body.action === "login") return reply({ success: true });
  }

  const WEBAPP_URL = env.WEBAPP_URL;
  if (!WEBAPP_URL) {
    return reply({ success: false, error: "WEBAPP_URL chưa được cấu hình trên server" }, 500);
  }

  try {
    // ── ADMIN: thống kê ──────────────────────────────────────────
    if (ADMIN_ACTIONS.includes(body.action)) {
      const params = new URLSearchParams({ action: body.action });
      if (body.thang) params.set("thang", body.thang);
      if (body.nam) params.set("nam", body.nam);

      const upstream = await fetch(`${WEBAPP_URL}?${params.toString()}`);
      return reply(await readJson(upstream));
    }

    // ── CHI HỘI: gửi file báo cáo ───────────────────────────────
    if (body.file && body.filename) {
      const upstream = await fetch(WEBAPP_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ file: body.file, filename: body.filename }),
      });
      return reply(await readJson(upstream));
    }

    return reply({ success: false, error: "Yêu cầu không hợp lệ" }, 400);
  } catch (err) {
    return reply({ success: false, error: err.message }, 500);
  }
}

export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/proxy") {
      if (request.method !== "POST") {
        return reply({ success: false, error: "Method not allowed" }, 405);
      }
      return handleProxy(request, env);
    }

    if (pathname.startsWith("/api/")) {
      return reply({ success: false, error: "Not found" }, 404);
    }

    // Các đường dẫn còn lại: trả về file tĩnh
    return env.ASSETS.fetch(request);
  },
};
