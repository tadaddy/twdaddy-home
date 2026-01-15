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
const balanceTotal = document.querySelector("#balanceTotal");
const savingRate = document.querySelector("#savingRate");
const assetTotal = document.querySelector("#assetTotal");
const breakdown = document.querySelector("#categoryBreakdown");
const clearAllButton = document.querySelector("#clearAll");
const walletSelect = document.querySelector("#walletSelect");
const walletABalance = document.querySelector("#walletABalance");
const walletBBalance = document.querySelector("#walletBBalance");
const trendType = document.querySelector("#trendType");
const trendChart = document.querySelector("#trendChart");
const assetPoolList = document.querySelector("#assetPoolList");
const addAssetPool = document.querySelector("#addAssetPool");

const AUTH_KEY = "twdaddy-home-auth";
const DASHBOARD_PASSWORD = "0303";
const WALLET_MONTHLY_BUDGET = 5000;
let transactions = [];
let assetPools = [];

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
    await Promise.all([fetchTransactions(), fetchPools()]);
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
  const tr = document.createElement("tr");
  tr.innerHTML = `
    <td>${item.date}</td>
    <td><span class="tag ${item.type}">${item.type === "income" ? "收入" : "支出"}</span></td>
    <td>${item.category}</td>
    <td>${formatCurrency(item.amount)}</td>
    <td>${item.note || "-"}</td>
    <td><button class="ghost" data-id="${item.id}">删除</button></td>
  `;
  return tr;
};

const renderEmptyState = () => {
  const tr = document.createElement("tr");
  const td = document.createElement("td");
  td.colSpan = 6;
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
  const balance = income - expense;
  const rate = income === 0 ? 0 : (balance / income) * 100;

  incomeTotal.textContent = formatCurrency(income);
  expenseTotal.textContent = formatCurrency(expense);
  balanceTotal.textContent = formatCurrency(balance);
  savingRate.textContent = `${rate.toFixed(1)}%`;
};

const getWalletRemaining = (items) => {
  const walletTotals = {
    walletA: WALLET_MONTHLY_BUDGET,
    walletB: WALLET_MONTHLY_BUDGET,
  };
  items
    .filter((item) => item.type === "expense")
    .forEach((item) => {
      if (item.wallet === "walletA") {
        walletTotals.walletA -= item.amount;
      }
      if (item.wallet === "walletB") {
        walletTotals.walletB -= item.amount;
      }
    });
  return walletTotals;
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
  assetPools.reduce((sum, pool) => sum + (Number(pool.amount) || 0), 0);

const getDaysInMonth = (month) => {
  const [year, monthIndex] = month.split("-").map(Number);
  return new Date(year, monthIndex, 0).getDate();
};

const buildTrendSvg = (values, color) => {
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

  return `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="趋势折线图">
      <polyline
        fill="none"
        stroke="#e2e8f0"
        stroke-width="2"
        points="${padding},${height - padding} ${width - padding},${height - padding}"
      />
      <polyline
        fill="none"
        stroke="${color}"
        stroke-width="3"
        stroke-linecap="round"
        stroke-linejoin="round"
        points="${points}"
      />
    </svg>
  `;
};

const renderTrendChart = (items) => {
  const currentMonth = monthSelect.value;
  const daysInMonth = getDaysInMonth(currentMonth);
  const values = Array.from({ length: daysInMonth }, () => 0);
  items
    .filter((item) => item.type === trendType.value)
    .forEach((item) => {
      const day = Number(item.date.split("-")[2]);
      if (!Number.isNaN(day) && day >= 1 && day <= daysInMonth) {
        values[day - 1] += item.amount;
      }
    });

  const color = trendType.value === "income" ? "#16a34a" : "#dc2626";
  trendChart.innerHTML = buildTrendSvg(values, color);
};

const updateView = () => {
  const currentMonth = monthSelect.value;
  const monthItems = getMonthItems(transactions, currentMonth);
  const sorted = [...monthItems].sort((a, b) => b.date.localeCompare(a.date));
  renderTransactions(sorted);
  renderSummary(monthItems);
  const wallets = getWalletRemaining(monthItems);
  walletABalance.textContent = formatCurrency(wallets.walletA);
  walletBBalance.textContent = formatCurrency(wallets.walletB);
  renderAssetPools();
  assetTotal.textContent = formatCurrency(
    monthItems
      .filter((item) => item.type === "income")
      .reduce((sum, item) => sum + item.amount, 0) -
      monthItems
        .filter((item) => item.type === "expense")
        .reduce((sum, item) => sum + item.amount, 0) +
      wallets.walletA +
      wallets.walletB +
      getAssetPoolTotal()
  );
  renderBreakdown(monthItems);
  renderTrendChart(monthItems);
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
};

const resetForm = () => {
  typeSelect.value = "income";
  categoryInput.value = "";
  walletSelect.value = "none";
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

  const payload = {
    id: Date.now().toString(),
    type: typeSelect.value,
    category: categoryInput.value.trim() || "其他",
    amount,
    date: dateInput.value,
    note: noteInput.value.trim(),
    wallet: typeSelect.value === "expense" ? walletSelect.value : "none",
  };

  try {
    await apiRequest("/api/transactions", {
      method: "POST",
      body: JSON.stringify(payload),
    });
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
    await apiRequest(`/api/transactions/${id}`, { method: "DELETE" });
    await fetchTransactions();
    updateView();
  } catch (error) {
    console.error("删除失败", error);
    alert("删除失败，请稍后再试。");
  }
});

monthSelect.addEventListener("change", updateView);
trendType.addEventListener("change", updateView);

typeSelect.addEventListener("change", () => {
  if (typeSelect.value === "income") {
    walletSelect.value = "none";
    walletSelect.disabled = true;
  } else {
    walletSelect.disabled = false;
  }
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
});

monthSelect.value = getCurrentMonth();
walletSelect.disabled = true;
resetForm();
ensureAuthenticated();
