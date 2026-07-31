// YouTube Otomasyon — Localhost Kontrol Paneli
// Sifir bagimlilik: sadece Node dahili modulleri. Calistir: node server.js
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const VIDEOS_DIR = path.join(ROOT, "videolar");
const PUBLIC_DIR = path.join(ROOT, "public");
const TEMPLATE = path.join(ROOT, "templates", "video-paketi-sablonu.md");
const PORT = process.env.PORT ? Number(process.env.PORT) : 4173;

const STAGES = ["fikir", "senaryo", "gorsel", "ses", "kurgu", "thumbnail", "seo", "hazir", "yuklendi"];

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function safeDir(name) {
  // yol enjeksiyonunu engelle: sadece tek klasor adi
  return typeof name === "string" && /^[A-Za-z0-9._-]+$/.test(name);
}

function readVideos() {
  if (!fs.existsSync(VIDEOS_DIR)) return [];
  return fs.readdirSync(VIDEOS_DIR, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => {
      const metaPath = path.join(VIDEOS_DIR, d.name, "meta.json");
      if (!fs.existsSync(metaPath)) return null;
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
        meta._dir = d.name;
        meta._hasPaket = fs.existsSync(path.join(VIDEOS_DIR, d.name, "PAKET.md"));
        return meta;
      } catch (e) {
        return { _dir: d.name, id: d.name, title_tr: d.name, status: "fikir", _error: "meta.json okunamadi" };
      }
    })
    .filter(Boolean)
    .sort((a, b) => String(a.id || "").localeCompare(String(b.id || "")));
}

function sendJson(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", c => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on("end", () => {
      try { resolve(data ? JSON.parse(data) : {}); }
      catch (e) { resolve({}); }
    });
  });
}

function serveStatic(req, res) {
  let urlPath = decodeURIComponent(req.url.split("?")[0]);
  if (urlPath === "/") urlPath = "/index.html";
  const filePath = path.join(PUBLIC_DIR, path.normalize(urlPath).replace(/^(\.\.[/\\])+/, ""));
  if (!filePath.startsWith(PUBLIC_DIR)) { res.writeHead(403); return res.end("forbidden"); }
  fs.readFile(filePath, (err, buf) => {
    if (err) { res.writeHead(404); return res.end("not found"); }
    res.writeHead(200, { "Content-Type": MIME[path.extname(filePath)] || "application/octet-stream" });
    res.end(buf);
  });
}

const server = http.createServer(async (req, res) => {
  const u = req.url.split("?")[0];

  // --- API ---
  if (u === "/api/videos" && req.method === "GET") {
    return sendJson(res, 200, { stages: STAGES, videos: readVideos() });
  }

  if (u === "/api/paket" && req.method === "GET") {
    const dir = new URL(req.url, "http://x").searchParams.get("dir");
    if (!safeDir(dir)) return sendJson(res, 400, { error: "gecersiz dir" });
    const p = path.join(VIDEOS_DIR, dir, "PAKET.md");
    if (!fs.existsSync(p)) return sendJson(res, 404, { error: "PAKET.md yok" });
    return sendJson(res, 200, { markdown: fs.readFileSync(p, "utf8") });
  }

  if (u === "/api/status" && req.method === "POST") {
    const body = await readBody(req);
    const { dir, status } = body;
    if (!safeDir(dir) || !STAGES.includes(status)) return sendJson(res, 400, { error: "gecersiz istek" });
    const metaPath = path.join(VIDEOS_DIR, dir, "meta.json");
    if (!fs.existsSync(metaPath)) return sendJson(res, 404, { error: "meta.json yok" });
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    meta.status = status;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    return sendJson(res, 200, { ok: true, status });
  }

  if (u === "/api/schedule" && req.method === "POST") {
    const body = await readBody(req);
    const { dir, scheduled } = body;
    if (!safeDir(dir)) return sendJson(res, 400, { error: "gecersiz dir" });
    const metaPath = path.join(VIDEOS_DIR, dir, "meta.json");
    if (!fs.existsSync(metaPath)) return sendJson(res, 404, { error: "meta.json yok" });
    const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
    meta.scheduled = scheduled || null;
    fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    return sendJson(res, 200, { ok: true, scheduled: meta.scheduled });
  }

  if (u === "/api/new" && req.method === "POST") {
    const body = await readBody(req);
    const slug = String(body.slug || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "");
    if (!slug) return sendJson(res, 400, { error: "slug gerekli" });
    const existing = readVideos();
    const nextId = String(existing.length + 1).padStart(3, "0");
    const dirName = nextId + "-" + slug;
    const dirPath = path.join(VIDEOS_DIR, dirName);
    if (fs.existsSync(dirPath)) return sendJson(res, 409, { error: "zaten var" });
    fs.mkdirSync(dirPath, { recursive: true });
    const meta = {
      id: nextId, slug, format: body.format === "short" ? "short" : "long",
      title_tr: body.title_tr || slug, title_en: body.title_en || slug,
      status: "fikir", duration_target_sec: body.format === "short" ? 45 : 460,
      created: body.today || "", scheduled: null,
      tags_tr: [], tags_en: [], shorts_derived: 0, notes: ""
    };
    fs.writeFileSync(path.join(dirPath, "meta.json"), JSON.stringify(meta, null, 2) + "\n", "utf8");
    let tpl = "# " + nextId + " — " + meta.title_tr + "\n\n> Bu paket henuz doldurulmadi. Claude'a: \"" + dirName + " paketini uret\" de.\n";
    if (fs.existsSync(TEMPLATE)) tpl += "\n---\n\n" + fs.readFileSync(TEMPLATE, "utf8");
    fs.writeFileSync(path.join(dirPath, "PAKET.md"), tpl, "utf8");
    return sendJson(res, 200, { ok: true, dir: dirName });
  }

  // --- statik dosyalar ---
  return serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log("\n  🌌 YouTube Otomasyon paneli calisiyor:");
  console.log("     http://localhost:" + PORT + "\n");
  console.log("  Kapatmak icin: Ctrl+C\n");
});
