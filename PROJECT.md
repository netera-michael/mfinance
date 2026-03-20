# Finance Cockpit — Master Project Document

> **Purpose:** This document is a comprehensive handoff guide for any developer or AI agent continuing work on this project. It contains the full technical architecture, the owner's financial logic/structure, completed work, current state, and the roadmap of what remains to be built.

---

## 1. Project Overview

**Owner:** Michael Emil  
**Goal:** Replace a complex Google Spreadsheet with a personal Finance Cockpit web app powered by ERPNext as the accounting backend.  
**Primary URL (local dev):** http://localhost:5173  
**Backend API (local dev):** http://localhost:3000  
**Production VPS:** Contabo VPS — IP `109.123.248.154`, ERPNext on port `8001`  
**Domain (to configure):** `finance.michaelemil.com`  

The dashboard is Michael's personal "cockpit" for tracking networth, monthly cash flow, budgets, and expenses across a multi-currency life split between **Egypt (EGP)** and **Dubai, UAE (AED)**.

---

## 2. Technology Stack

| Layer | Technology | Location |
|---|---|---|
| **Frontend** | Vite + Vanilla JS + HTML/CSS | `/cockpit/src/` |
| **API Middleware** | Node.js + Express | `/cockpit/server/index.js` |
| **ERP Backend** | ERPNext (Frappe) | Contabo VPS port 8001 |
| **Database** | MariaDB (via ERPNext) | Contabo VPS |
| **Styling** | Custom CSS variables (dark mode, glassmorphism) | `/cockpit/src/css/style.css` |
| **Fonts** | Inter (Google Fonts) | CDN |
| **Reverse Proxy** | Nginx (production only) | Contabo VPS |

### Dev Commands
```bash
# Start the frontend (Vite)
cd cockpit && npx vite --host

# Start the API proxy server
cd cockpit && node server/index.js

# Both must be running for the app to work
# Frontend: http://localhost:5173
# API: http://localhost:3000
```

### Login Credentials (local)
- **Username:** `michael`
- **Password:** `finance2026`
- Set via env vars `COCKPIT_USER` and `COCKPIT_PASS` in `server/index.js`

---

## 3. Architecture

```
Browser (http://localhost:5173)
    │
    ├─ Vite dev server (proxy /api/* → localhost:3000)
    │
    └─ Node.js Express API Middleware (port 3000)
            │
            ├─ /api/login           → session token auth
            ├─ /api/networth        → reads ERPNext GL Entries
            ├─ /api/budget/:month   → reads ERPNext GL Entries grouped by account
            ├─ /api/forecast/:month → reads/writes local forecasts.json
            ├─ /api/transaction     → creates Journal Entry in ERPNext
            └─ ERPNext (port 8001, token auth with API Key:Secret)
```

### Key Files

| File | Purpose |
|---|---|
| `index.html` | Full page structure: login, sidebar nav, all page panels |
| `src/js/main.js` | All frontend logic: auth, navigation, modules, API calls |
| `src/css/style.css` | Full styling: CSS variables, layout, components |
| `server/index.js` | Express API proxy — all backend endpoints |
| `server/budgets.json` | Persisted monthly budget targets (auto-created) |
| `server/forecasts.json` | Persisted expected cash flows (auto-created) |
| `vite.config.js` | Vite config — proxies `/api` to port 3000 |

### ERPNext Config in server/index.js
```javascript
const ERP_URL = process.env.ERP_URL || 'http://109.123.248.154:8001';
const ERP_API_KEY = process.env.ERP_API_KEY || '';
const ERP_API_SECRET = process.env.ERP_API_SECRET || '';
const COMPANY = 'Michael Emil';
const ABBR = 'ME';     // ERPNext company abbreviation (used in account names, e.g. "Car Expenses - ME")
```

---

## 4. Michael's Financial Structure

### 4.1 Currency Environment
Michael operates across three currencies:
- **EGP** — Egyptian Pound (primary networth currency)
- **AED** — UAE Dirham (Dubai bank accounts, Dubai-based expenses)
- **USD** — US Dollar (investments, Shopify loan, Splitwise balances)

**Key FX Rates Used (approximate, as of March 2026):**
- 1 AED = 13.38 EGP
- 1 USD = 50.80 EGP

**Rule:** All balances on the dashboard are shown in **EGP** as the master currency. Where the native currency differs (e.g. Dubai bank in AED), the AED amount is displayed in parentheses beside the EGP value for easy bank statement reconciliation.

---

### 4.2 Asset Breakdown

#### Real Estate 🏢
| Property | EGP Balance | Notes |
|---|---|---|
| San Stefano | 2,500,000 | Egypt, EGP |
| Damac | 4,715,982.60 | Dubai, UAE — native `AED 351,939.00` shown |
| Sawary | 8,000,000 | Egypt, EGP |

#### Egypt Banks 🇪🇬
| Account | Balance (EGP) | Notes |
|---|---|---|
| CIB Current | 110,000 | |
| CIB Savings | 258,000 | |
| CIB USD | 180,000 | USD account, shown as EGP equivalent |
| FAB | 40,000 | |
| BM | 10,000 | |
| Cash In Hand | 35,000 | Physical cash |

#### Dubai Banks 🇦🇪
| Account | Balance (EGP) | Native AED |
|---|---|---|
| Mashreq NEO | 14,725 | AED 1,100 |
| Mashreq Current | 30,636 | AED 2,290 |
| ADCB | 127,110 | AED 9,500 |
| AlHilal | 5,485.8 | AED 410 |

#### Investments 📈
| Asset | Balance (EGP) | Notes |
|---|---|---|
| Meta | 152,400 | Stocks |
| Microsoft | 95,250 | Stocks |
| BTC | 487,125 | Crypto — show BTC amount alongside EGP |

#### Cars 🚗
| Asset | Balance (EGP) | Notes |
|---|---|---|
| MG One | 910,000 | |
| BMW | 1,410,000 | |

#### UAE Egypt Installments (split category)
UAE installments (Tabby Card, Tamara, Tabby) — show AED amount too.
Egypt installments — show in EGP only.

#### UAE Installments 🇦🇪
| Item | Balance (EGP) | Native AED |
|---|---|---|
| Tabby Card | varies | show AED |
| Tamara | varies | show AED |
| Tabby | varies | show AED |

---

### 4.3 Liability Breakdown

#### Loans
| Liability | Balance (EGP) | Notes |
|---|---|---|
| Cars Loan | 2,046,006 | |
| Real Estate Loan | 1,400,000 | |
| Shopify (Clearco) | 486,129 | USD-based loan — native `$9,921.00` shown |
| Withdrawal (ECHO) | 1,172,600 | AED-based — native `AED 23,886.00` shown |

#### Splitwise (tracked separately in USD)
Splitwise partner balances are in **USD**, not AED.
- **Magdy** — Commission-based partner
- **Mina** — Balance owed
- **Dina** — Balance owed

---

### 4.4 Cash Flow Logic (Critical — Read Carefully)

Michael's Google Sheet "Cash Flow 2026" tracks what he calls **Expected vs. Actual** for each month. Every row in the sheet has three conceptual states:

| State | Visual in Sheet | Meaning |
|---|---|---|
| **Expected** | Cell has a number, no fill color | Planned/placeholder value — money hasn't moved yet |
| **Processed** | Cell has green fill | Money has physically arrived or left the bank |
| **Partial** | Gray fill | Partially paid (e.g. 2,500 of a 48,000 budget paid so far) |

**The Dashboard replicates this with:**
- ⏳ = Expected (not yet processed)
- ✅ = Processed (click an item to toggle it)

#### Income Sources (March 2026 example)
| Source | Expected (EGP) | Notes |
|---|---|---|
| Prive Marketing | 104,250 | Client payment — typically received, fills green |
| Withdrawal (ECHO) | ~150,000 | Commission from ECHO project. This is a **placeholder average** — it NEVER lands at exactly 150k. Will be resolved end of month. |
| Ciccio + System | 179,988 | Monthly retainer = AED 13,432 converted to EGP |
| Salary | 30,000 | Fixed, expected end of month, unfilled till then |
| Magdy | ~56,896 | Commission-based, variable each month |
| Agency (Elkamoush) | 76,000 | Client renewal: Michael paid 58k for hosting renewal, client owes 76k back. Profit = 18k. Stays as Expected until client pays. |
| Other / Ad-Hoc | varies | One-offs: Raafat Loan Return (77,500), Thrifty Car Rental Refund, etc. |

#### Expense Categories (Sunk / Fixed Monthly)
| Category | Budget (EGP) | Notes |
|---|---|---|
| Sodic Rent | 58,000 | Fixed |
| Stanley Rent | 13,200 | Fixed |
| MG One Installment | 38,000 | Car installment (was "Car Expenses") |
| Home | 10,000 | Fixed home expenses |
| Michael (Personal) | 30,000 | Personal spending |
| Nursery | 8,000 | Fixed |
| Nosa | 9,000 | Fixed |
| Reda | 6,000 | Fixed |
| Agency Salaries | 35,000 | Fixed |
| Ads | 48,000 | **Partial** — tracked; only 2,500 may be spent in a given month |
| Others | **No Limit** | Ad-hoc expenses: hotel, random purchases, gifts. Examples: Marriott (AED 800), Coffee Machine (EGP 17k), Mama (EGP 2k) |

**Key rule:** `Agency` (the client project revenue generator) does **NOT** have a fixed monthly budget. It's tracked via the ad-hoc Cash Flow expected entries, not the Budget Tracker.

---

### 4.5 Splitwise Accounts
- Splitwise is tracked in **USD** (not AED)
- Magdy: receives commission from the CO project, also covers costs for Soderhub + NetEra
- Mina, Dina: simpler balances owed

---

## 5. Completed Modules

### ✅ Module 1: Networth Overview (Home)
- Animated total networth card (EGP)
- 4 stats: Total Assets, Total Liabilities, Total Cash, Investments
- Assets Breakdown (collapsible groups with sub-items)
- Liabilities Breakdown (collapsible groups with sub-items)
- AED amounts shown in parentheses for Dubai accounts (Mashreq NEO, Mashreq Current, ADCB, AlHilal)
- Damac shows `(AED 351,939.00)` natively
- Withdrawal shows `(AED 23,886.00)` natively
- Shopify shows `($9,921.00)` natively
- **Data source:** Hardcoded as `OPENING_DATA` object in `main.js` (was manually imported from Google Sheet)
- **Future:** Should pull live from ERPNext `/api/networth` when balances are properly entered

### ✅ Module 2: More Page (Banks, Investments, Splitwise)
- Accessible via "More" sidebar link
- Shows groups: Banks & Cash, Investments, Splitwise Partner Accounts

### ✅ Module 3: Monthly Cash Flow (Expected vs. Actual)
- Income list with ⏳/✅ toggleable items
- Fixed expense list from budget targets
- Ad-hoc expense forecast items (e.g. Ciccio + System)
- `＋ Add Expectation` button — opens a prompt to add one-off expected items for the current month (saved to `forecasts.json`)
- Click any income/expense forecast item to toggle its ⏳/✅ status
- Data stored in `server/forecasts.json`
- **Known limitation:** Budget targets are hardcoded in the Cash Flow renderer (not dynamically pulled from the budget API, to avoid slow ERPNext GL calls)

### ✅ Module 4: Budget Tracker
- Visual progress bars per category (green/yellow/red health)
- Categories with `target: 0` show "No Limit" instead of a broken bar
- Budget targets stored in `server/budgets.json`
- Data dynamically fetched from `/api/budget/:month` — this calls ERPNext GL Entries to compute actual spending
- **Known issue:** ERPNext GL has no real expense entries yet (only opening balances loaded), so all spending shows as 0. Will populate as user logs transactions.

### ✅ Module 5: Quick Transaction Entry
- Form: Amount, Currency (EGP/AED/USD), Date, From Account, Category, Note
- Submits as Journal Entry to ERPNext via `/api/transaction`
- Shows recent transactions list after submission
- All categories are now correctly mapped (MG One Installment, Home, no Agency in fixed budget)

---

## 6. Remaining Work (Roadmap)

### 🔲 Module 6: Investments & Stocks
- Live stock price feed (Yahoo Finance API or Alpha Vantage)
- Cards for Meta, Microsoft, BTC
- Show current price, quantity, EGP value, and gain/loss since opening
- Manual "Refresh Prices" button

### 🔲 Module 7: Partner Accounts (Splitwise)
- Cards per person: Magdy, Mina, Dina
- Balances shown in USD with EGP equivalent
- Magdy detail view: income from CO, expenses for Soderhub + NetEra, net balance
- Quick Settlement entry form

### 🔲 Deployment to VPS
- Build Vite production bundle (`npm run build`)
- Upload `dist/` folder to Contabo VPS
- Deploy `server/` (Express middleware) as a PM2 service on the VPS
- Configure Nginx to serve the cockpit at `finance.michaelemil.com`
- Set ERPNext API keys as environment variables on the server

### 🔲 Phase 3: AI Integration (openclaw)
- Provide the API middleware endpoints to the AI agent
- Define system prompt instructing it to create journal entries via `/api/transaction`
- AI can act on commands like "Log 500 EGP for Home expenses from CIB Current"

---

## 7. Known Issues & Bugs

| Issue | Status | Notes |
|---|---|---|
| Budget shows all zeros | Expected | ERPNext only has opening balances, no real expense GL entries yet |
| Cash Flow toggle doesn't toggle budget expenses | By design | Budget items in Cash Flow are not individually toggleable (no ID) |
| `Raafat Loan Return` in forecasts.json marked as `expected` | Check | Should likely be `processed` if money was already received in March |
| Server restarts clear session tokens | Known | In-memory token map; after `node server/index.js` restart, users must log in again |
| `server/budgets.json` must be manually overwritten to override defaults | Fixed | Overwrote the file directly to apply the new budget categories |

---

## 8. ERPNext Details

- **Company Name:** `Michael Emil`
- **Company Abbreviation:** `ME`
- **ERPNext account name format:** `{Account Name} - ME` (e.g. `Car Expenses - ME`)
- **Chart of Accounts loaded:** Yes — all accounts for assets, liabilities, income, expenses
- **Opening balances:** Yes — imported from Google Sheet as of start of 2026
- **Real transactions:** None yet. All actual spending must be logged via the Quick Transaction form.

### ERPNext API Auth
Token auth format: `Authorization: token {API_KEY}:{API_SECRET}`  
API Key and Secret are stored in `server/index.js` env vars `ERP_API_KEY` and `ERP_API_SECRET`.

---

## 9. Design System

The app uses a custom CSS variable system. Key tokens:

```css
--bg-primary: #0d1117        /* Deep dark background */
--bg-secondary: #161b22      /* Card backgrounds */
--bg-tertiary: #1c2128       /* Nested elements */
--accent-blue: #388bfd       /* Primary actions */
--accent-emerald: #3fb950    /* Positive/income */
--accent-red: #f85149        /* Negative/liabilities */
--accent-amber: #d29922      /* Warnings */
--accent-purple: #8957e5     /* Investments */
--text-primary: #e6edf3      /* Main text */
--text-muted: #8b949e        /* Secondary text */
```

### Layout
- **Desktop:** Fixed sidebar (220px wide) + main content area fills remaining width
- **Mobile:** Sidebar hidden, bottom navigation bar shown instead
- **Breakpoint:** 768px

---

## 10. Google Sheet Context (Reference Only)

The original Google Sheet had the following tabs:
- **Networth 2026** — Monthly networth with per-asset balances
- **Cash Flow 2026** — Monthly income/expense tracker (columns = months, rows = items)
- **Magdy** — Splitwise partner account for Magdy (commission split)

The sheet used cell fill colors to indicate status:
- 🟩 **Green fill** = Processed / received / paid
- ⬜ **No fill** = Expected / pending
- 🌫️ **Gray fill** = Partially processed

This logic is now replicated in the Cockpit via the ⏳/✅ toggle system on the Cash Flow page.

---

*Last updated: March 2026. Document maintained by AI agent. Update this file whenever major architectural decisions are made or modules are completed.*
