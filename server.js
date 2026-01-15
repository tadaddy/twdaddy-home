const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 8000;
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_ROOT = __dirname;

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const readData = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === "ENOENT") {
      return [];
    }
    throw error;
  }
};

const writeData = async (items) => {
  await fs.writeFile(DATA_FILE, JSON.stringify(items, null, 2));
};

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
};

const readBody = (req) =>
  new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("payload_too_large"));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });

const serveFile = async (res, filePath) => {
  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = MIME_TYPES[ext] || "application/octet-stream";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not Found");
  }
};

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  if (pathname === "/api/transactions" && req.method === "GET") {
    try {
      const items = await readData();
      return sendJson(res, 200, items);
    } catch (error) {
      return sendJson(res, 500, { error: "读取数据失败" });
    }
  }

  if (pathname === "/api/transactions" && req.method === "DELETE") {
    try {
      await writeData([]);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "清空数据失败" });
    }
  }

  if (pathname === "/api/transactions" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      const items = await readData();
      items.push(payload);
      await writeData(items);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "写入数据失败" });
    }
  }

  if (pathname.startsWith("/api/transactions/") && req.method === "DELETE") {
    try {
      const id = pathname.split("/").pop();
      const items = await readData();
      const nextItems = items.filter((item) => item.id !== id);
      await writeData(nextItems);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "删除数据失败" });
    }
  }

  let filePath = pathname === "/" ? "/index.html" : pathname;
  filePath = path.join(PUBLIC_ROOT, path.normalize(filePath));
  if (!filePath.startsWith(PUBLIC_ROOT)) {
    res.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Forbidden");
    return;
  }
  await serveFile(res, filePath);
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
