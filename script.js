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
const breakdown = document.querySelector("#categoryBreakdown");
const clearAllButton = document.querySelector("#clearAll");

const AUTH_KEY = "twdaddy-home-auth";
const DASHBOARD_PASSWORD = "0303";
let transactions = [];

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

const hideOverlay = () => {
  authOverlay.classList.add("hidden");
  authOverlay.style.display = "none";
  authOverlay.setAttribute("aria-hidden", "true");
  app.classList.remove("hidden");
};

const showDashboard = async () => {
  hideOverlay();
  try {
    await fetchTransactions();
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

const updateView = () => {
  const currentMonth = monthSelect.value;
  const monthItems = getMonthItems(transactions, currentMonth);
  const sorted = [...monthItems].sort((a, b) => b.date.localeCompare(a.date));
  renderTransactions(sorted);
  renderSummary(monthItems);
  renderBreakdown(monthItems);
};

const resetForm = () => {
  typeSelect.value = "income";
  categoryInput.value = "";
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
    category: categoryInput.value.trim(),
    amount,
    date: dateInput.value,
    note: noteInput.value.trim(),
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

monthSelect.value = getCurrentMonth();
resetForm();
ensureAuthenticated();
