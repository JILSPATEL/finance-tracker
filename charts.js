/**
 * FinTrack — Chart Manager (charts.js)
 * All Chart.js chart configurations with premium dark styling
 */

const ChartManager = (() => {
    const instances = {}; // cache chart instances to destroy before re-render

    // ---- Shared color palettes ----
    const PALETTE = {
        blue: "#4f8ef7",
        purple: "#8b5cf6",
        green: "#10b981",
        red: "#ef4444",
        orange: "#f59e0b",
        cyan: "#06b6d4",
        pink: "#ec4899",
        teal: "#14b8a6",
        indigo: "#6366f1",
        rose: "#f43f5e",
    };

    const MULTI_COLORS = [
        PALETTE.blue, PALETTE.purple, PALETTE.green, PALETTE.orange,
        PALETTE.cyan, PALETTE.pink, PALETTE.teal, PALETTE.indigo,
        PALETTE.rose, PALETTE.red,
    ];

    // ---- Global Chart.js defaults ----
    Chart.defaults.color = "#8892a4";
    Chart.defaults.borderColor = "rgba(255,255,255,0.06)";
    Chart.defaults.font.family = "'Inter', sans-serif";
    Chart.defaults.font.size = 12;

    const baseTooltip = {
        backgroundColor: "rgba(15, 22, 41, 0.95)",
        borderColor: "rgba(255,255,255,0.1)",
        borderWidth: 1,
        titleColor: "#f0f4ff",
        bodyColor: "#8892a4",
        padding: 12,
        cornerRadius: 8,
        titleFont: { size: 13, weight: "600" },
        callbacks: {
            label(ctx) {
                return ` ₹${ctx.parsed.y?.toLocaleString("en-IN") ?? ctx.parsed.toLocaleString("en-IN")}`;
            },
        },
    };

    const baseTooltipPie = {
        ...baseTooltip,
        callbacks: {
            label(ctx) {
                const val = ctx.parsed;
                const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
                const pct = ((val / total) * 100).toFixed(1);
                return ` ₹${val.toLocaleString("en-IN")} (${pct}%)`;
            },
        },
    };

    function destroy(id) {
        if (instances[id]) {
            instances[id].destroy();
            delete instances[id];
        }
    }

    // =============================================
    //  MONTHLY BAR CHART — Income vs Expense
    // =============================================
    function renderMonthlyBar(canvasId, months) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (!ctx) return;

        const labels = months.map(m => m.label);
        const expenses = months.map(m => m.expense);
        const incomes = months.map(m => m.income);

        instances[canvasId] = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Expense",
                        data: expenses,
                        backgroundColor: "rgba(239,68,68,0.7)",
                        borderColor: "rgba(239,68,68,0.9)",
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: "Income",
                        data: incomes,
                        backgroundColor: "rgba(16,185,129,0.7)",
                        borderColor: "rgba(16,185,129,0.9)",
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        position: "top",
                        labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 },
                    },
                    tooltip: baseTooltip,
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: { maxRotation: 30 },
                    },
                    y: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: {
                            callback(val) { return "₹" + val.toLocaleString("en-IN"); },
                        },
                    },
                },
            },
        });
    }

    // =============================================
    //  CATEGORY DONUT CHART
    // =============================================
    function renderCategoryDonut(canvasId, categories) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (!ctx) return;

        const top8 = categories.slice(0, 8);
        const otherTotal = categories.slice(8).reduce((s, c) => s + c.amount, 0);
        const labels = top8.map(c => c.name);
        const data = top8.map(c => c.amount);

        if (otherTotal > 0) {
            labels.push("Others");
            data.push(otherTotal);
        }

        instances[canvasId] = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: MULTI_COLORS.slice(0, labels.length).map(c => c + "cc"),
                    borderColor: MULTI_COLORS.slice(0, labels.length),
                    borderWidth: 2,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: "65%",
                plugins: {
                    legend: {
                        position: "right",
                        labels: {
                            padding: 10,
                            usePointStyle: true,
                            pointStyleWidth: 8,
                            font: { size: 11 },
                            boxWidth: 10,
                        },
                    },
                    tooltip: baseTooltipPie,
                },
            },
        });
    }

    // =============================================
    //  CATEGORY BAR CHART
    // =============================================
    function renderCategoryBar(canvasId, categories) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (!ctx) return;

        const top12 = categories.slice(0, 12);

        instances[canvasId] = new Chart(ctx, {
            type: "bar",
            data: {
                labels: top12.map(c => c.name),
                datasets: [{
                    label: "Expense",
                    data: top12.map(c => c.amount),
                    backgroundColor: MULTI_COLORS.map(c => c + "bb"),
                    borderColor: MULTI_COLORS,
                    borderWidth: 1,
                    borderRadius: 6,
                    borderSkipped: false,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                indexAxis: "y",
                plugins: {
                    legend: { display: false },
                    tooltip: baseTooltip,
                },
                scales: {
                    x: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: { callback(val) { return "₹" + val.toLocaleString("en-IN"); } },
                    },
                    y: {
                        grid: { display: false },
                        ticks: {
                            font: { size: 11 },
                            callback(val, idx) {
                                const label = this.getLabelForValue(val);
                                return label.length > 18 ? label.slice(0, 17) + "…" : label;
                            },
                        },
                    },
                },
            },
        });
    }

    // =============================================
    //  BANK PIE CHART
    // =============================================
    function renderBankPie(canvasId, banks) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (!ctx) return;

        instances[canvasId] = new Chart(ctx, {
            type: "pie",
            data: {
                labels: banks.map(b => b.name),
                datasets: [{
                    data: banks.map(b => b.debit + b.credit),
                    backgroundColor: MULTI_COLORS.slice(0, banks.length).map(c => c + "cc"),
                    borderColor: MULTI_COLORS.slice(0, banks.length),
                    borderWidth: 2,
                    hoverOffset: 8,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "right",
                        labels: { padding: 12, usePointStyle: true, pointStyleWidth: 8 },
                    },
                    tooltip: baseTooltipPie,
                },
            },
        });
    }

    // =============================================
    //  BANK BAR CHART
    // =============================================
    function renderBankBar(canvasId, banks) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (!ctx) return;

        instances[canvasId] = new Chart(ctx, {
            type: "bar",
            data: {
                labels: banks.map(b => b.name),
                datasets: [
                    {
                        label: "Debit",
                        data: banks.map(b => b.debit),
                        backgroundColor: "rgba(239,68,68,0.7)",
                        borderColor: "rgba(239,68,68,0.9)",
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                    {
                        label: "Credit",
                        data: banks.map(b => b.credit),
                        backgroundColor: "rgba(16,185,129,0.7)",
                        borderColor: "rgba(16,185,129,0.9)",
                        borderWidth: 1,
                        borderRadius: 6,
                        borderSkipped: false,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: {
                        position: "top",
                        labels: { padding: 16, usePointStyle: true, pointStyleWidth: 8 },
                    },
                    tooltip: baseTooltip,
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: { callback(val) { return "₹" + val.toLocaleString("en-IN"); } },
                    },
                },
            },
        });
    }

    // =============================================
    //  CUMULATIVE BALANCE LINE CHART
    // =============================================
    function renderBalanceLine(canvasId, transactions) {
        destroy(canvasId);
        const ctx = document.getElementById(canvasId)?.getContext("2d");
        if (!ctx) return;

        // Sort transactions by date
        const sorted = [...transactions]
            .filter(t => DataProcessor.parseDate(t.date))
            .sort((a, b) => DataProcessor.parseDate(a.date) - DataProcessor.parseDate(b.date));

        let running = 0;
        const labels = [];
        const balances = [];

        sorted.forEach(t => {
            const change = t.action.toLowerCase() === "credit" ? t.amount : -t.amount;
            running += change;
            labels.push(t.date);
            balances.push(running);
        });

        // Create gradient
        const gradient = ctx.createLinearGradient(0, 0, 0, 300);
        gradient.addColorStop(0, "rgba(79,142,247,0.3)");
        gradient.addColorStop(1, "rgba(79,142,247,0)");

        instances[canvasId] = new Chart(ctx, {
            type: "line",
            data: {
                labels,
                datasets: [{
                    label: "Cumulative Balance",
                    data: balances,
                    borderColor: "#4f8ef7",
                    borderWidth: 2.5,
                    backgroundColor: gradient,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    pointHoverRadius: 5,
                    pointHoverBackgroundColor: "#4f8ef7",
                    pointHoverBorderColor: "#fff",
                    pointHoverBorderWidth: 2,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: "index", intersect: false },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        ...baseTooltip,
                        callbacks: {
                            label(ctx) {
                                const val = ctx.parsed.y;
                                return ` Balance: ₹${Math.abs(val).toLocaleString("en-IN")} ${val < 0 ? "(deficit)" : "(surplus)"}`;
                            },
                        },
                    },
                },
                scales: {
                    x: {
                        grid: { display: false },
                        ticks: {
                            maxTicksLimit: 8,
                            maxRotation: 30,
                        },
                    },
                    y: {
                        grid: { color: "rgba(255,255,255,0.04)" },
                        ticks: {
                            callback(val) {
                                return (val < 0 ? "-₹" : "₹") + Math.abs(val).toLocaleString("en-IN");
                            },
                        },
                    },
                },
            },
        });
    }

    // Public API
    return {
        renderMonthlyBar,
        renderCategoryDonut,
        renderCategoryBar,
        renderBankPie,
        renderBankBar,
        renderBalanceLine,
    };
})();
