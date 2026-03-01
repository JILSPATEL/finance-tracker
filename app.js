/**
 * FinTrack — App Core Logic (app.js)
 * Handles: Google Sheets API, data parsing, analytics, UI rendering, navigation
 */

// =============================================
//  GOOGLE SHEETS API LAYER
// =============================================
const SheetsAPI = {
    /**
     * Fetch all rows from a specific sheet tab.
     * @param {string} sheetName - Exact name of the sheet tab
     * @returns {Promise<Array[]>} - 2D array of cell values
     */
    async fetchSheet(sheetName) {
        if (!CONFIG.SHEET_ID || CONFIG.SHEET_ID === "YOUR_SHEET_ID_HERE") {
            throw new Error("SETUP_NEEDED");
        }
        if (!CONFIG.API_KEY || CONFIG.API_KEY === "YOUR_API_KEY_HERE") {
            throw new Error("SETUP_NEEDED");
        }

        const range = encodeURIComponent(`${sheetName}!A:G`);
        const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SHEET_ID}/values/${range}?key=${CONFIG.API_KEY}`;

        const res = await fetch(url);
        if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            const msg = err?.error?.message || `HTTP ${res.status}`;
            throw new Error(msg);
        }

        const data = await res.json();
        return data.values || [];
    },
};

// =============================================
//  DATA PROCESSOR
// =============================================
const DataProcessor = {
    /**
     * Parse raw rows into structured transaction objects.
     * @param {Array[]} rows - Raw rows including header
     * @returns {Object[]} - Parsed transactions
     */
    parse(rows) {
        if (!rows || rows.length <= CONFIG.HEADER_ROWS) return [];

        const dataRows = rows.slice(CONFIG.HEADER_ROWS);

        return dataRows
            .filter(row => {
                // Skip empty rows and summary rows at the bottom
                // (those have no Sri No and no For What — just totals)
                if (!row || row.length <= CONFIG.COLUMNS.AMOUNT) return false;
                const sriNo = (row[CONFIG.COLUMNS.SRI_NO] || "").trim();
                const forWhat = (row[CONFIG.COLUMNS.FOR_WHAT] || "").trim();
                const action = (row[CONFIG.COLUMNS.ACTION] || "").trim().toLowerCase();
                // Keep rows that have a Sri No (real transaction rows)
                // Skip summary rows (no Sri No, no For What, action is "credit"/"debit" totals)
                if (!sriNo && !forWhat) return false;
                return true;
            })
            .map((row, idx) => {
                // Amount may be: "₹5,362" or "-₹798" or "₹297,800"
                const rawAmount = (row[CONFIG.COLUMNS.AMOUNT] || "0")
                    .toString()
                    .replace(/[₹,\s]/g, "")   // remove ₹ comma spaces
                    .replace(/−/g, "-");        // handle special unicode minus

                const amount = parseFloat(rawAmount) || 0;
                const action = (row[CONFIG.COLUMNS.ACTION] || "").trim();

                return {
                    index: idx + 1,
                    date: (row[CONFIG.COLUMNS.DATE] || "").trim(),
                    forWhat: (row[CONFIG.COLUMNS.FOR_WHAT] || "").trim(),
                    action: action,
                    mode: (row[CONFIG.COLUMNS.MODE] || "").trim(),
                    amount: Math.abs(amount),  // always store absolute value
                    monthLabel: (row[CONFIG.COLUMNS.MONTHLY_LABEL] || "").trim(),
                    rawRow: row,
                };
            })
            .filter(t => t.forWhat !== "" && t.date !== ""); // must have description + date
    },

    /**
     * Parse date string (DD/MM/YYYY or MM/DD/YYYY) to Date object.
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        // Try DD/MM/YYYY
        const parts = dateStr.split("/");
        if (parts.length === 3) {
            const d = parseInt(parts[0]), m = parseInt(parts[1]), y = parseInt(parts[2]);
            if (d > 12) return new Date(y, m - 1, d); // DD/MM/YYYY
            return new Date(y, m - 1, d);             // default DD/MM/YYYY
        }
        return new Date(dateStr);
    },

    /**
     * Group transactions by month (YYYY-MM key, human-readable label).
     */
    groupByMonth(transactions) {
        const months = {};
        transactions.forEach(t => {
            const d = this.parseDate(t.date);
            if (!d || isNaN(d)) return;
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
            if (!months[key]) months[key] = { key, label, transactions: [], expense: 0, income: 0 };
            months[key].transactions.push(t);
            if (t.action.toLowerCase() === "debit") months[key].expense += t.amount;
            else if (t.action.toLowerCase() === "credit") months[key].income += t.amount;
        });
        // Sort by month key
        return Object.values(months).sort((a, b) => a.key.localeCompare(b.key));
    },

    /**
     * Group by category (forWhat field).
     */
    groupByCategory(transactions) {
        const cats = {};
        transactions
            .filter(t => t.action.toLowerCase() === "debit")
            .forEach(t => {
                const key = t.forWhat || "Other";
                cats[key] = (cats[key] || 0) + t.amount;
            });
        return Object.entries(cats)
            .map(([name, amount]) => ({ name, amount }))
            .sort((a, b) => b.amount - a.amount);
    },

    /**
     * Group by bank/mode.
     */
    groupByBank(transactions) {
        const banks = {};
        transactions.forEach(t => {
            const key = t.mode || "Unknown";
            if (!banks[key]) banks[key] = { name: key, count: 0, debit: 0, credit: 0 };
            banks[key].count++;
            if (t.action.toLowerCase() === "debit") banks[key].debit += t.amount;
            else if (t.action.toLowerCase() === "credit") banks[key].credit += t.amount;
        });
        return Object.values(banks).sort((a, b) => b.count - a.count);
    },

    /**
     * Compute summary analytics.
     */
    computeSummary(transactions) {
        let totalExpense = 0, totalIncome = 0;
        let biggestExpense = 0, biggestExpenseLabel = "—";

        transactions.forEach(t => {
            if (t.action.toLowerCase() === "debit") {
                totalExpense += t.amount;
                if (t.amount > biggestExpense) {
                    biggestExpense = t.amount;
                    biggestExpenseLabel = t.forWhat;
                }
            } else if (t.action.toLowerCase() === "credit") {
                totalIncome += t.amount;
            }
        });

        const months = this.groupByMonth(transactions);
        const avgMonthlySpend = months.length > 0 ? totalExpense / months.length : 0;

        return {
            totalExpense,
            totalIncome,
            netBalance: totalIncome - totalExpense,
            count: transactions.length,
            biggestExpense,
            biggestExpenseLabel,
            avgMonthlySpend,
        };
    },
};

// =============================================
//  UI HELPERS
// =============================================
const UI = {
    fmt(amount) {
        return CONFIG.CURRENCY + amount.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    },

    setStatus(state, text) {
        const badge = document.getElementById("statusBadge");
        const statusText = document.getElementById("statusText");
        badge.className = `status-badge ${state}`;
        statusText.textContent = text;
    },

    showLoading(show, text = "Fetching data from Google Sheets…") {
        const overlay = document.getElementById("loadingOverlay");
        const loadingText = document.getElementById("loadingText");
        overlay.classList.toggle("show", show);
        if (text) loadingText.textContent = text;

        const btn = document.getElementById("refreshBtn");
        btn.classList.toggle("loading", show);
    },

    toast(msg, type = "error") {
        const container = document.getElementById("toastContainer");
        const el = document.createElement("div");
        el.className = `toast ${type}`;
        el.innerHTML = `<span class="toast-icon">${type === "error" ? "❌" : "✅"}</span><span class="toast-msg">${msg}</span>`;
        container.appendChild(el);
        setTimeout(() => el.remove(), 4000);
    },

    updateKPIs(summary) {
        document.getElementById("kpi-expense").textContent = this.fmt(summary.totalExpense);
        document.getElementById("kpi-income").textContent = this.fmt(summary.totalIncome);

        const balEl = document.getElementById("kpi-balance");
        const net = summary.netBalance;
        balEl.textContent = this.fmt(Math.abs(net));
        balEl.style.color = net >= 0 ? "var(--accent-green)" : "var(--accent-red)";
        document.getElementById("kpi-balance-sub").textContent = net >= 0 ? "You're in surplus 🎉" : "You're in deficit ⚠️";

        document.getElementById("kpi-count").textContent = summary.count;
        document.getElementById("kpi-biggest").textContent = this.fmt(summary.biggestExpense);
        document.getElementById("kpi-biggest-sub").textContent = summary.biggestExpenseLabel || "—";
        document.getElementById("kpi-avg").textContent = this.fmt(summary.avgMonthlySpend);
    },

    updateMonthlyTable(months) {
        const tbody = document.getElementById("monthlyTableBody");
        if (!months.length) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon">📊</div><p>No monthly data</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = months.map(m => {
            const net = m.income - m.expense;
            const netClass = net >= 0 ? "positive" : "negative";
            return `<tr>
        <td class="font-bold">${m.label}</td>
        <td>${m.transactions.length}</td>
        <td>${UI.fmt(m.expense)}</td>
        <td>${UI.fmt(m.income)}</td>
        <td class="${netClass}">${net >= 0 ? "+" : ""}${UI.fmt(net)}</td>
      </tr>`;
        }).join("");
    },

    updateBankTable(banks) {
        const tbody = document.getElementById("bankTableBody");
        if (!banks.length) {
            tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon">🏦</div><p>No bank data</p></div></td></tr>`;
            return;
        }
        tbody.innerHTML = banks.map(b => {
            const net = b.credit - b.debit;
            const netClass = net >= 0 ? "positive" : "negative";
            return `<tr>
        <td><span class="mode-badge">${b.name}</span></td>
        <td>${b.count}</td>
        <td class="amount-debit">${UI.fmt(b.debit)}</td>
        <td class="amount-credit">${UI.fmt(b.credit)}</td>
        <td class="${netClass}">${net >= 0 ? "+" : ""}${UI.fmt(Math.abs(net))}</td>
      </tr>`;
        }).join("");
    },

    updateCategoryList(categories) {
        const container = document.getElementById("categoryList");
        if (!categories.length) {
            container.innerHTML = `<p class="text-muted" style="font-size:13px;padding:20px 0;">No category data</p>`;
            return;
        }
        const top10 = categories.slice(0, 10);
        const max = top10[0].amount;
        container.innerHTML = top10.map(cat => `
      <div class="category-item">
        <span class="category-name" title="${cat.name}">${cat.name}</span>
        <div class="category-bar-wrap">
          <div class="category-bar" style="width: ${(cat.amount / max * 100).toFixed(1)}%"></div>
        </div>
        <span class="category-amount">${UI.fmt(cat.amount)}</span>
      </div>
    `).join("");
    },

    populateTransactionFilters(transactions) {
        const modes = [...new Set(transactions.map(t => t.mode).filter(Boolean))].sort();
        const modeSelect = document.getElementById("filterMode");
        modeSelect.innerHTML = `<option value="">All Banks</option>` + modes.map(m => `<option value="${m}">${m}</option>`).join("");

        const months = [...new Set(transactions.map(t => {
            const d = DataProcessor.parseDate(t.date);
            if (!d || isNaN(d)) return null;
            return d.toLocaleString("en-IN", { month: "short", year: "numeric" });
        }).filter(Boolean))];

        const monthSelect = document.getElementById("filterMonth");
        monthSelect.innerHTML = `<option value="">All Months</option>` + months.map(m => `<option value="${m}">${m}</option>`).join("");
    },

    renderTransactionTable(transactions) {
        const tbody = document.getElementById("transactionTableBody");
        document.getElementById("tableCount").textContent = `${transactions.length} entries`;

        if (!transactions.length) {
            tbody.innerHTML = `<tr><td colspan="6"><div class="table-empty"><div class="empty-icon">📋</div><p>No matching transactions</p></div></td></tr>`;
            return;
        }

        tbody.innerHTML = transactions.map((t, i) => {
            const actionClass = t.action.toLowerCase() === "debit" ? "debit" : "credit";
            const amtClass = actionClass === "debit" ? "amount-debit" : "amount-credit";
            const sign = actionClass === "debit" ? "-" : "+";
            return `<tr>
        <td class="text-muted">${i + 1}</td>
        <td>${t.date}</td>
        <td>${t.forWhat || "—"}</td>
        <td><span class="badge ${actionClass}">${t.action}</span></td>
        <td><span class="mode-badge">${t.mode || "—"}</span></td>
        <td class="${amtClass}">${sign}${UI.fmt(t.amount)}</td>
      </tr>`;
        }).join("");
    },

    showSetupBanner(show) {
        document.getElementById("setupBanner").classList.toggle("hidden", !show);
    },

    setHeader(title, subtitle) {
        document.getElementById("pageTitle").textContent = title;
        document.getElementById("pageSubtitle").textContent = subtitle;
    },
};

// =============================================
//  MAIN APP CONTROLLER
// =============================================
const App = {
    data: [],
    currentSemester: "",
    currentPage: "dashboard",
    sortField: "date",
    sortAsc: true,
    _lastFetchTime: null,

    /** Initialize app on load */
    async init() {
        this.buildSemesterSelector();
        this.currentSemester = CONFIG.SEMESTERS[0] || "";
        this.navigate("dashboard");

        const isConfigured = CONFIG.SHEET_ID !== "YOUR_SHEET_ID_HERE" && CONFIG.API_KEY !== "YOUR_API_KEY_HERE";
        UI.showSetupBanner(!isConfigured);

        if (isConfigured) {
            await this.fetchAndRender();
        } else {
            UI.setStatus("error", "Not configured");
            UI.setHeader("Dashboard", "Please complete setup in config.js");
        }
    },

    buildSemesterSelector() {
        const sel = document.getElementById("semesterSelect");
        sel.innerHTML = CONFIG.SEMESTERS.map(s => `<option value="${s}">${s}</option>`).join("");
        this.currentSemester = CONFIG.SEMESTERS[0] || "";
    },

    async changeSemester(sem) {
        this.currentSemester = sem;
        await this.fetchAndRender();
    },

    async refresh() {
        await this.fetchAndRender();
    },

    async fetchAndRender() {
        UI.showLoading(true, `Loading ${this.currentSemester}…`);
        UI.setStatus("", "Fetching…");

        try {
            const rows = await SheetsAPI.fetchSheet(this.currentSemester);
            this.data = DataProcessor.parse(rows);
            this._lastFetchTime = new Date();

            UI.showSetupBanner(false);
            UI.setStatus("connected", `${this.currentSemester} · ${this.data.length} rows`);
            UI.setHeader(this.currentSemester, `Last updated: ${this._lastFetchTime.toLocaleTimeString()}`);
            UI.toast(`Loaded ${this.data.length} transactions from ${this.currentSemester}`, "success");

            this.renderAll();
        } catch (err) {
            UI.showLoading(false);
            if (err.message === "SETUP_NEEDED") {
                UI.showSetupBanner(true);
                UI.setStatus("error", "Setup required");
                UI.toast("Please fill in your Sheet ID and API Key in config.js", "error");
            } else {
                UI.setStatus("error", "Fetch failed");
                UI.toast(`Error: ${err.message}`, "error");
            }
            return;
        }

        UI.showLoading(false);
    },

    renderAll() {
        const transactions = this.data;

        // Analytics Data: Filter out excluded keywords (e.g. fees)
        let analyticsData = transactions;
        if (CONFIG.EXCLUDE_FROM_ANALYTICS && CONFIG.EXCLUDE_FROM_ANALYTICS.length) {
            analyticsData = transactions.filter(t => {
                const desc = t.forWhat.toLowerCase();
                return !CONFIG.EXCLUDE_FROM_ANALYTICS.some(ex => desc.includes(ex.toLowerCase()));
            });
        }

        const summary = DataProcessor.computeSummary(analyticsData);
        const months = DataProcessor.groupByMonth(analyticsData);
        const categories = DataProcessor.groupByCategory(analyticsData);
        const banks = DataProcessor.groupByBank(analyticsData);

        // KPI Cards
        UI.updateKPIs(summary);

        // Tables
        UI.updateMonthlyTable(months);
        UI.updateBankTable(banks);
        UI.updateCategoryList(categories);

        // Transaction Table Filters (use ALL transactions)
        UI.populateTransactionFilters(transactions);
        this.filterTransactions();

        // Charts (use filtered Analytics Data)
        ChartManager.renderMonthlyBar("monthlyBarChart", months);
        ChartManager.renderMonthlyBar("monthlyBarChart2", months);
        ChartManager.renderCategoryDonut("categoryDonutChart", categories);
        ChartManager.renderCategoryDonut("categoryDonutChart2", categories);
        ChartManager.renderCategoryBar("categoryBarChart", categories);
        ChartManager.renderBankPie("bankPieChart", banks);
        ChartManager.renderBankPie("bankPieChart2", banks);
        ChartManager.renderBankBar("bankBarChart", banks);
        ChartManager.renderBalanceLine("balanceLineChart", analyticsData);
    },

    navigate(page) {
        // Update nav items
        document.querySelectorAll(".nav-item").forEach(el => el.classList.remove("active"));
        const navEl = document.getElementById(`nav-${page}`);
        if (navEl) navEl.classList.add("active");

        // Show/hide pages
        document.querySelectorAll(".page").forEach(el => el.classList.remove("active"));
        const pageEl = document.getElementById(`page-${page}`);
        if (pageEl) pageEl.classList.add("active");

        this.currentPage = page;

        // Update header titles
        const titles = {
            dashboard: ["Dashboard", "Overview of your finances"],
            monthly: ["Monthly Analysis", "Month-by-month breakdown"],
            category: ["Category Analysis", "Where your money goes"],
            banks: ["Bank / Mode Analysis", "Bank usage breakdown"],
            transactions: ["All Transactions", "Browse and filter every entry"],
        };
        const [title, sub] = titles[page] || ["Finance Tracker", ""];
        UI.setHeader(title, this._lastFetchTime ? `Last updated: ${this._lastFetchTime.toLocaleTimeString()}` : sub);
    },

    filterTransactions() {
        const search = (document.getElementById("searchInput")?.value || "").toLowerCase();
        const action = document.getElementById("filterAction")?.value || "";
        const mode = document.getElementById("filterMode")?.value || "";
        const month = document.getElementById("filterMonth")?.value || "";
        const dateFromVal = document.getElementById("dateFrom")?.value || "";
        const dateToVal = document.getElementById("dateTo")?.value || "";

        // Parse date filter bounds (user picks YYYY-MM-DD via date input)
        const dateFrom = dateFromVal ? new Date(dateFromVal) : null;
        const dateTo = dateToVal ? new Date(dateToVal + "T23:59:59") : null;

        let filtered = [...this.data];

        if (search) {
            filtered = filtered.filter(t =>
                t.forWhat.toLowerCase().includes(search) ||
                t.mode.toLowerCase().includes(search) ||
                t.date.includes(search)
            );
        }
        if (action) filtered = filtered.filter(t => t.action === action);
        if (mode) filtered = filtered.filter(t => t.mode === mode);
        if (month) {
            filtered = filtered.filter(t => {
                const d = DataProcessor.parseDate(t.date);
                if (!d || isNaN(d)) return false;
                return d.toLocaleString("en-IN", { month: "short", year: "numeric" }) === month;
            });
        }
        // Date range filter
        if (dateFrom || dateTo) {
            filtered = filtered.filter(t => {
                const d = DataProcessor.parseDate(t.date);
                if (!d || isNaN(d)) return false;
                if (dateFrom && d < dateFrom) return false;
                if (dateTo && d > dateTo) return false;
                return true;
            });
        }

        // Sort
        filtered.sort((a, b) => {
            if (this.sortField === "date") {
                const da = DataProcessor.parseDate(a.date) || new Date(0);
                const db = DataProcessor.parseDate(b.date) || new Date(0);
                return this.sortAsc ? da - db : db - da;
            }
            if (this.sortField === "amount") {
                return this.sortAsc ? a.amount - b.amount : b.amount - a.amount;
            }
            return 0;
        });

        UI.renderTransactionTable(filtered);
    },

    clearDateRange() {
        const df = document.getElementById("dateFrom");
        const dt = document.getElementById("dateTo");
        if (df) df.value = "";
        if (dt) dt.value = "";
        this.filterTransactions();
    },

    sortTable(field) {
        if (this.sortField === field) {
            this.sortAsc = !this.sortAsc;
        } else {
            this.sortField = field;
            this.sortAsc = false; // default: high to low
        }
        this.filterTransactions();
    },

    // =============================================
    //  MODAL HANDLERS
    // =============================================
    openAddSemesterModal() {
        document.getElementById("semesterModal").classList.add("show");
        document.getElementById("newSemesterInput").value = "";
        document.getElementById("semesterPreview").innerHTML = "";
        setTimeout(() => document.getElementById("newSemesterInput").focus(), 80);
    },

    openAddTransactionModal() {
        document.getElementById("transactionModal").classList.add("show");
        document.getElementById("transactionPreview").innerHTML = "";

        // Check if Web App URL is configured
        const warning = document.getElementById("transSetupWarning");
        const submitBtn = document.getElementById("transSubmitBtn");
        if (!CONFIG.ADD_TRANSACTION_WEB_APP_URL) {
            warning.style.display = "block";
            submitBtn.disabled = true;
            submitBtn.style.opacity = "0.5";
            submitBtn.style.cursor = "not-allowed";
        } else {
            warning.style.display = "none";
            submitBtn.disabled = false;
            submitBtn.style.opacity = "1";
            submitBtn.style.cursor = "pointer";
        }

        // Pre-fill date to today
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        document.getElementById("transDate").value = `${yyyy}-${mm}-${dd}`;

        document.getElementById("transForWhat").value = "";
        document.getElementById("transAction").value = "Debit";
        document.getElementById("transMode").value = "";
        document.getElementById("transAmount").value = "";
    },

    closeModal(e, modalId) {
        if (e && e.target !== document.getElementById(modalId)) return;
        document.getElementById(modalId).classList.remove("show");
    },

    async confirmAddSemester() {
        const input = document.getElementById("newSemesterInput");
        const preview = document.getElementById("semesterPreview");
        const name = input.value.trim();

        if (!name) {
            input.style.borderColor = "var(--accent-red)";
            setTimeout(() => input.style.borderColor = "", 1500);
            return;
        }

        // Check for duplicates
        if (CONFIG.SEMESTERS.includes(name)) {
            preview.innerHTML = `<span style="color:var(--accent-orange)">⚠️ "${name}" already exists in the list.</span>`;
            return;
        }

        // Verify the sheet tab exists by trying to fetch
        preview.innerHTML = `<span style="color:var(--text-secondary)">🔄 Verifying sheet tab…</span>`;
        try {
            const rows = await SheetsAPI.fetchSheet(name);
            // Success — add to list and switch
            CONFIG.SEMESTERS.push(name);
            const sel = document.getElementById("semesterSelect");
            const opt = document.createElement("option");
            opt.value = name;
            opt.textContent = name;
            sel.appendChild(opt);
            sel.value = name;

            document.getElementById("semesterModal").classList.remove("show");
            UI.toast(`Semester "${name}" added with ${rows.length - 1} rows ✅`, "success");
            await this.changeSemester(name);
        } catch (err) {
            preview.innerHTML = `<span style="color:var(--accent-red)">❌ Could not load sheet "${name}". Make sure the tab name matches exactly.</span>`;
        }
    },

    async confirmAddTransaction() {
        if (!CONFIG.ADD_TRANSACTION_WEB_APP_URL) return;

        const dateVal = document.getElementById("transDate").value;
        const forWhat = document.getElementById("transForWhat").value.trim();
        const action = document.getElementById("transAction").value;
        const mode = document.getElementById("transMode").value.trim();
        const amountStr = document.getElementById("transAmount").value;
        const preview = document.getElementById("transactionPreview");

        if (!dateVal || !forWhat || !mode || !amountStr) {
            preview.innerHTML = `<span style="color:var(--accent-red)">⚠️ Please fill all fields.</span>`;
            return;
        }

        const amount = parseFloat(amountStr);
        if (isNaN(amount) || amount <= 0) {
            preview.innerHTML = `<span style="color:var(--accent-red)">⚠️ Valid amount required.</span>`;
            return;
        }

        // Convert YYYY-MM-DD to DD/MM/YYYY for the sheet
        const [y, m, d] = dateVal.split("-");
        const sheetDate = `${d}/${m}/${y}`;
        // Add currency symbol format
        const sheetAmount = `${CONFIG.CURRENCY}${amount.toLocaleString("en-IN")}`;

        preview.innerHTML = `<span style="color:var(--text-secondary)">🔄 Saving to Google Sheet…</span>`;
        const submitBtn = document.getElementById("transSubmitBtn");
        submitBtn.disabled = true;

        try {
            const formData = new URLSearchParams();
            const sheetName = this.currentSemester.trim();
            formData.append("sheet", sheetName);
            formData.append("date", sheetDate);
            formData.append("forWhat", forWhat);
            formData.append("action", action);
            formData.append("mode", mode);
            formData.append("amount", sheetAmount);

            preview.innerHTML = `<span style="color:var(--text-secondary)">🔄 Connecting to Google Sheets…</span>`;

            // Technique: Send parameters in BOTH query string and body for maximum compatibility
            const url = new URL(CONFIG.ADD_TRANSACTION_WEB_APP_URL);
            formData.forEach((val, key) => url.searchParams.append(key, val));

            console.log("Submitting to:", url.toString());

            // We use 'no-cors' to bypass strict browser checks from local files.
            // Note: This always returns an 'opaque' response (we can't see the result text).
            await fetch(url.toString(), {
                method: "POST",
                mode: "no-cors",
                body: formData // Some environments prefer body, others query string
            });

            // If we reach here without a network error, the request was SENT.
            this.closeModal(null, "transactionModal");
            UI.toast(`Submitted "${forWhat}" ✅`, "success");
            UI.toast(`Check your sheet in a few seconds...`, "success");

            // Refresh table after a longer delay
            setTimeout(async () => {
                await this.refresh();
            }, 3000);
        } catch (err) {
            console.error("Add transaction error details:", err);
            preview.innerHTML = `<span style="color:var(--accent-red)">⚠️ Error: ${err.message}. <br>1. Check internet. <br>2. Check Web App URL in config.js</span>`;
            submitBtn.disabled = false;
        }
    },
};

// Start the app when page is loaded
window.addEventListener("DOMContentLoaded", () => App.init());
