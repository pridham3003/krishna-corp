// Currency formatter utility for Indian Rupees (₹) - Rounded to nearest integer
function money(amount) {
  return "₹" + Math.round(Number(amount)).toLocaleString('en-IN');
}

// Dynamic API URL (Automatically detects localhost or mobile IP network)
const API_URL = window.location.protocol + '//' + window.location.hostname + ':3000/api';

// Data Arrays (populated from database on startup)
let items = [];
let employees = [];
let assets = [];
let expenses = [];
let settlements = [];
let partners = [];

let editIndex = null;
let empEditIndex = null;
let assetEditIndex = null;
let expenseEditIndex = null;
let settlementEditIndex = null;
let partnerEditIndex = null;

let multiMonthChartInstance = null;

// --- LOAD ALL DATA FROM BACKEND DATABASE ---
async function loadAllDataFromDB() {
  try {
    const [resItems, resEmp, resAsset, resExp, resSt, resPart] = await Promise.all([
      fetch(`${API_URL}/items`).then(r => r.json()),
      fetch(`${API_URL}/employees`).then(r => r.json()),
      fetch(`${API_URL}/assets`).then(r => r.json()),
      fetch(`${API_URL}/expenses`).then(r => r.json()),
      fetch(`${API_URL}/settlements`).then(r => r.json()),
      fetch(`${API_URL}/partners`).then(r => r.json())
    ]);

    items = resItems || [];
    employees = resEmp || [];
    assets = resAsset || [];
    expenses = resExp || [];
    settlements = resSt || [];
    partners = resPart || [];

    // Initialize UI after data is loaded
    loadSidebar();
    initDashboard();
    initMultiMonthChart();
    initInventory();
    initEmployees();
    initAssets();
    initExpenses();
    initPartners();
    initCreditSalesTable();
  } catch (err) {
    console.error("Failed to connect to backend database. Is server.js running?", err);
  }
}

// --- SAVE DATA TO BACKEND DATABASE ---
async function saveTableToDB(tableName, dataArray) {
  try {
    await fetch(`${API_URL}/${tableName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dataArray)
    });
  } catch (err) {
    console.error(`Error saving ${tableName} to DB:`, err);
  }
}

function saveItemsToLocalStorage() { saveTableToDB('items', items); }
function saveEmployeesToLocalStorage() { saveTableToDB('employees', employees); }
function saveAssetsToLocalStorage() { saveTableToDB('assets', assets); }
function saveExpensesToLocalStorage() { saveTableToDB('expenses', expenses); }
function saveSettlementsToLocalStorage() { saveTableToDB('settlements', settlements); }
function savePartnersToLocalStorage() { saveTableToDB('partners', partners); }

// --- REUSABLE SIDEBAR COMPONENT ---
function loadSidebar() {
  const container = document.getElementById("sidebar-container");
  if (!container) return;

  const currentPage = window.location.pathname.split("/").pop() || "index.html";

  container.innerHTML = `
    <aside class="sidebar">
      <h2>KRISHNA CORP</h2>
      <a href="index.html" class="${currentPage === 'index.html' ? 'active' : ''}">Dashboard</a>
      <a href="inventory.html" class="${currentPage === 'inventory.html' ? 'active' : ''}">Items & Inventory</a>
      <a href="employees.html" class="${currentPage === 'employees.html' ? 'active' : ''}">Employees & Salary</a>
      <a href="company-assets.html" class="${currentPage === 'company-assets.html' ? 'active' : ''}">Company Assets</a>
      <a href="expenses.html" class="${currentPage === 'expenses.html' ? 'active' : ''}">Operating Expenses</a>
      <a href="partners.html" class="${currentPage === 'partners.html' ? 'active' : ''}">Partners & Capital</a>
    </aside>
  `;
}

// --- ENHANCED MONTH TOTALS HELPER ---
function getDetailedMonthTotals(targetMonth) {
  if (!targetMonth) {
    let rev = 0, purch = 0, sal = 0, astExp = 0, astInc = 0, opExp = 0;
    items.forEach(i => {
      const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
      if (i.type === "Sale") rev += amt;
      else purch += amt;
    });
    employees.forEach(e => { sal += (Number(e.salary) || 0); });
    assets.forEach(a => {
      const price = Number(a.price) || 0;
      if (a.type === "Purchase") astExp += price;
      else astInc += price;
    });
    expenses.forEach(ex => { opExp += (Number(ex.amount) || 0); });

    const inventoryNet = rev - purch;
    const operationalExps = sal + astExp + opExp;
    const netProfit = (inventoryNet + astInc) - operationalExps;
    return { rev, purch, sal, astExp, astInc, opExp, netProfit };
  }

  let rev = 0, purch = 0, sal = 0, astExp = 0, astInc = 0, opExp = 0;
  items.forEach(i => {
    if (i.date && i.date.startsWith(targetMonth)) {
      const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
      if (i.type === "Sale") rev += amt;
      else purch += amt;
    }
  });
  employees.forEach(e => {
    if (e.date && e.date.startsWith(targetMonth)) sal += (Number(e.salary) || 0);
  });
  assets.forEach(a => {
    if (a.date && a.date.startsWith(targetMonth)) {
      const price = Number(a.price) || 0;
      if (a.type === "Purchase") astExp += price;
      else astInc += price;
    }
  });
  expenses.forEach(ex => {
    if (ex.date && ex.date.startsWith(targetMonth)) opExp += (Number(ex.amount) || 0);
  });

  const inventoryNet = rev - purch;
  const operationalExps = sal + astExp + opExp;
  const netProfit = (inventoryNet + astInc) - operationalExps;
  return { rev, purch, sal, astExp, astInc, opExp, netProfit };
}

// --- DASHBOARD METRICS LOGIC ---
function initDashboard() {
  const kpiPartnerCapital = document.getElementById("kpiPartnerCapital");
  if (!kpiPartnerCapital) return;

  const monthFilterEl = document.getElementById("dashboardMonthFilter");
  
  if (monthFilterEl && !monthFilterEl.value) {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    monthFilterEl.value = `${year}-${month}`;
  }

  const selectedMonth = monthFilterEl ? monthFilterEl.value : "";

  let availableBalance = 0;
  let ridhamSpent = 0;
  let pankajSpent = 0;

  function matchesMonth(dateStr) {
    if (!selectedMonth) return true;
    if (!dateStr) return false;
    return dateStr.startsWith(selectedMonth);
  }

  function isUpToMonth(dateStr, targetMonth) {
    if (!targetMonth || !dateStr) return true;
    return dateStr.substring(0, 7) <= targetMonth;
  }

  items.forEach(item => {
    const amount = (Number(item.quantity) || 0) * (Number(item.price) || 0);
    if (item.type === "Sale") {
      if (item.paymentMode !== "Credit") availableBalance += amount;
    } else {
      if (item.paymentMode !== "Credit") availableBalance -= amount;
    }

    if (item.type === "Purchase") {
      const isMatch = matchesMonth(item.date);
      if (!selectedMonth || isMatch) {
        if (item.paidBy === "Ridham Patel") ridhamSpent += amount;
        else if (item.paidBy === "Pankajbhai Patel") pankajSpent += amount;
      }
    }
  });

  settlements.forEach(st => {
    const stAmt = Number(st.amount) || 0;
    if (st.type === "Receive") availableBalance += stAmt;
    else if (st.type === "Pay") availableBalance -= stAmt;
  });

  employees.forEach(emp => {
    const salaryAmt = Number(emp.salary) || 0;
    const isMatch = matchesMonth(emp.date);
    if (!selectedMonth || isMatch) {
      if (emp.paidBy === "Ridham Patel") ridhamSpent += salaryAmt;
      else if (emp.paidBy === "Pankajbhai Patel") pankajSpent += salaryAmt;
    }
    if (emp.paymentMode !== "Credit") availableBalance -= salaryAmt;
  });

  assets.forEach(ast => {
    const astPrice = Number(ast.price) || 0;
    const isMatch = matchesMonth(ast.date);
    if (!selectedMonth || isMatch) {
      if (ast.type === "Purchase") {
        if (ast.paidBy === "Ridham Patel") ridhamSpent += astPrice;
        else if (ast.paidBy === "Pankajbhai Patel") pankajSpent += astPrice;
      }
    }
    if (ast.paymentMode !== "Credit") {
      if (ast.type === "Purchase") availableBalance -= astPrice;
      else availableBalance += astPrice;
    }
  });

  expenses.forEach(exp => {
    const expAmt = Number(exp.amount) || 0;
    const isMatch = matchesMonth(exp.date);
    if (!selectedMonth || isMatch) {
      if (exp.paidBy === "Ridham Patel") ridhamSpent += expAmt;
      else if (exp.paidBy === "Pankajbhai Patel") pankajSpent += expAmt;
    }
    if (exp.paymentMode !== "Credit") availableBalance -= expAmt;
  });

  let rollingCapital = 0;
  let lifetimeCapital = 0;
  
  partners.forEach(part => {
    const partAmt = Number(part.amount) || 0;
    const type = part.type || "Investment";
    
    if (type === "Withdrawal") {
      lifetimeCapital -= partAmt;
      if (!selectedMonth || isUpToMonth(part.date, selectedMonth)) rollingCapital -= partAmt;
      availableBalance -= partAmt;
    } else if (type === "Settlement Receive") {
      availableBalance += partAmt;
    } else if (type === "Settlement Pay") {
      availableBalance -= partAmt;
    } else {
      lifetimeCapital += partAmt;
      if (!selectedMonth || isUpToMonth(part.date, selectedMonth)) rollingCapital += partAmt;
      availableBalance += partAmt;
    }
  });

  let allTimeRidhamSpent = 0;
  let allTimePankajSpent = 0;

  items.forEach(i => {
    if (i.type === "Purchase") {
      const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
      if (i.paidBy === "Ridham Patel") allTimeRidhamSpent += amt;
      else if (i.paidBy === "Pankajbhai Patel") allTimePankajSpent += amt;
    }
  });
  employees.forEach(e => {
    const amt = Number(e.salary) || 0;
    if (e.paidBy === "Ridham Patel") allTimeRidhamSpent += amt;
    else if (e.paidBy === "Pankajbhai Patel") allTimePankajSpent += amt;
  });
  assets.forEach(a => {
    if (a.type === "Purchase") {
      const amt = Number(a.price) || 0;
      if (a.paidBy === "Ridham Patel") allTimeRidhamSpent += amt;
      else if (a.paidBy === "Pankajbhai Patel") allTimePankajSpent += amt;
    }
  });
  expenses.forEach(ex => {
    const amt = Number(ex.amount) || 0;
    if (ex.paidBy === "Ridham Patel") allTimeRidhamSpent += amt;
    else if (ex.paidBy === "Pankajbhai Patel") allTimePankajSpent += amt;
  });

  lifetimeCapital += (allTimeRidhamSpent + allTimePankajSpent);
  if (!selectedMonth) {
    rollingCapital += (allTimeRidhamSpent + allTimePankajSpent);
  } else {
    let rollingSpent = 0;
    items.forEach(i => {
      if (i.date && i.date.substring(0, 7) <= selectedMonth && i.type === "Purchase") {
        const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
        if (i.paidBy === "Ridham Patel" || i.paidBy === "Pankajbhai Patel") rollingSpent += amt;
      }
    });
    rollingCapital += rollingSpent;
  }

  if (selectedMonth) {
    let historicalOutflows = 0;
    let historicalInflows = 0;

    items.forEach(i => {
      if (i.date && i.date.substring(0, 7) <= selectedMonth && i.paymentMode !== "Credit") {
        const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
        if (i.type === "Sale") historicalInflows += amt;
        else historicalOutflows += amt;
      }
    });
    employees.forEach(e => {
      if (e.date && e.date.substring(0, 7) <= selectedMonth && e.paymentMode !== "Credit") {
        historicalOutflows += (Number(e.salary) || 0);
      }
    });
    assets.forEach(a => {
      if (a.date && a.date.substring(0, 7) <= selectedMonth && a.paymentMode !== "Credit") {
        const price = Number(a.price) || 0;
        if (a.type === "Purchase") historicalOutflows += price;
        else historicalInflows += price;
      }
    });
    expenses.forEach(ex => {
      if (ex.date && ex.date.substring(0, 7) <= selectedMonth && ex.paymentMode !== "Credit") {
        historicalOutflows += (Number(ex.amount) || 0);
      }
    });

    rollingCapital = rollingCapital + historicalInflows - historicalOutflows;
  }

  if (selectedMonth) {
    const [year, month] = selectedMonth.split("-").map(Number);
    let prevMonthNum = month - 1;
    let prevYearNum = year;
    if (prevMonthNum === 0) {
      prevMonthNum = 12;
      prevYearNum -= 1;
    }
    const prevMonthStr = `${prevYearNum}-${String(prevMonthNum).padStart(2, '0')}`;

    const curr = getDetailedMonthTotals(selectedMonth);
    const prev = getDetailedMonthTotals(prevMonthStr);

    const revDiff = curr.rev - prev.rev;
    const expCurrTotal = curr.purch + curr.sal + curr.astExp + curr.opExp;
    const expPrevTotal = prev.purch + prev.sal + prev.astExp + prev.opExp;
    const expDiff = expCurrTotal - expPrevTotal;
    const netProfitDiff = curr.netProfit - prev.netProfit;

    const elCurrRev = document.getElementById("compCurrentRevenue");
    const elCurrExp = document.getElementById("compCurrentExpense");
    const elCurrNetProfit = document.getElementById("compCurrentNetProfit");

    const elRevDiff = document.getElementById("compRevenueDiff");
    const elExpDiff = document.getElementById("compExpenseDiff");
    const elNetProfitDiff = document.getElementById("compNetProfitDiff");

    if (elCurrRev) elCurrRev.textContent = money(curr.rev);
    if (elCurrExp) elCurrExp.textContent = money(expCurrTotal);
    if (elCurrNetProfit) {
      elCurrNetProfit.textContent = money(curr.netProfit);
      elCurrNetProfit.className = curr.netProfit >= 0 ? "green" : "red";
    }

    if (elRevDiff) elRevDiff.textContent = `${revDiff >= 0 ? '+' : ''}${money(revDiff)} vs prev month`;
    if (elExpDiff) elExpDiff.textContent = `${expDiff >= 0 ? '+' : ''}${money(expDiff)} vs prev month`;
    if (elNetProfitDiff) elNetProfitDiff.textContent = `${netProfitDiff >= 0 ? '+' : ''}${money(netProfitDiff)} vs prev month`;
  } else {
    const curr = getDetailedMonthTotals("");
    const expCurrTotal = curr.purch + curr.sal + curr.astExp + curr.opExp;

    const elCurrRev = document.getElementById("compCurrentRevenue");
    const elCurrExp = document.getElementById("compCurrentExpense");
    const elCurrNetProfit = document.getElementById("compCurrentNetProfit");

    if (elCurrRev) elCurrRev.textContent = money(curr.rev);
    if (elCurrExp) elCurrExp.textContent = money(expCurrTotal);
    if (elCurrNetProfit) {
      elCurrNetProfit.textContent = money(curr.netProfit);
      elCurrNetProfit.className = curr.netProfit >= 0 ? "green" : "red";
    }
  }

  const elPartnerCap = document.getElementById("kpiPartnerCapital");
  const elRidham = document.getElementById("kpiRidhamSpent");
  const elPankaj = document.getElementById("kpiPankajSpent");
  const elBalance = document.getElementById("kpiBalance");

  if (elPartnerCap) elPartnerCap.textContent = money(selectedMonth ? rollingCapital : lifetimeCapital);
  if (elRidham) elRidham.textContent = money(ridhamSpent);
  if (elPankaj) elPankaj.textContent = money(pankajSpent);
  if (elBalance) elBalance.textContent = money(availableBalance);
  
  // Refresh chart on filter change if present
  initMultiMonthChart();
}

// --- 6-MONTH FINANCIAL TREND CHART ---
function initMultiMonthChart() {
  const canvas = document.getElementById("multiMonthChart");
  if (!canvas || !window.Chart) return;

  const labels = [];
  const revenueData = [];
  const expenseData = [];

  const now = new Date();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const monthStr = `${year}-${month}`;
    
    const monthLabel = d.toLocaleString('default', { month: 'short', year: 'numeric' });
    labels.push(monthLabel);

    const totals = getDetailedMonthTotals(monthStr);
    const totalExp = totals.purch + totals.sal + totals.astExp + totals.opExp;

    revenueData.push(totals.rev);
    expenseData.push(totalExp);
  }

  if (multiMonthChartInstance) {
    multiMonthChartInstance.destroy();
  }

  multiMonthChartInstance = new Chart(canvas.getContext("2d"), {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Revenue (₹)',
          data: revenueData,
          backgroundColor: '#16a34a',
          borderRadius: 4
        },
        {
          label: 'Expenses (₹)',
          data: expenseData,
          backgroundColor: '#dc2626',
          borderRadius: 4
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: function(value) {
              return '₹' + Number(value).toLocaleString('en-IN');
            }
          }
        }
      }
    }
  });
}

// --- KPI & BREAKDOWN MODALS ---
function closeKpiModal() { const m = document.getElementById("kpiModal"); if (m) m.style.display = "none"; }
function closeRevenueModal() { const m = document.getElementById("revenueModal"); if (m) m.style.display = "none"; }
function closeExpenseModal() { const m = document.getElementById("expenseModal"); if (m) m.style.display = "none"; }
function closeNetProfitModal() { const m = document.getElementById("netProfitModal"); if (m) m.style.display = "none"; }

// Close modals when clicking outside content box on backdrop
window.addEventListener("click", (event) => {
  const modalIds = ["kpiModal", "revenueModal", "expenseModal", "netProfitModal"];
  modalIds.forEach(id => {
    const modal = document.getElementById(id);
    if (modal && event.target === modal) {
      modal.style.display = "none";
    }
  });
});

function showPartnerCapitalBreakdown() {
  const selectedMonth = document.getElementById("dashboardMonthFilter")?.value || "";
  const modal = document.getElementById("kpiModal");
  const modalTitle = document.getElementById("modalKpiTitle");
  const modalContent = document.getElementById("modalKpiContent");
  
  if (!modal || !modalContent) return;

  if (modalTitle) {
    modalTitle.textContent = selectedMonth ? `Partner Capital & Full Breakdown (${selectedMonth})` : `Partner Capital & Full Breakdown (All-Time)`;
  }
  
  let partnerMap = {};

  ['Ridham Patel', 'Pankajbhai Patel'].forEach(name => {
    partnerMap[name] = { investments: 0, withdrawals: 0, spent: 0 };
  });

  partners.forEach(p => {
    if (p.name) {
      const name = p.name.trim();
      if (!partnerMap[name]) {
        partnerMap[name] = { investments: 0, withdrawals: 0, spent: 0 };
      }
      const amt = Number(p.amount) || 0;
      const type = p.type || "Investment";
      if (type === "Withdrawal") partnerMap[name].withdrawals += amt;
      else if (type === "Investment") partnerMap[name].investments += amt;
    }
  });

  const isUpTo = (d, m) => !m || !d || d.substring(0, 7) <= m;

  let inflowRecords = [];
  let outflowRecords = [];
  let partnerRecords = [];
  let totalInflows = 0;
  let totalOutflows = 0;

  partners.forEach(p => {
    if (!selectedMonth || isUpTo(p.date, selectedMonth)) {
      const amt = Number(p.amount) || 0;
      const type = p.type || "Investment";
      partnerRecords.push({ date: p.date, type, name: p.name, amount: amt, mode: p.paymentMode });
    }
  });

  items.forEach(i => {
    if (!selectedMonth || isUpTo(i.date, selectedMonth)) {
      const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
      const paidBy = i.paidBy ? i.paidBy.trim() : "";
      if (i.type === "Purchase" && partnerMap[paidBy]) {
        partnerMap[paidBy].spent += amt;
      }

      if (i.paymentMode !== "Credit") {
        if (i.type === "Sale") {
          totalInflows += amt;
          inflowRecords.push({ date: i.date, desc: `Inventory Sale: ${i.product} (${i.partyName})`, amt });
        } else {
          totalOutflows += amt;
          outflowRecords.push({ date: i.date, desc: `Inventory Purchase: ${i.product} (${i.partyName})`, amt });
        }
      }
    }
  });

  employees.forEach(e => {
    if (!selectedMonth || isUpTo(e.date, selectedMonth)) {
      const amt = Number(e.salary) || 0;
      const paidBy = e.paidBy ? e.paidBy.trim() : "";
      if (partnerMap[paidBy]) {
        partnerMap[paidBy].spent += amt;
      }
      if (e.paymentMode !== "Credit") {
        totalOutflows += amt;
        outflowRecords.push({ date: e.date, desc: `Employee Salary: ${e.name}`, amt });
      }
    }
  });

  assets.forEach(a => {
    if (!selectedMonth || isUpTo(a.date, selectedMonth)) {
      const amt = Number(a.price) || 0;
      const paidBy = a.paidBy ? a.paidBy.trim() : "";
      if (a.type === "Purchase" && partnerMap[paidBy]) {
        partnerMap[paidBy].spent += amt;
      }
      if (a.paymentMode !== "Credit") {
        if (a.type === "Purchase") {
          totalOutflows += amt;
          outflowRecords.push({ date: a.date, desc: `Asset Purchase: ${a.name}`, amt });
        } else {
          totalInflows += amt;
          inflowRecords.push({ date: a.date, desc: `Asset Sale: ${a.name}`, amt });
        }
      }
    }
  });

  expenses.forEach(ex => {
    if (!selectedMonth || isUpTo(ex.date, selectedMonth)) {
      const amt = Number(ex.amount) || 0;
      const paidBy = ex.paidBy ? ex.paidBy.trim() : "";
      if (partnerMap[paidBy]) {
        partnerMap[paidBy].spent += amt;
      }
      if (ex.paymentMode !== "Credit") {
        totalOutflows += amt;
        outflowRecords.push({ date: ex.date, desc: `Operating Exp (${ex.category}): ${ex.description}`, amt });
      }
    }
  });

  let partnerSummaryRows = "";
  let grandTotalNetCapital = 0;
  let totalNetCapitalSum = 0;

  Object.keys(partnerMap).forEach(name => {
    const data = partnerMap[name];
    const netCapital = data.investments - data.withdrawals;
    const totalPool = netCapital + data.spent;
    totalNetCapitalSum += netCapital;
    grandTotalNetCapital += totalPool;

    partnerSummaryRows += `
      <tr style="border-bottom: 1px solid #e2e8f0;">
        <td style="padding: 8px; font-weight: bold; color: #1e293b;">${name}</td>
        <td style="padding: 8px; text-align: right; color: #16a34a;">+${money(data.investments)}</td>
        <td style="padding: 8px; text-align: right; color: #dc2626;">-${money(data.withdrawals)}</td>
        <td style="padding: 8px; text-align: right; color: #d97706;">+${money(data.spent)}</td>
        <td style="padding: 8px; text-align: right; font-weight: bold; color: #2563eb;">${money(totalPool)}</td>
      </tr>
    `;
  });

  const availableLiquidityBalance = (totalNetCapitalSum + totalInflows) - totalOutflows;

  modalContent.innerHTML = `
    <h4 style="font-size: 13px; color: #1e293b; margin-bottom: 8px;">Partner Summary (${selectedMonth ? selectedMonth : 'All-Time'}):</h4>
    <div style="overflow-x: auto; margin-bottom: 15px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">Partner Name</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Investments</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">Withdrawals</th>
            <th style="border: 1px solid #cbd5e1; padding: 6px; text-align: right;">All-Time Spent</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Total Pool</th>
          </tr>
        </thead>
        <tbody>
          ${partnerSummaryRows}
          <tr style="background: #f8fafc; font-weight: bold;">
            <td colspan="4" style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Total Investment Pool:</td>
            <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #2563eb;">${money(grandTotalNetCapital)}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <h4 style="font-size: 13px; color: #1e293b; margin-bottom: 8px;">Available Liquidity Balance:</h4>
    <div style="background: #f8fafc; padding: 12px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 15px; font-size: 12px;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px;"><span>Total Net Partner Capital (+):</span> <b>${money(totalNetCapitalSum)}</b></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #16a34a;"><span>Total Inflows (+):</span> <b>+${money(totalInflows)}</b></div>
      <div style="display: flex; justify-content: space-between; margin-bottom: 4px; color: #dc2626;"><span>Total Outflows (-):</span> <b>-${money(totalOutflows)}</b></div>
      <div style="display: flex; justify-content: space-between; font-size: 13px; font-weight: bold; border-top: 1px solid #cbd5e1; padding-top: 6px; margin-top: 4px; color: #16a34a;">
        <span>Net Available Liquidity Balance:</span> <span>${money(availableLiquidityBalance)}</span>
      </div>
    </div>
  `;
  modal.style.display = "flex";
}

function showPartnerSpentBreakdown(partnerName) {
  const selectedMonth = document.getElementById("dashboardMonthFilter")?.value || "";
  const modal = document.getElementById("kpiModal");
  if (!modal) return;
  document.getElementById("modalKpiTitle").textContent = `${partnerName}'s Expenses Breakdown ${selectedMonth ? '(' + selectedMonth + ')' : ''}`;

  let spentRecords = [], totalSpent = 0;
  const matches = d => !selectedMonth || (d && d.startsWith(selectedMonth));

  items.forEach(i => {
    if (i.type === "Purchase" && i.paidBy === partnerName && matches(i.date)) {
      const amt = (Number(i.quantity) || 0) * (Number(i.price) || 0);
      totalSpent += amt;
      spentRecords.push({ date: i.date, cat: "Inventory Purchase", desc: `${i.product} (${i.partyName})`, amt });
    }
  });
  employees.forEach(e => {
    if (e.paidBy === partnerName && matches(e.date)) {
      const amt = Number(e.salary) || 0;
      totalSpent += amt;
      spentRecords.push({ date: e.date, cat: "Employee Salary", desc: `Salary for ${e.name}`, amt });
    }
  });
  assets.forEach(a => {
    if (a.type === "Purchase" && a.paidBy === partnerName && matches(a.date)) {
      const amt = Number(a.price) || 0;
      totalSpent += amt;
      spentRecords.push({ date: a.date, cat: "Company Asset", desc: a.name, amt });
    }
  });
  expenses.forEach(ex => {
    if (ex.paidBy === partnerName && matches(ex.date)) {
      const amt = Number(ex.amount) || 0;
      totalSpent += amt;
      spentRecords.push({ date: ex.date, cat: `Operating Exp (${ex.category})`, desc: ex.description, amt });
    }
  });

  spentRecords.sort((a, b) => new Date(a.date) - new Date(b.date));

  let rowsHtml = spentRecords.map(r => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.date}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px;"><b>${r.cat}</b></td>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">${r.desc}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #d97706;">${money(r.amt)}</td>
    </tr>
  `).join('');

  document.getElementById("modalKpiContent").innerHTML = spentRecords.length === 0 ? `<p style="text-align: center; color: #64748b; padding: 20px;">No expenses found for ${partnerName}.</p>` : `
    <div style="max-height: 300px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="background: #f1f5f9;"><th style="border: 1px solid #cbd5e1; padding: 8px;">Date</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Category</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Description</th><th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Amount</th></tr></thead>
        <tbody>${rowsHtml}<tr style="background: #f8fafc; font-weight: bold;"><td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Total Spent:</td><td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: #d97706;">${money(totalSpent)}</td></tr></tbody>
      </table>
    </div>
  `;
  modal.style.display = "flex";
}

function showLiquidityBreakdown() {
  const selectedMonth = document.getElementById("dashboardMonthFilter")?.value || "";
  const modal = document.getElementById("kpiModal");
  if (!modal) return;
  document.getElementById("modalKpiTitle").textContent = selectedMonth ? `Liquidity Breakdown (${selectedMonth})` : `Liquidity Breakdown (All-Time)`;

  let inflows = 0, outflows = 0, flows = [];
  const matches = d => !selectedMonth || (d && d.startsWith(selectedMonth));

  partners.forEach(p => { 
    if (matches(p.date)) { 
      const amt = Number(p.amount) || 0;
      if (p.type === "Withdrawal") {
        outflows += amt;
        flows.push({date: p.date, type:'Outflow (-)', cat:'Partner Withdrawal', desc:p.name, amt});
      } else {
        inflows += amt;
        flows.push({date: p.date, type:'Inflow (+)', cat:'Partner Capital', desc:p.name, amt});
      }
    } 
  });

  items.forEach(i => { if (i.type==="Sale" && i.paymentMode!=="Credit" && matches(i.date)) { const a=(Number(i.quantity)||0)*(Number(i.price)||0); inflows+=a; flows.push({date:i.date, type:'Inflow (+)', cat:'Inventory Sale', desc:`${i.product} (${i.partyName})`, amt:a}); } });
  assets.forEach(a => { if (a.type==="Sale" && a.paymentMode!=="Credit" && matches(a.date)) { inflows+=Number(a.price)||0; flows.push({date:a.date, type:'Inflow (+)', cat:'Asset Sale', desc:a.name, amt:a.price}); } });

  items.forEach(i => { if (i.type==="Purchase" && i.paymentMode!=="Credit" && matches(i.date)) { const a=(Number(i.quantity)||0)*(Number(i.price)||0); outflows+=a; flows.push({date:i.date, type:'Outflow (-)', cat:'Inventory Purchase', desc:`${i.product} (${i.partyName})`, amt:a}); } });
  employees.forEach(e => { if (e.paymentMode!=="Credit" && matches(e.date)) { outflows+=Number(e.salary)||0; flows.push({date:e.date, type:'Outflow (-)', cat:'Salary Paid', desc:e.name, amt:e.salary}); } });
  assets.forEach(a => { if (a.type==="Purchase" && a.paymentMode!=="Credit" && matches(a.date)) { outflows+=Number(a.price)||0; flows.push({date:a.date, type:'Outflow (-)', cat:'Asset Purchase', desc:a.name, amt:a.price}); } });
  expenses.forEach(ex => { if (ex.paymentMode!=="Credit" && matches(ex.date)) { outflows+=Number(ex.amount)||0; flows.push({date:ex.date, type:'Outflow (-)', cat:`Operating Exp`, desc:ex.description, amt:ex.amount}); } });

  flows.sort((a, b) => new Date(a.date) - new Date(b.date));

  const net = inflows - outflows;
  let rowsHtml = flows.map(f => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">${f.date}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; font-weight: bold; color: ${f.type.includes('Inflow')?'#16a34a':'#dc2626'};">${f.type}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px;"><b>${f.cat}</b>: ${f.desc}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: ${f.type.includes('Inflow')?'#16a34a':'#dc2626'};">${money(f.amt)}</td>
    </tr>
  `).join('');

  document.getElementById("modalKpiContent").innerHTML = `
    <div style="max-height: 320px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="background: #f1f5f9;"><th style="border: 1px solid #cbd5e1; padding: 8px;">Date</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Type</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Description</th><th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Amount</th></tr></thead>
        <tbody>${rowsHtml || '<tr><td colspan="4" style="text-align:center; padding:15px;">No cash flow records.</td></tr>'}
        <tr style="background: #f8fafc; font-weight: bold;"><td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Net Liquidity Change:</td><td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: ${net>=0?'#16a34a':'#dc2626'};">${money(net)}</td></tr></tbody>
      </table>
    </div>
  `;
  modal.style.display = "flex";
}

function showRevenueBreakdown() {
  const selectedMonth = document.getElementById("dashboardMonthFilter")?.value || "";
  const modal = document.getElementById("revenueModal");
  if (!modal) return;
  document.getElementById("modalRevenueTitle").textContent = selectedMonth ? `Revenue Breakdown (${selectedMonth})` : `Revenue Breakdown (All-Time)`;

  let records = [], totalRev = 0;
  items.forEach(i => {
    if (i.type === "Sale" && (!selectedMonth || i.date?.startsWith(selectedMonth))) {
      const line = (Number(i.quantity)||0)*(Number(i.price)||0);
      totalRev += line;
      records.push({ date: i.date, party: i.partyName, product: i.product, qty: i.quantity, price: i.price, total: line, mode: i.paymentMode });
    }
  });

  records.sort((a, b) => new Date(a.date) - new Date(b.date));

  let rowsHtml = records.map(s => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">${s.date}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px;"><b>${s.party}</b></td>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">${s.product} (${s.qty} × ${money(s.price)})</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #16a34a;">${money(s.total)}</td>
    </tr>
  `).join('');

  document.getElementById("modalRevenueContent").innerHTML = records.length === 0 ? `<p style="text-align:center; padding:20px;">No sales found.</p>` : `
    <div style="max-height: 300px; overflow-y: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead><tr style="background: #f1f5f9;"><th style="border: 1px solid #cbd5e1; padding: 8px;">Date</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Customer</th><th style="border: 1px solid #cbd5e1; padding: 8px;">Product</th><th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Total</th></tr></thead>
        <tbody>${rowsHtml}<tr style="background: #f8fafc; font-weight: bold;"><td colspan="3" style="border: 1px solid #cbd5e1; padding: 10px; text-align: right;">Total Revenue:</td><td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: #2563eb;">${money(totalRev)}</td></tr></tbody>
      </table>
    </div>
  `;
  modal.style.display = "flex";
}

function showMonthlyExpenseBreakdown() {
  const selectedMonth = document.getElementById("dashboardMonthFilter")?.value || "";
  const modal = document.getElementById("expenseModal");
  if (!modal) return;
  document.getElementById("modalExpenseTitle").textContent = selectedMonth ? `Expense Breakdown (${selectedMonth})` : `Expense Breakdown (All-Time)`;

  let purch = 0, sal = 0, astExp = 0, opExp = 0;
  const matches = d => !selectedMonth || (d && d.startsWith(selectedMonth));

  items.forEach(i => { if (i.type === "Purchase" && matches(i.date)) purch += (Number(i.quantity)||0)*(Number(i.price)||0); });
  employees.forEach(e => { if (matches(e.date)) sal += Number(e.salary)||0; });
  assets.forEach(a => { if (a.type === "Purchase" && matches(a.date)) astExp += Number(a.price)||0; });
  expenses.forEach(ex => { if (matches(ex.date)) opExp += Number(ex.amount)||0; });
  const total = purch + sal + astExp + opExp;

  document.getElementById("modalExpenseContent").innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead><tr style="background: #f1f5f9;"><th style="border: 1px solid #cbd5e1; padding: 8px;">Category</th><th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Amount</th></tr></thead>
      <tbody>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Inventory Purchases</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">${money(purch)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Employee Salaries</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">${money(sal)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Asset Purchases</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">${money(astExp)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Operating Expenses</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">${money(opExp)}</td></tr>
        <tr style="background: #f8fafc; font-weight: bold;"><td style="border: 1px solid #cbd5e1; padding: 10px;">Total Outflow:</td><td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: #0f172a;">${money(total)}</td></tr>
      </tbody>
    </table>
  `;
  modal.style.display = "flex";
}

function showNetProfitBreakdown() {
  const selectedMonth = document.getElementById("dashboardMonthFilter")?.value || "";
  const modal = document.getElementById("netProfitModal");
  if (!modal) return;
  document.getElementById("modalNetProfitTitle").textContent = selectedMonth ? `Net Profit Calculation (${selectedMonth})` : `Net Profit Calculation (All-Time)`;

  const data = getDetailedMonthTotals(selectedMonth);
  document.getElementById("modalNetProfitContent").innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead><tr style="background: #f1f5f9;"><th style="border: 1px solid #cbd5e1; padding: 8px;">Component</th><th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Amount</th></tr></thead>
      <tbody>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Sales Revenue (+)</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #16a34a;">${money(data.rev)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Inventory Purchases (-)</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">-${money(data.purch)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Employee Salaries (-)</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">-${money(data.sal)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Assets Net (Inc - Exp)</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: ${data.astInc - data.astExp >= 0 ? '#16a34a':'#dc2626'};">${money(data.astInc - data.astExp)}</td></tr>
        <tr><td style="border: 1px solid #cbd5e1; padding: 8px;">Operating Expenses (-)</td><td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #dc2626;">-${money(data.opExp)}</td></tr>
        <tr style="background: #f8fafc; font-weight: bold; font-size: 14px;"><td style="border: 1px solid #cbd5e1; padding: 10px;">Net Profit:</td><td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: ${data.netProfit>=0?'#16a34a':'#dc2626'};">${money(data.netProfit)}</td></tr>
      </tbody>
    </table>
  `;
  modal.style.display = "flex";
}

// --- DYNAMIC TRANSACTION TYPE HANDLER FOR INVENTORY ---
function handleTransactionTypeChange() {
  const typeSelect = document.getElementById("transactionType");
  const defaultOption = document.getElementById("defaultPaidByOption");

  if (!typeSelect || !defaultOption) return;

  if (typeSelect.value === "Sale") {
    defaultOption.textContent = "Deposited To Account";
  } else if (typeSelect.value === "Purchase") {
    defaultOption.textContent = "Paid By Account";
  } else {
    defaultOption.textContent = "Select Account";
  }
}

// --- INVENTORY PAGE LOGIC ---
function initInventory() {
  const salesTable = document.getElementById("salesTable");
  const purchasesTable = document.getElementById("purchasesTable");
  if (!salesTable && !purchasesTable) return;

  let totalSales = 0, totalPurchases = 0;
  items.forEach(item => {
    const amt = (Number(item.quantity) || 0) * (Number(item.price) || 0);
    if (item.type === "Sale") totalSales += amt;
    else if (item.type === "Purchase") totalPurchases += amt;
  });
  const invNetProfit = totalSales - totalPurchases;

  if (document.getElementById("invTotalRevenue")) document.getElementById("invTotalRevenue").textContent = money(totalSales);
  if (document.getElementById("invTotalInvestment")) document.getElementById("invTotalInvestment").textContent = money(totalPurchases);
  const profitEl = document.getElementById("inventoryNetProfit");
  if (profitEl) { profitEl.textContent = money(invNetProfit); profitEl.className = invNetProfit >= 0 ? "blue" : "red"; }

  const saleSearchText = document.getElementById("saleSearch")?.value.toLowerCase() || "";
  const purchaseSearchText = document.getElementById("purchaseSearch")?.value.toLowerCase() || "";
  const stockFilter = document.getElementById("stockFilter")?.value || "All";
  const submitBtn = document.getElementById("formSubmitBtn");

  if (editIndex !== null && submitBtn) {
    submitBtn.textContent = "Update Entry";
    const item = items[editIndex];
    if (item && document.getElementById("itemName").value === "") {
      document.getElementById("itemDate").value = item.date;
      document.getElementById("transactionType").value = item.type;
      handleTransactionTypeChange();
      document.getElementById("itemParty").value = item.partyName;
      document.getElementById("itemName").value = item.product;
      document.getElementById("itemQuantity").value = item.quantity;
      document.getElementById("itemPrice").value = item.price;
      document.getElementById("billNumber").value = item.billNumber;
      document.getElementById("itemPaidBy").value = item.paidBy || "Krishna Corp";
      document.getElementById("paymentMode").value = item.paymentMode;
    }
  } else if (submitBtn) {
    submitBtn.textContent = "Add Entry";
  }

  if (salesTable) salesTable.innerHTML = "";
  if (purchasesTable) purchasesTable.innerHTML = "";

  const indexedItems = items.map((item, originalIndex) => ({ ...item, originalIndex }));
  indexedItems.sort((a, b) => new Date(a.date) - new Date(b.date));

  const salesList = indexedItems.filter(item => item.type === "Sale").filter(item => 
    item.product.toLowerCase().includes(saleSearchText) || item.partyName.toLowerCase().includes(saleSearchText) || item.billNumber.toLowerCase().includes(saleSearchText)
  );

  const purchaseList = indexedItems.filter(item => item.type === "Purchase").filter(item => {
    const matchesSearch = item.product.toLowerCase().includes(purchaseSearchText) || item.partyName.toLowerCase().includes(purchaseSearchText) || item.billNumber.toLowerCase().includes(purchaseSearchText);
    let matchesFilter = true;
    if (stockFilter === "In Stock") matchesFilter = item.quantity > 5;
    else if (stockFilter === "Low Stock") matchesFilter = item.quantity > 0 && item.quantity <= 5;
    else if (stockFilter === "Out of Stock") matchesFilter = item.quantity === 0;
    return matchesSearch && matchesFilter;
  });

  if (salesTable) {
    if (salesList.length === 0) {
      salesTable.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b;">No sales records found.</td></tr>`;
    } else {
      salesList.forEach(item => {
        const row = document.createElement("tr");
        const amount = item.quantity * item.price;
        row.innerHTML = `
          <td>${item.date}</td>
          <td><b>${item.partyName}</b></td>
          <td>${item.product}</td>
          <td>${item.quantity}</td>
          <td>${money(item.price)}</td>
          <td>${money(amount)}</td>
          <td>${item.billNumber}</td>
          <td><b>${item.paidBy || "Krishna Corp"}</b></td>
          <td>${item.paymentMode}</td>
          <td>
            <button class="action-btn edit-btn" onclick="editItem(${item.originalIndex})">Edit</button>
            <button class="action-btn delete-btn" onclick="deleteItem(${item.originalIndex})">Delete</button>
            <button class="action-btn" style="background: #16a34a; color: white;" onclick="printBill(${item.originalIndex})">Bill</button>
          </td>
        `;
        salesTable.appendChild(row);
      });
    }
  }

  if (purchasesTable) {
    if (purchaseList.length === 0) {
      purchasesTable.innerHTML = `<tr><td colspan="10" style="text-align: center; color: #64748b;">No purchase records found.</td></tr>`;
    } else {
      purchaseList.forEach(item => {
        const row = document.createElement("tr");
        const amount = item.quantity * item.price;
        row.innerHTML = `
          <td>${item.date}</td>
          <td><b>${item.partyName}</b></td>
          <td>${item.product}</td>
          <td>${item.quantity}</td>
          <td>${money(item.price)}</td>
          <td>${money(amount)}</td>
          <td>${item.billNumber}</td>
          <td><b>${item.paidBy || "Krishna Corp"}</b></td>
          <td>${item.paymentMode}</td>
          <td>
            <button class="action-btn edit-btn" onclick="editItem(${item.originalIndex})">Edit</button>
            <button class="action-btn delete-btn" onclick="deleteItem(${item.originalIndex})">Delete</button>
          </td>
        `;
        purchasesTable.appendChild(row);
      });
    }
  }
}

function printBill(index) {
  const item = items[index];
  if (!item || item.type !== "Sale") return;
  const grandTotal = Math.round(item.quantity * item.price);

  const billWindow = window.open('', '_blank');
  billWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Invoice - ${item.billNumber}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 30px; color: #1e293b; max-width: 800px; margin: auto; line-height: 1.5; }
        .header { text-align: center; margin-bottom: 25px; border-bottom: 2px solid #2563eb; padding-bottom: 15px; }
        .header h1 { margin: 0; color: #2563eb; font-size: 26px; }
        .header p { margin: 4px 0; font-size: 13px; color: #475569; }
        .invoice-info { display: flex; justify-content: space-between; margin-bottom: 20px; font-size: 14px; background: #f8fafc; padding: 15px; border-radius: 8px; border: 1px solid #e2e8f0; }
        table { width: 100%; border-collapse: collapse; margin-top: 20px; }
        th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; font-size: 13px; }
        th { background: #f1f5f9; color: #0f172a; }
        .totals-box { margin-top: 20px; float: right; width: 300px; font-size: 14px; }
        .totals-box div { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #e2e8f0; }
        .totals-box div.grand { font-weight: bold; font-size: 16px; border-bottom: 2px solid #0f172a; color: #0f172a; margin-top: 5px; }
        .footer { clear: both; text-align: center; margin-top: 80px; font-size: 12px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 15px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>KRISHNA CORP</h1>
        <p><b>Address:</b> Survey No.29 Plot No.13, B/H Navjivan Way Bridge, Idar Highway, Dhandha, Himmatnagar</p>
      </div>
      <div class="invoice-info">
        <div><p><b>Bill Number:</b> ${item.billNumber}</p><p><b>Date:</b> ${item.date}</p></div>
        <div style="text-align: right;"><p><b>Customer:</b> ${item.partyName}</p><p><b>Payment Mode:</b> ${item.paymentMode}</p></div>
      </div>
      <table>
        <thead><tr><th>Product Description</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
        <tbody><tr><td>${item.product}</td><td>${item.quantity}</td><td>${Math.round(item.price)}</td><td>${grandTotal}</td></tr></tbody>
      </table>
      <div class="totals-box"><div class="grand"><span>Grand Total:</span> <span>₹${grandTotal.toLocaleString('en-IN')}</span></div></div>
      <div class="footer"><p>This is a computer-generated invoice for Krishna Corp.</p></div>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  billWindow.document.close();
}

// --- EMPLOYEES PAGE LOGIC ---
function populateEmployeeDropdown(selectedName = "") {
  const selectEl = document.getElementById("empNameSelect");
  const newInput = document.getElementById("empNameNew");
  if (!selectEl) return;

  let uniqueNames = [...new Set(employees.map(e => e.name.trim()))].sort();
  selectEl.innerHTML = `<option value="">Select Employee</option><option value="NEW_EMP">+ Add New Employee...</option>`;
  uniqueNames.forEach(name => {
    const opt = document.createElement("option"); opt.value = name; opt.textContent = name; selectEl.appendChild(opt);
  });

  if (selectedName) {
    if (uniqueNames.includes(selectedName)) { selectEl.value = selectedName; newInput.style.display = "none"; newInput.required = false; }
    else { selectEl.value = "NEW_EMP"; newInput.style.display = "block"; newInput.required = true; newInput.value = selectedName; }
  } else { selectEl.value = ""; newInput.style.display = "none"; newInput.required = false; }
}

function handleEmpNameChange() {
  const selectEl = document.getElementById("empNameSelect");
  const newInput = document.getElementById("empNameNew");
  if (selectEl.value === "NEW_EMP") { newInput.style.display = "block"; newInput.required = true; newInput.focus(); }
  else { newInput.style.display = "none"; newInput.required = false; newInput.value = ""; }
}

function initEmployees() {
  const table = document.getElementById("empTable");
  const summaryTable = document.getElementById("empSummaryTable");
  if (!table) return;

  let totalSalariesPaid = 0;
  let employeeTotals = {};

  employees.forEach(emp => {
    totalSalariesPaid += Number(emp.salary) || 0;
    const name = emp.name.trim();
    employeeTotals[name] = (employeeTotals[name] || 0) + (Number(emp.salary) || 0);
  });

  if (document.getElementById("empTotalSalary")) document.getElementById("empTotalSalary").textContent = money(totalSalariesPaid);

  populateEmployeeDropdown();

  if (summaryTable) {
    summaryTable.innerHTML = "";
    const empNames = Object.keys(employeeTotals).sort();
    if (empNames.length === 0) {
      summaryTable.innerHTML = `<tr><td colspan="2" style="text-align: center; color: #64748b;">No employee summary records found.</td></tr>`;
    } else {
      empNames.forEach(name => {
        const row = document.createElement("tr");
        row.style.cursor = "pointer";
        row.title = "Click to view monthly breakdown";
        row.onclick = () => showEmployeeMonthlyBreakdown(name);
        row.innerHTML = `
          <td><b style="color: #2563eb;">${name} 🔍</b></td>
          <td>${money(employeeTotals[name])}</td>
        `;
        summaryTable.appendChild(row);
      });
    }
  }

  const submitBtn = document.getElementById("empSubmitBtn");
  if (empEditIndex !== null && submitBtn) {
    submitBtn.textContent = "Update Salary Record";
    const emp = employees[empEditIndex];
    if (emp && document.getElementById("empDate").value === "") {
      document.getElementById("empDate").value = emp.date;
      populateEmployeeDropdown(emp.name);
      document.getElementById("empSalary").value = emp.salary;
      document.getElementById("empPaidBy").value = emp.paidBy || "Krishna Corp";
      document.getElementById("empPaymentMode").value = emp.paymentMode;
    }
  } else if (submitBtn) { submitBtn.textContent = "Add Salary Record"; }

  table.innerHTML = "";
  
  const indexedEmployees = employees.map((emp, originalIndex) => ({ ...emp, originalIndex }));
  indexedEmployees.sort((a, b) => new Date(a.date) - new Date(b.date));

  const filtered = indexedEmployees.filter(emp => emp.name.toLowerCase().includes((document.getElementById("empSearch")?.value || "").toLowerCase()));

  if (filtered.length === 0) {
    table.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">No employee records found.</td></tr>`;
    return;
  }

  filtered.forEach(emp => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${emp.date}</td><td>${emp.name}</td><td>${money(emp.salary)}</td><td><b>${emp.paidBy || "Krishna Corp"}</b></td><td>${emp.paymentMode}</td><td><button class="action-btn edit-btn" onclick="editEmployee(${emp.originalIndex})">Edit</button><button class="action-btn delete-btn" onclick="deleteEmployee(${emp.originalIndex})">Delete</button></td>`;
    table.appendChild(row);
  });
}

function showEmployeeMonthlyBreakdown(empName) {
  const container = document.getElementById("empDetailViewContainer");
  if (!container) return;

  let monthlyData = {};
  let totalEmpSalary = 0;

  employees.forEach(e => {
    if (e.name.trim() === empName) {
      const monthKey = e.date ? e.date.substring(0, 7) : "Unknown";
      monthlyData[monthKey] = (monthlyData[monthKey] || 0) + (Number(e.salary) || 0);
      totalEmpSalary += Number(e.salary) || 0;
    }
  });

  let rows = Object.keys(monthlyData).sort().map(month => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 8px;">${month}</td>
      <td style="border: 1px solid #cbd5e1; padding: 8px; text-align: right; color: #2563eb; font-weight: bold;">${money(monthlyData[month])}</td>
    </tr>
  `).join('');

  container.innerHTML = `
    <div class="employee-detail-card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <h3 style="margin: 0; color: #1e293b; font-size: 16px;">Monthly Breakdown for: <span style="color: #2563eb;">${empName}</span></h3>
        <button onclick="document.getElementById('empDetailViewContainer').innerHTML=''" style="background: #ef4444; color: white; border: none; padding: 4px 10px; border-radius: 4px; cursor: pointer; font-size: 12px;">Close</button>
      </div>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="background: #f1f5f9;">
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left;">Month (YYYY-MM)</th>
            <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: right;">Total Salary Paid</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="background: #f8fafc; font-weight: bold;">
            <td style="border: 1px solid #cbd5e1; padding: 10px;">Lifetime Total:</td>
            <td style="border: 1px solid #cbd5e1; padding: 10px; text-align: right; color: #16a34a;">${money(totalEmpSalary)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
  container.scrollIntoView({ behavior: 'smooth' });
}

// --- COMPANY ASSETS PAGE LOGIC ---
function initAssets() {
  const table = document.getElementById("assetTable");
  if (!table) return;

  let totalPurchase = 0, totalSale = 0, assetKrishna = 0, assetRidham = 0, assetPankaj = 0;
  assets.forEach(ast => {
    const price = Number(ast.price) || 0;
    if (ast.type === "Purchase") {
      totalPurchase += price;
      if (ast.paidBy === "Ridham Patel") assetRidham += price;
      else if (ast.paidBy === "Pankajbhai Patel") assetPankaj += price;
      else assetKrishna += price;
    } else if (ast.type === "Sale") {
      totalSale += price;
    }
  });

  if (document.getElementById("assetTotalPurchase")) document.getElementById("assetTotalPurchase").textContent = money(totalPurchase);
  if (document.getElementById("assetKrishnaExpense")) document.getElementById("assetKrishnaExpense").textContent = money(assetKrishna);
  if (document.getElementById("assetRidhamExpense")) document.getElementById("assetRidhamExpense").textContent = money(assetRidham);
  if (document.getElementById("assetPankajExpense")) document.getElementById("assetPankajExpense").textContent = money(assetPankaj);
  if (document.getElementById("assetTotalSale")) document.getElementById("assetTotalSale").textContent = money(totalSale);

  const submitBtn = document.getElementById("assetSubmitBtn");
  if (assetEditIndex !== null && submitBtn) {
    submitBtn.textContent = "Update Asset Record";
    const ast = assets[assetEditIndex];
    if (ast && document.getElementById("assetName").value === "") {
      document.getElementById("assetDate").value = ast.date;
      document.getElementById("assetType").value = ast.type;
      document.getElementById("assetName").value = ast.name;
      document.getElementById("assetPrice").value = ast.price;
      document.getElementById("assetPaidBy").value = ast.paidBy || "Krishna Corp";
      document.getElementById("assetPaymentMode").value = ast.paymentMode;
    }
  } else if (submitBtn) { submitBtn.textContent = "Add Asset Record"; }

  table.innerHTML = "";
  
  const indexedAssets = assets.map((ast, originalIndex) => ({ ...ast, originalIndex }));
  indexedAssets.sort((a, b) => new Date(a.date) - new Date(b.date));

  const filtered = indexedAssets.filter(ast => ast.name.toLowerCase().includes((document.getElementById("assetSearch")?.value || "").toLowerCase()));

  if (filtered.length === 0) {
    table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">No asset records found.</td></tr>`;
    return;
  }

  filtered.forEach(ast => {
    const row = document.createElement("tr");
    const badgeClass = ast.type === "Sale" ? "badge-sale" : "badge-purchase";
    row.innerHTML = `<td>${ast.date}</td><td><span class="${badgeClass}">${ast.type}</span></td><td>${ast.name}</td><td>${money(ast.price)}</td><td><b>${ast.paidBy || "Krishna Corp"}</b></td><td>${ast.paymentMode}</td><td><button class="action-btn edit-btn" onclick="editAsset(${ast.originalIndex})">Edit</button><button class="action-btn delete-btn" onclick="deleteAsset(${ast.originalIndex})">Delete</button></td>`;
    table.appendChild(row);
  });
}

// --- OPERATING EXPENSES PAGE LOGIC ---
function initExpenses() {
  const table = document.getElementById("expenseTable");
  if (!table) return;

  let totalExpense = 0, expKrishna = 0, expRidham = 0, expPankaj = 0;
  expenses.forEach(exp => {
    const amt = Number(exp.amount) || 0;
    totalExpense += amt;
    if (exp.paidBy === "Ridham Patel") expRidham += amt;
    else if (exp.paidBy === "Pankajbhai Patel") expPankaj += amt;
    else expKrishna += amt;
  });

  if (document.getElementById("expenseTotalAmount")) document.getElementById("expenseTotalAmount").textContent = money(totalExpense);
  if (document.getElementById("expenseKrishnaAmount")) document.getElementById("expenseKrishnaAmount").textContent = money(expKrishna);
  if (document.getElementById("expenseRidhamAmount")) document.getElementById("expenseRidhamAmount").textContent = money(expRidham);
  if (document.getElementById("expensePankajAmount")) document.getElementById("expensePankajAmount").textContent = money(expPankaj);

  const submitBtn = document.getElementById("expenseSubmitBtn");
  if (expenseEditIndex !== null && submitBtn) {
    submitBtn.textContent = "Update Expense Record";
    const exp = expenses[expenseEditIndex];
    if (exp && document.getElementById("expenseCategory").value === "") {
      document.getElementById("expenseDate").value = exp.date;
      document.getElementById("expenseCategory").value = exp.category;
      document.getElementById("expenseDescription").value = exp.description;
      document.getElementById("expenseAmount").value = exp.amount;
      document.getElementById("expensePaidBy").value = exp.paidBy || "Krishna Corp";
      document.getElementById("expensePaymentMode").value = exp.paymentMode;
    }
  } else if (submitBtn) { submitBtn.textContent = "Add Expense Record"; }

  table.innerHTML = "";
  
  const indexedExpenses = expenses.map((exp, originalIndex) => ({ ...exp, originalIndex }));
  indexedExpenses.sort((a, b) => new Date(a.date) - new Date(b.date));

  const filtered = indexedExpenses.filter(exp => exp.category.toLowerCase().includes((document.getElementById("expenseSearch")?.value || "").toLowerCase()) || exp.description.toLowerCase().includes((document.getElementById("expenseSearch")?.value || "").toLowerCase()));

  if (filtered.length === 0) {
    table.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #64748b;">No expense records found.</td></tr>`;
    return;
  }

  filtered.forEach(exp => {
    const row = document.createElement("tr");
    row.innerHTML = `<td>${exp.date}</td><td><b>${exp.category}</b></td><td>${exp.description}</td><td>${money(exp.amount)}</td><td><b>${exp.paidBy || "Krishna Corp"}</b></td><td>${exp.paymentMode}</td><td><button class="action-btn edit-btn" onclick="editExpense(${exp.originalIndex})">Edit</button><button class="action-btn delete-btn" onclick="deleteExpense(${exp.originalIndex})">Delete</button></td>`;
    table.appendChild(row);
  });
}

function initCreditSalesTable() {
  const tableBody = document.getElementById("creditSalesTable");
  const searchInput = document.getElementById("creditSearch");

  if (!tableBody) return;

  function renderCreditSales() {
    const searchTerm = searchInput ? searchInput.value.toLowerCase().trim() : "";
    const indexedItems = items.map((item, originalIndex) => ({ ...item, originalIndex }));

    const creditSales = indexedItems.filter(item => {
      const isSale = String(item.type || "").toLowerCase() === "sale";
      const isCredit = String(item.paymentMode || "").toLowerCase() === "credit";
      const searchText = [item.partyName, item.product, item.billNumber, item.date].join(" ").toLowerCase();
      return isSale && isCredit && searchText.includes(searchTerm);
    });

    tableBody.innerHTML = "";

    if (creditSales.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:20px;">No credit sales found.</td></tr>`;
      return;
    }

    creditSales.slice().sort((a, b) => new Date(b.date) - new Date(a.date)).forEach(item => {
      const quantity = Number(item.quantity) || 0;
      const price = Number(item.price) || 0;
      const total = quantity * price;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${item.date || "-"}</td>
        <td><b>${item.partyName || "-"}</b></td>
        <td>${item.product || "-"}</td>
        <td>${quantity}</td>
        <td>${money(price)}</td>
        <td class="orange" style="font-weight: 700;">${money(total)}</td>
        <td>${item.billNumber || "-"}</td>
        <td>
          <button class="action-btn" style="background: #16a34a; color: white;" onclick="settleCreditSale(${item.originalIndex})">✓ Mark Paid</button>
          <button class="action-btn" onclick="printBill(${item.originalIndex})">Bill</button>
        </td>
      `;
      tableBody.appendChild(row);
    });
  }

  if (searchInput && !searchInput.dataset.creditSearchBound) {
    searchInput.addEventListener("input", renderCreditSales);
    searchInput.dataset.creditSearchBound = "true";
  }

  renderCreditSales();
}

function settleCreditSale(index) {
  const item = items[index];
  if (!item) return;

  const total = Math.round((Number(item.quantity) || 0) * (Number(item.price) || 0));
  const mode = prompt(
    `Settle Credit Bill ${item.billNumber} for ${item.partyName} (${money(total)}).\nEnter Payment Mode received (Cash, UPI, or Bank Transfer):`,
    "Cash"
  );

  if (!mode) return;

  const cleanMode = mode.trim();
  const validModes = ["Cash", "UPI", "Bank Transfer"];
  const matchedMode = validModes.find(m => m.toLowerCase() === cleanMode.toLowerCase());

  if (!matchedMode) {
    alert("Please enter a valid payment mode: Cash, UPI, or Bank Transfer.");
    return;
  }

  items[index].paymentMode = matchedMode;
  saveItemsToLocalStorage();
  initInventory();
  initCreditSalesTable();
  initDashboard();
}

// --- PARTNERS CAPITAL PAGE LOGIC ---
let partnerChartInstance = null;
function initPartners() {
  const table = document.getElementById("partnerTable");
  if (!table) return;

  let totalCapital = 0, totalWithdrawals = 0, partnerNetTotals = {};
  
  partners.forEach(part => {
    const amt = Number(part.amount) || 0;
    const name = part.name.trim();
    if (!partnerNetTotals[name]) partnerNetTotals[name] = 0;

    if (part.type === "Withdrawal") {
      totalWithdrawals += amt;
      partnerNetTotals[name] -= amt;
    } else {
      totalCapital += amt;
      partnerNetTotals[name] += amt;
    }
  });

  const netTotalCapital = totalCapital - totalWithdrawals;

  let totalAllTimeSpent = 0;
  items.forEach(i => { if (i.type === "Purchase" && (i.paidBy === "Ridham Patel" || i.paidBy === "Pankajbhai Patel")) totalAllTimeSpent += (Number(i.quantity)||0)*(Number(i.price)||0); });
  employees.forEach(e => { if (e.paidBy === "Ridham Patel" || e.paidBy === "Pankajbhai Patel") totalAllTimeSpent += Number(e.salary)||0; });
  assets.forEach(a => { if (a.type === "Purchase" && (a.paidBy === "Ridham Patel" || a.paidBy === "Pankajbhai Patel")) totalAllTimeSpent += Number(a.price)||0; });
  expenses.forEach(ex => { if (ex.paidBy === "Ridham Patel" || ex.paidBy === "Pankajbhai Patel") totalAllTimeSpent += Number(ex.amount)||0; });

  const totalInvestmentPool = netTotalCapital + totalAllTimeSpent;

  if (document.getElementById("partnerTotalInvestment")) document.getElementById("partnerTotalInvestment").textContent = money(netTotalCapital);
  if (document.getElementById("partnerTotalInvestmentPool")) document.getElementById("partnerTotalInvestmentPool").textContent = money(totalInvestmentPool);

  const chartCanvas = document.getElementById("partnerChart");
  if (chartCanvas) {
    const labels = Object.keys(partnerNetTotals);
    const data = Object.values(partnerNetTotals);
    if (partnerChartInstance) partnerChartInstance.destroy();
    partnerChartInstance = new Chart(chartCanvas.getContext("2d"), {
      type: 'pie',
      data: { labels: labels.length > 0 ? labels : ['No Capital'], datasets: [{ data: data.length > 0 ? data : [1], backgroundColor: ['#2563eb', '#16a34a', '#ea580c', '#9333ea', '#dc2626'], borderWidth: 1 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } } }
    });
  }

  const submitBtn = document.getElementById("partnerSubmitBtn");
  if (partnerEditIndex !== null && submitBtn) {
    submitBtn.textContent = "Update Record";
    const part = partners[partnerEditIndex];
    if (part && document.getElementById("partnerAmount").value === "") {
      document.getElementById("partnerDate").value = part.date;
      document.getElementById("partnerType").value = part.type || "Investment";
      document.getElementById("partnerName").value = part.name;
      document.getElementById("partnerAmount").value = part.amount;
      document.getElementById("partnerPaymentMode").value = part.paymentMode;
    }
  } else if (submitBtn) { submitBtn.textContent = "Add Record"; }

  table.innerHTML = "";
  
  const indexedPartners = partners.map((part, originalIndex) => ({ ...part, originalIndex }));
  indexedPartners.sort((a, b) => new Date(a.date) - new Date(b.date));

  const filtered = indexedPartners.filter(part => part.name.toLowerCase().includes((document.getElementById("partnerSearch")?.value || "").toLowerCase()));

  if (filtered.length === 0) {
    table.innerHTML = `<tr><td colspan="6" style="text-align: center; color: #64748b;">No partner records found.</td></tr>`;
    return;
  }

  filtered.forEach(part => {
    const row = document.createElement("tr");
    const isWithdrawal = part.type === "Withdrawal";
    const badgeClass = isWithdrawal ? "badge-purchase" : "badge-sale";
    const amtColor = isWithdrawal ? "color: #dc2626;" : "color: #16a34a;";
    
    row.innerHTML = `
      <td>${part.date}</td>
      <td><span class="${badgeClass}">${part.type || "Investment"}</span></td>
      <td><b>${part.name}</b></td>
      <td style="font-weight: bold; ${amtColor}">${isWithdrawal ? '-' : '+'}${money(part.amount)}</td>
      <td>${part.paymentMode}</td>
      <td>
        <button class="action-btn edit-btn" onclick="editPartner(${part.originalIndex})">Edit</button>
        <button class="action-btn delete-btn" onclick="deletePartner(${part.originalIndex})">Delete</button>
      </td>
    `;
    table.appendChild(row);
  });
}

// --- FORM SUBMISSION HANDLERS ---
const itemForm = document.getElementById("itemForm");
if (itemForm) {
  itemForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const newItem = {
      date: document.getElementById("itemDate").value,
      type: document.getElementById("transactionType").value,
      partyName: document.getElementById("itemParty").value,
      product: document.getElementById("itemName").value,
      quantity: Number(document.getElementById("itemQuantity").value),
      price: Number(document.getElementById("itemPrice").value),
      billNumber: document.getElementById("billNumber").value,
      paidBy: document.getElementById("itemPaidBy").value,
      paymentMode: document.getElementById("paymentMode").value
    };
    if (editIndex !== null) {
      items[editIndex] = newItem;
      editIndex = null;
    } else {
      items.push(newItem);
    }
    saveItemsToLocalStorage();
    this.reset();
    handleTransactionTypeChange();
    initInventory();
    initCreditSalesTable();
  });
}

const empForm = document.getElementById("empForm");
if (empForm) {
  empForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const selectEl = document.getElementById("empNameSelect");
    const newInput = document.getElementById("empNameNew");
    const nameVal = selectEl.value === "NEW_EMP" ? newInput.value.trim() : selectEl.value;

    const newEmp = {
      date: document.getElementById("empDate").value,
      name: nameVal,
      salary: Number(document.getElementById("empSalary").value),
      paidBy: document.getElementById("empPaidBy").value,
      paymentMode: document.getElementById("empPaymentMode").value
    };
    if (empEditIndex !== null) { employees[empEditIndex] = newEmp; empEditIndex = null; }
    else { employees.push(newEmp); }
    saveEmployeesToLocalStorage();
    this.reset();
    populateEmployeeDropdown();
    initEmployees();
  });
}

const assetForm = document.getElementById("assetForm");
if (assetForm) {
  assetForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const newAsset = {
      date: document.getElementById("assetDate").value,
      type: document.getElementById("assetType").value,
      name: document.getElementById("assetName").value,
      price: Number(document.getElementById("assetPrice").value),
      paidBy: document.getElementById("assetPaidBy").value,
      paymentMode: document.getElementById("assetPaymentMode").value
    };
    if (assetEditIndex !== null) { assets[assetEditIndex] = newAsset; assetEditIndex = null; }
    else { assets.push(newAsset); }
    saveAssetsToLocalStorage();
    this.reset();
    initAssets();
  });
}

const expenseForm = document.getElementById("expenseForm");
if (expenseForm) {
  expenseForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const newExpense = {
      date: document.getElementById("expenseDate").value,
      category: document.getElementById("expenseCategory").value,
      description: document.getElementById("expenseDescription").value,
      amount: Number(document.getElementById("expenseAmount").value),
      paidBy: document.getElementById("expensePaidBy").value,
      paymentMode: document.getElementById("expensePaymentMode").value
    };
    if (expenseEditIndex !== null) { expenses[expenseEditIndex] = newExpense; expenseEditIndex = null; }
    else { expenses.push(newExpense); }
    saveExpensesToLocalStorage();
    this.reset();
    initExpenses();
  });
}

const partnerForm = document.getElementById("partnerForm");
if (partnerForm) {
  partnerForm.addEventListener("submit", function(event) {
    event.preventDefault();
    const newPartner = {
      date: document.getElementById("partnerDate").value,
      type: document.getElementById("partnerType").value,
      name: document.getElementById("partnerName").value,
      amount: Number(document.getElementById("partnerAmount").value),
      paymentMode: document.getElementById("partnerPaymentMode").value
    };
    if (partnerEditIndex !== null) { partners[partnerEditIndex] = newPartner; partnerEditIndex = null; }
    else { partners.push(newPartner); }
    savePartnersToLocalStorage();
    this.reset();
    initPartners();
  });
}

// --- EDIT & DELETE HELPERS ---
function editItem(i) {
  editIndex = i;
  saveItemsToLocalStorage();
  initInventory();
  initCreditSalesTable();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteItem(i) {
  if (confirm("Delete this item record?")) {
    items.splice(i, 1);
    if (editIndex === i) editIndex = null;
    saveItemsToLocalStorage();
    initInventory();
    initCreditSalesTable();
  }
}

function editEmployee(i) { empEditIndex = i; saveEmployeesToLocalStorage(); initEmployees(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function deleteEmployee(i) { if (confirm("Delete this employee salary record?")) { employees.splice(i, 1); if (empEditIndex === i) empEditIndex = null; saveEmployeesToLocalStorage(); initEmployees(); } }

function editAsset(i) { assetEditIndex = i; saveAssetsToLocalStorage(); initAssets(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function deleteAsset(i) { if (confirm("Delete this asset record?")) { assets.splice(i, 1); if (assetEditIndex === i) assetEditIndex = null; saveAssetsToLocalStorage(); initAssets(); } }

function editExpense(i) { expenseEditIndex = i; saveExpensesToLocalStorage(); initExpenses(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function deleteExpense(i) { if (confirm("Delete this expense record?")) { expenses.splice(i, 1); if (expenseEditIndex === i) expenseEditIndex = null; saveExpensesToLocalStorage(); initExpenses(); } }

function editPartner(i) { partnerEditIndex = i; savePartnersToLocalStorage(); initPartners(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
function deletePartner(i) { if (confirm("Delete this partner record?")) { partners.splice(i, 1); if (partnerEditIndex === i) partnerEditIndex = null; savePartnersToLocalStorage(); initPartners(); } }

// --- SEARCH LISTENERS ---
if (document.getElementById("saleSearch")) document.getElementById("saleSearch").addEventListener("input", initInventory);
if (document.getElementById("purchaseSearch")) document.getElementById("purchaseSearch").addEventListener("input", initInventory);
if (document.getElementById("stockFilter")) document.getElementById("stockFilter").addEventListener("change", initInventory);
if (document.getElementById("empSearch")) document.getElementById("empSearch").addEventListener("input", initEmployees);
if (document.getElementById("assetSearch")) document.getElementById("assetSearch").addEventListener("input", initAssets);
if (document.getElementById("expenseSearch")) document.getElementById("expenseSearch").addEventListener("input", initExpenses);
if (document.getElementById("partnerSearch")) document.getElementById("partnerSearch").addEventListener("input", initPartners);

// --- STARTUP LOAD ---
window.addEventListener("DOMContentLoaded", () => {
  loadAllDataFromDB();
});