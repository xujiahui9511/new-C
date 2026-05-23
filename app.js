const views = {
  onboarding: document.querySelector("#view-onboarding"),
  save: document.querySelector("#view-save"),
  home: document.querySelector("#view-home"),
  checkup: document.querySelector("#view-checkup"),
  results: document.querySelector("#view-results"),
  confirm: document.querySelector("#view-confirm"),
  processing: document.querySelector("#view-processing"),
  report: document.querySelector("#view-report"),
  files: document.querySelector("#view-files"),
  apps: document.querySelector("#view-apps"),
  popup: document.querySelector("#view-popup"),
  restore: document.querySelector("#view-restore"),
  reports: document.querySelector("#view-reports"),
  updates: document.querySelector("#view-updates"),
  settings: document.querySelector("#view-settings")
};

const navItems = [...document.querySelectorAll(".nav-item")];
const guideSteps = [
  {
    step: "首次使用 · 第 1 步",
    title: "先保护，再清理",
    text: "不会乱删系统文件。涉及文件转移、软件搬家和数据迁移时，都会先准备恢复入口，让用户有后悔空间。"
  },
  {
    step: "首次使用 · 第 2 步",
    title: "把空间真正腾出来",
    text: "不仅清理表面垃圾，还会找出微信、下载、桌面、大文件和占空间软件，建议转移到其他盘。"
  },
  {
    step: "首次使用 · 第 3 步",
    title: "你确认后才处理",
    text: "工具先扫描并给建议。用户能看到占用、风险、能否恢复，再决定处理哪些内容。"
  }
];

let guideIndex = 0;
let latestScanData = null;
let processingStarted = false;

const API_BASE = "http://localhost:4317";

function formatBytes(bytes) {
  if (!bytes || bytes < 0) return "0B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  return `${value >= 10 || index === 0 ? value.toFixed(0) : value.toFixed(1)}${units[index]}`;
}

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) throw new Error("操作没有完成");
  return response.json();
}

function showView(name) {
  if (!views[name]) return;
  Object.values(views).forEach(view => view.classList.remove("view-active"));
  views[name].classList.add("view-active");
  navItems.forEach(item => item.classList.toggle("active", item.dataset.nav === name));
  views[name].scrollTop = 0;

  if (["onboarding", "save", "results", "confirm", "processing", "report"].includes(name)) {
    navItems.forEach(item => item.classList.remove("active"));
  }

  if (name === "checkup") runRealScan();
  if (name === "processing") runRealProcessing();
}

function updateGuide() {
  const current = guideSteps[guideIndex];
  document.querySelector("#guideStep").textContent = current.step;
  document.querySelector("#guideTitle").textContent = current.title;
  document.querySelector("#guideText").textContent = current.text;
  document.querySelector("#nextGuide").textContent = guideIndex === guideSteps.length - 1 ? "选择保存位置" : "下一步";
  [...document.querySelectorAll(".dot")].forEach((dot, index) => {
    dot.classList.toggle("active", index === guideIndex);
  });
}

document.querySelector("#nextGuide").addEventListener("click", () => {
  if (guideIndex < guideSteps.length - 1) {
    guideIndex += 1;
    updateGuide();
    return;
  }
  showView("save");
});

document.querySelector("#skipGuide").addEventListener("click", () => showView("save"));

document.querySelectorAll("[data-go]").forEach(button => {
  button.addEventListener("click", () => showView(button.dataset.go));
});

navItems.forEach(item => {
  item.addEventListener("click", () => showView(item.dataset.nav));
});

document.querySelector("#finishScan").addEventListener("click", () => showView("results"));
document.querySelector("#finishProcess").addEventListener("click", () => showView("report"));

document.querySelectorAll(".advice-card input").forEach(input => {
  input.addEventListener("change", () => {
    input.closest(".advice-card").classList.toggle("selected", input.checked);
  });
});

document.querySelectorAll("[data-file-tab]").forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.fileTab;
    document.querySelectorAll("[data-file-tab]").forEach(item => {
      item.classList.toggle("active", item === tab);
    });
    document.querySelectorAll("[data-file-panel]").forEach(panel => {
      panel.classList.toggle("active", panel.dataset.filePanel === target);
    });
  });
});

async function runRealScan() {
  const button = document.querySelector("#finishScan");
  const percent = document.querySelector("#scanPercent");
  const bar = document.querySelector("#scanBar");
  const findings = document.querySelector(".live-findings");

  button.disabled = true;
  button.textContent = "正在扫描...";
  percent.textContent = "扫描中";
  bar.style.width = "42%";
  findings.innerHTML = `
    <div><span class="status blue"></span>正在读取 C 盘常见占用位置</div>
    <div><span class="status amber"></span>这里只扫描，不会处理文件</div>
  `;

  try {
    latestScanData = await request("/api/scan");
    const safe = latestScanData.totals.safe;
    const files = latestScanData.totals.files;
    const appData = latestScanData.totals.appData;

    percent.textContent = "100%";
    bar.style.width = "100%";
    findings.innerHTML = `
      <div><span class="status green"></span>可安全整理 ${formatBytes(safe)}</div>
      <div><span class="status blue"></span>个人文件 ${formatBytes(files)}</div>
      <div><span class="status amber"></span>软件资料 ${formatBytes(appData)}</div>
    `;

    updateResultNumbers(safe, files, appData);
    updateFileRows();
    button.textContent = "查看扫描结果";
  } catch {
    percent.textContent = "未连接";
    bar.style.width = "18%";
    findings.innerHTML = `
      <div><span class="status amber"></span>请从本地运行入口打开，才能读取真实 C 盘数据</div>
    `;
    button.textContent = "查看演示结果";
  } finally {
    button.disabled = false;
  }
}

function updateResultNumbers(safe, files, appData) {
  const summary = document.querySelectorAll("#view-results .result-summary strong");
  if (summary[0]) summary[0].textContent = formatBytes(safe);
  if (summary[1]) summary[1].textContent = formatBytes(files);
  if (summary[2]) summary[2].textContent = formatBytes(appData);

  const confirm = document.querySelectorAll("#view-confirm .result-summary strong");
  if (confirm[0]) confirm[0].textContent = formatBytes(safe);
  if (confirm[1]) confirm[1].textContent = formatBytes(files);
  if (confirm[2]) confirm[2].textContent = "可查看";
}

function updateFileRows() {
  if (!latestScanData) return;
  const rows = document.querySelectorAll("#view-files .file-row");
  const downloads = latestScanData.items.find(item => item.id === "downloads");
  const desktop = latestScanData.items.find(item => item.id === "desktop");
  const videos = latestScanData.items.find(item => item.id === "videos");
  const wechat = latestScanData.items.find(item => item.id === "wechat");

  if (rows[0] && downloads) rows[0].querySelector("span").textContent = `${formatBytes(downloads.bytes)} · 建议转移`;
  if (rows[1] && desktop) rows[1].querySelector("span").textContent = `${formatBytes(desktop.bytes)} · 建议确认`;
  if (rows[2] && downloads) rows[2].querySelector("span").textContent = `${formatBytes(downloads.bytes)} · 下载文件占用`;
  if (rows[3] && desktop) rows[3].querySelector("span").textContent = `${formatBytes(desktop.bytes)} · 桌面文件占用`;
  if (rows[4] && wechat) rows[4].querySelector("span").textContent = `${formatBytes(wechat.bytes)} · 微信资料占用`;
  if (rows[5] && videos) rows[5].querySelector("span").textContent = `${formatBytes(videos.bytes)} · 建议转移到 D 盘`;
}

async function runRealProcessing() {
  if (processingStarted) return;
  processingStarted = true;
  const title = document.querySelector("#view-processing h1");
  const button = document.querySelector("#finishProcess");
  title.textContent = "正在执行低风险安全清理";
  button.disabled = true;
  button.textContent = "处理中...";

  try {
    const result = await request("/api/clean-safe", { method: "POST" });
    const achievements = document.querySelectorAll("#view-report .achievement-grid strong");
    if (achievements[0]) achievements[0].textContent = formatBytes(result.movedBytes);
    if (achievements[1]) achievements[1].textContent = "待整理";
    if (achievements[3]) achievements[3].textContent = `${result.movedCount}项`;
    title.textContent = "低风险清理已完成";
  } catch {
    title.textContent = "暂时无法执行真实清理，请确认从本地运行入口打开";
  } finally {
    button.disabled = false;
    button.textContent = "查看完成报告";
  }
}

document.querySelectorAll(".organize-real").forEach(button => {
  button.addEventListener("click", async () => {
    const oldText = button.textContent;
    button.disabled = true;
    button.textContent = "整理中...";
    try {
      const result = await request("/api/organize-files", { method: "POST" });
      button.textContent = `已转移 ${formatBytes(result.movedBytes)}`;
    } catch {
      button.textContent = "请从本地运行入口打开";
      setTimeout(() => {
        button.disabled = false;
        button.textContent = oldText;
      }, 1800);
      return;
    }
    setTimeout(() => {
      button.disabled = false;
      button.textContent = oldText;
    }, 2200);
  });
});

const checkUpdateButton = document.querySelector("#checkUpdate");
const activateUpdateButton = document.querySelector("#activateUpdate");
const activationCodeInput = document.querySelector("#activationCode");
const activationMessage = document.querySelector("#activationMessage");
const updateState = document.querySelector("#updateState");
const latestVersion = document.querySelector("#latestVersion");
const updateIntro = document.querySelector("#updateIntro");

if (checkUpdateButton) {
  checkUpdateButton.addEventListener("click", async () => {
    checkUpdateButton.disabled = true;
    checkUpdateButton.textContent = "检查中...";
    try {
      const result = await request("/api/check-update");
      latestVersion.textContent = `体验版 ${result.latestVersion}`;
      updateState.textContent = result.requireActivation ? "需要激活码" : "可直接更新";
      updateIntro.textContent = result.requireActivation
        ? "发现新版。请先添加微信领取激活码，验证通过后继续更新。"
        : "发现新版，可以直接更新。";
      activationMessage.textContent = "已发现新版，请输入激活码。";
    } catch {
      activationMessage.textContent = "暂时无法检查更新，请确认从本地运行入口打开。";
    } finally {
      checkUpdateButton.disabled = false;
      checkUpdateButton.textContent = "检查更新";
    }
  });
}

if (activateUpdateButton) {
  activateUpdateButton.addEventListener("click", async () => {
    const code = activationCodeInput.value.trim();
    if (!code) {
      activationMessage.textContent = "请先输入激活码。";
      return;
    }

    activateUpdateButton.disabled = true;
    activateUpdateButton.textContent = "验证中...";
    try {
      const result = await request("/api/activate-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      if (!result.activated) {
        updateState.textContent = "验证失败";
        activationMessage.textContent = result.message;
        return;
      }

      updateState.textContent = "已激活";
      updateIntro.textContent = "激活成功，下一步将下载并安装新版。";
      activationMessage.textContent = "激活成功。正式安装包版会跳转到 GitHub 下载新版安装包。";
    } catch {
      activationMessage.textContent = "暂时无法验证，请确认从本地运行入口打开。";
    } finally {
      activateUpdateButton.disabled = false;
      activateUpdateButton.textContent = "验证并更新";
    }
  });
}

updateGuide();
