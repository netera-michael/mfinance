import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

// ─── CONFIG ───────────────────────────────────────────────
const ERP_URL = process.env.ERP_URL || 'http://109.123.248.154:8001';
const ERP_API_KEY = process.env.ERP_API_KEY || '';
const ERP_API_SECRET = process.env.ERP_API_SECRET || '';
const COCKPIT_USER = process.env.COCKPIT_USER || 'michael';
const COCKPIT_PASS = process.env.COCKPIT_PASS || 'finance2026';
const COMPANY = 'Michael Emil';
const ABBR = 'ME';

// Simple session tokens (in-memory)
const sessions = new Map();

// ─── AUTH ─────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === COCKPIT_USER && password === COCKPIT_PASS) {
    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessions.set(token, { user: username, created: Date.now() });
    return res.json({ ok: true, token });
  }
  res.status(401).json({ ok: false, error: 'Invalid credentials' });
});

function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  next();
}

// ─── ERP HELPER ───────────────────────────────────────────
async function erpCall(method, params = {}) {
  const qs = new URLSearchParams(params).toString();
  const url = `${ERP_URL}/api/method/${method}${qs ? '?' + qs : ''}`;
  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
        'Content-Type': 'application/json',
      },
    });
    return await resp.json();
  } catch (e) {
    return { error: e.message };
  }
}

async function erpResource(doctype, filters = {}, fields = ['*'], limit = 0) {
  const params = new URLSearchParams({
    filters: JSON.stringify(filters),
    fields: JSON.stringify(fields),
    limit_page_length: limit || 0,
  });
  const url = `${ERP_URL}/api/resource/${doctype}?${params}`;
  try {
    const resp = await fetch(url, {
      headers: {
        'Authorization': `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
        'Content-Type': 'application/json',
      },
    });
    return await resp.json();
  } catch (e) {
    return { error: e.message };
  }
}

// ─── NETWORTH ENDPOINT ────────────────────────────────────
app.get('/api/networth', authMiddleware, async (req, res) => {
  try {
    const result = await erpResource('Account', 
      [['company', '=', COMPANY], ['is_group', '=', 0], ['disabled', '=', 0]],
      ['name', 'account_name', 'root_type', 'parent_account', 'account_type']
    );
    
    const accounts = result.data || [];
    
    // Get balances from GL Entry
    const glResult = await erpResource('GL Entry',
      [['company', '=', COMPANY], ['is_cancelled', '=', 0]],
      ['account', 'sum(debit) as total_debit', 'sum(credit) as total_credit'],
      0
    );

    // Build balance map from trial balance approach
    const balanceMap = {};
    if (glResult.data) {
      for (const row of glResult.data) {
        balanceMap[row.account] = (row.total_debit || 0) - (row.total_credit || 0);
      }
    }

    // Structure the response
    const assets = { total: 0, items: [] };
    const liabilities = { total: 0, items: [] };

    for (const acc of accounts) {
      const bal = balanceMap[acc.name] || 0;
      const item = {
        name: acc.account_name,
        fullName: acc.name,
        balance: Math.abs(bal),
        parent: acc.parent_account,
        type: acc.account_type,
      };

      if (acc.root_type === 'Asset') {
        item.balance = bal; // Assets are naturally debit-positive
        assets.items.push(item);
        assets.total += bal;
      } else if (acc.root_type === 'Liability') {
        item.balance = Math.abs(bal); // Liabilities are credit-positive
        liabilities.items.push(item);
        liabilities.total += Math.abs(bal);
      }
    }

    const networth = assets.total - liabilities.total;

    res.json({
      ok: true,
      networth,
      assets,
      liabilities,
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── BANK ACCOUNTS ────────────────────────────────────────
app.get('/api/banks', authMiddleware, async (req, res) => {
  // Returns bank account balances grouped by region
  res.json({ ok: true, message: 'Banks endpoint ready' });
});

// ─── TRANSACTIONS ─────────────────────────────────────────
app.get('/api/transactions', authMiddleware, async (req, res) => {
  try {
    const result = await erpResource('Journal Entry',
      [['company', '=', COMPANY], ['docstatus', '=', 1]],
      ['name', 'posting_date', 'user_remark', 'total_debit', 'total_credit'],
      50
    );
    res.json({ ok: true, data: result.data || [] });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/transaction', authMiddleware, async (req, res) => {
  const { amount, fromAccount, category, note, date, currency } = req.body;
  
  // Create a journal entry in ERPNext
  const je = {
    doctype: 'Journal Entry',
    voucher_type: 'Journal Entry',
    posting_date: date || new Date().toISOString().split('T')[0],
    company: COMPANY,
    user_remark: note || '',
    accounts: [
      {
        account: `${category} - ${ABBR}`,
        debit_in_account_currency: amount,
        credit_in_account_currency: 0,
      },
      {
        account: `${fromAccount} - ${ABBR}`,
        debit_in_account_currency: 0,
        credit_in_account_currency: amount,
      },
    ],
  };

  try {
    const resp = await fetch(`${ERP_URL}/api/resource/Journal Entry`, {
      method: 'POST',
      headers: {
        'Authorization': `token ${ERP_API_KEY}:${ERP_API_SECRET}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ data: je }),
    });
    const result = await resp.json();
    res.json({ ok: true, data: result.data });
  } catch (e) {
    res.status(500).json({ ok: false, error: e.message });
  }
});

// ─── BUDGET ───────────────────────────────────────────────
const DATA_DIR = process.env.DATA_DIR || __dirname;
const BUDGET_FILE = join(DATA_DIR, 'budgets.json');

function loadBudgets() {
  try {
    if (existsSync(BUDGET_FILE)) {
      return JSON.parse(readFileSync(BUDGET_FILE, 'utf-8'));
    }
  } catch (e) {}
  // Default budgets from the user's sheet
  return {
    "Sodic Rent": 58000,
    "Stanley Rent": 13200,
    "MG One Installment": 38000,
    "Home": 10000,
    "Michael": 30000,
    "Nursery": 8000,
    "Nosa": 9000,
    "Reda": 6000,
    "Agency Salaries": 35000,
    "Ads": 48000,
    "Others": 0
  };
}

app.get('/api/budget/:month', authMiddleware, async (req, res) => {
  const budgets = loadBudgets();
  const monthStr = req.params.month; // e.g., "2026-03"
  
  // Calculate start/end dates for the given month
  const [yyyy, mm] = monthStr.split('-');
  const startDate = `${yyyy}-${mm}-01`;
  const endDate = new Date(yyyy, parseInt(mm), 0).toISOString().split('T')[0];

  try {
    // Fetch all GL Entries for the company in this month
    const result = await erpResource('GL Entry',
      [
        ['company', '=', COMPANY],
        ['docstatus', '=', 1],
        ['posting_date', 'between', [startDate, endDate]]
      ],
      ['account', 'debit', 'credit'],
      0 // fetch all
    );

    const entries = result.data || [];
    
    // Sum by account
    const spentByAccount = {};
    for (const entry of entries) {
      spentByAccount[entry.account] = (spentByAccount[entry.account] || 0) + (entry.debit - entry.credit);
    }

    const categories = Object.entries(budgets).map(([name, target]) => {
      const accountName = `${name} - ${ABBR}`;
      // Spending is net debit
      const spent = spentByAccount[accountName] || 0;
      
      return {
        name,
        target,
        spent,
        remaining: target - spent,
        percentage: target > 0 ? (spent / target) * 100 : 0,
      };
    });

    res.json({ ok: true, budgets: categories, month: monthStr });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

app.post('/api/budget', authMiddleware, (req, res) => {
  const budgets = loadBudgets();
  const { category, amount } = req.body;
  budgets[category] = amount;
  writeFileSync(BUDGET_FILE, JSON.stringify(budgets, null, 2));
  res.json({ ok: true });
});

// ─── FORECAST (CASH FLOW EXPECTATIONS) ────────────────────
const FORECAST_FILE = join(DATA_DIR, 'forecasts.json');

function loadForecasts() {
  try {
    if (existsSync(FORECAST_FILE)) {
      return JSON.parse(readFileSync(FORECAST_FILE, 'utf-8'));
    }
  } catch (e) {}
  // Default structure
  return {
    "2026-03": [
      { id: "f1", name: "Prive Marketing", amount: 104250, type: "income", status: "expected" },
      { id: "f2", name: "Withdrawal (ECHO)", amount: 150000, type: "income", status: "expected" },
      { id: "f3", name: "Raafat Loan Return", amount: 77500, type: "income", status: "processed" },
      { id: "f4", name: "Thrifty Refund", amount: 13400, type: "income", status: "expected" },
      { id: "f5", name: "Ciccio + System (AED 13,432)", amount: 179988, type: "expense", status: "expected" }
    ]
  };
}

app.get('/api/forecast/:month', authMiddleware, (req, res) => {
  const forecasts = loadForecasts();
  const monthData = forecasts[req.params.month] || [];
  res.json({ ok: true, data: monthData });
});

app.post('/api/forecast', authMiddleware, (req, res) => {
  const forecasts = loadForecasts();
  const { month, name, amount, type } = req.body;
  if (!forecasts[month]) forecasts[month] = [];
  
  const newItem = {
    id: Date.now().toString(),
    name,
    amount,
    type,
    status: "expected"
  };
  
  forecasts[month].push(newItem);
  writeFileSync(FORECAST_FILE, JSON.stringify(forecasts, null, 2));
  res.json({ ok: true, data: newItem });
});

app.put('/api/forecast/:id', authMiddleware, (req, res) => {
  const forecasts = loadForecasts();
  const { status } = req.body;
  const id = req.params.id;
  
  let found = false;
  for (const month in forecasts) {
    const item = forecasts[month].find(i => i.id === id);
    if (item) {
      item.status = status;
      found = true;
      break;
    }
  }
  
  if (found) writeFileSync(FORECAST_FILE, JSON.stringify(forecasts, null, 2));
  res.json({ ok: found });
});

// ─── START ────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Finance Cockpit API running on port ${PORT}`);
  console.log(`📡 ERPNext backend: ${ERP_URL}`);
});
