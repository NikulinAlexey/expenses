const STORAGE_KEY = "expenses-tracker-v1";

const CATEGORIES = [
  "Коммунальные услуги",
  "Продукты питания",
  "Развлечения",
  "Леша",
  "Настя",
  "Дети",
  "Кредиты",
  "Подписки",
  "Бытовые товары",
  "Уход/косметика",
  "Питание вне дома",
  "Транспорт",
  "Бьюти",
  "Медицина",
  "Кошки",
  "Накопления",
  "Машина",
  "Прочее"
];

let expenses = loadExpenses();

const $ = (selector) => document.querySelector(selector);

function loadExpenses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(expenses));
}

function formatMoney(value) {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(new Date(`${dateString}T12:00:00`));
}

function monthKey(dateString) {
  return dateString.slice(0, 7);
}

function monthLabel(key) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("ru-RU", {
    month: "long",
    year: "numeric"
  }).format(new Date(Number(year), Number(month) - 1, 1));
}

function currentMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getMonths() {
  const set = new Set(expenses.map(e => monthKey(e.date)));
  set.add(currentMonth());
  return [...set].sort((a, b) => b.localeCompare(a));
}

function getYears() {
  return [...new Set(getMonths().map(m => m.slice(0, 4)))].sort().reverse();
}

function totalForMonth(month) {
  return expenses
    .filter(e => monthKey(e.date) === month)
    .reduce((sum, e) => sum + Number(e.amount), 0);
}

function renderCategoryOptions() {
  $("#categoryInput").innerHTML = CATEGORIES
    .map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join("");
}

function renderSelectors() {
  const months = getMonths();
  const current = currentMonth();

  const categorySelect = $("#categoryMonthSelect");
  const historySelect = $("#historyMonthSelect");

  categorySelect.innerHTML = months
    .map(m => `<option value="${m}">${capitalize(monthLabel(m))}</option>`)
    .join("");

  historySelect.innerHTML = `<option value="all">Все месяцы</option>` + months
    .map(m => `<option value="${m}">${capitalize(monthLabel(m))}</option>`)
    .join("");

  if (months.includes(current)) {
    categorySelect.value = current;
    historySelect.value = current;
  }

  const years = getYears();
  const yearSelect = $("#yearSelect");
  yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join("");
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderSummary() {
  const month = currentMonth();
  const total = totalForMonth(month);
  const monthExpenses = expenses.filter(e => monthKey(e.date) === month);
  const average = monthExpenses.length ? total / monthExpenses.length : 0;

  const previous = new Date();
  previous.setMonth(previous.getMonth() - 1);
  const previousKey = previous.toISOString().slice(0, 7);
  const previousTotal = totalForMonth(previousKey);

  let note = "Пока нет данных за прошлый месяц";
  if (previousTotal > 0) {
    const diff = ((total - previousTotal) / previousTotal) * 100;
    note = `${diff > 0 ? "+" : ""}${diff.toFixed(0)}% к прошлому месяцу`;
  }

  $("#summary").innerHTML = `
    <div class="summary-card">
      <div class="summary-label">Траты в ${capitalize(monthLabel(month))}</div>
      <div class="summary-value">${formatMoney(total)}</div>
      <div class="summary-note">${note}</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Количество покупок</div>
      <div class="summary-value">${monthExpenses.length}</div>
      <div class="summary-note">за текущий месяц</div>
    </div>
    <div class="summary-card">
      <div class="summary-label">Средняя трата</div>
      <div class="summary-value">${formatMoney(average)}</div>
      <div class="summary-note">на одну запись</div>
    </div>
  `;
}

function renderMonthsTable() {
  const selectedYear = $("#yearSelect").value || String(new Date().getFullYear());
  const months = getMonths().filter(m => m.startsWith(selectedYear)).sort();

  const tbody = $("#monthsTable tbody");
  tbody.innerHTML = months.map((month, index) => {
    const total = totalForMonth(month);
    const prev = index > 0 ? totalForMonth(months[index - 1]) : null;
    let change = `<span class="change-neutral">—</span>`;

    if (prev !== null && prev > 0) {
      const percent = ((total - prev) / prev) * 100;
      const cls = percent > 0 ? "change-up" : percent < 0 ? "change-down" : "change-neutral";
      change = `<span class="${cls}">${percent > 0 ? "+" : ""}${percent.toFixed(0)}%</span>`;
    }

    const count = expenses.filter(e => monthKey(e.date) === month).length;
    return `<tr>
      <td>${capitalize(monthLabel(month))}</td>
      <td class="amount">${formatMoney(total)}</td>
      <td>${change}</td>
      <td>${count}</td>
    </tr>`;
  }).join("");

  if (!tbody.innerHTML) {
    tbody.innerHTML = `<tr><td colspan="4" class="empty-state">В этом году пока нет данных.</td></tr>`;
  }
}

function renderCategoryAnalysis() {
  const month = $("#categoryMonthSelect").value;
  const monthExpenses = expenses.filter(e => monthKey(e.date) === month);
  const total = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);

  const byCategory = {};
  monthExpenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + Number(e.amount);
  });

  const rows = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);

  if (!rows.length) {
    $("#categoryAnalysis").innerHTML = `<div class="empty-state">Нет трат за выбранный месяц.</div>`;
    return;
  }

  $("#categoryAnalysis").innerHTML = rows.map(([category, amount]) => {
    const percent = total ? (amount / total) * 100 : 0;
    return `<div class="category-row">
      <div class="category-name">${escapeHtml(category)}</div>
      <div class="category-bar"><div class="category-fill" style="width:${percent}%"></div></div>
      <div class="category-total">${formatMoney(amount)}</div>
    </div>`;
  }).join("");
}

function renderHistory() {
  const selected = $("#historyMonthSelect").value;
  const filtered = expenses
    .filter(e => selected === "all" || monthKey(e.date) === selected)
    .sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);

  const tbody = $("#expensesTable tbody");
  $("#emptyHistory").style.display = filtered.length ? "none" : "block";

  tbody.innerHTML = filtered.map(e => `<tr>
    <td>${formatDate(e.date)}</td>
    <td>${escapeHtml(e.item)}</td>
    <td>${escapeHtml(e.category)}</td>
    <td class="amount">${formatMoney(Number(e.amount))}</td>
    <td><button class="delete-btn" data-delete="${e.id}" title="Удалить">×</button></td>
  </tr>`).join("");
}

function drawTrendChart() {
  const canvas = $("#trendChart");
  const ctx = canvas.getContext("2d");
  const box = canvas.parentElement;
  const dpr = window.devicePixelRatio || 1;
  const width = box.clientWidth;
  const height = box.clientHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const months = getMonths().sort().slice(-8);
  const values = months.map(totalForMonth);
  const max = Math.max(...values, 1);
  const pad = { left: 15, right: 15, top: 25, bottom: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  ctx.font = "11px DM Sans, sans-serif";
  ctx.lineWidth = 1;
  ctx.strokeStyle = "#e8e4da";
  ctx.fillStyle = "#76817d";

  for (let i = 0; i < 4; i++) {
    const y = pad.top + chartH * (i / 3);
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();
  }

  if (!months.length) return;

  const points = months.map((m, i) => ({
    x: months.length === 1 ? width / 2 : pad.left + chartW * (i / (months.length - 1)),
    y: pad.top + chartH - (values[i] / max) * chartH
  }));

  ctx.strokeStyle = "#315b50";
  ctx.lineWidth = 3;
  ctx.beginPath();
  points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
  ctx.stroke();

  points.forEach((p, i) => {
    ctx.fillStyle = "#fffdf8";
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#315b50";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#76817d";
    ctx.textAlign = "center";
    ctx.fillText(new Intl.DateTimeFormat("ru-RU", { month: "short" })
      .format(new Date(Number(months[i].slice(0, 4)), Number(months[i].slice(5)) - 1, 1)), p.x, height - 15);
  });
}

function renderAll() {
  renderSelectors();
  renderSummary();
  renderMonthsTable();
  renderCategoryAnalysis();
  renderHistory();
  drawTrendChart();
}

function openModal() {
  $("#expenseModal").classList.remove("hidden");
  $("#dateInput").value = new Date().toISOString().slice(0, 10);
  $("#itemInput").focus();
}

function closeModal() {
  $("#expenseModal").classList.add("hidden");
  $("#expenseForm").reset();
}

$("#addExpenseBtn").addEventListener("click", openModal);
$("#closeModalBtn").addEventListener("click", closeModal);
$("#cancelBtn").addEventListener("click", closeModal);

$("#expenseModal").addEventListener("click", (event) => {
  if (event.target === $("#expenseModal")) closeModal();
});

$("#expenseForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const expense = {
    id: Date.now(),
    item: $("#itemInput").value.trim(),
    category: $("#categoryInput").value,
    amount: Number($("#amountInput").value),
    date: $("#dateInput").value
  };

  if (!expense.item || !expense.category || !expense.amount || expense.amount <= 0 || !expense.date) return;

  expenses.push(expense);
  saveExpenses();
  closeModal();
  renderAll();
});

$("#categoryMonthSelect").addEventListener("change", renderCategoryAnalysis);
$("#historyMonthSelect").addEventListener("change", renderHistory);
$("#yearSelect").addEventListener("change", renderMonthsTable);

$("#expensesTable").addEventListener("click", (event) => {
  const button = event.target.closest("[data-delete]");
  if (!button) return;

  const id = Number(button.dataset.delete);
  const expense = expenses.find(e => e.id === id);
  if (!expense) return;

  if (confirm(`Удалить трату «${expense.item}» на ${formatMoney(expense.amount)}?`)) {
    expenses = expenses.filter(e => e.id !== id);
    saveExpenses();
    renderAll();
  }
});

window.addEventListener("resize", drawTrendChart);

renderCategoryOptions();
renderAll();
