const authOverlay = document.querySelector("#authOverlay");
const authForm = document.querySelector("#authForm");
const authPassword = document.querySelector("#authPassword");
const app = document.querySelector("#app");
const form = document.querySelector("#transactionForm");
const typeSelect = document.querySelector("#typeSelect");
const categoryInput = document.querySelector("#categoryInput");
const amountInput = document.querySelector("#amountInput");
const dateInput = document.querySelector("#dateInput");
const noteInput = document.querySelector("#noteInput");
const monthSelect = document.querySelector("#monthSelect");
const transactionList = document.querySelector("#transactionList");
const incomeTotal = document.querySelector("#incomeTotal");
const expenseTotal = document.querySelector("#expenseTotal");
const assetPoolSelect = document.querySelector("#assetPoolSelect");
const assetTotal = document.querySelector("#assetTotal");
const breakdown = document.querySelector("#categoryBreakdown");
const clearAllButton = document.querySelector("#clearAll");
const walletList = document.querySelector("#walletList");
const trendType = document.querySelector("#trendType");
const trendChart = document.querySelector("#trendChart");
const trendZoom = document.querySelector("#trendZoom");
const trendOffset = document.querySelector("#trendOffset");
const assetPoolList = document.querySelector("#assetPoolList");
const addAssetPool = document.querySelector("#addAssetPool");

const AUTH_KEY = "twdaddy-home-auth";
const DASHBOARD_PASSWORD = "0303";
let transactions = [];
let assetPools = [];
let wallets = [];
let walletBalances = {};

const formatCurrency = (value) =>
  `¥${value.toLocaleString("zh-CN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const getCurrentMonth = () => {
  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return month;
};

const apiRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json",
    },
    ...options,
  });
  if (!response.ok) {
    throw new Error("请求失败");
  }
  return response.json();
};

const fetchTransactions = async () => {
  try {
    transactions = await apiRequest("/api/transactions");
  } catch (error) {
    console.error("无法获取服务器数据", error);
    alert("无法获取服务器数据，请确认服务器已启动。");
    transactions = [];
  }
};

const fetchPools = async () => {
  try {
    assetPools = await apiRequest("/api/pools");
  } catch (error) {
    console.error("无法获取资产池数据", error);
    alert("无法获取资产池数据，请确认服务器已启动。");
    assetPools = [];
  }
};

const fetchWallets = async () => {
  try {
    wallets = await apiRequest("/api/wallets");
  } catch (error) {
    console.error("无法获取钱包数据", error);
    alert("无法获取钱包数据，请确认服务器已启动。");
    wallets = [];
  }
};

const saveWallets = async () => {
  try {
    await apiRequest("/api/wallets", {
      method: "PUT",
      body: JSON.stringify(wallets),
    });
  } catch (error) {
    console.error("无法保存钱包", error);
    alert("保存钱包失败，请稍后再试。");
  }
};

const savePools = async () => {
  try {
    await apiRequest("/api/pools", {
      method: "PUT",
      body: JSON.stringify(assetPools),
    });
  } catch (error) {
    console.error("无法保存资产池", error);
    alert("保存资产池失败，请稍后再试。");
  }
};

const hideOverlay = () => {
  authOverlay.classList.add("hidden");
  authOverlay.style.display = "none";
  authOverlay.setAttribute("aria-hidden", "true");
  app.classList.remove("hidden");
};

const showDashboard = async () => {
  hideOverlay();
  try {
    await Promise.all([fetchTransactions(), fetchPools(), fetchWallets()]);
    renderAssetPools();
    renderWallets();
    updateAssetPoolOptions();
    updateTrendOptions();
    updateView();
  } catch (error) {
    console.error("初始化失败", error);
  }
};

const setAuthenticated = async () => {
  sessionStorage.setItem(AUTH_KEY, "true");
  await showDashboard();
};

const ensureAuthenticated = async () => {
  if (sessionStorage.getItem(AUTH_KEY) === "true") {
    await showDashboard();
  }
};

const createRow = (item) => {
  const poolName = getPoolName(item.assetPool);
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${item.date}</td>
    <td><span class="tag ${item.type}">${item.type === "income" ? "收入" : "支出"}</span></td>
    <td>${item.category}</td>
    <td>${poolName || "-"}</td>
    <td>${formatCurrency(item.amount)}</td>
    <td>${item.note || "-"}</td>
    <td><button class="ghost" data-id="${item.id}">删除</button></td>
  `;
  return tr;
};

const renderEmptyState = () => {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 7;
  td.className = "empty-state";
  td.textContent = "暂无记录，先添加一笔吧。";
  tr.appendChild(td);
  transactionList.appendChild(tr);
};

const renderTransactions = (items) => {
  transactionList.innerHTML = "";
  if (!items.length) {
    renderEmptyState();
    return;
  }
  items.forEach((item) => {
    const row = createRow(item);
    transactionList.appendChild(row);
  });
};

const renderSummary = (items) => {
  const income = items
    .filter((item) => item.type === "income")
    .reduce((sum, item) => sum + item.amount, 0);
  const expense = items
    .filter((item) => item.type === "expense")
    .reduce((sum, item) => sum + item.amount, 0);

  incomeTotal.textContent = formatCurrency(income);
  expenseTotal.textContent = formatCurrency(expense);
};

const getWalletRemaining = (items) => {
  const totals = {};
  wallets.forEach((wallet) => {
    totals[wallet.id] = wallet.monthlyBudget ?? 5000;
  });

  items
    .filter((item) => item.wallet && item.wallet !== "none")
    .forEach((item) => {
      if (!(item.wallet in totals)) {
        totals[item.wallet] = 0;
      }
      if (item.type === "expense") {
        totals[item.wallet] -= item.amount;
      }
      if (item.type === "income") {
        totals[item.wallet] += item.amount;
      }
    });
  return totals;
};

const renderBreakdown = (items) => {
  breakdown.innerHTML = "";
  const expenseItems = items.filter((item) => item.type === "expense");
  if (!expenseItems.length) {
    const empty = document.createElement("p");
    empty.className = "empty-state";
    empty.textContent = "暂无支出记录。";
    breakdown.appendChild(empty);
    return;
  }

  const totals = expenseItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + item.amount;
    return acc;
  }, {});

  const entries = Object.entries(totals).sort((a, b) => b[1] - a[1]);
  const max = entries[0]?.[1] || 1;

  entries.forEach(([category, amount]) => {
    const item = document.createElement("div");
    item.className = "breakdown-item";

    const label = document.createElement("div");
    label.innerHTML = `<strong>${category}</strong><div class="progress-bar"><span style="width:${
      (amount / max) * 100
    }%"></span></div>`;

    const value = document.createElement("div");
    value.textContent = formatCurrency(amount);

    item.appendChild(label);
    item.appendChild(value);
    breakdown.appendChild(item);
  });
};

const getMonthItems = (items, month) => items.filter((item) => item.date.startsWith(month));

const getAssetPoolTotal = () =>
  assetPools.reduce((sum, pool) => sum + (Number(pool.amount) || 0), 0) +
  Object.values(walletBalances).reduce((sum, value) => sum + value, 0);

const getDaysInMonth = (month) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
};

const buildTrendSvg = (values, color, labels) => {
  const width = 640;
  const height = 220;
  const padding = 24;
  const maxValue = Math.max(...values, 1);
  const step = (width - padding * 2) / (values.length - 1 || 1);
  const points = values
    .map((value, index) => {
      const x = padding + index * step;
      const y = height - padding - (value / maxValue) * (height - padding * 2);
      return `${x},${y}`;
    })
    .join(" ");

  const labelPoints = labels
    .map((label, index) => {
      if (index % Math.ceil(labels.length / 6) !== 0 && index !== labels.length - 1) {
        return "";
      }
      const x = padding + index * step;
      return `<text x="${x}" y="${height - 6}" font-size="10" fill="#94a3b8" text-anchor="middle">${label}</text>`;
    })
    .join("");

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="趋势折线图">
      <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#e2e8f0" stroke-width="2" />
      <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#e2e8f0" stroke-width="2" />
      <polyline
        fill="none"
        stroke="${color}"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points}"
      />
      ${labelPoints}
      <text x="${padding}" y="${padding - 8}" font-size="10" fill="#94a3b8">¥${maxValue.toFixed(0)}</text>
    </svg>
  `;
};

const renderTrendChart = (items) => {
  const currentMonth = monthSelect.value;
  const daysInMonth = getDaysInMonth(currentMonth);
  const fullValues = Array.from({ length: daysInMonth }, () => 0);
  items
    .filter((item) => {
      if (trendType.value === "income" || trendType.value === "expense") {
        return item.type === trendType.value;
      }
      return item.wallet === trendType.value;
    })
    .forEach((item) => {
      const day = Number(item.date.split("-")[2]);
      if (!Number.isNaN(day) && day >= 1 && day <= daysInMonth) {
        fullValues[day - 1] += item.amount;
      }
    });

  const zoomDays = Number(trendZoom.value);
  trendZoom.max = daysInMonth.toString();
  trendOffset.max = Math.max(daysInMonth - zoomDays, 0).toString();
  const offset = Math.min(Number(trendOffset.value), Math.max(daysInMonth - zoomDays, 0));
  trendOffset.value = offset.toString();

  const values = fullValues.slice(offset, offset + zoomDays);
  const labels = values.map((_, index) => `${offset + index + 1}日`);
  const color =
    trendType.value === "income" ? "#16a34a" : trendType.value === "expense" ? "#dc2626" : "#0ea5e9";
  trendChart.innerHTML = buildTrendSvg(values, color, labels);
};

const updateView = () => {
  const currentMonth = monthSelect.value;
  const monthItems = getMonthItems(transactions, currentMonth);
  const sorted = [...monthItems].sort((a, b) => b.date.localeCompare(a.date));
  renderTransactions(sorted);
  renderSummary(monthItems);
  walletBalances = getWalletRemaining(monthItems);
  updateWalletBalances(walletBalances);
  updateAssetPoolInputs();
  assetTotal.textContent = formatCurrency(getAssetPoolTotal());
  renderBreakdown(monthItems);
  renderTrendChart(monthItems);
};

const renderWallets = () => {
  walletList.innerHTML = "";
  wallets.forEach((wallet) => {
    const card = document.createElement("article");
    card.className = "wallet-item";
    card.innerHTML = `
      <div class="wallet-row">
        <input type="text" value="${wallet.name}" data-wallet-id="${wallet.id}" data-field="name" />
        <span class="hint">每月 ¥${wallet.monthlyBudget ?? 5000}</span>
      </div>
      <div class="wallet-balance" data-wallet-balance="${wallet.id}">¥0</div>
      <div class="wallet-actions">
        <input type="number" min="0" step="0.01" placeholder="调整余额" data-wallet-id="${wallet.id}" data-field="target" />
        <input type="date" data-wallet-id="${wallet.id}" data-field="date" />
        <button type="button" class="primary" data-wallet-id="${wallet.id}" data-action="apply">更新</button>
      </div>
    `;
    walletList.appendChild(card);
  });
};

const updateWalletBalances = (walletTotals) => {
  wallets.forEach((wallet) => {
    const balance = walletTotals[wallet.id] ?? 0;
    const balanceEl = walletList.querySelector(`[data-wallet-balance="${wallet.id}"]`);
    const targetInput = walletList.querySelector(`input[data-wallet-id="${wallet.id}"][data-field="target"]`);
    if (balanceEl) {
      balanceEl.textContent = formatCurrency(balance);
    }
    if (targetInput && document.activeElement !== targetInput) {
      targetInput.value = balance.toFixed(2);
    }
  });
  const poolBalances = assetPoolList.querySelectorAll("[data-wallet-pool-balance]");
  poolBalances.forEach((element) => {
    const walletId = element.dataset.walletPoolBalance;
    const balance = walletTotals[walletId] ?? 0;
    element.textContent = `同步临时钱包 ${formatCurrency(balance)}`;
  });
  const poolInputs = assetPoolList.querySelectorAll("[data-wallet-pool-input]");
  poolInputs.forEach((element) => {
    const walletId = element.dataset.walletPoolInput;
    const balance = walletTotals[walletId] ?? 0;
    element.value = balance.toFixed(2);
  });
};

const updateAssetPoolInputs = () => {
  const amountInputs = assetPoolList.querySelectorAll('input[data-field="amount"]');
  amountInputs.forEach((input) => {
    const index = Number(input.dataset.index);
    if (Number.isNaN(index) || !assetPools[index]) {
      return;
    }
    if (document.activeElement === input) {
      return;
    }
    input.value = Number(assetPools[index].amount || 0).toFixed(2);
  });
};

const getSelectablePools = () => [
  ...assetPools.map((pool) => ({ id: pool.id, name: pool.name, type: "pool" })),
  ...wallets.map((wallet) => ({ id: wallet.id, name: wallet.name, type: "wallet" })),
];

const getPoolName = (poolId) => {
  if (!poolId || poolId === "none") {
    return "";
  }
  const fromPools = assetPools.find((pool) => pool.id === poolId);
  if (fromPools) {
    return fromPools.name;
  }
  const fromWallets = wallets.find((wallet) => wallet.id === poolId);
  return fromWallets ? fromWallets.name : "";
};

const updateAssetPoolOptions = () => {
  const currentValue = assetPoolSelect.value;
  assetPoolSelect.innerHTML = `
    <option value="none">不使用</option>
    ${getSelectablePools().map((pool) => `<option value="${pool.id}">${pool.name}</option>`).join("")}
  `;
  if (assetPoolSelect.querySelector(`option[value="${currentValue}"]`)) {
    assetPoolSelect.value = currentValue;
  }
};

const updateTrendOptions = () => {
  const currentValue = trendType.value;
  trendType.innerHTML = `
    <option value="income">收入</option>
    <option value="expense">支出</option>
    ${wallets.map((wallet) => `<option value="${wallet.id}">${wallet.name}</option>`).join("")}
  `;
  if (trendType.querySelector(`option[value="${currentValue}"]`)) {
    trendType.value = currentValue;
  }
};

const renderAssetPools = () => {
  assetPoolList.innerHTML = "";
  assetPools.forEach((pool, index) => {
    const row = document.createElement("div");
    row.className = "asset-pool-item";
    row.innerHTML = `
      <input type="text" value="${pool.name}" data-index="${index}" data-field="name" />
      <input type="number" min="0" step="0.01" value="${pool.amount}" data-index="${index}" data-field="amount" />
      <button type="button" class="ghost" data-index="${index}" data-action="delete">删除</button>
    `;
    assetPoolList.appendChild(row);
  });

  wallets.forEach((wallet) => {
    const row = document.createElement("div");
    row.className = "asset-pool-item readonly";
    row.innerHTML = `
      <input type="text" value="${wallet.name}" readonly />
      <input type="number" value="${(walletBalances[wallet.id] ?? 0).toFixed(2)}" data-wallet-pool-input="${wallet.id}" readonly />
      <span class="asset-pool-note" data-wallet-pool-balance="${wallet.id}">同步临时钱包</span>
    `;
    assetPoolList.appendChild(row);
  });
};

const resetForm = () => {
  typeSelect.value = "income";
  categoryInput.value = "";
  assetPoolSelect.value = "none";
  amountInput.value = "";
  dateInput.valueAsDate = new Date();
  noteInput.value = "";
};

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  const amount = Number.parseFloat(amountInput.value);
  if (Number.isNaN(amount) || amount <= 0) {
    alert("请输入有效金额");
    return;
  }

  if (assetPoolSelect.value === "none") {
    alert(typeSelect.value === "income" ? "请选择收入进入的资产池。" : "请选择支出对应的资产池。");
    return;
  }

  const selectedPool = getSelectablePools().find((pool) => pool.id === assetPoolSelect.value);
  const payload = {
    id: Date.now().toString(),
    type: typeSelect.value,
    category: categoryInput.value.trim() || "其他",
    amount,
    date: dateInput.value,
    note: noteInput.value.trim(),
    wallet: selectedPool?.type === "wallet" ? selectedPool.id : "none",
    assetPool: assetPoolSelect.value,
  };

  try {
    await apiRequest("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    if (selectedPool?.type === "pool") {
      const poolIndex = assetPools.findIndex((pool) => pool.id === selectedPool.id);
      if (poolIndex !== -1) {
        const delta = payload.type === "income" ? payload.amount : -payload.amount;
        assetPools[poolIndex].amount = Number(assetPools[poolIndex].amount || 0) + delta;
        await savePools();
        renderAssetPools();
        updateAssetPoolOptions();
      }
    }
    await fetchTransactions();
    updateView();
    resetForm();
  } catch (error) {
    console.error("无法保存记录", error);
    alert("保存失败，请稍后再试。");
  }
});

authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (authPassword.value.trim() === DASHBOARD_PASSWORD) {
    await setAuthenticated();
    authPassword.value = "";
  } else {
    alert("密码错误，请重试。");
  }
});

transactionList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  const id = target.dataset.id;
  if (!id) {
    return;
  }

  try {
    const toDelete = transactions.find((item) => item.id === id);
    await apiRequest(`/api/transactions/${id}`, { method: "DELETE" });
    if (toDelete) {
      const poolIndex = assetPools.findIndex((pool) => pool.id === toDelete.assetPool);
      if (poolIndex !== -1) {
        const delta = toDelete.type === "income" ? -toDelete.amount : toDelete.amount;
        assetPools[poolIndex].amount = Number(assetPools[poolIndex].amount || 0) + delta;
        await savePools();
        renderAssetPools();
        updateAssetPoolOptions();
      }
    }
    await fetchTransactions();
    updateView();
  } catch (error) {
    console.error("删除失败", error);
    alert("删除失败，请稍后再试。");
  }
});

monthSelect.addEventListener("change", updateView);
trendType.addEventListener("change", updateView);
trendZoom.addEventListener("input", updateView);
trendOffset.addEventListener("input", updateView);

typeSelect.addEventListener("change", () => {
  assetPoolSelect.disabled = false;
});

clearAllButton.addEventListener("click", async () => {
  if (!confirm("确认清空全部记录吗？此操作无法撤销。")) {
    return;
  }
  try {
    await apiRequest("/api/transactions", { method: "DELETE" });
    await fetchTransactions();
    updateView();
  } catch (error) {
    console.error("清空失败", error);
    alert("清空失败，请稍后再试。");
  }
});

addAssetPool.addEventListener("click", async () => {
  assetPools.push({
    id: `pool-${Date.now()}`,
    name: "新资产池",
    amount: 0,
  });
  renderAssetPools();
  updateView();
  await savePools();
  updateAssetPoolOptions();
});

assetPoolList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const index = Number(target.dataset.index);
  const field = target.dataset.field;
  if (Number.isNaN(index) || !assetPools[index]) {
    return;
  }
  if (field === "name") {
    assetPools[index].name = target.value;
  }
  if (field === "amount") {
    assetPools[index].amount = Number(target.value) || 0;
  }
  updateView();
});

assetPoolList.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  await savePools();
  updateAssetPoolOptions();
});

assetPoolList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  if (target.dataset.action !== "delete") {
    return;
  }
  const index = Number(target.dataset.index);
  if (Number.isNaN(index) || !assetPools[index]) {
    return;
  }
  assetPools.splice(index, 1);
  renderAssetPools();
  updateView();
  await savePools();
  updateAssetPoolOptions();
});

walletList.addEventListener("input", (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const walletId = target.dataset.walletId;
  const field = target.dataset.field;
  const wallet = wallets.find((item) => item.id === walletId);
  if (!wallet || field !== "name") {
    return;
  }
  wallet.name = target.value;
});

walletList.addEventListener("change", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLInputElement)) {
    return;
  }
  const walletId = target.dataset.walletId;
  const field = target.dataset.field;
  if (field === "name") {
    const wallet = wallets.find((item) => item.id === walletId);
    if (wallet) {
      await saveWallets();
      renderWallets();
      renderAssetPools();
      updateAssetPoolOptions();
      updateTrendOptions();
      updateView();
    }
  }
});

walletList.addEventListener("click", async (event) => {
  const target = event.target;
  if (!(target instanceof HTMLButtonElement)) {
    return;
  }
  if (target.dataset.action !== "apply") {
    return;
  }
  const walletId = target.dataset.walletId;
  const targetInput = walletList.querySelector(`input[data-wallet-id="${walletId}"][data-field="target"]`);
  const dateInput = walletList.querySelector(`input[data-wallet-id="${walletId}"][data-field="date"]`);
  if (!targetInput || !dateInput) {
    return;
  }
  const targetValue = Number.parseFloat(targetInput.value);
  if (Number.isNaN(targetValue)) {
    alert("请输入有效金额。");
    return;
  }
  if (!dateInput.value) {
    alert("请选择日期。");
    return;
  }
  const currentMonth = monthSelect.value;
  const monthItems = getMonthItems(transactions, currentMonth);
  const currentBalances = getWalletRemaining(monthItems);
  const currentValue = currentBalances[walletId] ?? 0;
  const diff = targetValue - currentValue;
  if (Math.abs(diff) < 0.01) {
    return;
  }
  const payload = {
    id: Date.now().toString(),
    type: diff > 0 ? "income" : "expense",
    category: "钱包调整",
    amount: Math.abs(diff),
    date: dateInput.value,
    note: `调整${walletId}`,
    wallet: walletId,
    assetPool: walletId,
  };
  try {
    await apiRequest("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    await fetchTransactions();
    updateView();
  } catch (error) {
    console.error("钱包调整失败", error);
    alert("钱包调整失败，请稍后再试。");
  }
});

monthSelect.value = getCurrentMonth();
assetPoolSelect.disabled = false;
resetForm();
ensureAuthenticated();
