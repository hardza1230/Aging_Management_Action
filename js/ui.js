import { state, dataStore, getActionColor } from './state.js';
import { updateCharts } from './charts.js';

export function updateDashboard() {
    dataStore.activeData = dataStore.allFilteredData.filter(row => {
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

    dataStore.activeData.forEach(row => {
        totalExceed += row.overPo;
        let rStr = String(row.reason);
        if (rStr.includes('15') || rStr.includes('17') || rStr.includes('ผลิต')) humanError += row.overPo;
        if (row.age > 5) deadStock++;
        if (row.missingData) missingCount++;

        reasonMap[row.reason] = (reasonMap[row.reason] || 0) + 1;
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
        actionCounts[st] = (actionCounts[st] || 0) + row.overPo;
    });

    document.getElementById('kpiTotalSkus').textContent = dataStore.activeData.length.toLocaleString();
    document.getElementById('kpiTotalExceed').textContent = totalExceed.toLocaleString();
    document.getElementById('kpiDeadStock').textContent = deadStock.toLocaleString();
    document.getElementById('kpiHumanError').textContent = humanError.toLocaleString();
    document.getElementById('kpiMissingData').textContent = missingCount.toLocaleString();

    updateProgressUI();
    updateCharts(reasonMap, ageBuckets, salesmanMap, actionCounts);
    renderPivotTable();
    renderFactoryTab();
    renderAnalysisTab(reasonMap);
    renderTable();
}

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

        let currAction = dataStore.actionStates[row._id] || "รอตรวจสอบ";
        if (!dataStore.actionOptions.includes(currAction)) currAction = "รอตรวจสอบ";

        const optionsHtml = dataStore.actionOptions.map(opt => `<option value="${opt}" ${currAction === opt ? 'selected' : ''}>${opt}</option>`).join('');

        let trClass = 'hover:bg-blue-50 transition';
        if (currAction === 'ดำเนินการแล้ว') trClass = 'bg-slate-100 opacity-60';
        else if (currAction !== 'รอตรวจสอบ') trClass = 'bg-yellow-50';

        tbody.insertAdjacentHTML('beforeend', `
            <tr id="tr-${row._id}" class="${trClass}">
                <td class="p-3 border-r border-slate-100">
                    <select class="action-select text-xs border border-slate-300 rounded p-1.5 w-full bg-white font-semibold outline-none" 
                            data-id="${row._id}" style="color: ${getActionColor(currAction)}">
                        ${optionsHtml}
                    </select>
                </td>
                <td class="p-3 text-xs text-slate-500 font-mono">${row.plant}</td>
                <td class="p-3"><span class="px-2 py-1 rounded text-xs font-bold ${ageColor}">${row.age} ด.</span></td>
                <td class="p-3 font-medium text-slate-700 truncate max-w-[120px]" title="${row.reason}">${row.reason}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-900">${row.item} ${row.missingData ? '<span class="text-red-500 text-xs" title="ข้อมูลไม่ครบ">⚠️</span>' : ''}</div>
                    <div class="text-xs text-slate-500 truncate max-w-[200px]" title="${row.desc}">${row.desc}</div>
                    ${row.planRemark !== '-' ? `<div class="text-[10px] text-blue-600 truncate max-w-[200px] mt-0.5" title="${row.planRemark}">📝 ${row.planRemark}</div>` : ''}
                </td>
                <td class="p-3 text-right font-semibold text-orange-600">${row.allowance.toLocaleString()}</td>
                <td class="p-3 text-xs">${row.saleman}</td>
                <td class="p-3 text-right text-red-600 font-bold">${row.overPo.toLocaleString()}</td>
            </tr>
        `);
    });

    document.getElementById('pageInfo').textContent = `หน้า ${state.page} / ${maxPage}`;
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
            }
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

export function renderAnalysisTab(reasonMap) {
    let sortedR = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const ul = document.getElementById('analysisTopReasons');
    if (!ul) return;
    ul.innerHTML = '';
    if (sortedR.length === 0) {
        ul.innerHTML = '<li>ไม่มีข้อมูลสาเหตุในขณะนี้</li>';
        return;
    }
    sortedR.forEach((r, i) => {
        ul.insertAdjacentHTML('beforeend', `<li><b>อันดับ ${i + 1}:</b> ${r[0]} <span class="text-slate-500">(${r[1].toLocaleString()} รายการ)</span></li>`);
    });
}
