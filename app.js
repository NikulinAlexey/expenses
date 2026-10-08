'use strict';
const CATS = ['коммунальные услуги','продукты питания','развлечения','Леша','Настя','дети','кредиты','подписки','бытовые товары','уход/косметика','питание вне дома','транспорт','бьюти','медицина','кошки','накопления','машина','прочее'];

/* ---- Хранилище. Когда появится сервер — меняется только этот объект. ---- */
const Store = {
  KEY: 'expenses_v1',
  load() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); }
};

let data = Store.load();
let editingId = null;
const $ = id => document.getElementById(id);

/* ---- Утилиты ---- */
const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const thisMonth = () => today().slice(0, 7);
const fmt = n => n.toLocaleString('ru-RU', { maximumFractionDigits: 2 }) + ' ₽';
const short = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? Math.round(n / 1000) + 'k' : Math.round(n);
const mName = k => new Date(k + '-01T00:00').toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
const mShort = k => new Date(k + '-01T00:00').toLocaleDateString('ru-RU', { month: 'short', year: '2-digit' });
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sum = a => a.reduce((s, e) => s + e.amount, 0);
const months = () => [...new Set([...data.map(e => e.date.slice(0, 7)), thisMonth()])].sort();
const prevOf = m => { const d = new Date(m + '-01T00:00'); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7) === m ? m : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
const delta = (cur, prev) => {
  if (!prev) return '<span class="muted">—</span>';
  const p = (cur - prev) / prev * 100;
  return `<span class="${p > 0 ? 'up' : 'down'}">${p > 0 ? '▲' : '▼'} ${Math.abs(p).toFixed(0)}%</span>`;
};
const inMonth = m => data.filter(e => e.date.startsWith(m));
const byCat = list => { const t = {}; CATS.forEach(c => t[c] = 0); list.forEach(e => t[e.cat] = (t[e.cat] || 0) + e.amount); return t; };

/* ---- Рендер ---- */
function renderMonthSelect() {
  const sel = $('month'), keep = sel.value || thisMonth();
  const ms = months().reverse();
  sel.innerHTML = ms.map(m => `<option value="${m}">${mName(m)}</option>`).join('');
  sel.value = ms.includes(keep) ? keep : ms[0];
}

function renderKpis(m) {
  const cur = inMonth(m), prev = inMonth(prevOf(m));
  const total = sum(cur), pTotal = sum(prev);
  const t = byCat(cur), top = Object.entries(t).sort((a, b) => b[1] - a[1])[0];
  $('kpis').innerHTML = `
    <div class="kpi"><small>Всего за месяц</small><b>${fmt(total)}</b></div>
    <div class="kpi"><small>К прошлому месяцу (${fmt(pTotal)})</small><b>${delta(total, pTotal)}</b></div>
    <div class="kpi"><small>Больше всего ушло на</small><b>${top && top[1] > 0 ? esc(top[0]) : '—'}</b></div>
    <div class="kpi"><small>Количество трат</small><b>${cur.length}</b></div>`;
}

function renderCats(m) {
  const t = byCat(inMonth(m)), p = byCat(inMonth(prevOf(m)));
  const total = Object.values(t).reduce((a, b) => a + b, 0);
  const rows = Object.entries(t).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const max = rows.length ? rows[0][1] : 1;
  $('cats').innerHTML = rows.length ? rows.map(([c, v]) => `
    <div class="cat"><span>${esc(c)}</span>
      <div class="track"><div class="fill" style="width:${v / max * 100}%"></div></div>
      <span class="num">${fmt(v)} <span class="muted">${(v / total * 100).toFixed(0)}%</span></span>
      <span class="num" title="к прошлому месяцу">${delta(v, p[c])}</span></div>`).join('')
    : '<p class="muted">В этом месяце трат пока нет.</p>';
}

function renderTrend() {
  const sel = $('trendCat');
  if (!sel.options.length) sel.innerHTML = '<option value="">Все категории</option>' + CATS.map(c => `<option>${esc(c)}</option>`).join('');
  const c = sel.value, ms = months();
  const vals = ms.map(m => sum(inMonth(m).filter(e => !c || e.cat === c)));
  const max = Math.max(...vals, 1);
  $('chart').innerHTML = ms.map((m, i) => `<div class="col"><span>${short(vals[i])}</span>
    <div class="wrap"><div class="bar" title="${mName(m)}: ${fmt(vals[i])}" style="height:${vals[i] / max * 100}%"></div></div>
    <span class="muted">${mShort(m)}</span></div>`).join('');
  const filled = vals.filter(v => v > 0);
  if (filled.length < 2) { $('trendNote').textContent = 'Для анализа тенденции нужны данные минимум за два месяца.'; return; }
  const avg = filled.reduce((a, b) => a + b, 0) / filled.length, last = vals[vals.length - 1];
  const prevAvg = vals.slice(0, -1).filter(v => v > 0);
  const base = prevAvg.reduce((a, b) => a + b, 0) / (prevAvg.length || 1);
  const maxI = vals.indexOf(Math.max(...vals));
  const d = base ? (last - base) / base * 100 : 0;
  $('trendNote').textContent = `Среднее в месяц: ${fmt(avg)}. Максимум: ${mName(ms[maxI])} (${fmt(vals[maxI])}). ` +
    `Последний месяц ${d >= 0 ? 'выше' : 'ниже'} среднего за предыдущие на ${Math.abs(d).toFixed(0)}%.`;
}

function renderPivot() {
  const ms = months();
  const head = `<tr><th>Категория</th>${ms.map(m => `<th class="num">${mShort(m)}</th>`).join('')}<th class="num">Всего</th></tr>`;
  const per = ms.map(m => byCat(inMonth(m)));
  const body = CATS.map(c => {
    const vs = per.map(t => t[c]), tot = vs.reduce((a, b) => a + b, 0);
    return tot ? `<tr><td>${esc(c)}</td>${vs.map(v => `<td class="num">${v ? fmt(v) : '·'}</td>`).join('')}<td class="num"><b>${fmt(tot)}</b></td></tr>` : '';
  }).join('');
  const totals = per.map(t => Object.values(t).reduce((a, b) => a + b, 0));
  const dl = totals.map((v, i) => `<td class="num">${i ? delta(v, totals[i - 1]) : ''}</td>`).join('');
  $('pivot').innerHTML = head + body +
    `<tr class="total"><td>Итого</td>${totals.map(v => `<td class="num">${fmt(v)}</td>`).join('')}<td class="num">${fmt(totals.reduce((a, b) => a + b, 0))}</td></tr>` +
    `<tr><td class="muted">к прошлому месяцу</td>${dl}<td></td></tr>`;
}

function renderList(m) {
  const rows = inMonth(m).sort((a, b) => b.date.localeCompare(a.date));
  $('list').innerHTML = rows.length
    ? `<tr><th>Дата</th><th>Вещь</th><th>Категория</th><th class="num">Сумма</th><th></th></tr>` +
      rows.map(e => `<tr><td>${e.date.split('-').reverse().join('.')}</td><td>${esc(e.item)}</td><td>${esc(e.cat)}</td>
        <td class="num">${fmt(e.amount)}</td>
        <td class="num"><button class="icon" data-edit="${e.id}" title="Изменить">✎</button><button class="icon" data-del="${e.id}" title="Удалить">✕</button></td></tr>`).join('')
    : '<tr><td class="muted">Трат за этот месяц нет.</td></tr>';
}

function renderAll() {
  renderMonthSelect();
  const m = $('month').value;
  renderKpis(m); renderCats(m); renderTrend(); renderPivot(); renderList(m);
}

/* ---- Форма ---- */
function resetForm() {
  editingId = null; $('form').reset(); $('date').value = today();
  $('formTitle').textContent = 'Новая трата'; $('submitBtn').textContent = 'Добавить'; $('cancel').hidden = true;
}

$('form').addEventListener('submit', ev => {
  ev.preventDefault();
  const rec = { id: editingId || Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    item: $('item').value.trim(), cat: $('cat').value, amount: parseFloat($('amount').value), date: $('date').value };
  if (!rec.item || !(rec.amount >= 0)) return;
  data = editingId ? data.map(e => e.id === editingId ? rec : e) : [...data, rec];
  Store.save(data);
  const m = rec.date.slice(0, 7);
  resetForm(); renderAll();
  if ([...$('month').options].some(o => o.value === m)) { $('month').value = m; renderAll(); }
  $('item').focus();
});
$('cancel').onclick = resetForm;

$('list').addEventListener('click', ev => {
  const del = ev.target.dataset.del, ed = ev.target.dataset.edit;
  if (del && confirm('Удалить эту трату?')) { data = data.filter(e => e.id !== del); Store.save(data); renderAll(); }
  if (ed) {
    const e = data.find(x => x.id === ed); editingId = ed;
    $('item').value = e.item; $('cat').value = e.cat; $('amount').value = e.amount; $('date').value = e.date;
    $('formTitle').textContent = 'Изменить трату'; $('submitBtn').textContent = 'Сохранить'; $('cancel').hidden = false;
    window.scrollTo({ top: 0, behavior: 'smooth' }); $('item').focus();
  }
});
$('month').onchange = () => { const m = $('month').value; renderKpis(m); renderCats(m); renderList(m); };
$('trendCat').onchange = renderTrend;

/* ---- Экспорт / импорт ---- */
function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('exportJson').onclick = () => download(`expenses-${today()}.json`,
  JSON.stringify({ app: 'expense-tracker', version: 1, exportedAt: new Date().toISOString(), expenses: data }, null, 2), 'application/json');
$('exportCsv').onclick = () => {
  const q = s => `"${String(s).replace(/"/g, '""')}"`;
  const rows = [...data].sort((a, b) => a.date.localeCompare(b.date)).map(e =>
    [e.date, q(e.item), q(e.cat), String(e.amount).replace('.', ',')].join(';'));
  download(`expenses-${today()}.csv`, '\ufeff' + ['Дата;Вещь;Категория;Сумма', ...rows].join('\r\n'), 'text/csv;charset=utf-8');
};
$('importFile').onchange = async ev => {
  const f = ev.target.files[0]; ev.target.value = ''; if (!f) return;
  try {
    const j = JSON.parse(await f.text()), arr = Array.isArray(j) ? j : j.expenses;
    const ok = arr.filter(e => e && e.id && e.item && e.cat && e.date && isFinite(e.amount));
    const have = new Set(data.map(e => e.id)), fresh = ok.filter(e => !have.has(e.id));
    data = [...data, ...fresh.map(e => ({ id: String(e.id), item: String(e.item), cat: String(e.cat), amount: +e.amount, date: String(e.date) }))];
    Store.save(data); renderAll(); alert(`Добавлено трат: ${fresh.length}. Уже были в базе: ${ok.length - fresh.length}.`);
  } catch { alert('Не удалось прочитать файл. Нужен JSON, скачанный из этого сайта.'); }
};

/* ---- Старт ---- */
$('cat').innerHTML = CATS.map(c => `<option>${esc(c)}</option>`).join('');
$('date').value = today();
renderAll();
