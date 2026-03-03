import { state, dataStore, getActionColor } from './state.js';
import { updateCharts } from './charts.js';

export function updateDashboard() {
    // Use currentData for main dashboard to prevent doubling
    dataStore.activeData = dataStore.currentData.filter(row => {
        const searchStr = `${row.item} ${row.desc} ${row.planRemark}`.toLowerCase();
        const mSearch = !state.search || searchStr.includes(state.search);
        const mPlant = state.plant === 'all' || String(row.plant) === state.plant;
        const mSaleman = state.saleman === 'all' || String(row.saleman) === state.saleman;
        const mCustomer = state.customer === 'all' || String(row.customer) === state.customer;
        const mAge = row.age >= state.ageMin && row.age <= state.ageMax;

        return mSearch && mPlant && mSaleman && mCustomer && mAge;
    });

    let reasonMap = {}, salesmanMap = {};
    let ageBuckets = { '1 เดือน': 0, '2 เดือน': 0, '3 เดือน': 0, '4 เดือน': 0, '5 เดือน': 0, '6 เดือน': 0, '7 เดือน': 0, '8 เดือน': 0, '9 เดือน': 0, '10 เดือน': 0, '11 เดือน': 0, '12 เดือน': 0, '> 1 ปี': 0 };
    let actionCounts = {};
    dataStore.actionOptions.forEach(o => actionCounts[o] = 0);
    let totalExceed = 0, humanError = 0, deadStock = 0, missingCount = 0;
    let totalStockQty = 0, totalPoQty = 0, withPoCount = 0;

    dataStore.activeData.forEach(row => {
        totalExceed += row.overPo;
        totalStockQty += row.stock || 0;
        totalPoQty += row.hasPo || 0;

        // Charts still focus on excess (overPo)
        reasonMap[row.reason] = (reasonMap[row.reason] || 0) + (state.chartMode === 'qty' ? row.overPo : 1);
        salesmanMap[row.saleman] = (salesmanMap[row.saleman] || 0) + row.overPo;

        if (row.age <= 1) ageBuckets['1 เดือน'] += row.overPo;
        else if (row.age >= 12) {
            if (row.age === 12) ageBuckets['12 เดือน'] += row.overPo;
            else ageBuckets['> 1 ปี'] += row.overPo;
        } else {
            ageBuckets[`${row.age} เดือน`] += row.overPo;
        }

        let st = dataStore.actionStates[row._id] || "รอตรวจสอบ";
        if (!dataStore.actionOptions.includes(st)) st = "รอตรวจสอบ";
        actionCounts[st] = (actionCounts[st] || 0) + (state.chartMode === 'qty' ? row.overPo : 1);
    });

    const totalSkus = dataStore.activeData.length;

    // Percentages based on quantity relative to stock
    const poPct = totalStockQty ? Math.round((totalPoQty / totalStockQty) * 100) : 0;
    const overPct = totalStockQty ? Math.round((totalExceed / totalStockQty) * 100) : 0;

    document.getElementById('kpiTotalSkus').textContent = totalSkus.toLocaleString();
    document.getElementById('kpiTotalStock').textContent = totalStockQty.toLocaleString();
    document.getElementById('kpiWithPo').innerHTML = `${totalPoQty.toLocaleString()} <span class="text-xs font-normal opacity-70">(${poPct}%)</span>`;
    document.getElementById('kpiOverPo').innerHTML = `${totalExceed.toLocaleString()} <span class="text-xs font-normal opacity-70">(${overPct}%)</span>`;

    updateProgressUI();
    updateCharts(reasonMap, ageBuckets, salesmanMap, actionCounts);
    renderPivotTable();
    renderFactoryTab();
    renderProgressTab();
    renderTable();
}

export function renderProgressTab() {
    const tbody = document.getElementById('progressGridBody');
    const decreaseList = document.getElementById('notableDecreases');
    if (!tbody || !decreaseList) return;

    tbody.innerHTML = '';
    decreaseList.innerHTML = '';

    // *** IMPORTANT: Use ALL data (not just latestSnap) so we can compare across snapshots ***
    // Apply only the age filter — NOT the snapshot filter — here.
    let history = {};
    let itemSnapshotStats = {};

    dataStore.allFilteredData.forEach(row => {
        if (row.age < state.ageMin || row.age > state.ageMax) return;

        const date = row.snapshotDate || 'No Date';
        if (!history[date]) history[date] = { date, skus: 0, overPo: 0, done: 0 };
        history[date].skus++;
        history[date].overPo += row.overPo;
        const st = dataStore.actionStates[row._id] || 'รอตรวจสอบ';
        if (st === 'ดำเนินการแล้ว') history[date].done++;

        if (!itemSnapshotStats[row.item]) itemSnapshotStats[row.item] = {};
        itemSnapshotStats[row.item][date] = (itemSnapshotStats[row.item][date] || 0) + row.overPo;
    });

    // Sort dates chronologically using the same parseDate helper logic
    const parseDate = (s) => {
        let d = new Date(s);
        if (!isNaN(d)) return d;
        const parts = s.split(/[\/\-\.\s]/);
        if (parts.length >= 3) {
            let [a, b, c] = parts.map(Number);
            if (c > 2500) c -= 543;
            d = new Date(c, b - 1, a);
        }
        if (s && (s.toLowerCase().includes('current') || s.includes('ล่าสุด'))) return new Date(8640000000000000);
        return isNaN(d) ? new Date(0) : d;
    };

    const sortedDates = Object.keys(history).sort((a, b) => parseDate(a) - parseDate(b));

    if (sortedDates.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-8 text-center text-slate-400 italic">เลือกช่วงอายุสต็อกให้กว้างขึ้นเพื่อดูข้อมูลเทรนด์</td></tr>';
        decreaseList.innerHTML = '<p class="text-slate-400 text-xs italic text-center py-8">ไม่มีข้อมูล</p>';
        return;
    }

    // --- Snapshot comparison table ---
    let prevOver = null;
    sortedDates.forEach(date => {
        const data = history[date];
        const donePct = data.skus ? Math.round((data.done / data.skus) * 100) : 0;
        let diffHtml = '<span class="text-slate-400 text-xs">-</span>';
        if (prevOver !== null) {
            const diff = data.overPo - prevOver;
            const color = diff <= 0 ? 'text-green-600' : 'text-red-600';
            const icon = diff <= 0 ? '⬇️' : '⬆️';
            diffHtml = `<span class="${color} font-bold">${icon} ${Math.abs(diff).toLocaleString()}</span>`;
        }
        prevOver = data.overPo;
        const isLatest = date === state.latestSnap;
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="hover:bg-slate-50 ${isLatest ? 'ring-2 ring-inset ring-indigo-300 bg-indigo-50' : ''}">
                <td class="p-3 font-medium">${date}${isLatest ? ' <span class="text-[10px] text-indigo-500 font-bold bg-indigo-100 px-1 rounded">ล่าสุด</span>' : ''}</td>
                <td class="p-3 text-right">${data.skus.toLocaleString()}</td>
                <td class="p-3 text-right font-bold text-red-600">${data.overPo.toLocaleString()}</td>
                <td class="p-3 text-right font-bold text-green-600">${donePct}%</td>
                <td class="p-3">${diffHtml}</td>
            </tr>
        `);
    });

    // --- Notable Decreases ---
    if (sortedDates.length >= 2) {
        const latestDate = sortedDates[sortedDates.length - 1];
        const previousDate = sortedDates[sortedDates.length - 2];
        let changes = [];
        for (let item in itemSnapshotStats) {
            const lateVal = itemSnapshotStats[item][latestDate] ?? 0;
            const prevVal = itemSnapshotStats[item][previousDate] ?? 0;
            const diff = lateVal - prevVal;
            if (diff < 0) changes.push({ item, diff: Math.abs(diff), prevVal, lateVal });
        }
        changes.sort((a, b) => b.diff - a.diff).slice(0, 20).forEach(c => {
            const pct = c.prevVal > 0 ? Math.round((c.diff / c.prevVal) * 100) : 0;
            const cleared = c.lateVal === 0;
            decreaseList.insertAdjacentHTML('beforeend', `
                <div class="p-3 ${cleared ? 'bg-emerald-50 border-emerald-200' : 'bg-green-50 border-green-100'} rounded-lg border flex justify-between items-start gap-2">
                    <div class="min-w-0">
                        <div class="text-xs font-bold text-slate-800 truncate">${c.item}</div>
                        <div class="text-[10px] ${cleared ? 'text-emerald-600' : 'text-green-600'} font-bold mt-0.5">${cleared ? '✅ เคลียร์แล้ว!' : `⬇ ลด ${c.diff.toLocaleString()} ชิ้น (${pct}%)`}</div>
                    </div>
                    <div class="text-[9px] text-slate-400 text-right shrink-0">
                        <div>ก่อน: ${c.prevVal.toLocaleString()}</div>
                        <div>ล่าสุด: ${c.lateVal.toLocaleString()}</div>
                    </div>
                </div>
            `);
        });
        if (changes.length === 0) {
            decreaseList.innerHTML = '<p class="text-slate-400 text-xs italic text-center py-8">ไม่มีรายการที่ลดลงระหว่าง 2 รอบล่าสุด</p>';
        }
    } else {
        decreaseList.innerHTML = `
            <div class="text-center py-8 text-slate-400">
                <div class="text-2xl mb-2">📋</div>
                <p class="text-xs italic">ยังมีแค่ 1 snapshot ในระบบ</p>
                <p class="text-[10px] mt-1 text-slate-300">เพิ่มข้อมูลรอบถัดไปเพื่อเปรียบเทียบ</p>
            </div>`;
    }

    // --- Trend Chart ---
    const ctx = document.getElementById('trendChart')?.getContext('2d');
    if (ctx) {
        if (dataStore.charts.trend) dataStore.charts.trend.destroy();
        dataStore.charts.trend = new Chart(ctx, {
            type: 'line',
            data: {
                labels: sortedDates,
                datasets: [{
                    label: 'ยอดรวมส่วนเกิน',
                    data: sortedDates.map(d => history[d].overPo),
                    borderColor: '#4f46e5',
                    backgroundColor: 'rgba(79,70,229,0.08)',
                    borderWidth: 3,
                    pointRadius: 5,
                    pointBackgroundColor: '#fff',
                    pointBorderColor: '#4f46e5',
                    pointBorderWidth: 2,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (c) => ' ' + c.raw.toLocaleString() + ' ชิ้น' } },
                    datalabels: { display: true, align: 'top', font: { weight: 'bold', size: 10 }, formatter: v => v.toLocaleString() }
                },
                scales: {
                    y: { beginAtZero: true, grid: { color: '#f1f5f9' } },
                    x: { grid: { display: false } }
                }
            },
            plugins: [ChartDataLabels]
        });
    }

    // --- Velocity ---
    if (sortedDates.length >= 2) {
        const firstVal = history[sortedDates[0]].overPo;
        const lastVal = history[sortedDates[sortedDates.length - 1]].overPo;
        const v = firstVal ? Math.round(((firstVal - lastVal) / firstVal) * 100) : 0;
        document.getElementById('velocityText').textContent = (v >= 0 ? '↘️ ' : '↗️ ') + Math.abs(v) + '%';
    }
}

window.setChartMode = function (mode, btn) {
    state.chartMode = mode;
    document.querySelectorAll('.mode-btn').forEach(b => {
        b.classList.remove('bg-indigo-600', 'text-white', 'active');
        b.classList.add('bg-white', 'text-slate-600');
    });
    btn.classList.add('bg-indigo-600', 'text-white', 'active');
    btn.classList.remove('bg-white', 'text-slate-600');
    updateDashboard();
};

export function updateProgressUI() {
    let totalCases = dataStore.activeData.length;
    let doneCases = 0;
    let totalQty = 0;
    let doneQty = 0;

    dataStore.activeData.forEach(row => {
        totalQty += row.overPo;
        let st = dataStore.actionStates[row._id] || "รอตรวจสอบ";
        if (st === "ดำเนินการแล้ว") {
            doneCases++;
            doneQty += row.overPo;
        }
    });

    let casePct = totalCases ? Math.round((doneCases / totalCases) * 100) : 0;
    let qtyPct = totalQty ? Math.round((doneQty / totalQty) * 100) : 0;

    document.getElementById('progressCaseText').textContent = `${doneCases.toLocaleString()} / ${totalCases.toLocaleString()} (${casePct}%)`;
    document.getElementById('progressCaseBar').style.width = `${casePct}%`;

    document.getElementById('progressQtyText').textContent = `${doneQty.toLocaleString()} / ${totalQty.toLocaleString()} (${qtyPct}%)`;
    document.getElementById('progressQtyBar').style.width = `${qtyPct}%`;
}

export function openModal(title, filterFn) {
    document.getElementById('modalTitle').textContent = `รายละเอียด: ${title}`;
    const modalBody = document.getElementById('modalTableBody');
    modalBody.innerHTML = '';

    let filtered = dataStore.activeData.filter(filterFn).sort((a, b) => b.overPo - a.overPo);
    if (filtered.length === 0) {
        modalBody.innerHTML = '<tr><td colspan="8" class="p-4 text-center text-slate-500">ไม่มีข้อมูล</td></tr>';
    } else {
        filtered.slice(0, 500).forEach(row => {
            const status = dataStore.actionStates[row._id] || "รอตรวจสอบ";
            const sColor = getActionColor(status);
            modalBody.insertAdjacentHTML('beforeend', `
                <tr class="hover:bg-blue-50">
                    <td class="p-2">${row.plant}</td>
                    <td class="p-2 max-w-[250px]">
                        <div class="font-bold truncate" title="${row.item}">${row.item}</div>
                        <div class="text-xs text-slate-500 truncate" title="${row.desc}">${row.desc}</div>
                        ${row.planRemark !== '-' ? `<div class="text-[10px] text-blue-600 truncate mt-0.5" title="${row.planRemark}">📝 ${row.planRemark}</div>` : ''}
                    </td>
                    <td class="p-2 text-xs truncate max-w-[100px]">${row.reason}</td>
                    <td class="p-2 text-xs">${row.saleman}</td>
                    <td class="p-2 text-right">${row.age}</td>
                    <td class="p-2 text-right text-orange-600">${row.allowance.toLocaleString()}</td>
                    <td class="p-2 text-right text-red-600 font-bold">${row.overPo.toLocaleString()}</td>
                    <td class="p-2 text-xs" style="color:${sColor}; font-weight:bold;">${status}</td>
                </tr>
            `);
        });
    }
    document.getElementById('dataModal')?.classList.remove('hidden');
}

export function renderTable() {
    const tbody = document.getElementById('tableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let sorted = [...dataStore.activeData].sort((a, b) => {
        let vA = a[state.sortBy], vB = b[state.sortBy];
        if (typeof vA === 'string') { vA = vA.toLowerCase(); vB = vB.toLowerCase(); }
        if (vA < vB) return state.sortAsc ? -1 : 1;
        if (vA > vB) return state.sortAsc ? 1 : -1;
        return 0;
    });

    const maxPage = Math.ceil(sorted.length / state.limit) || 1;
    if (state.page > maxPage) state.page = maxPage;

    sorted.slice((state.page - 1) * state.limit, state.page * state.limit).forEach(row => {
        let ageColor = row.age > 5 ? 'bg-red-100 text-red-700' : row.age > 3 ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700';

        let currAction = dataStore.actionStates[row._id] || 'รอตรวจสอบ';
        if (!dataStore.actionOptions.includes(currAction)) currAction = 'รอตรวจสอบ';

        const optionsHtml = dataStore.actionOptions.map(opt =>
            `<option value="${opt}" ${currAction === opt ? 'selected' : ''}>${opt}</option>`
        ).join('');

        let trClass = 'hover:bg-blue-50 transition border-b border-slate-100';
        if (currAction === 'ดำเนินการแล้ว') trClass = 'bg-slate-100 opacity-60 border-b border-slate-100';
        else if (currAction !== 'รอตรวจสอบ') trClass = 'bg-yellow-50 border-b border-slate-100';

        // Allowance is a raw string (may be '+10/-10' or number), display as-is
        const allowanceDisplay = row.allowance ?? '-';

        tbody.insertAdjacentHTML('beforeend', `
            <tr id="tr-${row._id}" class="${trClass}">
                <td class="p-2 w-[180px]">
                    <div class="flex flex-col gap-1">
                        <select class="action-select text-[11px] border border-slate-300 rounded p-1 w-full bg-white font-semibold outline-none"
                                data-id="${row._id}" style="color: ${getActionColor(currAction)}">
                            ${optionsHtml}
                        </select>
                        <button class="save-action-btn bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] px-2 py-1 rounded shadow-sm transition-colors font-bold w-full"
                                data-id="${row._id}">💾 Save</button>
                    </div>
                </td>
                <td class="p-2 text-xs text-slate-500 font-mono align-top">${row.plant}</td>
                <td class="p-2 align-top"><span class="px-2 py-1 rounded text-xs font-bold ${ageColor}">${row.age}ด.</span></td>
                <td class="p-2 align-top max-w-[280px]">
                    <div class="font-bold text-slate-900 text-sm leading-tight">${row.item} ${row.missingData ? '<span class="text-red-400 text-[10px]">⚠</span>' : ''}</div>
                    <div class="text-[11px] text-slate-500 truncate mt-0.5" title="${row.desc}">${row.desc}</div>
                    <div class="text-[10px] text-indigo-600 font-semibold mt-1 truncate" title="${row.reason}">📌 ${row.reason}</div>
                    ${row.planRemark !== '-' ? `<div class="text-[10px] text-blue-500 truncate mt-0.5" title="${row.planRemark}">📝 ${row.planRemark}</div>` : ''}
                    <div class="text-[10px] text-slate-400 mt-1">🗓 ขายล่าสุด: <span class="font-medium text-slate-500">${row.latestSale || '-'}</span></div>
                </td>
                <td class="p-2 text-right text-xs text-orange-600 font-medium align-top whitespace-nowrap">${allowanceDisplay}</td>
                <td class="p-2 text-xs text-slate-600 align-top">${row.saleman}</td>
                <td class="p-2 text-right text-red-600 font-bold align-top">${row.overPo.toLocaleString()}</td>
            </tr>
        `);
    });

    document.getElementById('pageInfo').textContent = `หน้า ${state.page} / ${maxPage} (${sorted.length} รายการ)`;
    document.getElementById('btnPrevPage').disabled = state.page === 1;
    document.getElementById('btnNextPage').disabled = state.page === maxPage || maxPage === 0;
}

export function renderPivotTable() {
    let pivot = {};
    dataStore.activeData.forEach(row => {
        if (!pivot[row.saleman]) pivot[row.saleman] = { totalOver: 0, customers: {} };
        pivot[row.saleman].totalOver += row.overPo;
        if (!pivot[row.saleman].customers[row.customer]) pivot[row.saleman].customers[row.customer] = { count: 0, overPo: 0 };
        pivot[row.saleman].customers[row.customer].count += 1;
        pivot[row.saleman].customers[row.customer].overPo += row.overPo;
    });

    let sortedSalesmen = Object.entries(pivot).sort((a, b) => b[1].totalOver - a[1].totalOver);
    const tbody = document.getElementById('pivotBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    sortedSalesmen.forEach(([saleman, data]) => {
        tbody.insertAdjacentHTML('beforeend', `
            <tr class="bg-slate-50 border-t-2 border-slate-200">
                <td class="p-3 font-bold text-slate-800" colspan="2">💼 ${saleman}</td>
                <td class="p-3 font-bold text-right text-slate-600">-</td>
                <td class="p-3 font-bold text-right text-red-600">${data.totalOver.toLocaleString()}</td>
            </tr>
        `);
        let sortedCust = Object.entries(data.customers).sort((a, b) => b[1].overPo - a[1].overPo);
        sortedCust.forEach(([cust, cData]) => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-blue-50 transition cursor-pointer";
            tr.innerHTML = `
                <td class="p-2 border-l-4 border-transparent"></td>
                <td class="p-2 text-slate-700">🏢 ${cust}</td>
                <td class="p-2 text-right text-slate-500">${cData.count.toLocaleString()}</td>
                <td class="p-2 text-right font-semibold text-rose-500">${cData.overPo.toLocaleString()}</td>
            `;
            tr.onclick = () => openModal(`ลูกค้า: ${cust}`, r => r.customer === cust && r.saleman === saleman);
            tbody.appendChild(tr);
        });
    });
}

export function renderFactoryTab() {
    let plantMap = {};
    dataStore.activeData.forEach(r => {
        let p = r.plant || 'Unknown';
        if (!plantMap[p]) plantMap[p] = { overPo: 0, count: 0, allowance: 0 };
        plantMap[p].overPo += r.overPo;
        plantMap[p].count += 1;
        plantMap[p].allowance += r.allowance;
    });

    let sortedPlants = Object.entries(plantMap).sort((a, b) => b[1].overPo - a[1].overPo);
    const charts = dataStore.charts;
    if (charts.factory) charts.factory.destroy();
    const factChartEl = document.getElementById('factoryChart');
    if (factChartEl) {
        charts.factory = new Chart(factChartEl, {
            type: 'bar',
            data: { labels: sortedPlants.map(p => p[0]), datasets: [{ data: sortedPlants.map(p => p[1].overPo), backgroundColor: '#0ea5e9', borderRadius: 4 }] },
            options: {
                responsive: true, maintainAspectRatio: false,
                layout: { padding: { top: 20 } },
                plugins: {
                    legend: { display: false },
                    tooltip: { callbacks: { label: (ctx) => ' ' + ctx.raw.toLocaleString() + ' ชิ้น' } },
                    datalabels: { display: true, color: '#475569', anchor: 'end', align: 'top', formatter: (val) => val.toLocaleString() }
                },
                onClick: (e, els) => { if (els.length) openModal('Plant: ' + sortedPlants[els[0].index][0], r => r.plant === sortedPlants[els[0].index][0]); }
            },
            plugins: [ChartDataLabels]
        });
    }

    const tbody = document.getElementById('factoryTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';
    sortedPlants.forEach(([plant, data]) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-blue-50 transition cursor-pointer";
        tr.innerHTML = `
            <td class="p-3 font-semibold text-slate-700">🏭 ${plant}</td>
            <td class="p-3 text-right text-slate-600">${data.count.toLocaleString()}</td>
            <td class="p-3 text-right text-orange-500">${data.allowance.toLocaleString()}</td>
            <td class="p-3 text-right font-bold text-red-600">${data.overPo.toLocaleString()}</td>
        `;
        tr.onclick = () => openModal(`Plant: ${plant}`, r => r.plant === plant);
        tbody.appendChild(tr);
    });
}
