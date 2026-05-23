const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const os = require("os");

const PORT = 4317;
const ROOT = __dirname;
const LOG_FILE = path.join(ROOT, "server-error.log");
const UPDATE_INFO_URL = "https://api.github.com/repos/xujiahui9511/new-C/contents/updates/latest.json?ref=main";
const userHome = os.homedir();
const defaultWarehouse = fs.existsSync("D:\\")
  ? "D:\\C盘安心整理仓库"
  : path.join(userHome, "Documents", "C盘安心整理仓库");
const validActivationCodes = new Set([
  "YUCHUAN-2026",
  "CPAN-UPDATE-2026",
  "ZXGJ-8888"
]);

let latestScan = null;
let latestScanTime = 0;

function logError(error) {
  const message = `[${new Date().toISOString()}] ${error && error.stack ? error.stack : error}\n`;
  try {
    fs.appendFileSync(LOG_FILE, message, "utf8");
  } catch {
    // Logging should never break the app.
  }
}

function send(res, status, data, type = "application/json") {
  res.writeHead(status, {
    "Content-Type": `${type}; charset=utf-8`,
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(type === "application/json" ? JSON.stringify(data) : data);
}

function formatError(error) {
  logError(error);
  return { ok: false, message: error && error.message ? error.message : "操作失败" };
}

function joinHome(...parts) {
  return path.join(userHome, ...parts);
}

function knownTargets() {
  return [
    { id: "safe", title: "安全临时文件", kind: "safe", paths: [os.tmpdir()], maxFiles: 1500 },
    { id: "downloads", title: "下载文件夹", kind: "files", paths: [joinHome("Downloads")], maxFiles: 1500 },
    { id: "desktop", title: "桌面文件", kind: "files", paths: [joinHome("Desktop")], maxFiles: 1200 },
    { id: "documents", title: "文档资料", kind: "files", paths: [joinHome("Documents")], maxFiles: 1500 },
    { id: "pictures", title: "图片资料", kind: "files", paths: [joinHome("Pictures")], maxFiles: 1500 },
    { id: "videos", title: "视频资料", kind: "files", paths: [joinHome("Videos")], maxFiles: 1500 },
    {
      id: "wechat",
      title: "微信资料",
      kind: "appData",
      paths: [
        joinHome("Documents", "WeChat Files"),
        joinHome("AppData", "Roaming", "Tencent", "WeChat")
      ],
      maxFiles: 1200
    },
    {
      id: "dingtalk",
      title: "钉钉资料",
      kind: "appData",
      paths: [
        joinHome("AppData", "Roaming", "DingTalk"),
        joinHome("AppData", "Local", "DingTalk")
      ],
      maxFiles: 1200
    }
  ];
}

async function exists(target) {
  try {
    await fsp.access(target);
    return true;
  } catch {
    return false;
  }
}

async function walkSize(root, options = {}) {
  const maxFiles = options.maxFiles || 1500;
  const minFileSize = options.minFileSize || 0;
  const files = [];
  let total = 0;
  let count = 0;

  async function walk(current, depth) {
    if (count >= maxFiles || depth > 5) return;
    let entries;
    try {
      entries = await fsp.readdir(current, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (count >= maxFiles) break;
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          await walk(full, depth + 1);
        } else if (entry.isFile()) {
          const stat = await fsp.stat(full);
          total += stat.size;
          count += 1;
          if (stat.size >= minFileSize) {
            files.push({
              path: full,
              name: entry.name,
              size: stat.size,
              modified: stat.mtimeMs
            });
          }
        }
      } catch {
        continue;
      }
    }
  }

  if (await exists(root)) await walk(root, 0);
  files.sort((a, b) => b.size - a.size);
  return { total, count, files: files.slice(0, 80) };
}

async function scan() {
  const cacheAge = Date.now() - latestScanTime;
  if (latestScan && cacheAge < 60 * 1000) {
    return { ...latestScan, cached: true };
  }

  const targets = knownTargets();
  const results = [];

  for (const target of targets) {
    let total = 0;
    let count = 0;
    let files = [];

    for (const targetPath of target.paths) {
      const result = await walkSize(targetPath, {
        maxFiles: target.maxFiles || 1500,
        minFileSize: target.kind === "files" ? 50 * 1024 * 1024 : 0
      });
      total += result.total;
      count += result.count;
      files = files.concat(result.files.map(file => ({ ...file, sourceRoot: targetPath })));
    }

    results.push({
      id: target.id,
      title: target.title,
      kind: target.kind,
      bytes: total,
      count,
      files: files.sort((a, b) => b.size - a.size).slice(0, 60)
    });
  }

  latestScan = {
    ok: true,
    scannedAt: new Date().toISOString(),
    warehouse: defaultWarehouse,
    items: results,
    totals: {
      safe: results.filter(item => item.kind === "safe").reduce((sum, item) => sum + item.bytes, 0),
      files: results.filter(item => item.kind === "files").reduce((sum, item) => sum + item.bytes, 0),
      appData: results.filter(item => item.kind === "appData").reduce((sum, item) => sum + item.bytes, 0)
    }
  };
  latestScanTime = Date.now();

  return latestScan;
}

function safeDestination(folder, filePath) {
  const drive = path.parse(filePath).root.replace(/[\\:]/g, "");
  const clean = filePath.replace(/^[A-Za-z]:\\/, "").replace(/[<>:"/\\|?*]+/g, "_");
  return path.join(folder, drive, clean);
}

async function moveFile(source, baseFolder) {
  const stat = await fsp.stat(source);
  const destination = safeDestination(baseFolder, source);
  await fsp.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fsp.rename(source, destination);
  } catch {
    await fsp.copyFile(source, destination);
    await fsp.unlink(source);
  }
  return { source, destination, size: stat.size };
}

async function cleanSafe() {
  const temp = os.tmpdir();
  const now = Date.now();
  const oneDay = 24 * 60 * 60 * 1000;
  const targetFolder = path.join(defaultWarehouse, "安全清理", timestamp());
  const scanResult = await walkSize(temp, { maxFiles: 6000, minFileSize: 0 });
  const candidates = scanResult.files.filter(file => now - file.modified > oneDay).slice(0, 500);
  const moved = [];

  await fsp.mkdir(targetFolder, { recursive: true });
  for (const file of candidates) {
    try {
      moved.push(await moveFile(file.path, targetFolder));
    } catch {
      continue;
    }
  }

  return {
    ok: true,
    movedCount: moved.length,
    movedBytes: moved.reduce((sum, file) => sum + file.size, 0),
    warehouse: targetFolder,
    moved
  };
}

async function organizeFiles() {
  const scanData = latestScan || await scan();
  const targetFolder = path.join(defaultWarehouse, "文件整理", timestamp());
  const fileGroups = scanData.items.filter(item => ["downloads", "desktop", "videos"].includes(item.id));
  const files = fileGroups.flatMap(item => item.files).slice(0, 120);
  const moved = [];

  await fsp.mkdir(targetFolder, { recursive: true });
  for (const file of files) {
    try {
      moved.push(await moveFile(file.path, targetFolder));
    } catch {
      continue;
    }
  }

  return {
    ok: true,
    movedCount: moved.length,
    movedBytes: moved.reduce((sum, file) => sum + file.size, 0),
    warehouse: targetFolder,
    moved
  };
}

function timestamp() {
  const now = new Date();
  const pad = value => String(value).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function readBody(req) {
  return new Promise(resolve => {
    let body = "";
    req.on("data", chunk => {
      body += chunk.toString();
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        resolve({});
      }
    });
  });
}

async function checkUpdate() {
  const fallback = {
    ok: true,
    currentVersion: "1.0",
    latestVersion: "1.2",
    requireActivation: true,
    updateTitle: "发现可更新版本",
    downloadUrl: "https://github.com/xujiahui9511/new-C/releases/latest",
    updateNotes: [
      "扫描结果短时间内自动复用，减少等待",
      "界面状态更清楚，更新流程更顺",
      "已接入 GitHub 固定更新中心"
    ]
  };

  try {
    const response = await fetch(`${UPDATE_INFO_URL}&t=${Date.now()}`, {
      headers: { "User-Agent": "CpanCleanerUpdater" }
    });
    if (!response.ok) return fallback;
    const githubFile = await response.json();
    const text = githubFile.content
      ? Buffer.from(githubFile.content, "base64").toString("utf8")
      : JSON.stringify(githubFile);
    const remote = JSON.parse(text);
    return { ...fallback, ...remote, ok: true };
  } catch {
    return fallback;
  }
}

async function activateUpdate(req) {
  const body = await readBody(req);
  const code = String(body.code || "").trim().toUpperCase();

  if (!validActivationCodes.has(code)) {
    return {
      ok: false,
      activated: false,
      message: "激活码不正确，请添加微信重新获取。"
    };
  }

  return {
    ok: true,
    activated: true,
    message: "激活成功，已允许下载并安装新版。",
    downloadUrl: "https://github.com/xujiahui9511/new-C/releases/latest"
  };
}

function serveStatic(req, res) {
  const requestPath = decodeURIComponent(new URL(req.url, `http://localhost:${PORT}`).pathname);
  const filePath = path.join(ROOT, requestPath === "/" ? "index.html" : requestPath);
  if (!filePath.startsWith(ROOT)) return send(res, 403, "拒绝访问", "text/plain");

  fs.readFile(filePath, (error, content) => {
    if (error) return send(res, 404, "找不到页面", "text/plain");
    const ext = path.extname(filePath).toLowerCase();
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
    send(res, 200, content, types[ext] || "text/plain");
  });
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 200, { ok: true });

  try {
    const url = new URL(req.url, `http://localhost:${PORT}`);
    if (url.pathname === "/api/health") return send(res, 200, { ok: true, warehouse: defaultWarehouse });
    if (url.pathname === "/api/scan") return send(res, 200, await scan());
    if (url.pathname === "/api/clean-safe" && req.method === "POST") return send(res, 200, await cleanSafe());
    if (url.pathname === "/api/organize-files" && req.method === "POST") return send(res, 200, await organizeFiles());
    if (url.pathname === "/api/check-update") return send(res, 200, await checkUpdate());
    if (url.pathname === "/api/activate-update" && req.method === "POST") return send(res, 200, await activateUpdate(req));
    return serveStatic(req, res);
  } catch (error) {
    return send(res, 500, formatError(error));
  }
});

process.on("uncaughtException", error => {
  logError(error);
});

process.on("unhandledRejection", error => {
  logError(error);
});

server.listen(PORT, () => {
  console.log(`C盘安心管家已启动：http://localhost:${PORT}`);
});
