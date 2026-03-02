import { state, dataStore, CORE_ACTIONS, DEFAULT_ACTIONS, getActionColor } from './state.js';
import { updateDashboard, renderTable, updateProgressUI, openModal } from './ui.js';
import { fetchGoogleSheet, processData, saveActionToSheet } from './api.js';
import { closeModal, openModalById } from './utils.js';

// Global Event Listeners & Initialization
document.addEventListener("DOMContentLoaded", async () => {
    // 1. Initialize State from Storage
    try {
        const savedOps = await localforage.getItem('customActionOptions');
        dataStore.actionOptions = (savedOps && savedOps.length > 0) ? savedOps : [...DEFAULT_ACTIONS];
        renderSetupList();

        const savedData = await localforage.getItem('inventoryData');
        const savedActions = await localforage.getItem('inventoryActions');
        dataStore.actionStates = savedActions || {};

        if (savedData) {
            dataStore.allFilteredData = savedData;
            setupDashboard(true);
        } else {
            // First time or no data - try fetching from Google Sheets
            fetchGoogleSheet();
        }
    } catch (e) {
        console.error("Init error", e);
    }

    // 2. Main UI Events
    setupEventListeners();
});

function setupEventListeners() {
    // Filters
    ['filterSearch', 'filterPlant', 'filterSaleman', 'filterCustomer'].forEach(id => {
        document.getElementById(id)?.addEventListener('input', (e) => {
            const key = id.replace('filter', '').toLowerCase();
            state[key] = e.target.value.toLowerCase();
            if (id !== 'filterSearch') state[key] = e.target.value;
            state.page = 1;
            updateDashboard();
        });
    });

    document.getElementById('filterAgeMin')?.addEventListener('input', syncAgeFilter);
    document.getElementById('filterAgeMax')?.addEventListener('input', syncAgeFilter);

    // Buttons
    document.getElementById('btnRefreshSheets')?.addEventListener('click', fetchGoogleSheet);
    document.getElementById('btnPrevPage')?.addEventListener('click', () => { if (state.page > 1) { state.page--; renderTable(); } });
    document.getElementById('btnNextPage')?.addEventListener('click', () => {
        if (state.page < Math.ceil(dataStore.activeData.length / state.limit)) { state.page++; renderTable(); }
    });

    // Special Modal Buttons
    window.closeModal = closeModal;
    window.openModal = openModal;
    window.showSummaryReport = showSummaryReport;
    window.copySummaryReport = copySummaryReport;
    window.switchTab = switchTab;
    window.handleSort = handleSort;
    window.exportToCSV = exportToCSV;
    window.addNewAction = addNewAction;
    window.removeActionOption = removeActionOption;
}


function syncAgeFilter() {
    let min = parseInt(document.getElementById('filterAgeMin').value);
    let max = parseInt(document.getElementById('filterAgeMax').value);
    if (min > max) { let tmp = min; min = max; max = tmp; }
    state.ageMin = min; state.ageMax = max;
    document.getElementById('ageLabel').textContent = `${min} - ${max} ด.`;
    state.page = 1; updateDashboard();
}

function setupDashboard(skipFetch = false) {
    document.getElementById('resultsSection')?.classList.remove('hidden');
    document.getElementById('btnRefreshSheets')?.classList.remove('hidden');

    // Populate Filters
    const plants = [...new Set(dataStore.allFilteredData.map(d => d.plant).filter(p => p !== '-'))].sort();
    const salemen = [...new Set(dataStore.allFilteredData.map(d => d.saleman).filter(s => s !== '-'))].sort();
    const customers = [...new Set(dataStore.allFilteredData.map(d => d.customer).filter(c => c !== '-'))].sort();

    document.getElementById('filterPlant').innerHTML = '<option value="all">ทั้งหมด</option>' + plants.map(p => `<option value="${p}">${p}</option>`).join('');
    document.getElementById('filterSaleman').innerHTML = '<option value="all">ทั้งหมด</option>' + salemen.map(s => `<option value="${s}">${s}</option>`).join('');
    document.getElementById('filterCustomer').innerHTML = '<option value="all">ทั้งหมด</option>' + customers.map(c => `<option value="${c}">${c}</option>`).join('');

    updateDashboard();
}

// Event Listeners for Dynamic Table Elements
document.body.addEventListener('change', async (e) => {
    if (e.target.classList.contains('action-select')) {
        const id = e.target.getAttribute('data-id');
        const val = e.target.value;
        dataStore.actionStates[id] = val;
        try { await localforage.setItem('inventoryActions', dataStore.actionStates); } catch (e) { }

        // ส่งข้อมูลกลับไปบันทึกที่ Google Sheet (Collaborative)
        saveActionToSheet(id, val);

        const tr = document.getElementById(`tr-${id}`);
        if (tr) {
            tr.className = (val === 'ดำเนินการแล้ว') ? 'bg-slate-100 opacity-60 transition' : (val !== 'รอตรวจสอบ' ? 'bg-yellow-50 transition' : 'hover:bg-blue-50 transition');
            e.target.style.color = getActionColor(val);
        }
        updateActionChartOnly();
    }
});

// Tab Switcher
function switchTab(tabId, btn) {
    ['exec', 'action', 'insight', 'factory', 'setup', 'analysis'].forEach(id => document.getElementById(`tab-${id}`)?.classList.add('hidden'));
    document.getElementById(`tab-${tabId}`)?.classList.remove('hidden');
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    if (tabId === 'action') renderTable();
}

// Other window-bound functions
function handleSort(col) {
    if (state.sortBy === col) state.sortAsc = !state.sortAsc; else { state.sortBy = col; state.sortAsc = true; }
    document.querySelectorAll('.sort-icon').forEach(el => el.textContent = '');
    document.getElementById(`sort-${col}`).textContent = state.sortAsc ? '▲' : '▼';
    state.page = 1; renderTable();
}

function updateActionChartOnly() {
    updateProgressUI();
    const charts = dataStore.charts;
    if (!charts.action) return;

    let actionCounts = {};
    dataStore.actionOptions.forEach(o => actionCounts[o] = 0);
    dataStore.activeData.forEach(row => {
        let st = dataStore.actionStates[row._id] || "รอตรวจสอบ";
        if (!dataStore.actionOptions.includes(st)) st = "รอตรวจสอบ";
        actionCounts[st] = (actionCounts[st] || 0) + row.overPo;
    });

    const actLabels = Object.keys(actionCounts).filter(k => actionCounts[k] > 0);
    const actData = actLabels.map(k => actionCounts[k]);
    const actColors = actLabels.map(k => getActionColor(k));

    charts.action.data.labels = actLabels;
    charts.action.data.datasets[0].data = actData;
    charts.action.data.datasets[0].backgroundColor = actColors;
    charts.action.update();
}

function exportToCSV() {
    if (!dataStore.activeData.length) return alert('ไม่มีข้อมูล');
    const data = dataStore.activeData.map(r => ({
        'Plant': r.plant, 'Status': dataStore.actionStates[r._id] || 'รอตรวจสอบ',
        'Item': r.item, 'Description': r.desc, 'Planning Remarks': r.planRemark,
        'Reason': r.reason, 'จำนวนเกิน PO': r.overPo, 'ค่าเผื่อ': r.allowance,
        'อายุ (เดือน)': r.age, 'พนักงานขาย': r.saleman, 'ลูกค้า': r.customer
    }));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(['\uFEFF' + Papa.unparse(data)], { type: 'text/csv;charset=utf-8;' }));
    link.download = "inventory_action_plan.csv"; link.click();
}

// Setup Functions
function renderSetupList() {
    const list = document.getElementById('actionSettingsList');
    if (!list) return;
    list.innerHTML = '';
    dataStore.actionOptions.forEach(opt => {
        const isCore = CORE_ACTIONS.includes(opt);
        list.insertAdjacentHTML('beforeend', `
            <li class="p-3 flex justify-between items-center hover:bg-white transition">
                <div class="flex items-center gap-3">
                    <span class="w-3 h-3 rounded-full" style="background-color: ${getActionColor(opt)}"></span>
                    <span class="text-slate-700 font-medium">${opt}</span>
                </div>
                ${isCore ? '<span class="text-xs text-slate-400 font-semibold bg-slate-100 px-2 py-1 rounded">ระบบ</span>' : `<button onclick="removeActionOption('${opt}')" class="text-red-500 hover:text-red-700 text-sm font-bold px-3 py-1 bg-red-50 rounded hover:bg-red-100 transition">ลบ</button>`}
            </li>
        `);
    });
}

async function addNewAction() {
    const input = document.getElementById('newActionInput');
    const val = input.value.trim();
    if (!val) return;
    if (dataStore.actionOptions.includes(val)) return alert('มีสถานะนี้อยู่แล้ว');
    dataStore.actionOptions.push(val);
    await localforage.setItem('customActionOptions', dataStore.actionOptions);
    input.value = '';
    renderSetupList();
    if (dataStore.allFilteredData.length > 0) renderTable();
}

async function removeActionOption(val) {
    if (CORE_ACTIONS.includes(val)) return alert('ไม่สามารถลบสถานะระบบได้');
    if (!confirm(`ต้องการลบสถานะ "${val}" หรือไม่?\n\n* ข้อมูลเดิมที่ถูกตั้งสถานะนี้ไว้ จะถูกเปลี่ยนกลับเป็น "รอตรวจสอบ"`)) return;

    dataStore.actionOptions = dataStore.actionOptions.filter(o => o !== val);
    if (dataStore.actionStates) {
        for (let key in dataStore.actionStates) {
            if (dataStore.actionStates[key] === val) dataStore.actionStates[key] = "รอตรวจสอบ";
        }
        await localforage.setItem('inventoryActions', dataStore.actionStates);
    }
    await localforage.setItem('customActionOptions', dataStore.actionOptions);
    renderSetupList();
    if (dataStore.allFilteredData.length > 0) updateDashboard();
}

function showSummaryReport() {
    if (dataStore.activeData.length === 0) return alert('ไม่มีข้อมูลสำหรับสร้างรายงาน');
    const totalSkus = dataStore.activeData.length;
    const totalQty = dataStore.activeData.reduce((sum, r) => sum + r.overPo, 0);
    const deadStock = dataStore.activeData.filter(r => r.age > 5).length;
    const deadStockQty = dataStore.activeData.filter(r => r.age > 5).reduce((sum, r) => sum + r.overPo, 0);

    let reasonMap = {};
    let doneCases = 0, doneQty = 0;
    dataStore.activeData.forEach(r => {
        reasonMap[r.reason] = (reasonMap[r.reason] || 0) + 1;
        let st = dataStore.actionStates[r._id] || "รอตรวจสอบ";
        if (st === "ดำเนินการแล้ว") { doneCases++; doneQty += r.overPo; }
    });

    let topReasons = Object.entries(reasonMap).sort((a, b) => b[1] - a[1]).slice(0, 3);
    let topReasonsText = topReasons.map((r, i) => `  ${i + 1}. ${r[0]} (${r[1].toLocaleString()} รายการ)`).join('\n');
    let casePct = totalSkus ? Math.round((doneCases / totalSkus) * 100) : 0;
    const today = new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' });

    const reportText = `📊 สรุปรายงานการจัดการสต็อกส่วนเกิน (Over PO)\nประจำวันที่: ${today}\n\n[ภาพรวมปัญหา]\n- รายการที่มีปัญหาทั้งหมด: ${totalSkus.toLocaleString()} รายการ\n- จำนวนสินค้าส่วนเกินรวม: ${totalQty.toLocaleString()} ชิ้น\n- กลุ่ม Dead Stock (>5 เดือน): ${deadStock.toLocaleString()} รายการ (${deadStockQty.toLocaleString()} ชิ้น)\n\n[3 สาเหตุหลักที่พบมากที่สุด]\n${topReasonsText}\n\n[ความคืบหน้าการจัดการ]\n- ดำเนินการแก้ไขแล้ว: ${doneCases.toLocaleString()} รายการ (คิดเป็น ${casePct}%)\n- จำนวนชิ้นที่เคลียร์แล้ว: ${doneQty.toLocaleString()} ชิ้น\n- รอตรวจสอบ/รอดำเนินการ: ${(totalSkus - doneCases).toLocaleString()} รายการ\n\n[แผนการดำเนินงานต่อไป]\n1. เร่งระบายกลุ่ม Dead Stock ที่มีอายุเกิน 5 เดือน\n2. ติดตามพนักงานขายเพื่อหาข้อสรุปในรายการที่รอเคลียร์\n3. ตรวจสอบสาเหตุร่วมกับฝ่ายผลิตเพื่อลดอัตราการผลิตเกิน`;

    document.getElementById('summaryTextarea').value = reportText;
    openModalById('summaryModal');
}

function copySummaryReport() {
    const textarea = document.getElementById('summaryTextarea');
    textarea.select();
    try { document.execCommand('copy'); alert('คัดลอกเรียบร้อย'); } catch (e) { }
}

// Global hook for API
window.dispatchEvent(new CustomEvent('app-initialized'));
window.addEventListener('data-ready', () => setupDashboard());
