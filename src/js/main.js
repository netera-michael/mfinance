// ═══════════════════════════════════════════════════════
// FINANCE COCKPIT — Main Application
// ═══════════════════════════════════════════════════════

const API_BASE = '/api';
let authToken = localStorage.getItem('cockpit_token') || null;

// ─── API HELPER ─────────────────────────────────────────
async function api(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
  };

  try {
    const resp = await fetch(url, { ...options, headers });
    if (resp.status === 401) {
      authToken = null;
      localStorage.removeItem('cockpit_token');
      showScreen('login');
      return { ok: false, error: 'Session expired' };
    }
    return await resp.json();
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

// ─── FORMAT HELPERS ─────────────────────────────────────
function formatEGP(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  const neg = amount < 0;
  const abs = Math.abs(amount);
  const formatted = abs.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
  return `${neg ? '-' : ''}${formatted}`;
}

function formatDetailed(amount) {
  if (amount === null || amount === undefined || isNaN(amount)) return '—';
  return amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

// ─── ANIMATED COUNTER ───────────────────────────────────
function animateValue(el, target, duration = 800) {
  const start = parseFloat(el.dataset.currentValue) || 0;
  const startTime = performance.now();

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = start + (target - start) * eased;
    el.textContent = formatEGP(current);
    el.dataset.currentValue = current;
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// ─── SCREEN MANAGEMENT ──────────────────────────────────
function showScreen(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  if (name === 'login') {
    document.getElementById('login-screen')?.classList.add('active');
  } else {
    document.getElementById('main-app')?.classList.add('active');
  }
}

// ─── PAGE ROUTING ───────────────────────────────────────
const pageTitles = {
  home: 'Dashboard',
  cashflow: 'Cash Flow',
  add: 'New Transaction',
  budget: 'Budget',
  more: 'More',
};

function showPage(name) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(`page-${name}`)?.classList.add('active');

  // Sync bottom nav
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-btn[data-page="${name}"]`)?.classList.add('active');

  // Sync sidebar nav
  document.querySelectorAll('.sidebar-btn').forEach(b => b.classList.remove('active'));
  document.querySelector(`.sidebar-btn[data-page="${name}"]`)?.classList.add('active');

  document.getElementById('page-title').textContent = pageTitles[name] || 'Dashboard';

  // Load data for the page
  switch (name) {
    case 'home':
      loadNetworth();
      break;
    case 'cashflow':
      loadCashFlow();
      break;
    case 'add':
      loadRecentTransactions();
      break;
    case 'budget':
      loadBudget();
      break;
    case 'more':
      loadMore();
      break;
  }
}

// ─── NETWORTH MODULE ────────────────────────────────────

// Hardcoded March 2026 data from the Opening Entry
// (In production, this would come from the ERPNext API via /api/networth)
const OPENING_DATA = {
  assets: {
    total: 20369882.46,
    items: [
      // Real Estate
      { name: 'San Stefano', balance: 2500000, group: 'Real Estate 🏢' },
      { name: 'Damac', balance: 4715982.6, group: 'Real Estate 🏢', native: 'AED 351,939.00' },
      { name: 'Sawary', balance: 8000000, group: 'Real Estate 🏢' },
      // Cars
      { name: 'MG One 2026', balance: 1150000, group: 'Cars' },
      { name: 'Ateca 2020', balance: 750000, group: 'Cars' },
      // Dubai Banks
      { name: 'Mashreq NEO', balance: 1608000, group: 'Dubai Banks 🇦🇪', native: 'AED 40,200.00' },
      { name: 'Mashreq Current', balance: 220336.20, group: 'Dubai Banks 🇦🇪', native: 'AED 5,508.41' },
      { name: 'ADCB', balance: 884.40, group: 'Dubai Banks 🇦🇪', native: 'AED 22.11' },
      { name: 'AlHilal', balance: -1340, group: 'Dubai Banks 🇦🇪', native: 'AED -33.50' },
      // Egypt Banks
      { name: 'CIB Current', balance: 35000, group: 'Egypt Banks 🇪🇬' },
      { name: 'CIB USD', balance: 90624, group: 'Egypt Banks 🇪🇬', native: '$1,849.46' },
      { name: 'Other Egypt Funds', balance: 77500, group: 'Egypt Banks 🇪🇬' },
      // Investments
      { name: 'Meta (NASDAQ)', balance: 223451.94, group: 'Investments 📈', native: '$4,560.24' },
      { name: 'Microsoft (NASDAQ)', balance: 700828.47, group: 'Investments 📈', native: '$14,302.62' },
      { name: 'BTC', balance: 53614.85, group: 'Investments 📈', native: '₿ 0.015698' },
      // Other
      { name: 'Other Assets', balance: 245000, group: 'Other', native: '$5,000.00' },
    ],
  },
  liabilities: {
    total: 5429741.20,
    items: [
      { name: 'Cars Loan', balance: 2046006, group: 'Loans' },
      { name: 'Real Estate Loan', balance: 1400000, group: 'Loans' },
      { name: 'Shopify', balance: 486129, group: 'Loans', native: '$9,921.00' },
      { name: 'Withdrawal', balance: 320072.40, group: 'Loans', native: 'AED 23,886.00' },
      { name: 'Magdy', balance: 235494, group: 'Splitwise', native: '$4,806.00' },
      { name: 'Mina', balance: 196000, group: 'Splitwise', native: '$4,000.00' },
      { name: 'Dina', balance: 196000, group: 'Splitwise', native: '$4,000.00' },
      // UAE Installments
      { name: 'Tabby Card', balance: 131320, group: 'UAE Installments 🇦🇪', native: 'AED 9,800.00' },
      { name: 'Tamara', balance: 91897.20, group: 'UAE Installments 🇦🇪', native: 'AED 6,858.00' },
      { name: 'Tabby', balance: 74758.60, group: 'UAE Installments 🇦🇪', native: 'AED 5,579.00' },
      // Egypt Installments
      { name: 'Michael Valu', balance: 103921, group: 'Egypt Installments 🇪🇬' },
      { name: 'Souhoola', balance: 59642, group: 'Egypt Installments 🇪🇬' },
      { name: 'Fawry', balance: 57881, group: 'Egypt Installments 🇪🇬' },
      { name: "Mira's Valu", balance: 30620, group: 'Egypt Installments 🇪🇬' },
    ],
  },
};

function loadNetworth() {
  const data = OPENING_DATA;
  const networth = data.assets.total - data.liabilities.total;

  animateValue(document.getElementById('networth-value'), networth);

  const totalCash = data.assets.items
    .filter(i => ['Dubai Banks 🇦🇪', 'Egypt Banks 🇪🇬'].includes(i.group))
    .reduce((sum, i) => sum + i.balance, 0);

  const totalInvestments = data.assets.items
    .filter(i => i.group === 'Investments 📈')
    .reduce((sum, i) => sum + i.balance, 0);

  document.getElementById('total-assets').textContent = formatEGP(data.assets.total);
  document.getElementById('total-liabilities').textContent = formatEGP(data.liabilities.total);
  document.getElementById('total-cash').textContent = formatEGP(totalCash);
  document.getElementById('total-investments').textContent = formatEGP(totalInvestments);

  // Assets breakdown
  renderBreakdown('assets-list', data.assets.items, 'positive');
  renderBreakdown('liabilities-list', data.liabilities.items, 'negative');
}

function renderBreakdown(containerId, items, valueClass) {
  const container = document.getElementById(containerId);
  let currentGroup = '';
  let html = '';

  for (const item of items) {
    if (item.group !== currentGroup) {
      currentGroup = item.group;
      html += `<div class="breakdown-item group-header">
        <span class="item-name">${currentGroup}</span>
      </div>`;
    }

    if (item.hasSubitems) {
      html += `<div class="breakdown-item accordion-parent" onclick="this.nextElementSibling.classList.toggle('active'); this.querySelector('.arrow').classList.toggle('up')">
        <span class="item-name" style="cursor:pointer; display:flex; align-items:center;">
          ${item.name} <span class="arrow" style="margin-left:8px; font-size:10px; transition:transform 0.2s;">▼</span>
        </span>
        <span class="item-value ${valueClass}">${formatEGP(item.balance)}</span>
      </div>`;
      html += `<div class="accordion-content">`;
      for (const sub of item.subItems) {
        html += `<div class="breakdown-item sub-item">
          <span class="item-name">- ${sub.name}</span>
          <span class="item-value ${valueClass}">${formatEGP(sub.balance)}</span>
        </div>`;
      }
      html += `</div>`;
    } else {
      html += `<div class="breakdown-item">
        <span class="item-name">
          ${item.name}
          ${item.native ? `<br><span class="native-amt">(${item.native})</span>` : ''}
        </span>
        <span class="item-value ${valueClass}">${formatEGP(item.balance)}</span>
      </div>`;
    }
  }

  container.innerHTML = html;
}

// ─── BUDGET MODULE ──────────────────────────────────────
async function loadBudget() {
  const container = document.getElementById('budget-list');
  container.innerHTML = '<div class="spinner" style="margin:20px auto;display:block;"></div>';
  
  // Using March 2026 for demonstration
  const month = '2026-03';
  const monthLabel = document.getElementById('budget-month');
  if (monthLabel) monthLabel.textContent = 'March 2026';

  const result = await api(`/budget/${month}`);
  if (!result.ok || !result.budgets) {
    container.innerHTML = '<p class="error-text">Failed to load budget data</p>';
    return;
  }

  let html = '';
  // Sort alphabetically or however you want (API dictates order)
  for (const data of result.budgets) {
    if (data.target === 0) {
      html += `<div class="budget-item">
        <div class="budget-header">
          <span class="budget-name">${data.name}</span>
          <span class="budget-numbers" style="color: var(--text-muted)">
            ${formatEGP(data.spent)} spent / No limit
          </span>
        </div>
      </div>`;
      continue;
    }

    let color = 'green';
    if (data.percentage > 90) color = 'red';
    else if (data.percentage > 70) color = 'yellow';

    const overBudget = data.spent > data.target;
    // Calculate remaining
    const remaining = data.target - data.spent;

    html += `<div class="budget-item">
      <div class="budget-header">
        <span class="budget-name">${data.name}</span>
        <span class="budget-numbers" style="color: ${overBudget ? 'var(--accent-red)' : 'var(--text-muted)'}">
          ${formatEGP(data.spent)} / ${formatEGP(data.target)}
          ${overBudget ? ' ⚠️' : ''}
        </span>
      </div>
      <div class="budget-bar">
        <div class="budget-bar-fill ${color}" style="width: ${overBudget ? 100 : data.percentage}%"></div>
      </div>
      <div style="font-size:11px;color:${remaining < 0 ? 'var(--accent-red)' : 'var(--text-muted)'};font-weight:500;margin-top:2px;">
        ${remaining >= 0 ? `${formatEGP(remaining)} remaining` : `${formatEGP(Math.abs(remaining))} over budget`}
      </div>
    </div>`;
  }

  container.innerHTML = html;
}

// ─── CASH FLOW MODULE ─────────────────────────────────────
async function loadCashFlow() {
  const month = '2026-03';
  document.getElementById('current-month').textContent = 'March 2026';

  document.getElementById('income-list').innerHTML = '<div class="spinner" style="margin:20px auto;display:block;"></div>';
  document.getElementById('expenses-list').innerHTML = '<div class="spinner" style="margin:20px auto;display:block;"></div>';

  const result = await api(`/forecast/${month}`);
  if (!result.ok || !result.data) {
    document.getElementById('income-list').innerHTML = '<p class="error-text">Failed to load data. Please refresh.</p>';
    document.getElementById('expenses-list').innerHTML = '';
    return;
  }

  const incomeItems = result.data.filter(i => i.type === 'income');
  const expenseItems = result.data.filter(i => i.type === 'expense');

  // ── Income
  let incomeHtml = '';
  let totalIncome = 0;
  for (const item of incomeItems) {
    totalIncome += item.amount;
    const isProcessed = item.status === 'processed';
    incomeHtml += `<div class="breakdown-item forecast-toggle" data-id="${item.id}" data-next="${isProcessed ? 'expected' : 'processed'}" style="cursor:pointer;">
      <span class="item-name" style="${isProcessed ? 'color:var(--text-muted);text-decoration:line-through;' : ''}">
        <span style="font-size:12px;margin-right:4px;">${isProcessed ? '✅' : '⏳'}</span>${item.name}
      </span>
      <span class="item-value positive" style="${isProcessed ? 'color:var(--text-muted);' : ''}">${formatEGP(item.amount)}</span>
    </div>`;
  }
  document.getElementById('income-list').innerHTML = incomeHtml;
  document.getElementById('total-income').textContent = formatEGP(totalIncome);

  // ── Fixed Sunk Expenses (from budget targets directly, no ERPNext GL calls)
  const budgetTargets = [
    { name: 'Sodic Rent', target: 58000 },
    { name: 'Stanley Rent', target: 13200 },
    { name: 'MG One Installment', target: 38000 },
    { name: 'Home', target: 10000 },
    { name: 'Michael', target: 30000 },
    { name: 'Nursery', target: 8000 },
    { name: 'Nosa', target: 9000 },
    { name: 'Reda', target: 6000 },
    { name: 'Agency Salaries', target: 35000 },
    { name: 'Ads', target: 48000 },
  ];

  let expHtml = '';
  let totalExp = 0;
  for (const b of budgetTargets) {
    totalExp += b.target;
    expHtml += `<div class="breakdown-item">
      <span class="item-name"><span style="font-size:12px;margin-right:4px;">⏳</span>${b.name}</span>
      <span class="item-value negative">${formatEGP(b.target)}</span>
    </div>`;
  }

  // ── Additional expense forecast items (e.g. Ciccio)
  for (const item of expenseItems) {
    totalExp += item.amount;
    const isProcessed = item.status === 'processed';
    expHtml += `<div class="breakdown-item forecast-toggle" data-id="${item.id}" data-next="${isProcessed ? 'expected' : 'processed'}" style="cursor:pointer;">
      <span class="item-name" style="${isProcessed ? 'color:var(--text-muted);text-decoration:line-through;' : ''}">
        <span style="font-size:12px;margin-right:4px;">${isProcessed ? '✅' : '⏳'}</span>${item.name}
      </span>
      <span class="item-value negative" style="${isProcessed ? 'color:var(--text-muted);' : ''}">${formatEGP(item.amount)}</span>
    </div>`;
  }

  document.getElementById('expenses-list').innerHTML = expHtml;
  document.getElementById('total-sunk').textContent = formatEGP(totalExp);

  const discretionary = totalIncome - totalExp;
  document.getElementById('discretionary-income').textContent = formatEGP(discretionary);
  document.getElementById('discretionary-income').className = `stat-value giant ${discretionary >= 0 ? 'positive' : 'negative'}`;

  document.getElementById('monthly-cash').textContent = formatEGP(discretionary);
  document.getElementById('monthly-cash').className = `stat-value giant ${discretionary >= 0 ? 'positive' : 'negative'}`;

  // ── Wire up toggling via event delegation (safe, no inline onclick)
  document.querySelectorAll('.forecast-toggle').forEach(el => {
    el.addEventListener('click', async function() {
      const id = this.dataset.id;
      const nextStatus = this.dataset.next;
      this.style.opacity = '0.5';
      const res = await api(`/forecast/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: nextStatus }),
      });
      if (res.ok) loadCashFlow();
    });
  });
}

// ─── MORE MODULE (Banks, Investments, Splitwise) ────────
function loadMore() {
  // Banks
  const banks = OPENING_DATA.assets.items.filter(i =>
    i.group.includes('Banks') || i.group.includes('Cash')
  );
  renderBreakdown('banks-detail', banks.map(b => ({...b, group: b.group})), 'positive');

  // Investments
  const investments = OPENING_DATA.assets.items.filter(i => i.group === 'Investments 📈');
  renderBreakdown('investments-detail', investments.map(i => ({...i, group: 'Stocks & Crypto'})), 'positive');

  // Splitwise
  const splitwise = OPENING_DATA.liabilities.items.filter(i => i.group === 'Splitwise');
  renderBreakdown('splitwise-detail', splitwise.map(s => ({...s, group: 'You Owe'})), 'negative');
}
// ─── TRANSACTION FORM ───────────────────────────────────
function initTransactionForm() {
  // Currency toggles
  document.querySelectorAll('.toggle-btn[data-currency]').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.toggle-btn[data-currency]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });
  });

  // Set default date to today
  const dateInput = document.getElementById('tx-date');
  if (dateInput) {
    dateInput.value = new Date().toISOString().split('T')[0];
  }

  // Form submit
  document.getElementById('transaction-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = parseFloat(document.getElementById('tx-amount').value);
    const fromAccount = document.getElementById('tx-from').value;
    const category = document.getElementById('tx-category').value;
    const note = document.getElementById('tx-note').value;
    const date = document.getElementById('tx-date').value;
    const currency = document.querySelector('.toggle-btn[data-currency].active')?.dataset.currency || 'EGP';

    if (!amount || !fromAccount || !category) return;

    const result = await api('/transaction', {
      method: 'POST',
      body: JSON.stringify({ amount, fromAccount, category, note, date, currency }),
    });

    if (result.ok) {
      // Reset form
      document.getElementById('transaction-form').reset();
      document.getElementById('tx-date').value = new Date().toISOString().split('T')[0];
      // Show success
      const btn = document.querySelector('#transaction-form .btn-primary');
      btn.textContent = '✓ Submitted!';
      btn.style.background = 'var(--accent-emerald)';
      loadRecentTransactions(); // Refresh the list
      setTimeout(() => {
        btn.textContent = 'Submit Transaction';
        btn.style.background = '';
      }, 2000);
    }
  });
}

// ─── RECENT TRANSACTIONS ────────────────────────────────
async function loadRecentTransactions() {
  const container = document.getElementById('recent-transactions');
  container.innerHTML = '<div class="spinner" style="margin:20px auto;display:block;"></div>';

  const result = await api('/transactions');
  if (!result.ok || !result.data || result.data.length === 0) {
    container.innerHTML = '<p class="empty-state">No transactions yet</p>';
    return;
  }

  let html = '';
  for (const row of result.data) {
    const isIncome = false; // We can parse this later
    const dateStr = new Date(row.posting_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const amount = row.total_debit || row.total_credit;
    
    html += `<div class="breakdown-item">
      <div style="display:flex; flex-direction:column; gap:4px;">
        <span class="item-name" style="font-size:14px; font-weight:600;">${row.user_remark || 'Journal Entry'} <span style="color:var(--text-muted); font-size:12px; margin-left:8px; font-weight:500;">${row.name}</span></span>
        <span style="font-size:12px; color:var(--text-muted);">${dateStr}</span>
      </div>
      <span class="item-value negative">${formatEGP(amount)}</span>
    </div>`;
  }
  container.innerHTML = html;
}

// ─── LOGIN ──────────────────────────────────────────────
function initLogin() {
  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-user').value;
    const password = document.getElementById('login-pass').value;
    const errorEl = document.getElementById('login-error');
    const btn = document.getElementById('login-btn');

    btn.textContent = 'Signing in...';
    btn.disabled = true;

    const result = await api('/login', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });

    if (result.ok) {
      authToken = result.token;
      localStorage.setItem('cockpit_token', authToken);
      showScreen('main');
      showPage('home');
      errorEl.textContent = '';
    } else {
      errorEl.textContent = 'Invalid username or password';
    }

    btn.textContent = 'Sign In';
    btn.disabled = false;
  });
}

// ─── INIT CASHFLOW ────────────────────────────────────────
function initCashflow() {
  document.getElementById('add-forecast-btn')?.addEventListener('click', async () => {
    const name = prompt("Enter expected description (e.g. 'Thrifty Refund'):");
    if (!name) return;
    const amountStr = prompt("Enter expected amount:");
    const amount = parseFloat(amountStr);
    if (!amount) return;
    const typeStr = prompt("Type ('income' or 'expense'):", "income");
    const type = typeStr === 'expense' ? 'expense' : 'income';

    const monthEl = document.getElementById('current-month');
    const month = monthEl ? monthEl.dataset.month || '2026-03' : '2026-03';
    
    const res = await api('/forecast', {
      method: 'POST',
      body: JSON.stringify({ month, name, amount, type })
    });
    if (res.ok) {
      loadCashFlow();
    }
  });
}

// ─── NAV BUTTONS ────────────────────────────────────────
function initNav() {
  // Bottom nav buttons
  document.querySelectorAll('.nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) showPage(page);
    });
  });

  // Sidebar nav buttons
  document.querySelectorAll('.sidebar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = btn.dataset.page;
      if (page) showPage(page);
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    authToken = null;
    localStorage.removeItem('cockpit_token');
    showScreen('login');
  });

  document.getElementById('refresh-btn')?.addEventListener('click', () => {
    const activePage = document.querySelector('.page.active')?.id?.replace('page-', '');
    if (activePage) showPage(activePage);
  });
}

// ─── INIT ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initNav();
  initTransactionForm();
  initCashflow();

  // Check if already logged in
  if (authToken) {
    showScreen('main');
    showPage('home');
  } else {
    showScreen('login');
  }
});
