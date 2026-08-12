/*
 * GLASS FINANCE
 * Real Estate Investment Analyzer
 * Complete – with Y-axis labels, tuner re-render, header save/load, validation.
 */

"use strict";

/* =========================================================
   HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

// Global currency symbol – updated by dropdown
window.currencySymbol = '₹';

// Toast helper
function showToast(message) {
  let toast = document.getElementById('toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'toast';
    toast.style.cssText = `
      position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
      background: rgba(0,0,0,0.7); color: white; padding: 10px 20px;
      border-radius: 12px; font-size: 12px; z-index: 9999;
      backdrop-filter: blur(8px); border: 1px solid #fff3;
      transition: opacity 0.3s; opacity: 0; pointer-events: none;
    `;
    document.body.appendChild(toast);
  }
  toast.textContent = message;
  toast.style.opacity = '1';
  clearTimeout(toast._hideTimeout);
  toast._hideTimeout = setTimeout(() => {
    toast.style.opacity = '0';
  }, 3000);
}

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


function readNumber(id) {

  const element = $(id);

  if (!element) {
    return DEFAULTS[id] ?? 0;
  }

  const value = Number(element.value);

  return Number.isFinite(value)
    ? value
    : DEFAULTS[id] ?? 0;
}


function setText(id, value) {

  const element = $(id);

  if (element) {
    element.textContent = value;
  }
}


function money(value) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return (window.currencySymbol || '₹') + "0";
  }

  return (window.currencySymbol || '₹') +
    Math.round(number).toLocaleString("en-IN");
}


function percent(value) {

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0.00%";
  }

  return number.toFixed(2) + "%";
}


function clamp(value, min, max) {

  return Math.min(
    max,
    Math.max(min, value)
  );
}


/* =========================================================
   INPUT MODEL
   ========================================================= */

function getInputs() {

  return {

    price:
      Math.max(
        0,
        readNumber("price")
      ),

    down:
      clamp(
        readNumber("down") / 100,
        0,
        1
      ),

    closing:
      Math.max(
        0,
        readNumber("closing") / 100
      ),

    reno:
      Math.max(
        0,
        readNumber("reno")
      ),

    rate:
      Math.max(
        0,
        readNumber("rate")
      ),

    term:
      Math.max(
        1,
        readNumber("term")
      ),

    points:
      Math.max(
        0,
        readNumber("points") / 100
      ),

    rent:
      Math.max(
        0,
        readNumber("rent")
      ),

    vacancy:
      clamp(
        readNumber("vacancy") / 100,
        0,
        0.99
      ),

    tax:
      Math.max(
        0,
        readNumber("tax")
      ),

    insurance:
      Math.max(
        0,
        readNumber("insurance")
      ),

    maint:
      Math.max(
        0,
        readNumber("maint") / 100
      ),

    management:
      clamp(
        readNumber("management") / 100,
        0,
        0.99
      ),

    capex:
      Math.max(
        0,
        readNumber("capex") / 100
      ),

    other:
      Math.max(
        0,
        readNumber("other")
      ),

    appreciation:
      readNumber("appreciation") / 100,

    rentgrowth:
      readNumber("rentgrowth") / 100,

    expensegrowth:
      readNumber("expensegrowth") / 100,

    hold:
      Math.max(
        1,
        Math.round(
          readNumber("hold")
        )
      ),

    exitcap:
      Math.max(
        0.0001,
        readNumber("exitcap") / 100
      ),

    selling:
      clamp(
        readNumber("selling") / 100,
        0,
        0.99
      )
  };
}


/* =========================================================
   MORTGAGE
   ========================================================= */

function monthlyMortgagePayment(
  principal,
  annualRate,
  years
) {

  if (
    principal <= 0 ||
    years <= 0
  ) {
    return 0;
  }

  const months =
    years * 12;

  const monthlyRate =
    annualRate / 100 / 12;

  if (monthlyRate === 0) {
    return principal / months;
  }

  const factor =
    Math.pow(
      1 + monthlyRate,
      months
    );

  return (
    principal *
    monthlyRate *
    factor
  ) / (
    factor - 1
  );
}


/* =========================================================
   IRR
   ========================================================= */

function calculateIRR(cashFlows) {

  if (
    !cashFlows.some(
      value => value > 0
    ) ||
    !cashFlows.some(
      value => value < 0
    )
  ) {
    return 0;
  }


  function npv(rate) {

    let total = 0;

    for (
      let i = 0;
      i < cashFlows.length;
      i++
    ) {

      const denominator =
        Math.pow(
          1 + rate,
          i
        );

      if (!Number.isFinite(denominator)) {
        return NaN;
      }

      total +=
        cashFlows[i] /
        denominator;
    }

    return total;
  }


  let previousRate = -0.99;

  let previousNPV =
    npv(previousRate);

  let low = null;
  let high = null;


  for (
    let rate = -0.98;
    rate <= 10;
    rate += 0.01
  ) {

    const currentNPV =
      npv(rate);

    if (
      Number.isFinite(
        currentNPV
      ) &&
      Number.isFinite(
        previousNPV
      ) &&
      previousNPV *
        currentNPV <= 0
    ) {

      low =
        previousRate;

      high =
        rate;

      break;
    }

    previousRate =
      rate;

    previousNPV =
      currentNPV;
  }


  if (
    low === null ||
    high === null
  ) {
    return 0;
  }


  let lowNPV =
    npv(low);


  for (
    let i = 0;
    i < 150;
    i++
  ) {

    const mid =
      (low + high) / 2;

    const midNPV =
      npv(mid);


    if (
      !Number.isFinite(
        midNPV
      )
    ) {
      return 0;
    }


    if (
      Math.abs(midNPV) <
      0.000001
    ) {
      return mid;
    }


    if (
      lowNPV * midNPV <= 0
    ) {

      high = mid;

    } else {

      low = mid;

      lowNPV =
        midNPV;
    }
  }


  return (
    low + high
  ) / 2;
}


/* =========================================================
   CORE REAL ESTATE MODEL
   ========================================================= */

function calculateModel(a) {

  const loan =
    a.price *
    (1 - a.down);


  const pointsCost =
    loan *
    a.points;


  const initialCash =
    a.price * a.down +
    a.price * a.closing +
    a.reno +
    pointsCost;


  const payment =
    monthlyMortgagePayment(
      loan,
      a.rate,
      a.term
    );


  let balance = loan;

  let propertyValue =
    a.price;

  let monthlyRent =
    a.rent;

  let tax =
    a.tax;

  let insurance =
    a.insurance;

  let other =
    a.other;


  const rows = [];

  const cashFlows =
    [-initialCash];


  let totalInterest = 0;


  for (
    let year = 1;
    year <= a.hold;
    year++
  ) {

    propertyValue *=
      1 + a.appreciation;


    monthlyRent *=
      1 + a.rentgrowth;


    if (year > 1) {

      tax *=
        1 + a.expensegrowth;

      insurance *=
        1 + a.expensegrowth;

      other *=
        1 + a.expensegrowth;
    }


    const grossRent =
      monthlyRent * 12;


    const collectedRent =
      grossRent *
      (1 - a.vacancy);


    const maintenance =
      grossRent *
      a.maint;


    const management =
      collectedRent *
      a.management;


    const capex =
      grossRent *
      a.capex;


    const operatingExpenses =
      maintenance +
      management +
      capex +
      tax +
      insurance +
      other;


    const noi =
      collectedRent -
      operatingExpenses;


    let debtService = 0;

    let interestPaid = 0;


    for (
      let month = 0;
      month < 12;
      month++
    ) {

      if (balance > 0) {

        const monthlyInterest =
          balance *
          (
            a.rate /
            100 /
            12
          );


        const principalPaid =
          Math.min(
            balance,
            Math.max(
              0,
              payment -
              monthlyInterest
            )
          );


        balance =
          Math.max(
            0,
            balance -
            principalPaid
          );


        interestPaid +=
          monthlyInterest;

        totalInterest +=
          monthlyInterest;
      }


      debtService +=
        payment;
    }


    const cashFlow =
      noi -
      debtService;


    const equity =
      propertyValue -
      balance;


    rows.push({

      year,

      propertyValue,

      grossRent,

      collectedRent,

      noi,

      debtBalance:
        balance,

      equity,

      cashFlow,

      debtService,

      interest:
        interestPaid
    });


    cashFlows.push(
      cashFlow
    );
  }


  if (!rows.length) {

    return {

      rows: [],

      loan,

      initialCash,

      totalInterest: 0,

      exitEquity: 0,

      totalProfit:
        -initialCash,

      irr: 0,

      equityMultiple: 0,

      capRate: 0,

      cashOnCash: 0,

      dscr: 0,

      ltv:
        a.price > 0
          ? loan / a.price
          : 0,

      breakEvenOccupancy:
        0
    };
  }


  const finalYear =
    rows[
      rows.length - 1
    ];


  const terminalValue =
    finalYear.noi /
    a.exitcap;


  const sellingCosts =
    terminalValue *
    a.selling;


  const netSale =
    terminalValue -
    sellingCosts;


  const exitEquity =
    netSale -
    finalYear.debtBalance;


  cashFlows[
    cashFlows.length - 1
  ] += exitEquity;


  const yearOne =
    rows[0];


  const totalPositiveCash =
    cashFlows
      .slice(1)
      .reduce(
        (sum, value) =>
          sum +
          Math.max(
            0,
            value
          ),
        0
      );


  const totalProfit =
    cashFlows.reduce(
      (sum, value) =>
        sum + value,
      0
    );


  const equityMultiple =
    initialCash > 0
      ? totalPositiveCash /
        initialCash
      : 0;


  const irr =
    calculateIRR(
      cashFlows
    );


  const capRate =
    a.price > 0
      ? yearOne.noi /
        a.price
      : 0;


  const cashOnCash =
    initialCash > 0
      ? yearOne.cashFlow /
        initialCash
      : 0;


  const dscr =
    yearOne.debtService > 0
      ? yearOne.noi /
        yearOne.debtService
      : 0;


  const ltv =
    a.price > 0
      ? loan / a.price
      : 0;


  /*
   * Break-even occupancy
   */

  const fixedCosts =
    yearOne.debtService +
    a.tax +
    a.insurance +
    a.other;


  const denominator =
    1 -
    a.management;


  const breakEvenOccupancy =
    yearOne.grossRent > 0 &&
    denominator > 0
      ? (
          fixedCosts /
          yearOne.grossRent +
          a.maint +
          a.capex
        ) /
        denominator
      : 0;


  return {

    rows,

    loan,

    initialCash,

    totalInterest,

    exitEquity,

    totalProfit,

    irr,

    equityMultiple,

    capRate,

    cashOnCash,

    dscr,

    ltv,

    breakEvenOccupancy
  };
}


/* =========================================================
   INVESTMENT SCORE
   ========================================================= */

function investmentScore(
  result
) {

  let score = 50;


  score += clamp(
    (
      result.capRate -
      0.06
    ) * 250,
    -15,
    15
  );


  score += clamp(
    (
      result.irr -
      0.08
    ) * 120,
    -15,
    20
  );


  score += clamp(
    (
      result.dscr -
      1
    ) * 15,
    -10,
    10
  );


  score += clamp(
    (
      0.9 -
      result.breakEvenOccupancy
    ) * 30,
    -10,
    10
  );


  return Math.round(
    clamp(
      score,
      0,
      100
    )
  );
}


/* =========================================================
   CALCULATOR FIELDS
   ========================================================= */

function buildCalculatorFields() {

  const container =
    $("calculatorFields");

  if (!container) {
    return;
  }


  const groups = {

    "ACQUISITION": [

      ["price", "Purchase price"],

      ["down", "Down payment %"],

      ["closing", "Closing costs %"],

      [
        "reno",
        "Renovation / upfront costs"
      ]
    ],


    "FINANCING": [

      ["rate", "Mortgage rate %"],

      [
        "term",
        "Loan term (years)"
      ],

      ["points", "Loan points %"]
    ],


    "RENT & OPERATIONS": [

      ["rent", "Monthly rent"],

      ["vacancy", "Vacancy %"],

      [
        "tax",
        "Property tax / year"
      ],

      [
        "insurance",
        "Insurance / year"
      ],

      [
        "maint",
        "Maintenance % of gross rent"
      ],

      [
        "management",
        "Management % of collected rent"
      ],

      [
        "capex",
        "CapEx reserve % of gross rent"
      ],

      [
        "other",
        "Other expenses / year"
      ]
    ],


    "GROWTH & EXIT": [

      [
        "appreciation",
        "Property appreciation % / year"
      ],

      [
        "rentgrowth",
        "Rent growth % / year"
      ],

      [
        "expensegrowth",
        "Expense growth % / year"
      ],

      [
        "hold",
        "Hold period (years)"
      ],

      [
        "exitcap",
        "Exit cap rate %"
      ],

      [
        "selling",
        "Selling costs %"
      ]
    ]
  };


  container.innerHTML =

    Object.entries(groups)
      .map(
        ([group, fields]) => `

          <section class="form-section">

            <h3>
              ${group}
            </h3>

            ${fields
              .map(
                ([id, label]) => `

                  <div class="input-row">

                    <label for="${id}">
                      ${label}
                    </label>

                    <input
                      id="${id}"
                      type="number"
                      value="${DEFAULTS[id]}"
                      step="any"
                      inputmode="decimal"
                    >

                  </div>
                `
              )
              .join("")}

          </section>
        `
      )
      .join("");
}


/* =========================================================
   GRAPHS (with Y-axis labels)
   ========================================================= */

function renderChart(rows) {
  const container = document.getElementById('chart');
  if (!container || !rows || !rows.length) {
    console.warn('Chart container not found or empty rows');
    return;
  }

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 900 260");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const W = 900, H = 260;
  const left = 60, right = 20, top = 20, bottom = 30;
  const plotWidth = W - left - right;
  const plotHeight = H - top - bottom;

  const maxValue = Math.max(1, ...rows.map(row => Math.max(row.propertyValue, Math.max(0, row.equity))));
  const x = index => left + plotWidth * index / Math.max(1, rows.length - 1);
  const y = value => top + plotHeight * (1 - value / maxValue);

  function svgElement(tag, attributes) {
    const element = document.createElementNS(NS, tag);
    Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
    return element;
  }

  // Grid lines and Y-axis labels
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const gridY = top + plotHeight * (1 - ratio);
    const labelY = gridY + 4;
    svg.appendChild(svgElement('line', { x1: left, y1: gridY, x2: W - right, y2: gridY, class: 'gridline' }));
    // Y-axis label
    const label = svgElement('text', {
      x: left - 8,
      y: labelY,
      'text-anchor': 'end',
      fill: '#71838d',
      'font-size': '9'
    });
    label.textContent = money(maxValue * ratio);
    svg.appendChild(label);
  }

  // Property value
  const propertyPoints = rows.map((row, index) => `${x(index)},${y(row.propertyValue)}`).join(' ');
  svg.appendChild(svgElement('polyline', { points: propertyPoints, class: 'path' }));

  // Equity
  const equityPoints = rows.map((row, index) => `${x(index)},${y(Math.max(0, row.equity))}`).join(' ');
  svg.appendChild(svgElement('polyline', { points: equityPoints, class: 'eq' }));

  // X-axis year labels
  rows.forEach((row, index) => {
    if (index === 0 || index === rows.length - 1 || index % 5 === 0) {
      const label = svgElement('text', { x: x(index), y: H - 8, 'text-anchor': 'middle', fill: '#71838d', 'font-size': '9' });
      label.textContent = 'Y' + row.year;
      svg.appendChild(label);
    }
  });

  container.innerHTML = '';
  container.appendChild(svg);
  console.log('✅ Property chart rendered');
}

function renderChart2(rows) {
  const container = document.getElementById('chart2');
  if (!container || !rows || !rows.length) {
    console.warn('Chart2 container not found or empty rows');
    return;
  }

  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("viewBox", "0 0 900 260");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", "100%");

  const W = 900, H = 260;
  const left = 60, right = 20, top = 20, bottom = 30;
  const plotW = W - left - right;
  const plotH = H - top - bottom;

  const maxVal = Math.max(1, ...rows.map(r => Math.max(r.noi, Math.abs(r.cashFlow))));
  const x = i => left + plotW * i / Math.max(1, rows.length - 1);
  const y = v => top + plotH * (1 - (v + maxVal) / (2 * maxVal));

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (let [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
    return e;
  }

  // Grid and Y-axis labels (for this chart, we show both positive and negative)
  for (let i = 0; i <= 4; i++) {
    const ratio = i / 4;
    const value = -maxVal + ratio * 2 * maxVal;
    const gridY = top + plotH * (1 - ratio);
    const labelY = gridY + 4;
    svg.appendChild(el('line', { x1: left, y1: gridY, x2: W - right, y2: gridY, class: 'gridline' }));
    const label = el('text', {
      x: left - 8,
      y: labelY,
      'text-anchor': 'end',
      fill: '#71838d',
      'font-size': '9'
    });
    label.textContent = money(value);
    svg.appendChild(label);
  }

  // Zero line
  const zeroY = y(0);
  svg.appendChild(el('line', { x1: left, y1: zeroY, x2: W - right, y2: zeroY, stroke: '#66818e40', strokeWidth: 1 }));

  // NOI path
  const noiPoints = rows.map((r, i) => `${x(i)},${y(r.noi)}`).join(' ');
  svg.appendChild(el('polyline', { points: noiPoints, class: 'path' }));

  // Cash flow path (gold)
  const cfPoints = rows.map((r, i) => `${x(i)},${y(r.cashFlow)}`).join(' ');
  const cfPath = el('polyline', { points: cfPoints, class: 'eq' });
  cfPath.setAttribute('stroke', 'var(--gold)');
  svg.appendChild(cfPath);

  // X-axis year labels
  rows.forEach((r, i) => {
    if (i === 0 || i === rows.length - 1 || i % 5 === 0) {
      const label = el('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', fill: '#71838d', 'font-size': '9' });
      label.textContent = 'Y' + r.year;
      svg.appendChild(label);
    }
  });

  container.innerHTML = '';
  container.appendChild(svg);
  console.log('✅ Returns chart rendered');
}


/* =========================================================
   YEAR-BY-YEAR TABLE
   ========================================================= */

function renderYearTable(
  rows
) {

  const tbody =
    $("rows");

  if (!tbody) {
    return;
  }


  tbody.innerHTML =
    rows
      .map(
        row => `

          <tr>

            <td>
              ${row.year}
            </td>

            <td>
              ${money(
                row.propertyValue
              )}
            </td>

            <td>
              ${money(
                row.grossRent
              )}
            </td>

            <td>
              ${money(
                row.noi
              )}
            </td>

            <td>
              ${money(
                row.debtBalance
              )}
            </td>

            <td>
              ${money(
                row.equity
              )}
            </td>

            <td>
              ${money(
                row.cashFlow
              )}
            </td>

          </tr>

        `
      )
      .join("");
}


/* =========================================================
   RIGHT PANEL
   ========================================================= */

function renderRightPanel(
  inputs,
  result
) {

  const assumptions =
    $("keyAssumptions");


  if (assumptions) {

    assumptions.innerHTML = [

      [
        "Purchase price",
        money(inputs.price)
      ],

      [
        "Down payment",
        percent(
          inputs.down * 100
        )
      ],

      [
        "Mortgage",
        percent(inputs.rate)
      ],

      [
        "Vacancy",
        percent(
          inputs.vacancy * 100
        )
      ],

      [
        "Appreciation",
        percent(
          inputs.appreciation * 100
        )
      ]

    ]
      .map(
        ([label, value]) => `

          <div class="field">

            <span>
              ${label}
            </span>

            <b>
              ${value}
            </b>

          </div>
        `
      )
      .join("");
  }


  const mini =
    $("miniScenarios");


  if (mini) {

    const conservative =
      scenarioModel(
        inputs,
        "Conservative"
      );


    const optimistic =
      scenarioModel(
        inputs,
        "Optimistic"
      );


    mini.innerHTML = [

      [
        "DOWN",
        conservative
      ],

      [
        "BASE",
        result
      ],

      [
        "UPSIDE",
        optimistic
      ]

    ]
      .map(
        ([label, model]) => `

          <div class="mini">

            <span>
              ${label}
            </span>

            <b>
              ${percent(
                model.irr * 100
              )}
            </b>

          </div>
        `
      )
      .join("");
  }


  const insight =
    $("whyItWorks");


  if (insight) {

    if (
      result.dscr >= 1.2
    ) {

      insight.textContent =
        `Debt coverage is healthy at ${result.dscr.toFixed(2)}×.`;

    } else {

      insight.textContent =
        `Debt coverage is ${result.dscr.toFixed(2)}×. Cash flow is sensitive to the operating assumptions.`;
    }
  }
}


/* =========================================================
   SCENARIO MODEL
   ========================================================= */

function scenarioModel(
  inputs,
  type
) {

  const scenario = {
    ...inputs
  };


  if (
    type === "Conservative"
  ) {

    scenario.appreciation =
      Math.max(
        0,
        scenario.appreciation -
        0.02
      );


    scenario.rentgrowth =
      Math.max(
        0,
        scenario.rentgrowth -
        0.015
      );


    scenario.vacancy =
      Math.min(
        0.95,
        scenario.vacancy +
        0.03
      );


    scenario.exitcap +=
      0.01;
  }


  if (
    type === "Optimistic"
  ) {

    scenario.appreciation +=
      0.02;


    scenario.rentgrowth +=
      0.015;


    scenario.vacancy =
      Math.max(
        0,
        scenario.vacancy -
        0.02
      );


    scenario.exitcap =
      Math.max(
        0.0001,
        scenario.exitcap -
        0.01
      );
  }


  return calculateModel(
    scenario
  );
}


/* =========================================================
   SCENARIO CARDS
   ========================================================= */

function renderScenarioCards(
  inputs
) {

  const container =
    $("scenarioCards");

  if (!container) {
    return;
  }


  container.innerHTML =
    [
      "Conservative",
      "Base",
      "Optimistic"
    ]
      .map(type => {

        const result =
          type === "Base"
            ? calculateModel(
                inputs
              )
            : scenarioModel(
                inputs,
                type
              );


        const finalYear =
          result.rows[
            result.rows.length - 1
          ];


        return `

          <div class="scenario-card">

            <h3>
              ${type}
            </h3>

            <div class="big">
              ${percent(
                result.irr * 100
              )}
            </div>

            <small>
              ANNUALIZED IRR
            </small>

            <div class="scenario-row">
              <span>
                Exit equity
              </span>

              <b>
                ${money(
                  result.exitEquity
                )}
              </b>
            </div>

            <div class="scenario-row">
              <span>
                Cash-on-cash
              </span>

              <b>
                ${percent(
                  result.cashOnCash *
                  100
                )}
              </b>
            </div>

            <div class="scenario-row">
              <span>
                Equity multiple
              </span>

              <b>
                ${result.equityMultiple.toFixed(2)}×
              </b>
            </div>

            <div class="scenario-row">
              <span>
                Final property
              </span>

              <b>
                ${money(
                  finalYear.propertyValue
                )}
              </b>
            </div>

          </div>
        `;
      })
      .join("");
}


/* =========================================================
   SENSITIVITY
   ========================================================= */

function renderSensitivity(
  inputs
) {

  const container =
    $("sensitivityRows");

  if (!container) {
    return;
  }


  const base =
    calculateModel(
      inputs
    );


  const tests = [

    [
      "Property appreciation",

      calculateModel({
        ...inputs,

        appreciation:
          inputs.appreciation +
          0.01

      }).irr -
      base.irr
    ],


    [
      "Rent growth",

      calculateModel({
        ...inputs,

        rentgrowth:
          inputs.rentgrowth +
          0.01

      }).irr -
      base.irr
    ],


    [
      "Vacancy",

      base.irr -
      calculateModel({

        ...inputs,

        vacancy:
          Math.min(
            0.95,
            inputs.vacancy +
            0.01
          )

      }).irr
    ],


    [
      "Mortgage rate",

      base.irr -
      calculateModel({

        ...inputs,

        rate:
          inputs.rate +
          1

      }).irr
    ]

  ];


  const maxImpact =
    Math.max(
      0.0001,

      ...tests.map(
        item =>
          Math.abs(
            item[1]
          )
      )
    );


  container.innerHTML =
    tests
      .map(
        ([label, impact]) => {

          const width =
            Math.min(
              100,

              Math.abs(
                impact
              ) /
              maxImpact *
              100
            );


          return `

            <div class="sensitivity-row">

              <span>
                ${label}
              </span>

              <div class="bar">

                <i
                  style="width:${width}%"
                ></i>

              </div>

              <b>
                ${impact >= 0
                  ? "+"
                  : ""}
                ${percent(
                  impact * 100
                )}
              </b>

            </div>
          `;
        }
      )
      .join("");
}


/* =========================================================
   ASSUMPTION MAP
   ========================================================= */

function renderAssumptionMap(
  inputs
) {

  const container =
    $("assumptionMap");

  if (!container) {
    return;
  }


  const groups = {

    "ACQUISITION": [

      [
        "Purchase price",
        money(inputs.price)
      ],

      [
        "Down payment",
        percent(
          inputs.down * 100
        )
      ],

      [
        "Closing costs",
        percent(
          inputs.closing * 100
        )
      ],

      [
        "Upfront costs",
        money(inputs.reno)
      ]
    ],


    "FINANCING": [

      [
        "Rate",
        percent(inputs.rate)
      ],

      [
        "Term",
        inputs.term +
        " years"
      ],

      [
        "Points",
        percent(
          inputs.points * 100
        )
      ]
    ],


    "OPERATIONS": [

      [
        "Monthly rent",
        money(inputs.rent)
      ],

      [
        "Vacancy",
        percent(
          inputs.vacancy * 100
        )
      ],

      [
        "Maintenance",
        percent(
          inputs.maint * 100
        )
      ],

      [
        "Management",
        percent(
          inputs.management * 100
        )
      ],

      [
        "CapEx",
        percent(
          inputs.capex * 100
        )
      ],

      [
        "Other expenses",
        money(inputs.other)
      ]
    ],


    "GROWTH & EXIT": [

      [
        "Appreciation",
        percent(
          inputs.appreciation *
          100
        )
      ],

      [
        "Rent growth",
        percent(
          inputs.rentgrowth *
          100
        )
      ],

      [
        "Expense growth",
        percent(
          inputs.expensegrowth *
          100
        )
      ],

      [
        "Hold",
        inputs.hold +
        " years"
      ],

      [
        "Exit cap",
        percent(
          inputs.exitcap * 100
        )
      ],

      [
        "Selling costs",
        percent(
          inputs.selling * 100
        )
      ]
    ]
  };


  container.innerHTML =
    Object.entries(groups)
      .map(
        ([group, values]) => `

          <div class="assump">

            <h3>
              ${group}
            </h3>

            ${values
              .map(
                ([label, value]) => `

                  <div class="assump-row">

                    <span>
                      ${label}
                    </span>

                    <b>
                      ${value}
                    </b>

                  </div>
                `
              )
              .join("")}

          </div>
        `
      )
      .join("");
}


/* =========================================================
   COMPARISON
   ========================================================= */

function renderComparison(
  current
) {

  const other =
    calculateModel(
      compareB
    );


  setText(
    "compareAName",
    "Current Property"
  );


  setText(
    "compareBName",
    compareB.name
  );


  setText(
    "aIrr",
    percent(
      current.irr * 100
    )
  );


  setText(
    "aCap",
    percent(
      current.capRate * 100
    )
  );


  setText(
    "aCash",
    money(
      current.rows[0].cashFlow /
      12
    )
  );


  setText(
    "aEquity",
    money(
      current.exitEquity
    )
  );


  setText(
    "bIrr",
    percent(
      other.irr * 100
    )
  );


  setText(
    "bCap",
    percent(
      other.capRate * 100
    )
  );


  setText(
    "bCash",
    money(
      other.rows[0].cashFlow /
      12
    )
  );


  setText(
    "bEquity",
    money(
      other.exitEquity
    )
  );


  const winner =
    $("winner");


  if (!winner) {
    return;
  }


  if (
    current.irr >
    other.irr
  ) {

    winner.textContent =
      `Property A leads on modeled IRR by ${percent(
        (
          current.irr -
          other.irr
        ) * 100
      )}.`;

  } else if (
    other.irr >
    current.irr
  ) {

    winner.textContent =
      `Property B leads on modeled IRR by ${percent(
        (
          other.irr -
          current.irr
        ) * 100
      )}.`;

  } else {

    winner.textContent =
      "Both properties have the same modeled IRR.";
  }
}


/* =========================================================
   MAIN CALCULATION (with validation)
   ========================================================= */

function calculate() {

  const inputs =
    getInputs();

  // Validate essential inputs
  let invalid = false;
  if (inputs.price <= 0) {
    invalid = true;
    showToast('Purchase price must be positive – reset to default.');
  }
  if (inputs.rent <= 0) {
    invalid = true;
    showToast('Monthly rent must be positive – reset to default.');
  }
  if (inputs.rate < 0) {
    invalid = true;
    showToast('Mortgage rate cannot be negative – reset to default.');
  }

  if (invalid) {
    // Reset all inputs to DEFAULTS
    Object.entries(DEFAULTS).forEach(([id, value]) => {
      const el = $(id);
      if (el) el.value = value;
    });
    // Re-calculate with fixed inputs
    const fixedInputs = getInputs();
    const result = calculateModel(fixedInputs);
    updateUI(fixedInputs, result);
    return;
  }

  const result =
    calculateModel(
      inputs
    );

  updateUI(inputs, result);
}

function updateUI(inputs, result) {

  const score =
    investmentScore(
      result
    );


  /*
   * Main metrics
   */

  setText(
    "cap",
    percent(
      result.capRate * 100
    )
  );


  setText(
    "irr",
    percent(
      result.irr * 100
    )
  );


  setText(
    "coc",
    percent(
      result.cashOnCash *
      100
    )
  );


  setText(
    "cashflow",
    result.rows.length
      ? money(
          result.rows[0].cashFlow /
          12
        )
      : "₹0"
  );


  setText(
    "multiple",
    result.equityMultiple.toFixed(
      2
    ) + "×"
  );


  setText(
    "equity",
    money(
      result.exitEquity
    )
  );


  /*
   * Bottom metrics
   */

  setText(
    "initialCash",
    money(
      result.initialCash
    )
  );


  setText(
    "dscr",
    result.dscr.toFixed(
      2
    ) + "×"
  );


  setText(
    "breakEven",
    percent(
      result.breakEvenOccupancy *
      100
    )
  );


  setText(
    "ltv",
    percent(
      result.ltv * 100
    )
  );


  /*
   * Score
   */

  setText(
    "scoreValue",
    score
  );


  setText(
    "scoreLabel",

    score >= 75
      ? "Strong investment profile"

      : score >= 60
        ? "Promising, with trade-offs"

        : score >= 45
          ? "Mixed investment profile"

          : "High-risk profile"
  );


  setText(
    "scoreReason",

    score >= 75
      ? "Cash flow, leverage and returns are currently working together."

      : score >= 60
        ? "The deal has potential, but some assumptions deserve a stress test."

        : score >= 45
          ? "The model is sensitive to assumptions. Stress-test the downside."

          : "The current assumptions do not provide enough return for the modeled risk."
  );


  /*
   * Score ring
   */

  const ring =
    $("scoreRing");


  if (ring) {

    ring.style.background =
      `conic-gradient(
        var(--blue) 0 ${score}%,
        #dce7eb ${score}% 100%
      )`;
  }


  /*
   * Hero
   */

  setText(
    "dealSub",

    `${money(
      inputs.price
    )} purchase · ${money(
      inputs.rent
    )} monthly rent`
  );


  setText(
    "yearCount",

    `${inputs.hold} YEARS`
  );


  setText(
    "saveStatus",
    "● LIVE MODEL"
  );


  /*
   * Everything else
   */

  renderChart(
    result.rows
  );


  renderChart2(
    result.rows
  );


  renderYearTable(
    result.rows
  );


  renderRightPanel(
    inputs,
    result
  );


  renderScenarioCards(
    inputs
  );


  renderSensitivity(
    inputs
  );


  renderAssumptionMap(
    inputs
  );


  renderComparison(
    result
  );


  updateTuner();
}


/* =========================================================
   INVESTMENT TUNER (now re-renders charts)
   ========================================================= */

function updateTuner() {

  const tuner =
    $("tuner");


  if (!tuner) {
    return;
  }


  const value =
    Number(tuner.value) ||
    50;


  const inputs =
    getInputs();


  const type =
    value < 34
      ? "Conservative"

      : value > 66
        ? "Optimistic"

        : "Base";


  const result =
    type === "Base"
      ? calculateModel(
          inputs
        )
      : scenarioModel(
          inputs,
          type
        );


  setText(
    "tunerLabel",
    type.toUpperCase()
  );


  setText(
    "tunerIrr",
    percent(
      result.irr * 100
    )
  );


  setText(

    "tunerText",

    type === "Conservative"

      ? "Stress case: slower growth, higher vacancy and a softer exit."

      : type === "Optimistic"

        ? "Upside case: stronger growth, lower vacancy and a tighter exit."

        : "Drag this to stress-test the entire investment."
  );


  // Update the slider background and knob
  const slider =
    document.querySelector(
      ".slider"
    );


  if (slider) {

    slider.style.background =
      `linear-gradient(
        90deg,
        #8aa9ba 0 ${value}%,
        #dce6ea ${value}% 100%
      )`;
  }


  const knob =
    document.querySelector(
      ".knob"
    );


  if (knob) {

    knob.style.left =
      value + "%";
  }


  // *** NEW: Re‑render the charts with the stressed result ***
  renderChart(result.rows);
  renderChart2(result.rows);
}


/* =========================================================
   NAVIGATION
   ========================================================= */

const SECTION_TO_VIEW = {

  property:
    "decision",

  finance:
    "calculator",

  returns:
    "yearly",

  scenarios:
    "scenario",

  compare:
    "compare",

  yearly:
    "yearly",

  assumptions:
    "assumptions",

  decision:
    "decision",

  calculator:
    "calculator",

  scenario:
    "scenario"
};


function showView(section) {

  const viewName =
    SECTION_TO_VIEW[
      section
    ] ||
    "decision";


  // Hide all views
  document
    .querySelectorAll(
      ".view"
    )
    .forEach(
      view => {

        view.classList.add(
          "hidden"
        );

      }
    );


  // Show target
  const target =
    document.querySelector(
      `.view[data-view="${viewName}"]`
    );


  if (target) {

    target.classList.remove(
      "hidden"
    );

  }


  // Update sidebar and mobile tabs
  document
    .querySelectorAll(
      "[data-section]"
    )
    .forEach(
      button => {

        button.classList.toggle(

          "active",

          button.dataset.section ===
          section
        );

      }
    );


  // Update top mode pills
  let mode =
    "decision";


  if (
    viewName ===
    "scenario"
  ) {

    mode =
      "scenario";

  } else if (

    viewName ===
      "calculator" ||

    viewName ===
      "yearly" ||

    viewName ===
      "assumptions"

  ) {

    mode =
      "calculator";
  }


  document
    .querySelectorAll(
      ".modebtn"
    )
    .forEach(
      button => {

        button.classList.toggle(

          "on",

          button.dataset.mode ===
          mode
        );

      }
    );


  // Re‑draw charts if switching to Property or Returns
  if (
    viewName === "decision" ||
    viewName === "yearly"
  ) {

    const result =
      calculateModel(
        getInputs()
      );


    if (
      viewName === "decision"
    ) {

      renderChart(
        result.rows
      );

    }


    if (
      viewName === "yearly"
    ) {

      renderChart2(
        result.rows
      );

    }

  }


  console.log(
    `Active view: ${viewName} (from section: ${section})`
  );
}


/* =========================================================
   MODAL
   ========================================================= */

function openModal(
  title,
  body
) {

  const modal =
    $("modal");

  const content =
    $("modalContent");


  if (
    !modal ||
    !content
  ) {
    return;
  }


  content.innerHTML =
    `<h2>${title}</h2>${body}`;


  modal.classList.remove(
    "hidden"
  );
}


/* =========================================================
   CHATBOT RULES (hardcoded for chips)
   ========================================================= */

const CHAT_RULES = {

  rent: {
    title: "Rent Growth Analysis",
    question: "“What happens to my IRR if rent grows only 1% a year?”",
    run(inputs) {
      return calculateModel({ ...inputs, rentgrowth: 0.01 });
    },
    answer(base, stressed) {
      return `
        At 1% annual rent growth,
        modeled IRR changes from
        <b>${percent(base.irr * 100)}</b>
        to
        <b>${percent(stressed.irr * 100)}</b>.
      `;
    }
  },

  vacancy: {
    title: "Vacancy Stress Test",
    question: "“What happens if vacancy rises to 10%?”",
    run(inputs) {
      return calculateModel({ ...inputs, vacancy: 0.10 });
    },
    answer(base, stressed) {
      return `
        At 10% vacancy,
        modeled IRR becomes
        <b>${percent(stressed.irr * 100)}</b>.
        Year-1 monthly cash flow becomes
        <b>${money(stressed.rows[0].cashFlow / 12)}</b>.
      `;
    }
  },

  rate: {
    title: "Mortgage Rate Stress Test",
    question: "“What happens if my mortgage rises by 2%?”",
    run(inputs) {
      return calculateModel({ ...inputs, rate: inputs.rate + 2 });
    },
    answer(base, stressed, inputs) {
      return `
        At a mortgage rate of
        <b>${percent(inputs.rate + 2)}</b>,
        modeled IRR becomes
        <b>${percent(stressed.irr * 100)}</b>.
      `;
    }
  },

  why: {
    title: "Investment Analysis",
    question: "“Why is this deal strong?”",
    run(inputs) {
      return calculateModel(inputs);
    },
    answer(base) {
      const score = investmentScore(base);
      return `
        <p>Investment score: <b>${score}/100</b></p>
        <ul>
          <li>Cap rate: ${percent(base.capRate * 100)}</li>
          <li>IRR: ${percent(base.irr * 100)}</li>
          <li>DSCR: ${base.dscr.toFixed(2)}×</li>
          <li>Break-even occupancy: ${percent(base.breakEvenOccupancy * 100)}</li>
        </ul>
      `;
    }
  },

  expenses: {
    title: "Expense Shock Test",
    question: "“What if operating expenses increase by 10%?”",
    run(inputs) {
      const shocked = { ...inputs };
      shocked.maint = Math.min(0.99, shocked.maint * 1.1);
      shocked.management = Math.min(0.99, shocked.management * 1.1);
      shocked.capex = Math.min(0.99, shocked.capex * 1.1);
      shocked.tax *= 1.1;
      shocked.insurance *= 1.1;
      shocked.other *= 1.1;
      return calculateModel(shocked);
    },
    answer(base, stressed) {
      return `
        With a 10% increase in operating expenses,
        modeled IRR drops from
        <b>${percent(base.irr * 100)}</b>
        to
        <b>${percent(stressed.irr * 100)}</b>.
        Year-1 cash flow changes from
        <b>${money(base.rows[0].cashFlow / 12)}</b>
        to
        <b>${money(stressed.rows[0].cashFlow / 12)}</b>.
      `;
    }
  },

  exitcap: {
    title: "Exit Cap Expansion",
    question: "“What if the exit cap rate rises to 7%?”",
    run(inputs) {
      return calculateModel({ ...inputs, exitcap: 0.07 });
    },
    answer(base, stressed) {
      return `
        With an exit cap rate of 7%,
        modeled IRR changes from
        <b>${percent(base.irr * 100)}</b>
        to
        <b>${percent(stressed.irr * 100)}</b>.
        Exit equity becomes
        <b>${money(stressed.exitEquity)}</b>.
      `;
    }
  },

  appreciation: {
    title: "Slower Appreciation",
    question: "“What if property appreciation drops to 1%?”",
    run(inputs) {
      return calculateModel({ ...inputs, appreciation: 0.01 });
    },
    answer(base, stressed) {
      return `
        At 1% annual appreciation,
        modeled IRR changes from
        <b>${percent(base.irr * 100)}</b>
        to
        <b>${percent(stressed.irr * 100)}</b>.
        Final property value becomes
        <b>${money(stressed.rows[stressed.rows.length - 1].propertyValue)}</b>.
      `;
    }
  },

  reno: {
    title: "Renovation Overrun",
    question: "“What if the renovation budget doubles?”",
    run(inputs) {
      return calculateModel({ ...inputs, reno: inputs.reno * 2 });
    },
    answer(base, stressed) {
      return `
        With a doubled renovation budget,
        modeled IRR changes from
        <b>${percent(base.irr * 100)}</b>
        to
        <b>${percent(stressed.irr * 100)}</b>.
        Initial cash invested becomes
        <b>${money(stressed.initialCash)}</b>.
      `;
    }
  }
};


/* =========================================================
   DYNAMIC "WHAT-IF" PARSER (Enhanced)
   ========================================================= */

// Recognised variables and their mapping to input fields
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

  // 1. Detect variable
  let variable = null;
  const variablePatterns = {
    rent: ['rent', 'rental', 'monthly rent'],
    vacancy: ['vacancy', 'vacant', 'occupancy'],
    rate: ['rate', 'mortgage', 'interest', 'loan rate'],
    expenses: ['expenses', 'operating', 'costs', 'opex'],
    appreciation: ['appreciation', 'value growth', 'property growth'],
    exitcap: ['exit cap', 'exit cap rate', 'terminal cap'],
    reno: ['renovation', 'reno', 'budget', 'upfront', 'renovation budget']
  };
  for (const [key, patterns] of Object.entries(variablePatterns)) {
    if (patterns.some(p => lower.includes(p))) {
      variable = key;
      break;
    }
  }
  if (!variable) return null;

  // 2. Detect direction
  let direction = 0; // 0 = unknown (means "set to exact value")
  if (/increase|rise|up|grow|higher|raise|add|plus/i.test(lower)) direction = 1;
  else if (/decrease|fall|drop|down|lower|reduce|decline|minus|cut/i.test(lower)) direction = -1;

  // Special case: "double" => increase by 100%
  if (/double|twice|2x/i.test(lower)) {
    return { variable, direction: 1, amount: 1.0, isPercentage: true };
  }
  if (/half|50%|0.5/i.test(lower)) {
    return { variable, direction: -1, amount: 0.5, isPercentage: true };
  }

  // 3. Extract number and unit
  // Try to find a number with optional % or ₹ sign
  const numberMatch = lower.match(/(\d+\.?\d*)\s*(%|₹|lakh|crore)?/);
  if (!numberMatch) {
    // If no number, maybe the user said "increase rent" without specifying – we can assume a default of 5%
    if (direction !== 0 && /rent|vacancy|rate|expenses|appreciation|exitcap|reno/.test(variable)) {
      // Default change: 5% for percentages, 10% for flat? We'll use 5% for percentages and 10% for flat (rent/reno)
      const defaultPercent = (variable === 'rent' || variable === 'reno') ? 0.05 : 0.05;
      return { variable, direction, amount: defaultPercent, isPercentage: true };
    }
    return null;
  }

  let amount = parseFloat(numberMatch[1]);
  let unit = numberMatch[2] || '';
  let isPercentage = false;

  if (unit === '%') {
    isPercentage = true;
    amount = amount / 100; // convert to decimal
  } else if (unit === '₹' || unit === 'lakh' || unit === 'crore') {
    // For flat amounts, we keep as is (₹ is just a label)
    // We'll handle conversion later if needed
  }

  // If no explicit direction, assume "set to" (exact value)
  // But if the number is accompanied by words like "to" or "at", we treat as absolute.
  // We'll check if the phrase has "to" or "at" indicating a target.
  const hasTarget = /to|at|equals|=/.test(lower);
  if (hasTarget) {
    direction = 0; // treat as absolute set
  }

  // If direction is still 0 and we have a percentage, it's ambiguous; we'll treat as "set to this exact value"
  // For percentages, if they say "vacancy 8%", we set it to 8%.
  // For flat, if they say "rent 50000", we set it to 50000.

  return { variable, direction, amount, isPercentage, unit };
}

function applyChange(inputs, parsed) {
  const { variable, direction, amount, isPercentage } = parsed;
  const newInputs = { ...inputs };

  switch (variable) {
    case 'rent':
      if (isPercentage) {
        // Apply percentage change to rent
        const change = direction * amount;
        newInputs.rent = inputs.rent * (1 + change);
      } else {
        // Absolute change (flat amount)
        // If direction is 0, set exact value; else add/subtract
        if (direction === 0) {
          newInputs.rent = amount;
        } else {
          newInputs.rent = inputs.rent + (direction * amount);
        }
      }
      newInputs.rent = Math.max(0, newInputs.rent);
      break;

    case 'vacancy':
      if (isPercentage) {
        // If direction is 0, treat as absolute value; else apply percentage change.
        if (direction === 0) {
          newInputs.vacancy = amount; // amount is in decimal (e.g., 0.08)
        } else {
          const change = direction * amount;
          newInputs.vacancy = inputs.vacancy + change;
        }
      } else {
        // assume percentage points if no %
        if (direction === 0) {
          newInputs.vacancy = amount / 100;
        } else {
          newInputs.vacancy = inputs.vacancy + (direction * amount / 100);
        }
      }
      newInputs.vacancy = clamp(newInputs.vacancy, 0, 0.99);
      break;

    case 'rate':
      if (isPercentage) {
        if (direction === 0) {
          newInputs.rate = amount * 100; // amount is decimal, convert to percentage points
        } else {
          const change = direction * amount * 100; // amount is decimal, multiply by 100 to get percentage points
          newInputs.rate = inputs.rate + change;
        }
      } else {
        // flat number (percentage points)
        if (direction === 0) {
          newInputs.rate = amount;
        } else {
          newInputs.rate = inputs.rate + (direction * amount);
        }
      }
      newInputs.rate = Math.max(0, newInputs.rate);
      break;

    case 'expenses':
      // Apply a uniform percentage change to all operating expenses
      if (isPercentage) {
        const change = direction * amount;
        newInputs.maint = Math.min(0.99, inputs.maint * (1 + change));
        newInputs.management = Math.min(0.99, inputs.management * (1 + change));
        newInputs.capex = Math.min(0.99, inputs.capex * (1 + change));
        newInputs.tax = Math.max(0, inputs.tax * (1 + change));
        newInputs.insurance = Math.max(0, inputs.insurance * (1 + change));
        newInputs.other = Math.max(0, inputs.other * (1 + change));
      } else {
        // absolute change? Probably not common; we'll ignore.
      }
      break;

    case 'appreciation':
      if (isPercentage) {
        if (direction === 0) {
          newInputs.appreciation = amount; // amount is decimal
        } else {
          const change = direction * amount;
          newInputs.appreciation = inputs.appreciation + change;
        }
      } else {
        if (direction === 0) {
          newInputs.appreciation = amount / 100;
        } else {
          newInputs.appreciation = inputs.appreciation + (direction * amount / 100);
        }
      }
      newInputs.appreciation = Math.max(0, newInputs.appreciation);
      break;

    case 'exitcap':
      if (isPercentage) {
        if (direction === 0) {
          newInputs.exitcap = amount; // decimal
        } else {
          const change = direction * amount;
          newInputs.exitcap = inputs.exitcap + change;
        }
      } else {
        if (direction === 0) {
          newInputs.exitcap = amount / 100;
        } else {
          newInputs.exitcap = inputs.exitcap + (direction * amount / 100);
        }
      }
      newInputs.exitcap = Math.max(0.0001, newInputs.exitcap);
      break;

    case 'reno':
      if (isPercentage) {
        const change = direction * amount;
        newInputs.reno = inputs.reno * (1 + change);
      } else {
        if (direction === 0) {
          newInputs.reno = amount;
        } else {
          newInputs.reno = inputs.reno + (direction * amount);
        }
      }
      newInputs.reno = Math.max(0, newInputs.reno);
      break;

    default:
      return null;
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

  // Build a human-readable description of the change
  let desc = '';
  const varName = VARIABLE_MAP[parsed.variable]?.label || parsed.variable;
  if (parsed.direction === 0) {
    desc = `set ${varName} to ${parsed.isPercentage ? percent(parsed.amount * 100) : money(parsed.amount)}`;
  } else {
    const dir = parsed.direction === 1 ? 'increase' : 'decrease';
    const amountStr = parsed.isPercentage ? percent(parsed.amount * 100) : money(parsed.amount);
    desc = `${dir} ${varName} by ${amountStr}`;
  }

  const resultHTML = `
    <p><strong>What if:</strong> ${desc}</p>
    <ul>
      <li><strong>Base IRR:</strong> ${percent(base.irr * 100)}</li>
      <li><strong>Stressed IRR:</strong> ${percent(stressed.irr * 100)}</li>
      <li><strong>Change:</strong> ${percent((stressed.irr - base.irr) * 100)}</li>
      <li><strong>Year-1 monthly cash flow:</strong> ${money(stressed.rows[0]?.cashFlow / 12 || 0)}</li>
      <li><strong>Exit equity:</strong> ${money(stressed.exitEquity)}</li>
      <li><strong>Cap rate:</strong> ${percent(stressed.capRate * 100)}</li>
      <li><strong>DSCR:</strong> ${stressed.dscr.toFixed(2)}×</li>
    </ul>
  `;

  return {
    title: `What if: ${desc}`,
    question: `“${text}”`,
    answer: resultHTML,
    stressed // we might need it later
  };
}


/* =========================================================
   CHATBOT ACTION (updated to try dynamic parser first)
   ========================================================= */

function askModel(ruleName) {
  const rule = CHAT_RULES[ruleName];
  if (!rule) return;

  const inputs = getInputs();
  const base = calculateModel(inputs);
  const stressed = rule.run(inputs);
  const answer = rule.answer(base, stressed, inputs);

  setText("questionText", rule.question);
  const answerElement = $("answerText");
  if (answerElement) answerElement.innerHTML = answer;

  openModal(rule.title, `<div>${answer}</div>`);
}


/* =========================================================
   SAVE / LOAD / MANAGE DEALS (multiple)
   ========================================================= */

// Get all saved deals from localStorage
function getSavedDeals() {
  try {
    const raw = localStorage.getItem('glassFinanceDeals');
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

// Save deals array to localStorage
function setSavedDeals(deals) {
  localStorage.setItem('glassFinanceDeals', JSON.stringify(deals));
}

// Save current deal with a name
function saveDeal() {
  const inputs = getInputs();
  const data = {
    inputs: inputs,
    compareB: compareB,
    timestamp: new Date().toISOString()
  };

  // Prompt for a name
  let name = prompt('Enter a name for this deal:', 'Deal ' + new Date().toLocaleString());
  if (name === null) return; // cancelled
  name = name.trim() || 'Unnamed Deal';

  const deals = getSavedDeals();
  // Check if name already exists – ask to overwrite or rename
  const existing = deals.find(d => d.name === name);
  if (existing) {
    if (!confirm(`A deal named "${name}" already exists. Overwrite?`)) {
      saveDeal(); // retry with new name
      return;
    }
    // Remove old entry
    const index = deals.indexOf(existing);
    deals.splice(index, 1);
  }

  deals.push({ name, data, timestamp: data.timestamp });
  setSavedDeals(deals);
  showToast(`Deal "${name}" saved successfully!`);
}

// Load a deal by name (called from the manage modal or header)
function loadDealByName(name) {
  const deals = getSavedDeals();
  const found = deals.find(d => d.name === name);
  if (!found) {
    showToast('Deal not found.');
    return;
  }
  const data = found.data;
  // Restore inputs
  Object.keys(DEFAULTS).forEach(id => {
    const el = $(id);
    if (el && data.inputs[id] !== undefined) {
      el.value = data.inputs[id];
    }
  });
  if (data.compareB) {
    compareB = data.compareB;
  }
  showToast(`Deal "${name}" loaded!`);
  calculate();
}

// Load the most recently saved deal (for the header Load button)
function loadDeal() {
  const deals = getSavedDeals();
  if (deals.length === 0) {
    showToast('No saved deals found.');
    return;
  }
  // Load the most recent one (or show list?)
  // For simplicity, load the first (or prompt to choose from manage)
  // Better: open manageSaved() to let user choose.
  manageSaved();
}

// Rename a saved deal
function renameDeal(oldName) {
  const deals = getSavedDeals();
  const found = deals.find(d => d.name === oldName);
  if (!found) {
    showToast('Deal not found.');
    return;
  }
  const newName = prompt('Rename deal to:', oldName);
  if (newName === null) return;
  const trimmed = newName.trim();
  if (!trimmed) {
    showToast('Name cannot be empty.');
    return;
  }
  // Check for duplicate
  if (trimmed !== oldName && deals.some(d => d.name === trimmed)) {
    showToast(`A deal named "${trimmed}" already exists.`);
    return;
  }
  found.name = trimmed;
  setSavedDeals(deals);
  showToast(`Deal renamed to "${trimmed}".`);
  manageSaved(); // refresh list
}

// Delete a saved deal
function deleteDeal(name) {
  if (!confirm(`Delete deal "${name}"?`)) return;
  let deals = getSavedDeals();
  deals = deals.filter(d => d.name !== name);
  setSavedDeals(deals);
  showToast(`Deal "${name}" deleted.`);
  manageSaved(); // refresh list
}

// Open the manage modal with a list of all saved deals
function manageSaved() {
  const deals = getSavedDeals();
  if (deals.length === 0) {
    openModal('Saved Deals', '<p>No saved deals yet. Save your current deal first.</p>');
    return;
  }

  let listHtml = '<ul style="list-style:none; padding:0; margin:0;">';
  deals.forEach(d => {
    const date = new Date(d.timestamp).toLocaleString();
    listHtml += `
      <li style="display:flex; align-items:center; gap:10px; padding:8px 0; border-bottom:1px solid #fff3;">
        <span style="flex:1;"><strong>${d.name}</strong> <span style="font-size:9px; color:#6f818b;">(${date})</span></span>
        <button onclick="loadDealByName('${d.name}')" class="smallbtn">Load</button>
        <button onclick="renameDeal('${d.name}')" class="smallbtn">✏️</button>
        <button onclick="deleteDeal('${d.name}')" class="smallbtn" style="color:#c0392b;">🗑</button>
      </li>
    `;
  });
  listHtml += '</ul>';

  openModal('Saved Deals', listHtml);
}
/* =========================================================
   RESET
   ========================================================= */

function resetCalculator() {

  Object.entries(
    DEFAULTS
  ).forEach(
    ([id, value]) => {

      const input =
        $(id);


      if (input) {
        input.value =
          value;
      }
    }
  );


  if ($("tuner")) {

    $("tuner").value =
      50;
  }


  calculate();
}


/* =========================================================
   INITIALIZATION
   ========================================================= */

function initialize() {

  /*
   * Build calculator
   * inputs first.
   */

  buildCalculatorFields();


  /*
   * Currency selector
   */

  const currencySelect = document.getElementById('currencySelect');
  if (currencySelect) {
    currencySelect.addEventListener('change', function() {
      window.currencySymbol = this.value;
      calculate(); // refresh all numbers
    });
    window.currencySymbol = currencySelect.value;
  }


  /*
   * Save / Load buttons (header and right panel)
   */

  const saveHeader = document.getElementById('saveDealHeader');
  const loadHeader = document.getElementById('loadDealHeader');
  if (saveHeader) saveHeader.addEventListener('click', saveDeal);
  if (loadHeader) loadHeader.addEventListener('click', loadDeal);

  const saveRight = document.getElementById('saveDeal');
  const loadRight = document.getElementById('loadDeal');
  if (saveRight) saveRight.addEventListener('click', saveDeal);
  if (loadRight) loadRight.addEventListener('click', loadDeal);
  // Manage Saved button (header)
  const manageBtn = document.getElementById('manageSaved');
  if (manageBtn) manageBtn.addEventListener('click', manageSaved);

  /*
   * Live number inputs.
   */

  document.addEventListener(
    "input",
    event => {

      const target =
        event.target;


      if (
        target instanceof
          HTMLInputElement &&
        target.type ===
          "number"
      ) {

        calculate();
      }


      if (
        target instanceof
          HTMLInputElement &&
        target.type ===
          "range"
      ) {

        updateTuner();
      }

    }
  );


  /*
   * Change event fallback.
   */

  document.addEventListener(
    "change",
    event => {

      const target =
        event.target;


      if (
        target instanceof
          HTMLInputElement &&
        target.type ===
          "number"
      ) {

        calculate();
      }

    }
  );


  /*
   * Sidebar + mobile tabs.
   */

  document
    .querySelectorAll(
      "[data-section]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            showView(
              button.dataset.section
            );

          }
        );

      }
    );


  /*
   * Top modes.
   */

  document
    .querySelectorAll(
      ".modebtn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const mode =
              button.dataset.mode;


            if (
              mode ===
              "calculator"
            ) {

              showView(
                "finance"
              );

            } else if (
              mode ===
              "scenario"
            ) {

              showView(
                "scenarios"
              );

            } else {

              showView(
                "property"
              );
            }

          }
        );

      }
    );


  /*
   * Right-side actions.
   */

  document
    .querySelectorAll(
      "[data-jump]"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const target =
              button.dataset.jump;


            showView(
              target
            );

          }
        );

      }
    );


  /*
   * Tuner.
   */

  if ($("tuner")) {

    $("tuner").addEventListener(
      "input",
      updateTuner
    );
  }


  /*
   * Why score.
   */

  if ($("whyScore")) {

    $("whyScore").addEventListener(
      "click",
      () => {

        askModel(
          "why"
        );

      }
    );
  }


  /*
   * Ask model.
   */

  if ($("askModel")) {

    $("askModel").addEventListener(
      "click",
      () => {

        askModel(
          "rent"
        );

      }
    );
  }


  /*
   * Compare.
   */

  if ($("openCompare")) {

    $("openCompare").addEventListener(
      "click",
      () => {

        showView(
          "compare"
        );

      }
    );
  }


  /*
   * Chatbot chips.
   */

  document
    .querySelectorAll(
      ".chips button"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            askModel(
              button.dataset.query
            );

          }
        );

      }
    );


  /*
   * Chat input (natural language) - now with dynamic parser
   */

  const chatInput =
    document.getElementById(
      "chatInput"
    );


  const chatSend =
    document.getElementById(
      "chatSend"
    );


  if (
    chatInput &&
    chatSend
  ) {

    const sendMessage =
      () => {

        const text =
          chatInput.value
            .trim();


        if (!text) {
          return;
        }


        // First, try dynamic "what-if" parser
        const dynamicResult = handleWhatIfQuestion(text);
        if (dynamicResult) {
          setText("questionText", dynamicResult.question);
          const answerElement = $("answerText");
          if (answerElement) answerElement.innerHTML = dynamicResult.answer;
          openModal(dynamicResult.title, `<div>${dynamicResult.answer}</div>`);
          chatInput.value = "";
          return;
        }

        // Fallback to keyword matching (for simple commands)
        const lower = text.toLowerCase();
        if (
          lower.includes("rent") ||
          lower.includes("growth")
        ) {
          askModel("rent");
        } else if (
          lower.includes("vacancy")
        ) {
          askModel("vacancy");
        } else if (
          lower.includes("rate") ||
          lower.includes("mortgage") ||
          lower.includes("interest")
        ) {
          askModel("rate");
        } else if (
          lower.includes("why") ||
          lower.includes("strong") ||
          lower.includes("score")
        ) {
          askModel("why");
        } else if (
          lower.includes("expense") ||
          lower.includes("operating") ||
          lower.includes("cost")
        ) {
          askModel("expenses");
        } else if (
          lower.includes("exit") ||
          lower.includes("cap rate")
        ) {
          askModel("exitcap");
        } else if (
          lower.includes("appreciation") ||
          lower.includes("value")
        ) {
          askModel("appreciation");
        } else if (
          lower.includes("reno") ||
          lower.includes("renovation") ||
          lower.includes("budget")
        ) {
          askModel("reno");
        } else {
          openModal(
            "I didn't understand that",
            `<p>I can answer dynamic "what-if" questions like:</p>
            <ul>
              <li><i>"What if rent drops 5%?"</i></li>
              <li><i>"What if vacancy rises to 8%?"</i></li>
              <li><i>"What if expenses increase 10%?"</i></li>
              <li><i>"What if appreciation falls to 2%?"</i></li>
              <li><i>"What if exit cap goes to 7%?"</i></li>
              <li><i>"What if renovation budget doubles?"</i></li>
              <li><i>"What if mortgage rate goes up 1.5%?"</i></li>
            </ul>
            <p>Or use one of these keywords: <b>rent, vacancy, rate, why, expenses, exitcap, appreciation, reno</b></p>
            <p><small>Tip: include a number and a direction (increase/decrease) or a target value.</small></p>`
          );
        }

        chatInput.value = "";
      };


    chatSend.addEventListener(
      "click",
      sendMessage
    );


    chatInput.addEventListener(
      "keydown",
      event => {

        if (
          event.key ===
          "Enter"
        ) {

          sendMessage();
        }

      }
    );
  }


  /*
   * Reset.
   */

  if ($("reset")) {

    $("reset").addEventListener(
      "click",
      resetCalculator
    );
  }


  /*
   * Close modal.
   */

  if ($("closeModal")) {

    $("closeModal").addEventListener(
      "click",
      () => {

        $("modal")
          .classList
          .add("hidden");

      }
    );
  }


  /*
   * Click outside modal.
   */

  if ($("modal")) {

    $("modal").addEventListener(
      "click",
      event => {

        if (
          event.target.classList
            .contains(
              "modal-backdrop"
            )
        ) {

          $("modal")
            .classList
            .add("hidden");
        }

      }
    );
  }


  /*
   * Copy current deal
   * into Property B.
   */

  if ($("copyDeal")) {

    $("copyDeal").addEventListener(
      "click",
      () => {

        compareB = {

          ...getInputs(),

          name:
            "Copied Deal"
        };


        calculate();


        showView(
          "compare"
        );

      }
    );
  }


  /*
   * Initial calculation.
   */

  calculate();


  /*
   * Start on Property.
   */

  showView(
    "property"
  );
}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialize,
    {
      once: true
    }
  );

} else {

  initialize();
}
