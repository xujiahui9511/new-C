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
const API_BASE = "http://localhost:4317";

function fitAppToWindow() {
  const widthScale = window.innerWidth / 1360;
  const heightScale = window.innerHeight / 860;
  const scale = Math.min(widthScale, heightScale, 1);
  document.documentElement.style.setProperty("--app-scale", scale.toFixed(4));
}

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
let latestDiskState = null;
let processingStarted = false;
let firstUseActivated = false;
let pendingProtectedAction = null;

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

function updateHomeMeter(percent, status) {
  const value = document.querySelector(".meter-value");
  if (!value) return;
  const clamped = Math.max(0, Math.min(100, Number(percent) || 0));
  value.style.strokeDashoffset = String(302 - (302 * clamped / 100));
  value.style.stroke = status === "空间不足" ? "#c2410c" : status === "偏紧张" ? "#df8f0d" : "#178b8d";
}

function describeHistory(entry) {
  if (!entry) return null;
  const action = entry.type === "organize" ? "整理" : "清理";
  const date = entry.at ? new Date(entry.at) : null;
  const timeText = date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString("zh-CN") : "最近一次";
  return {
    title: `${action} ${formatBytes(entry.movedBytes)}`,
    detail: `${timeText} · 处理 ${entry.movedCount || 0} 项`
  };
}

async function loadHomeState() {
  const statusText = document.querySelector("#homeDiskStatus");
  const percentText = document.querySelector("#homeDiskPercent");
  const summaryText = document.querySelector("#homeDiskSummary");
  const estimateText = document.querySelector("#homeMoveEstimate");
  const lastTitle = document.querySelector("#homeLastCleanTitle");
  const lastDetail = document.querySelector("#homeLastCleanDetail");

  try {
    const state = await request("/api/disk-state");
    latestDiskState = state;
    if (statusText) statusText.textContent = state.status || "未知";
    if (percentText) percentText.textContent = `${state.usedPercent}%`;
    if (summaryText) summaryText.textContent = `剩余 ${formatBytes(state.freeBytes)}，总容量 ${formatBytes(state.totalBytes)}。建议先扫描可安全释放和可转移内容。`;
    updateHomeMeter(state.usedPercent, state.status);

    if (estimateText) {
      if (state.scanTotals) {
        const movable = (state.scanTotals.files || 0) + (state.scanTotals.appData || 0);
        estimateText.textContent = `已扫描到 ${formatBytes(movable)} 可进一步确认整理。`;
      } else {
        estimateText.textContent = "扫描后显示可整理空间。";
      }
    }

    const history = describeHistory(state.lastHistory);
    if (history) {
      if (lastTitle) lastTitle.textContent = history.title;
      if (lastDetail) lastDetail.textContent = history.detail;
    } else {
      if (lastTitle) lastTitle.textContent = "暂无真实记录";
      if (lastDetail) lastDetail.textContent = "完成一次清理或整理后，这里会自动显示。";
    }
  } catch {
    latestDiskState = null;
    if (statusText) statusText.textContent = "未连接";
    if (percentText) percentText.textContent = "--";
    if (summaryText) summaryText.textContent = "请从桌面的正式入口打开，才能读取这台电脑的真实 C 盘数据。";
    if (estimateText) estimateText.textContent = "连接成功后再显示可整理空间。";
    if (lastTitle) lastTitle.textContent = "暂无真实记录";
    if (lastDetail) lastDetail.textContent = "当前没有读取到真实清理记录。";
    updateHomeMeter(0, "健康");
  }
}

async function refreshActivationStatus() {
  try {
    const status = await request("/api/activation-status");
    firstUseActivated = Boolean(status.activated);
    const deviceCodeText = document.querySelector("#deviceCodeText");
    if (deviceCodeText) deviceCodeText.textContent = status.deviceCode || "未获取";
    return status;
  } catch {
    firstUseActivated = false;
    const deviceCodeText = document.querySelector("#deviceCodeText");
    if (deviceCodeText) deviceCodeText.textContent = "请从启动入口打开";
    return { activated: false, deviceCode: "请从启动入口打开" };
  }
}

async function requireFirstActivation(action) {
  const status = await refreshActivationStatus();
  if (status.activated || firstUseActivated) return true;

  pendingProtectedAction = action || null;
  openFirstActivationModal();
  return false;
}

function openFirstActivationModal() {
  const modal = document.querySelector("#firstActivationModal");
  if (!modal) return;
  modal.classList.add("show");
  modal.setAttribute("aria-hidden", "false");
}

function closeFirstActivationModal() {
  const modal = document.querySelector("#firstActivationModal");
  if (!modal) return;
  modal.classList.remove("show");
  modal.setAttribute("aria-hidden", "true");
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

  if (name === "home") {
    loadHomeState();
  }

  if (name === "checkup") {
    requireFirstActivation(() => runRealScan()).then(allowed => {
      if (allowed) runRealScan();
    });
  }

  if (name === "processing") {
    requireFirstActivation(() => runRealProcessing()).then(allowed => {
      if (allowed) runRealProcessing();
    });
  }
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

async function runRealScan() {
  const button = document.querySelector("#finishScan");
  const percent = document.querySelector("#scanPercent");
  const bar = document.querySelector("#scanBar");
  const findings = document.querySelector(".live-findings");
  const steps = document.querySelectorAll("[data-scan-step]");

  button.disabled = true;
  button.textContent = "正在扫描...";
  percent.textContent = "扫描中";
  bar.style.width = "42%";
  steps.forEach(step => {
    step.classList.remove("complete", "done");
    step.classList.add("pending");
  });
  const appDataStep = document.querySelector("[data-scan-step='appData']");
  if (appDataStep) {
    appDataStep.classList.remove("pending", "complete");
    appDataStep.classList.add("active");
    appDataStep.querySelector("p").textContent = "正在分析微信、钉钉";
  }
  findings.innerHTML = `
    <div><span class="status blue"></span>正在读取 C 盘常见占用位置</div>
    <div><span class="status amber"></span>这里只扫描，不会处理文件</div>
  `;

  try {
    await loadHomeState();
    latestScanData = await request("/api/scan");
    const safe = latestScanData.totals.safe;
    const files = latestScanData.totals.files;
    const appData = latestScanData.totals.appData;

    percent.textContent = "100%";
    bar.style.width = "100%";
    setScanStepDone("safe", `已发现 ${formatBytes(safe)}`);
    setScanStepDone("files", `已发现 ${formatBytes(files)}`);
    setScanStepDone("appData", `已发现 ${formatBytes(appData)}`);
    setScanStepDone("apps", "暂未开放自动迁移");
    findings.innerHTML = `
      <div><span class="status green"></span>可安全整理 ${formatBytes(safe)}</div>
      <div><span class="status blue"></span>个人文件 ${formatBytes(files)}</div>
      <div><span class="status amber"></span>软件资料 ${formatBytes(appData)}</div>
    `;

    updateResultNumbers(safe, files, appData);
    updateFileRows();
    loadHomeState();
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

function setScanStepDone(id, text) {
  const step = document.querySelector(`[data-scan-step='${id}']`);
  if (!step) return;
  step.classList.remove("active", "pending");
  step.classList.add("complete", "done");
  const miniProgress = step.querySelector(".mini-progress");
  if (miniProgress) miniProgress.remove();
  const paragraph = step.querySelector("p");
  if (paragraph) paragraph.textContent = text;
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

  if (latestDiskState) {
    const beforeFree = document.querySelector("#confirmBeforeFree");
    const beforeStatus = document.querySelector("#confirmBeforeStatus");
    const afterFree = document.querySelector("#confirmAfterFree");
    const afterStatus = document.querySelector("#confirmAfterStatus");
    const estimatedFree = Math.min(latestDiskState.totalBytes, latestDiskState.freeBytes + safe + files);
    const estimatedUsedPercent = latestDiskState.totalBytes > 0
      ? Math.round(((latestDiskState.totalBytes - estimatedFree) / latestDiskState.totalBytes) * 100)
      : 0;
    const estimatedStatus = estimatedUsedPercent >= 90 ? "空间不足" : estimatedUsedPercent >= 75 ? "偏紧张" : "健康";
    if (beforeFree) beforeFree.textContent = `剩余 ${formatBytes(latestDiskState.freeBytes)}`;
    if (beforeStatus) beforeStatus.textContent = `状态：${latestDiskState.status}`;
    if (afterFree) afterFree.textContent = `预计剩余 ${formatBytes(estimatedFree)}`;
    if (afterStatus) afterStatus.textContent = `状态：${estimatedStatus}`;
  }
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
  const processPercent = document.querySelector("#processPercent");
  const processBar = document.querySelector("#processBar");
  title.textContent = "正在执行低风险安全清理";
  button.disabled = true;
  button.textContent = "处理中...";
  updateProcessProgress(8, "正在准备恢复入口");

  try {
    updateProcessProgress(28, "正在整理低风险文件");
    const result = await request("/api/clean-safe", { method: "POST" });
    updateProcessProgress(78, "正在写入处理记录");
    const achievements = document.querySelectorAll("#view-report .achievement-grid strong");
    if (achievements[0]) achievements[0].textContent = formatBytes(result.movedBytes);
    if (achievements[1]) achievements[1].textContent = "待整理";
    if (achievements[3]) achievements[3].textContent = `${result.movedCount}项`;
    updateProcessProgress(100, "处理完成");
    loadHomeState();
    title.textContent = "低风险清理已完成";
  } catch {
    title.textContent = "暂时无法执行真实清理，请确认从本地运行入口打开";
    updateProcessProgress(0, "处理未完成");
  } finally {
    button.disabled = false;
    button.textContent = "查看完成报告";
  }

  function updateProcessProgress(value, label) {
    if (processPercent) processPercent.textContent = `${value}%`;
    if (processBar) processBar.style.width = `${value}%`;
    if (label) title.textContent = label;
  }
}

async function organizeRealFiles(button) {
  const oldText = button.textContent;
  button.disabled = true;
  button.textContent = "整理中 0%";

  try {
    button.textContent = "整理中 35%";
    const result = await request("/api/organize-files", { method: "POST" });
    button.textContent = `完成 100% · ${formatBytes(result.movedBytes)}`;
    loadHomeState();
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

document.querySelectorAll(".organize-real").forEach(button => {
  button.addEventListener("click", async () => {
    if (!(await requireFirstActivation(() => organizeRealFiles(button)))) return;
    organizeRealFiles(button);
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
    if (!(await requireFirstActivation(() => checkUpdateButton.click()))) return;

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

const firstActivationModal = document.querySelector("#firstActivationModal");
const closeFirstActivationButton = document.querySelector("#closeFirstActivation");
const copyDeviceCodeButton = document.querySelector("#copyDeviceCode");
const confirmFirstActivationButton = document.querySelector("#confirmFirstActivation");
const firstActivationCodeInput = document.querySelector("#firstActivationCode");
const firstActivationMessage = document.querySelector("#firstActivationMessage");

if (closeFirstActivationButton) {
  closeFirstActivationButton.addEventListener("click", closeFirstActivationModal);
}

if (firstActivationModal) {
  firstActivationModal.addEventListener("click", event => {
    if (event.target === firstActivationModal) closeFirstActivationModal();
  });
}

if (copyDeviceCodeButton) {
  copyDeviceCodeButton.addEventListener("click", async () => {
    const text = document.querySelector("#deviceCodeText").textContent;
    try {
      await navigator.clipboard.writeText(text);
      copyDeviceCodeButton.textContent = "已复制";
    } catch {
      copyDeviceCodeButton.textContent = "请手动复制";
    }
    setTimeout(() => {
      copyDeviceCodeButton.textContent = "复制设备码";
    }, 1600);
  });
}

if (confirmFirstActivationButton) {
  confirmFirstActivationButton.addEventListener("click", async () => {
    const code = firstActivationCodeInput.value.trim();
    if (!code) {
      firstActivationMessage.textContent = "请先输入首次激活码。";
      return;
    }

    confirmFirstActivationButton.disabled = true;
    confirmFirstActivationButton.textContent = "激活中...";
    try {
      const result = await request("/api/activate-first-use", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });

      if (!result.activated) {
        firstActivationMessage.textContent = result.message;
        return;
      }

      firstUseActivated = true;
      firstActivationMessage.textContent = result.message;
      closeFirstActivationModal();
      const action = pendingProtectedAction;
      pendingProtectedAction = null;
      if (action) action();
    } catch {
      firstActivationMessage.textContent = "暂时无法激活，请确认从启动入口打开。";
    } finally {
      confirmFirstActivationButton.disabled = false;
      confirmFirstActivationButton.textContent = "立即激活";
    }
  });
}

fitAppToWindow();
window.addEventListener("resize", fitAppToWindow);
updateGuide();
refreshActivationStatus();
loadHomeState();
