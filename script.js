/*
 * GLASS FINANCE
 * Real Estate Investment Analyzer
 * COMPLETE script – all render functions included.
 */

"use strict";

const $ = (id) => document.getElementById(id);

const DEFAULTS = {
  price: 5000000,
  down: 20,
  closing: 3,
  reno: 250000,
  rate: 8.5,
  term: 20,
  points: 0,
  rent: 45000,
  vacancy: 5,
  tax: 60000,
  insurance: 24000,
  maint: 8,
  management: 8,
  capex: 4,
  other: 12000,
  appreciation: 4,
  rentgrowth: 3,
  expensegrowth: 3,
  hold: 10,
  exitcap: 6,
  selling: 6
};

let compareB = {
  name: "Harbor View",
  price: 5600000,
  down: 25,
  closing: 3,
  reno: 300000,
  rate: 8.2,
  term: 20,
  points: 0,
  rent: 52000,
  vacancy: 5,
  tax: 70000,
  insurance: 26000,
  maint: 8,
  management: 8,
  capex: 4,
  other: 14000,
  appreciation: 5,
  rentgrowth: 3.2,
  expensegrowth: 3,
  hold: 10,
  exitcap: 6,
  selling: 6
};

window.currencySymbol = '₹';

// ----- HELPERS -----
function showToast(msg) {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast';
    t.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.7);color:#fff;padding:10px 20px;border-radius:12px;font-size:12px;z-index:9999;backdrop-filter:blur(8px);border:1px solid #fff3;transition:opacity 0.3s;opacity:0;pointer-events:none';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.style.opacity = '1';
  clearTimeout(t._hide);
  t._hide = setTimeout(() => t.style.opacity = '0', 3000);
}

function readNumber(id) {
  const el = $(id);
  if (!el) return DEFAULTS[id] ?? 0;
  const v = Number(el.value);
  return Number.isFinite(v) ? v : DEFAULTS[id] ?? 0;
}

function setText(id, val) {
  const el = $(id);
  if (el) el.textContent = val;
}

function money(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return (window.currencySymbol || '₹') + '0';
  return (window.currencySymbol || '₹') + Math.round(n).toLocaleString('en-IN');
}

function percent(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '0.00%';
  return n.toFixed(2) + '%';
}

function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

// ----- INPUT MODEL -----
function getInputs() {
  return {
    price: Math.max(0, readNumber('price')),
    down: clamp(readNumber('down') / 100, 0, 1),
    closing: Math.max(0, readNumber('closing') / 100),
    reno: Math.max(0, readNumber('reno')),
    rate: Math.max(0, readNumber('rate')),
    term: Math.max(1, readNumber('term')),
    points: Math.max(0, readNumber('points') / 100),
    rent: Math.max(0, readNumber('rent')),
    vacancy: clamp(readNumber('vacancy') / 100, 0, 0.99),
    tax: Math.max(0, readNumber('tax')),
    insurance: Math.max(0, readNumber('insurance')),
    maint: Math.max(0, readNumber('maint') / 100),
    management: clamp(readNumber('management') / 100, 0, 0.99),
    capex: Math.max(0, readNumber('capex') / 100),
    other: Math.max(0, readNumber('other')),
    appreciation: readNumber('appreciation') / 100,
    rentgrowth: readNumber('rentgrowth') / 100,
    expensegrowth: readNumber('expensegrowth') / 100,
    hold: Math.max(1, Math.round(readNumber('hold'))),
    exitcap: Math.max(0.0001, readNumber('exitcap') / 100),
    selling: clamp(readNumber('selling') / 100, 0, 0.99)
  };
}

// ----- MORTGAGE & IRR (unchanged) -----
function monthlyMortgagePayment(principal, annualRate, years) {
  if (principal <= 0 || years <= 0) return 0;
  const months = years * 12;
  const monthlyRate = annualRate / 100 / 12;
  if (monthlyRate === 0) return principal / months;
  const factor = Math.pow(1 + monthlyRate, months);
  return (principal * monthlyRate * factor) / (factor - 1);
}

function calculateIRR(cashFlows) {
  if (!cashFlows.some(v => v > 0) || !cashFlows.some(v => v < 0)) return 0;
  function npv(rate) {
    let total = 0;
    for (let i = 0; i < cashFlows.length; i++) {
      const den = Math.pow(1 + rate, i);
      if (!Number.isFinite(den)) return NaN;
      total += cashFlows[i] / den;
    }
    return total;
  }
  let prevRate = -0.99, prevNPV = npv(prevRate), low = null, high = null;
  for (let r = -0.98; r <= 10; r += 0.01) {
    const curNPV = npv(r);
    if (Number.isFinite(curNPV) && Number.isFinite(prevNPV) && prevNPV * curNPV <= 0) {
      low = prevRate; high = r; break;
    }
    prevRate = r; prevNPV = curNPV;
  }
  if (low === null || high === null) return 0;
  let lowNPV = npv(low);
  for (let i = 0; i < 150; i++) {
    const mid = (low + high) / 2;
    const midNPV = npv(mid);
    if (!Number.isFinite(midNPV)) return 0;
    if (Math.abs(midNPV) < 0.000001) return mid;
    if (lowNPV * midNPV <= 0) high = mid;
    else { low = mid; lowNPV = midNPV; }
  }
  return (low + high) / 2;
}

// ----- CORE MODEL -----
function calculateModel(a) {
  const loan = a.price * (1 - a.down);
  const pointsCost = loan * a.points;
  const initialCash = a.price * a.down + a.price * a.closing + a.reno + pointsCost;
  const payment = monthlyMortgagePayment(loan, a.rate, a.term);

  let balance = loan, propertyValue = a.price, monthlyRent = a.rent,
      tax = a.tax, insurance = a.insurance, other = a.other;
  const rows = [], cashFlows = [-initialCash];
  let totalInterest = 0;

  for (let year = 1; year <= a.hold; year++) {
    propertyValue *= 1 + a.appreciation;
    monthlyRent *= 1 + a.rentgrowth;
    if (year > 1) { tax *= 1 + a.expensegrowth; insurance *= 1 + a.expensegrowth; other *= 1 + a.expensegrowth; }

    const grossRent = monthlyRent * 12;
    const collectedRent = grossRent * (1 - a.vacancy);
    const maint = grossRent * a.maint;
    const mgmt = collectedRent * a.management;
    const capex = grossRent * a.capex;
    const opex = maint + mgmt + capex + tax + insurance + other;
    const noi = collectedRent - opex;

    let debtService = 0, interestPaid = 0;
    for (let m = 0; m < 12; m++) {
      if (balance > 0) {
        const monthlyInterest = balance * (a.rate / 100 / 12);
        const principalPaid = Math.min(balance, Math.max(0, payment - monthlyInterest));
        balance = Math.max(0, balance - principalPaid);
        interestPaid += monthlyInterest;
        totalInterest += monthlyInterest;
      }
      debtService += payment;
    }

    const cashFlow = noi - debtService;
    const equity = propertyValue - balance;

    rows.push({ year, propertyValue, grossRent, collectedRent, noi, debtBalance: balance, equity, cashFlow, debtService, interest: interestPaid });
    cashFlows.push(cashFlow);
  }

  if (!rows.length) {
    return { rows: [], loan, initialCash, totalInterest: 0, exitEquity: 0, totalProfit: -initialCash, irr: 0, equityMultiple: 0, capRate: 0, cashOnCash: 0, dscr: 0, ltv: a.price > 0 ? loan / a.price : 0, breakEvenOccupancy: 0 };
  }

  const finalYear = rows[rows.length - 1];
  const terminalValue = finalYear.noi / a.exitcap;
  const sellingCosts = terminalValue * a.selling;
  const netSale = terminalValue - sellingCosts;
  const exitEquity = netSale - finalYear.debtBalance;
  cashFlows[cashFlows.length - 1] += exitEquity;

  const yearOne = rows[0];
  const totalPositiveCash = cashFlows.slice(1).reduce((s, v) => s + Math.max(0, v), 0);
  const equityMultiple = initialCash > 0 ? totalPositiveCash / initialCash : 0;
  const irr = calculateIRR(cashFlows);
  const capRate = a.price > 0 ? yearOne.noi / a.price : 0;
  const cashOnCash = initialCash > 0 ? yearOne.cashFlow / initialCash : 0;
  const dscr = yearOne.debtService > 0 ? yearOne.noi / yearOne.debtService : 0;
  const ltv = a.price > 0 ? loan / a.price : 0;

  const fixedCosts = yearOne.debtService + a.tax + a.insurance + a.other;
  const denom = 1 - a.management;
  const breakEvenOccupancy = (yearOne.grossRent > 0 && denom > 0) ? (fixedCosts / yearOne.grossRent + a.maint + a.capex) / denom : 0;

  return { rows, loan, initialCash, totalInterest, exitEquity, totalProfit: cashFlows.reduce((s, v) => s + v, 0), irr, equityMultiple, capRate, cashOnCash, dscr, ltv, breakEvenOccupancy };
}

function investmentScore(result) {
  let score = 50;
  score += clamp((result.capRate - 0.06) * 250, -15, 15);
  score += clamp((result.irr - 0.08) * 120, -15, 20);
  score += clamp((result.dscr - 1) * 15, -10, 10);
  score += clamp((0.9 - result.breakEvenOccupancy) * 30, -10, 10);
  return Math.round(clamp(score, 0, 100));
}

// ----- BUILD CALCULATOR FIELDS -----
function buildCalculatorFields() {
  const container = $('calculatorFields');
  if (!container) return;
  const groups = {
    'ACQUISITION': [['price','Purchase price'], ['down','Down payment %'], ['closing','Closing costs %'], ['reno','Renovation / upfront costs']],
    'FINANCING': [['rate','Mortgage rate %'], ['term','Loan term (years)'], ['points','Loan points %']],
    'RENT & OPERATIONS': [['rent','Monthly rent'], ['vacancy','Vacancy %'], ['tax','Property tax / year'], ['insurance','Insurance / year'], ['maint','Maintenance % of gross rent'], ['management','Management % of collected rent'], ['capex','CapEx reserve % of gross rent'], ['other','Other expenses / year']],
    'GROWTH & EXIT': [['appreciation','Property appreciation % / year'], ['rentgrowth','Rent growth % / year'], ['expensegrowth','Expense growth % / year'], ['hold','Hold period (years)'], ['exitcap','Exit cap rate %'], ['selling','Selling costs %']]
  };
  container.innerHTML = Object.entries(groups).map(([g, fields]) => `
    <section class="form-section"><h3>${g}</h3>
    ${fields.map(([id, label]) => `
      <div class="input-row"><label for="${id}">${label}</label>
      <input id="${id}" type="number" value="${DEFAULTS[id]}" step="any" inputmode="decimal" min="0"></div>
    `).join('')}</section>
  `).join('');
}

// ----- RENDER FUNCTIONS (all present) -----
function renderChart(rows) {
  const container = document.getElementById('chart');
  if (!container || !rows || !rows.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 900 260');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const W = 900, H = 260, left = 60, right = 20, top = 20, bottom = 30;
  const plotW = W - left - right, plotH = H - top - bottom;
  const maxVal = Math.max(1, ...rows.map(r => Math.max(r.propertyValue, Math.max(0, r.equity))));
  const x = i => left + plotW * i / Math.max(1, rows.length - 1);
  const y = v => top + plotH * (1 - v / maxVal);
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  for (let i = 0; i < 4; i++) {
    const yy = top + plotH * i / 3;
    svg.appendChild(el('line', { x1: left, y1: yy, x2: W - right, y2: yy, class: 'gridline' }));
  }
  svg.appendChild(el('polyline', { points: rows.map((r, i) => `${x(i)},${y(r.propertyValue)}`).join(' '), class: 'path' }));
  svg.appendChild(el('polyline', { points: rows.map((r, i) => `${x(i)},${y(Math.max(0, r.equity))}`).join(' '), class: 'eq' }));
  rows.forEach((r, i) => {
    if (i === 0 || i === rows.length - 1 || i % 5 === 0) {
      const lbl = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', fill: '#71838d', 'font-size': '9' });
      lbl.textContent = 'Y' + r.year;
      svg.appendChild(lbl);
    }
  });
  container.innerHTML = '';
  container.appendChild(svg);
}

function renderChart2(rows) {
  const container = document.getElementById('chart2');
  if (!container || !rows || !rows.length) return;
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 900 260');
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', '100%');
  const W = 900, H = 260, left = 60, right = 20, top = 20, bottom = 30;
  const plotW = W - left - right, plotH = H - top - bottom;
  const maxVal = Math.max(1, ...rows.map(r => Math.max(r.noi, Math.abs(r.cashFlow))));
  const x = i => left + plotW * i / Math.max(1, rows.length - 1);
  const y = v => top + plotH * (1 - (v + maxVal) / (2 * maxVal));
  const el = (tag, attrs) => { const e = document.createElementNS(NS, tag); Object.entries(attrs).forEach(([k, v]) => e.setAttribute(k, v)); return e; };
  for (let i = 0; i < 5; i++) {
    const yy = top + plotH * i / 4;
    svg.appendChild(el('line', { x1: left, y1: yy, x2: W - right, y2: yy, class: 'gridline' }));
  }
  const zeroY = y(0);
  svg.appendChild(el('line', { x1: left, y1: zeroY, x2: W - right, y2: zeroY, stroke: '#66818e40', strokeWidth: 1 }));
  svg.appendChild(el('polyline', { points: rows.map((r, i) => `${x(i)},${y(r.noi)}`).join(' '), class: 'path' }));
  const cfPath = el('polyline', { points: rows.map((r, i) => `${x(i)},${y(r.cashFlow)}`).join(' '), class: 'eq' });
  cfPath.setAttribute('stroke', 'var(--gold)');
  svg.appendChild(cfPath);
  rows.forEach((r, i) => {
    if (i === 0 || i === rows.length - 1 || i % 5 === 0) {
      const lbl = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', fill: '#71838d', 'font-size': '9' });
      lbl.textContent = 'Y' + r.year;
      svg.appendChild(lbl);
    }
  });
  container.innerHTML = '';
  container.appendChild(svg);
}

function renderYearTable(rows) {
  const tbody = $('rows');
  if (!tbody) return;
  tbody.innerHTML = rows.map(r => `<tr><td>${r.year}</td><td>${money(r.propertyValue)}</td><td>${money(r.grossRent)}</td><td>${money(r.noi)}</td><td>${money(r.debtBalance)}</td><td>${money(r.equity)}</td><td>${money(r.cashFlow)}</td></tr>`).join('');
}

function renderRightPanel(inputs, result) {
  const ass = $('keyAssumptions');
  if (ass) {
    ass.innerHTML = [
      ['Purchase price', money(inputs.price)],
      ['Down payment', percent(inputs.down * 100)],
      ['Mortgage', percent(inputs.rate)],
      ['Vacancy', percent(inputs.vacancy * 100)],
      ['Appreciation', percent(inputs.appreciation * 100)]
    ].map(([l, v]) => `<div class="field"><span>${l}</span><b>${v}</b></div>`).join('');
  }
  const mini = $('miniScenarios');
  if (mini) {
    const cons = scenarioModel(inputs, 'Conservative');
    const opt = scenarioModel(inputs, 'Optimistic');
    mini.innerHTML = [
      ['DOWN', cons],
      ['BASE', result],
      ['UPSIDE', opt]
    ].map(([l, m]) => `<div class="mini"><span>${l}</span><b>${percent(m.irr * 100)}</b></div>`).join('');
  }
  const insight = $('whyItWorks');
  if (insight) {
    insight.textContent = result.dscr >= 1.2 ? `Debt coverage is healthy at ${result.dscr.toFixed(2)}×.` : `Debt coverage is ${result.dscr.toFixed(2)}×. Cash flow is sensitive to the operating assumptions.`;
  }
}

function scenarioModel(inputs, type) {
  const s = { ...inputs };
  if (type === 'Conservative') {
    s.appreciation = Math.max(0, s.appreciation - 0.02);
    s.rentgrowth = Math.max(0, s.rentgrowth - 0.015);
    s.vacancy = Math.min(0.95, s.vacancy + 0.03);
    s.exitcap += 0.01;
  } else if (type === 'Optimistic') {
    s.appreciation += 0.02;
    s.rentgrowth += 0.015;
    s.vacancy = Math.max(0, s.vacancy - 0.02);
    s.exitcap = Math.max(0.0001, s.exitcap - 0.01);
  }
  return calculateModel(s);
}

function renderScenarioCards(inputs) {
  const container = $('scenarioCards');
  if (!container) return;
  container.innerHTML = ['Conservative','Base','Optimistic'].map(type => {
    const res = type === 'Base' ? calculateModel(inputs) : scenarioModel(inputs, type);
    const last = res.rows[res.rows.length - 1];
    return `<div class="scenario-card"><h3>${type}</h3><div class="big">${percent(res.irr * 100)}</div><small>ANNUALIZED IRR</small>
      <div class="scenario-row"><span>Exit equity</span><b>${money(res.exitEquity)}</b></div>
      <div class="scenario-row"><span>Cash-on-cash</span><b>${percent(res.cashOnCash * 100)}</b></div>
      <div class="scenario-row"><span>Equity multiple</span><b>${res.equityMultiple.toFixed(2)}×</b></div>
      <div class="scenario-row"><span>Final property</span><b>${money(last.propertyValue)}</b></div>
    </div>`;
  }).join('');
}

function renderSensitivity(inputs) {
  const container = $('sensitivityRows');
  if (!container) return;
  const base = calculateModel(inputs);
  const tests = [
    ['Property appreciation', calculateModel({ ...inputs, appreciation: inputs.appreciation + 0.01 }).irr - base.irr],
    ['Rent growth', calculateModel({ ...inputs, rentgrowth: inputs.rentgrowth + 0.01 }).irr - base.irr],
    ['Vacancy', base.irr - calculateModel({ ...inputs, vacancy: Math.min(0.95, inputs.vacancy + 0.01) }).irr],
    ['Mortgage rate', base.irr - calculateModel({ ...inputs, rate: inputs.rate + 1 }).irr]
  ];
  const maxImp = Math.max(0.0001, ...tests.map(t => Math.abs(t[1])));
  container.innerHTML = tests.map(([label, impact]) => {
    const w = Math.min(100, Math.abs(impact) / maxImp * 100);
    return `<div class="sensitivity-row"><span>${label}</span><div class="bar"><i style="width:${w}%"></i></div><b>${impact >= 0 ? '+' : ''}${percent(impact * 100)}</b></div>`;
  }).join('');
}

function renderAssumptionMap(inputs) {
  const container = $('assumptionMap');
  if (!container) return;
  const groups = {
    'ACQUISITION': [['Purchase price', money(inputs.price)], ['Down payment', percent(inputs.down * 100)], ['Closing costs', percent(inputs.closing * 100)], ['Upfront costs', money(inputs.reno)]],
    'FINANCING': [['Rate', percent(inputs.rate)], ['Term', inputs.term + ' years'], ['Points', percent(inputs.points * 100)]],
    'OPERATIONS': [['Monthly rent', money(inputs.rent)], ['Vacancy', percent(inputs.vacancy * 100)], ['Maintenance', percent(inputs.maint * 100)], ['Management', percent(inputs.management * 100)], ['CapEx', percent(inputs.capex * 100)], ['Other expenses', money(inputs.other)]],
    'GROWTH & EXIT': [['Appreciation', percent(inputs.appreciation * 100)], ['Rent growth', percent(inputs.rentgrowth * 100)], ['Expense growth', percent(inputs.expensegrowth * 100)], ['Hold', inputs.hold + ' years'], ['Exit cap', percent(inputs.exitcap * 100)], ['Selling costs', percent(inputs.selling * 100)]]
  };
  container.innerHTML = Object.entries(groups).map(([g, vals]) => `<div class="assump"><h3>${g}</h3>${vals.map(([l, v]) => `<div class="assump-row"><span>${l}</span><b>${v}</b></div>`).join('')}</div>`).join('');
}

function renderComparison(current) {
  const other = calculateModel(compareB);
  setText('compareAName', 'Current Property');
  setText('compareBName', compareB.name);
  setText('aIrr', percent(current.irr * 100));
  setText('aCap', percent(current.capRate * 100));
  setText('aCash', money(current.rows[0].cashFlow / 12));
  setText('aEquity', money(current.exitEquity));
  setText('bIrr', percent(other.irr * 100));
  setText('bCap', percent(other.capRate * 100));
  setText('bCash', money(other.rows[0].cashFlow / 12));
  setText('bEquity', money(other.exitEquity));
  const w = $('winner');
  if (!w) return;
  if (current.irr > other.irr) w.textContent = `Property A leads on modeled IRR by ${percent((current.irr - other.irr) * 100)}.`;
  else if (other.irr > current.irr) w.textContent = `Property B leads on modeled IRR by ${percent((other.irr - current.irr) * 100)}.`;
  else w.textContent = 'Both properties have the same modeled IRR.';
}

// ----- TUNER -----
function updateTuner() {
  const tuner = $('tuner');
  if (!tuner) return;
  const val = Number(tuner.value) || 50;
  const inputs = getInputs();
  const type = val < 34 ? 'Conservative' : val > 66 ? 'Optimistic' : 'Base';
  const res = type === 'Base' ? calculateModel(inputs) : scenarioModel(inputs, type);
  setText('tunerLabel', type.toUpperCase());
  setText('tunerIrr', percent(res.irr * 100));
  setText('tunerText', type === 'Conservative' ? 'Stress case: slower growth, higher vacancy and a softer exit.' : type === 'Optimistic' ? 'Upside case: stronger growth, lower vacancy and a tighter exit.' : 'Drag this to stress-test the entire investment.');
  const slider = document.querySelector('.slider');
  if (slider) slider.style.background = `linear-gradient(90deg, #8aa9ba 0 ${val}%, #dce6ea ${val}% 100%)`;
  const knob = document.querySelector('.knob');
  if (knob) knob.style.left = val + '%';
}

// ----- NAVIGATION -----
const SECTION_TO_VIEW = { property:'decision', finance:'calculator', returns:'yearly', scenarios:'scenario', compare:'compare', yearly:'yearly', assumptions:'assumptions', decision:'decision', calculator:'calculator', scenario:'scenario' };

function showView(section) {
  const view = SECTION_TO_VIEW[section] || 'decision';
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  const target = document.querySelector(`.view[data-view="${view}"]`);
  if (target) target.classList.remove('hidden');
  document.querySelectorAll('[data-section]').forEach(b => b.classList.toggle('active', b.dataset.section === section));
  let mode = 'decision';
  if (view === 'scenario') mode = 'scenario';
  else if (['calculator','yearly','assumptions'].includes(view)) mode = 'calculator';
  document.querySelectorAll('.modebtn').forEach(b => b.classList.toggle('on', b.dataset.mode === mode));
  if (view === 'decision' || view === 'yearly') {
    const res = calculateModel(getInputs());
    if (view === 'decision') renderChart(res.rows);
    if (view === 'yearly') renderChart2(res.rows);
  }
  console.log(`Active view: ${view} (from ${section})`);
}

// ----- MODAL -----
function openModal(title, body) {
  const modal = $('modal'), content = $('modalContent');
  if (!modal || !content) return;
  content.innerHTML = `<h2>${title}</h2>${body}`;
  modal.classList.remove('hidden');
}

// ----- SAVE / LOAD -----
function saveDeal() {
  const inputs = getInputs();
  const data = { inputs, compareB, timestamp: new Date().toISOString() };
  try { localStorage.setItem('glassFinanceDeal', JSON.stringify(data)); showToast('Deal saved!'); } catch(e) { showToast('Failed to save.'); }
}
function loadDeal() {
  try {
    const raw = localStorage.getItem('glassFinanceDeal');
    if (!raw) { showToast('No saved deal.'); return; }
    const data = JSON.parse(raw);
    if (!data.inputs) { showToast('Invalid data.'); return; }
    Object.keys(DEFAULTS).forEach(id => {
      const el = $(id);
      if (el && data.inputs[id] !== undefined) el.value = data.inputs[id];
    });
    if (data.compareB) compareB = data.compareB;
    showToast('Deal loaded!');
    calculate();
  } catch(e) { showToast('Error loading.'); }
}

// ----- CHATBOT RULES (hardcoded) -----
const CHAT_RULES = {
  rent: {
    title: 'Rent Growth Analysis',
    question: '“What happens to my IRR if rent grows only 1% a year?”',
    run(i) { return calculateModel({ ...i, rentgrowth: 0.01 }); },
    answer(b, s) { return `At 1% annual rent growth, modeled IRR changes from <b>${percent(b.irr * 100)}</b> to <b>${percent(s.irr * 100)}</b>.`; }
  },
  vacancy: {
    title: 'Vacancy Stress Test',
    question: '“What happens if vacancy rises to 10%?”',
    run(i) { return calculateModel({ ...i, vacancy: 0.10 }); },
    answer(b, s) { return `At 10% vacancy, modeled IRR becomes <b>${percent(s.irr * 100)}</b>. Year-1 monthly cash flow becomes <b>${money(s.rows[0].cashFlow / 12)}</b>.`; }
  },
  rate: {
    title: 'Mortgage Rate Stress Test',
    question: '“What happens if my mortgage rises by 2%?”',
    run(i) { return calculateModel({ ...i, rate: i.rate + 2 }); },
    answer(b, s, i) { return `At a mortgage rate of <b>${percent(i.rate + 2)}</b>, modeled IRR becomes <b>${percent(s.irr * 100)}</b>.`; }
  },
  why: {
    title: 'Investment Analysis',
    question: '“Why is this deal strong?”',
    run(i) { return calculateModel(i); },
    answer(b) {
      const score = investmentScore(b);
      return `<p>Investment score: <b>${score}/100</b></p><ul><li>Cap rate: ${percent(b.capRate * 100)}</li><li>IRR: ${percent(b.irr * 100)}</li><li>DSCR: ${b.dscr.toFixed(2)}×</li><li>Break-even occupancy: ${percent(b.breakEvenOccupancy * 100)}</li></ul>`;
    }
  },
  expenses: {
    title: 'Expense Shock Test',
    question: '“What if operating expenses increase by 10%?”',
    run(i) {
      const s = { ...i };
      s.maint = Math.min(0.99, s.maint * 1.1);
      s.management = Math.min(0.99, s.management * 1.1);
      s.capex = Math.min(0.99, s.capex * 1.1);
      s.tax *= 1.1; s.insurance *= 1.1; s.other *= 1.1;
      return calculateModel(s);
    },
    answer(b, s) { return `With a 10% increase in operating expenses, modeled IRR drops from <b>${percent(b.irr * 100)}</b> to <b>${percent(s.irr * 100)}</b>. Year-1 cash flow changes from <b>${money(b.rows[0].cashFlow / 12)}</b> to <b>${money(s.rows[0].cashFlow / 12)}</b>.`; }
  },
  exitcap: {
    title: 'Exit Cap Expansion',
    question: '“What if the exit cap rate rises to 7%?”',
    run(i) { return calculateModel({ ...i, exitcap: 0.07 }); },
    answer(b, s) { return `With an exit cap rate of 7%, modeled IRR changes from <b>${percent(b.irr * 100)}</b> to <b>${percent(s.irr * 100)}</b>. Exit equity becomes <b>${money(s.exitEquity)}</b>.`; }
  },
  appreciation: {
    title: 'Slower Appreciation',
    question: '“What if property appreciation drops to 1%?”',
    run(i) { return calculateModel({ ...i, appreciation: 0.01 }); },
    answer(b, s) { return `At 1% annual appreciation, modeled IRR changes from <b>${percent(b.irr * 100)}</b> to <b>${percent(s.irr * 100)}</b>. Final property value becomes <b>${money(s.rows[s.rows.length - 1].propertyValue)}</b>.`; }
  },
  reno: {
    title: 'Renovation Overrun',
    question: '“What if the renovation budget doubles?”',
    run(i) { return calculateModel({ ...i, reno: i.reno * 2 }); },
    answer(b, s) { return `With a doubled renovation budget, modeled IRR changes from <b>${percent(b.irr * 100)}</b> to <b>${percent(s.irr * 100)}</b>. Initial cash invested becomes <b>${money(s.initialCash)}</b>.`; }
  }
};

function askModel(ruleName) {
  const rule = CHAT_RULES[ruleName];
  if (!rule) return;
  const inputs = getInputs();
  const base = calculateModel(inputs);
  const stressed = rule.run(inputs);
  const answer = rule.answer(base, stressed, inputs);
  setText('questionText', rule.question);
  const ansEl = $('answerText');
  if (ansEl) ansEl.innerHTML = answer;
  openModal(rule.title, `<div>${answer}</div>`);
}

// ----- DYNAMIC WHAT-IF PARSER (short version) -----
const VARIABLE_MAP = {
  rent: { key: 'rent', type: 'flat', label: 'monthly rent' },
  vacancy: { key: 'vacancy', type: 'percentage', label: 'vacancy rate' },
  rate: { key: 'rate', type: 'percentage', label: 'mortgage rate' },
  expenses: { key: 'expenses', type: 'percentage', label: 'operating expenses' },
  appreciation: { key: 'appreciation', type: 'percentage', label: 'appreciation' },
  exitcap: { key: 'exitcap', type: 'percentage', label: 'exit cap rate' },
  reno: { key: 'reno', type: 'flat', label: 'renovation budget' }
};

function parseQuestion(text) {
  const lower = text.toLowerCase();
  let variable = null;
  const patterns = {
    rent: ['rent','rental','monthly rent'],
    vacancy: ['vacancy','vacant','occupancy'],
    rate: ['rate','mortgage','interest','loan rate'],
    expenses: ['expenses','operating','costs','opex'],
    appreciation: ['appreciation','value growth','property growth'],
    exitcap: ['exit cap','exit cap rate','terminal cap'],
    reno: ['renovation','reno','budget','upfront']
  };
  for (const [key, pats] of Object.entries(patterns)) {
    if (pats.some(p => lower.includes(p))) { variable = key; break; }
  }
  if (!variable) return null;

  let direction = 0;
  if (/increase|rise|up|grow|higher|raise|add|plus/i.test(lower)) direction = 1;
  else if (/decrease|fall|drop|down|lower|reduce|decline|minus|cut/i.test(lower)) direction = -1;

  if (/double|twice|2x/i.test(lower)) return { variable, direction: 1, amount: 1.0, isPercentage: true };
  if (/half|50%|0.5/i.test(lower)) return { variable, direction: -1, amount: 0.5, isPercentage: true };

  const numMatch = lower.match(/(\d+\.?\d*)\s*(%|₹|lakh|crore)?/);
  if (!numMatch) {
    if (direction !== 0 && /rent|vacancy|rate|expenses|appreciation|exitcap|reno/.test(variable)) {
      const defaultPercent = (variable === 'rent' || variable === 'reno') ? 0.05 : 0.05;
      return { variable, direction, amount: defaultPercent, isPercentage: true };
    }
    return null;
  }
  let amount = parseFloat(numMatch[1]);
  let unit = numMatch[2] || '';
  let isPercentage = false;
  if (unit === '%') { isPercentage = true; amount /= 100; }
  if (/to|at|equals|=/.test(lower)) direction = 0;
  return { variable, direction, amount, isPercentage, unit };
}

function applyChange(inputs, parsed) {
  const { variable, direction, amount, isPercentage } = parsed;
  const newInputs = { ...inputs };
  switch (variable) {
    case 'rent':
      if (isPercentage) newInputs.rent = inputs.rent * (1 + direction * amount);
      else newInputs.rent = direction === 0 ? amount : inputs.rent + direction * amount;
      newInputs.rent = Math.max(0, newInputs.rent);
      break;
    case 'vacancy':
      if (isPercentage) newInputs.vacancy = direction === 0 ? amount : inputs.vacancy + direction * amount;
      else newInputs.vacancy = direction === 0 ? amount / 100 : inputs.vacancy + direction * amount / 100;
      newInputs.vacancy = clamp(newInputs.vacancy, 0, 0.99);
      break;
    case 'rate':
      if (isPercentage) newInputs.rate = direction === 0 ? amount * 100 : inputs.rate + direction * amount * 100;
      else newInputs.rate = direction === 0 ? amount : inputs.rate + direction * amount;
      newInputs.rate = Math.max(0, newInputs.rate);
      break;
    case 'expenses':
      if (isPercentage) {
        const chg = direction * amount;
        newInputs.maint = Math.min(0.99, inputs.maint * (1 + chg));
        newInputs.management = Math.min(0.99, inputs.management * (1 + chg));
        newInputs.capex = Math.min(0.99, inputs.capex * (1 + chg));
        newInputs.tax = Math.max(0, inputs.tax * (1 + chg));
        newInputs.insurance = Math.max(0, inputs.insurance * (1 + chg));
        newInputs.other = Math.max(0, inputs.other * (1 + chg));
      }
      break;
    case 'appreciation':
      if (isPercentage) newInputs.appreciation = direction === 0 ? amount : inputs.appreciation + direction * amount;
      else newInputs.appreciation = direction === 0 ? amount / 100 : inputs.appreciation + direction * amount / 100;
      newInputs.appreciation = Math.max(0, newInputs.appreciation);
      break;
    case 'exitcap':
      if (isPercentage) newInputs.exitcap = direction === 0 ? amount : inputs.exitcap + direction * amount;
      else newInputs.exitcap = direction === 0 ? amount / 100 : inputs.exitcap + direction * amount / 100;
      newInputs.exitcap = Math.max(0.0001, newInputs.exitcap);
      break;
    case 'reno':
      if (isPercentage) newInputs.reno = inputs.reno * (1 + direction * amount);
      else newInputs.reno = direction === 0 ? amount : inputs.reno + direction * amount;
      newInputs.reno = Math.max(0, newInputs.reno);
      break;
    default: return null;
  }
  return newInputs;
}

function handleWhatIfQuestion(text) {
  const parsed = parseQuestion(text);
  if (!parsed) return null;
  const inputs = getInputs();
  const newInputs = applyChange(inputs, parsed);
  if (!newInputs) return null;
  const base = calculateModel(inputs);
  const stressed = calculateModel(newInputs);
  const varName = VARIABLE_MAP[parsed.variable]?.label || parsed.variable;
  let desc = '';
  if (parsed.direction === 0) desc = `set ${varName} to ${parsed.isPercentage ? percent(parsed.amount * 100) : money(parsed.amount)}`;
  else {
    const dir = parsed.direction === 1 ? 'increase' : 'decrease';
    const amt = parsed.isPercentage ? percent(parsed.amount * 100) : money(parsed.amount);
    desc = `${dir} ${varName} by ${amt}`;
  }
  const html = `<p><strong>What if:</strong> ${desc}</p><ul>
    <li><strong>Base IRR:</strong> ${percent(base.irr * 100)}</li>
    <li><strong>Stressed IRR:</strong> ${percent(stressed.irr * 100)}</li>
    <li><strong>Change:</strong> ${percent((stressed.irr - base.irr) * 100)}</li>
    <li><strong>Year-1 monthly cash flow:</strong> ${money(stressed.rows[0]?.cashFlow / 12 || 0)}</li>
    <li><strong>Exit equity:</strong> ${money(stressed.exitEquity)}</li>
    <li><strong>Cap rate:</strong> ${percent(stressed.capRate * 100)}</li>
    <li><strong>DSCR:</strong> ${stressed.dscr.toFixed(2)}×</li>
  </ul>`;
  return { title: `What if: ${desc}`, question: `“${text}”`, answer: html };
}

// ----- MAIN CALCULATION -----
function calculate() {
  const inputs = getInputs();
  let invalid = false;
  if (inputs.price <= 0) { invalid = true; showToast('Purchase price must be positive – reset.'); }
  if (inputs.rent <= 0) { invalid = true; showToast('Monthly rent must be positive – reset.'); }
  if (inputs.rate < 0) { invalid = true; showToast('Mortgage rate cannot be negative – reset.'); }
  if (invalid) {
    Object.entries(DEFAULTS).forEach(([id, val]) => {
      const el = $(id);
      if (el) el.value = val;
    });
    const fixed = getInputs();
    const res = calculateModel(fixed);
    updateUI(fixed, res);
    return;
  }
  const res = calculateModel(inputs);
  updateUI(inputs, res);
}

function updateUI(inputs, result) {
  const score = investmentScore(result);
  setText('cap', percent(result.capRate * 100));
  setText('irr', percent(result.irr * 100));
  setText('coc', percent(result.cashOnCash * 100));
  setText('cashflow', result.rows.length ? money(result.rows[0].cashFlow / 12) : '₹0');
  setText('multiple', result.equityMultiple.toFixed(2) + '×');
  setText('equity', money(result.exitEquity));
  setText('initialCash', money(result.initialCash));
  setText('dscr', result.dscr.toFixed(2) + '×');
  setText('breakEven', percent(result.breakEvenOccupancy * 100));
  setText('ltv', percent(result.ltv * 100));
  setText('scoreValue', score);
  setText('scoreLabel', score >= 75 ? 'Strong investment profile' : score >= 60 ? 'Promising, with trade-offs' : score >= 45 ? 'Mixed investment profile' : 'High-risk profile');
  setText('scoreReason', score >= 75 ? 'Cash flow, leverage and returns are currently working together.' : score >= 60 ? 'The deal has potential, but some assumptions deserve a stress test.' : score >= 45 ? 'The model is sensitive to assumptions. Stress-test the downside.' : 'The current assumptions do not provide enough return for the modeled risk.');
  const ring = $('scoreRing');
  if (ring) ring.style.background = `conic-gradient(var(--blue) 0 ${score}%, #dce7eb ${score}% 100%)`;
  setText('dealSub', `${money(inputs.price)} purchase · ${money(inputs.rent)} monthly rent`);
  setText('yearCount', `${inputs.hold} YEARS`);
  setText('saveStatus', '● LIVE MODEL');
  renderChart(result.rows);
  renderChart2(result.rows);
  renderYearTable(result.rows);
  renderRightPanel(inputs, result);
  renderScenarioCards(inputs);
  renderSensitivity(inputs);
  renderAssumptionMap(inputs);
  renderComparison(result);
  updateTuner();
}

function resetCalculator() {
  Object.entries(DEFAULTS).forEach(([id, val]) => {
    const el = $(id);
    if (el) el.value = val;
  });
  if ($('tuner')) $('tuner').value = 50;
  calculate();
}

// ----- INITIALIZATION -----
function initialize() {
  buildCalculatorFields();

  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) {
    currencySelect.addEventListener('change', function() {
      window.currencySymbol = this.value;
      calculate();
    });
    window.currencySymbol = currencySelect.value;
  }

  const saveBtn = document.getElementById('saveDeal');
  const loadBtn = document.getElementById('loadDeal');
  if (saveBtn) saveBtn.addEventListener('click', saveDeal);
  if (loadBtn) loadBtn.addEventListener('click', loadDeal);

  document.addEventListener('input', e => {
    const t = e.target;
    if (t instanceof HTMLInputElement && t.type === 'number') calculate();
    if (t instanceof HTMLInputElement && t.type === 'range') updateTuner();
  });
  document.addEventListener('change', e => {
    if (e.target instanceof HTMLInputElement && e.target.type === 'number') calculate();
  });

  document.querySelectorAll('[data-section]').forEach(b => b.addEventListener('click', () => showView(b.dataset.section)));
  document.querySelectorAll('.modebtn').forEach(b => b.addEventListener('click', () => {
    const mode = b.dataset.mode;
    if (mode === 'calculator') showView('finance');
    else if (mode === 'scenario') showView('scenarios');
    else showView('property');
  }));
  document.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => showView(b.dataset.jump)));

  if ($('tuner')) $('tuner').addEventListener('input', updateTuner);
  if ($('whyScore')) $('whyScore').addEventListener('click', () => askModel('why'));
  if ($('askModel')) $('askModel').addEventListener('click', () => askModel('rent'));
  if ($('openCompare')) $('openCompare').addEventListener('click', () => showView('compare'));

  document.querySelectorAll('.chips button').forEach(b => b.addEventListener('click', () => askModel(b.dataset.query)));

  const chatInput = document.getElementById('chatInput');
  const chatSend = document.getElementById('chatSend');
  if (chatInput && chatSend) {
    const send = () => {
      const text = chatInput.value.trim();
      if (!text) return;
      const dynamic = handleWhatIfQuestion(text);
      if (dynamic) {
        setText('questionText', dynamic.question);
        const ans = $('answerText');
        if (ans) ans.innerHTML = dynamic.answer;
        openModal(dynamic.title, `<div>${dynamic.answer}</div>`);
        chatInput.value = '';
        return;
      }
      const lower = text.toLowerCase();
      if (lower.includes('rent') || lower.includes('growth')) askModel('rent');
      else if (lower.includes('vacancy')) askModel('vacancy');
      else if (lower.includes('rate') || lower.includes('mortgage') || lower.includes('interest')) askModel('rate');
      else if (lower.includes('why') || lower.includes('strong') || lower.includes('score')) askModel('why');
      else if (lower.includes('expense') || lower.includes('operating') || lower.includes('cost')) askModel('expenses');
      else if (lower.includes('exit') || lower.includes('cap rate')) askModel('exitcap');
      else if (lower.includes('appreciation') || lower.includes('value')) askModel('appreciation');
      else if (lower.includes('reno') || lower.includes('renovation') || lower.includes('budget')) askModel('reno');
      else {
        openModal("I didn't understand that", `<p>I can answer dynamic "what-if" questions like:</p>
          <ul><li><i>"What if rent drops 5%?"</i></li>
          <li><i>"What if vacancy rises to 8%?"</i></li>
          <li><i>"What if expenses increase 10%?"</i></li>
          <li><i>"What if appreciation falls to 2%?"</i></li>
          <li><i>"What if exit cap goes to 7%?"</i></li>
          <li><i>"What if renovation budget doubles?"</i></li>
          <li><i>"What if mortgage rate goes up 1.5%?"</i></li></ul>
          <p>Or use keywords: <b>rent, vacancy, rate, why, expenses, exitcap, appreciation, reno</b></p>`);
      }
      chatInput.value = '';
    };
    chatSend.addEventListener('click', send);
    chatInput.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
  }

  if ($('reset')) $('reset').addEventListener('click', resetCalculator);

  if ($('closeModal')) $('closeModal').addEventListener('click', () => $('modal').classList.add('hidden'));
  if ($('modal')) $('modal').addEventListener('click', e => {
    if (e.target.classList.contains('modal-backdrop')) $('modal').classList.add('hidden');
  });

  if ($('copyDeal')) {
    $('copyDeal').addEventListener('click', () => {
      compareB = { ...getInputs(), name: 'Copied Deal' };
      calculate();
      showView('compare');
    });
  }

  calculate();
  showView('property');
}

// ----- START -----
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize, { once: true });
} else {
  initialize();
}
