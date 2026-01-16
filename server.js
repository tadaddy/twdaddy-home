const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 9000;
const DATA_FILE = path.join(__dirname, "data.json");
const PUBLIC_ROOT = __dirname;
const DEFAULT_POOLS = [
  { id: "pool-1", name: "家庭备用金", amount: 0 },
  { id: "pool-2", name: "旅行基金", amount: 0 },
  { id: "pool-3", name: "教育基金", amount: 0 },
];
const DEFAULT_WALLETS = [
  { id: "walletA", name: "临时钱包 A", monthlyBudget: 5000 },
  { id: "walletB", name: "临时钱包 B", monthlyBudget: 5000 },
];
const DEFAULT_MEMO = { content: "", updatedAt: "" };

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

const normalizeData = (data) => {
  if (Array.isArray(data)) {
    return { transactions: data, pools: DEFAULT_POOLS, wallets: DEFAULT_WALLETS, memo: DEFAULT_MEMO };
  }
  if (!data || typeof data !== "object") {
    return { transactions: [], pools: DEFAULT_POOLS, wallets: DEFAULT_WALLETS, memo: DEFAULT_MEMO };
  }
  const pools = Array.isArray(data.pools) ? data.pools : DEFAULT_POOLS;
  const wallets = Array.isArray(data.wallets) ? data.wallets : DEFAULT_WALLETS;
  const transactions = Array.isArray(data.transactions) ? data.transactions : [];
  const memo = data.memo && typeof data.memo === "object" ? data.memo : DEFAULT_MEMO;
  return { transactions, pools, wallets, memo };
};

const readData = async () => {
  try {
    const raw = await fs.readFile(DATA_FILE, "utf8");
    try {
      return normalizeData(JSON.parse(raw));
    } catch (error) {
      if (error instanceof SyntaxError) {
        return { transactions: [], pools: DEFAULT_POOLS, wallets: DEFAULT_WALLETS, memo: DEFAULT_MEMO };
      }
      throw error;
    }
  } catch (error) {
    if (error.code === "ENOENT") {
      return { transactions: [], pools: DEFAULT_POOLS, wallets: DEFAULT_WALLETS, memo: DEFAULT_MEMO };
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
      const data = await readData();
      return sendJson(res, 200, data.transactions);
    } catch (error) {
      return sendJson(res, 500, { error: "读取数据失败" });
    }
  }

  if (pathname === "/api/transactions" && req.method === "DELETE") {
    try {
      const data = await readData();
      await writeData({ ...data, transactions: [] });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "清空数据失败" });
    }
  }

  if (pathname === "/api/transactions" && req.method === "POST") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      const data = await readData();
      data.transactions.push(payload);
      await writeData(data);
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "写入数据失败" });
    }
  }

  if (pathname.startsWith("/api/transactions/") && req.method === "DELETE") {
    try {
      const id = pathname.split("/").pop();
      const data = await readData();
      const nextItems = data.transactions.filter((item) => item.id !== id);
      await writeData({ ...data, transactions: nextItems });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "删除数据失败" });
    }
  }

  if (pathname === "/api/pools" && req.method === "GET") {
    try {
      const data = await readData();
      return sendJson(res, 200, data.pools);
    } catch (error) {
      return sendJson(res, 500, { error: "读取资产池失败" });
    }
  }

  if (pathname === "/api/pools" && req.method === "PUT") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : [];
      if (!Array.isArray(payload)) {
        return sendJson(res, 400, { error: "资产池格式错误" });
      }
      const data = await readData();
      await writeData({ ...data, pools: payload });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "保存资产池失败" });
    }
  }

  if (pathname === "/api/wallets" && req.method === "GET") {
    try {
      const data = await readData();
      return sendJson(res, 200, data.wallets);
    } catch (error) {
      return sendJson(res, 500, { error: "读取钱包失败" });
    }
  }

  if (pathname === "/api/wallets" && req.method === "PUT") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : [];
      if (!Array.isArray(payload)) {
        return sendJson(res, 400, { error: "钱包格式错误" });
      }
      const data = await readData();
      await writeData({ ...data, wallets: payload });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "保存钱包失败" });
    }
  }

  if (pathname === "/api/memo" && req.method === "GET") {
    try {
      const data = await readData();
      return sendJson(res, 200, data.memo || DEFAULT_MEMO);
    } catch (error) {
      return sendJson(res, 500, { error: "读取备忘录失败" });
    }
  }

  if (pathname === "/api/memo" && req.method === "PUT") {
    try {
      const body = await readBody(req);
      const payload = body ? JSON.parse(body) : {};
      if (!payload || typeof payload.content !== "string") {
        return sendJson(res, 400, { error: "备忘录格式错误" });
      }
      const data = await readData();
      const memo = { content: payload.content, updatedAt: payload.updatedAt || new Date().toISOString() };
      await writeData({ ...data, memo });
      return sendJson(res, 200, { ok: true });
    } catch (error) {
      return sendJson(res, 500, { error: "保存备忘录失败" });
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
