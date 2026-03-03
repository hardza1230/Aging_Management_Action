import { MASTER_SHEET_URL, CURRENT_SHEET_URL, APPS_SCRIPT_API_URL, headerKeywords, dataStore, state } from './state.js';
import { parseNum, calculateAgeMonths, findHeader, showLoading, hideLoading } from './utils.js';

export async function saveActionToSheet(rowId, status, item, plant, snapshotDate) {
    if (!APPS_SCRIPT_API_URL) return; // ถ้าไม่ได้ระบุ URL ก็ข้ามไป (ใช้แค่ Local)

    try {
        const payload = { rowId, status, item, plant, snapshotDate, timestamp: new Date().toISOString() };
        await fetch(APPS_SCRIPT_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify(payload),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`📡 ซิงค์ข้อมูล "${status}" ของ ${item} (${plant}) ไปยัง Sheet แล้ว`);
    } catch (e) {
        console.error("Sheet sync failed", e);
    }
}


export async function fetchGoogleSheet() {
    showLoading(20, 'กำลังดึงข้อมูลจาก Google Sheets...');
    try {
        const [resMaster, resCurrent] = await Promise.all([
            fetch(MASTER_SHEET_URL).then(r => r.ok ? r.text() : ""),
            fetch(CURRENT_SHEET_URL).then(r => r.ok ? r.text() : "")
        ]);

        let masterRaw = [], currentRaw = [];
        if (resMaster) {
            masterRaw = await new Promise(resolve => {
                Papa.parse(resMaster, { header: true, skipEmptyLines: true, complete: r => resolve(r.data) });
            });
        }
        if (resCurrent && MASTER_SHEET_URL !== CURRENT_SHEET_URL) {
            currentRaw = await new Promise(resolve => {
                Papa.parse(resCurrent, { header: true, skipEmptyLines: true, complete: r => resolve(r.data) });
            });
        }

        processDualData(masterRaw, currentRaw);
    } catch (err) {
        hideLoading();
        alert('Fetch error: ' + err.message);
    }
}

function mapDataset(rawData, forceSnapshot = null) {
    if (!rawData || rawData.length === 0) return [];
    const sr = rawData[0];
    const map = {
        overPo: findHeader(sr, headerKeywords.overPo),
        stock: findHeader(sr, headerKeywords.stock),
        reason: findHeader(sr, headerKeywords.reason),
        latestProduce: findHeader(sr, headerKeywords.latestProduce),
        age: findHeader(sr, headerKeywords.age),
        item: findHeader(sr, headerKeywords.item),
        desc: findHeader(sr, headerKeywords.desc),
        saleman: findHeader(sr, headerKeywords.saleman),
        customer: findHeader(sr, headerKeywords.customer),
        plant: findHeader(sr, headerKeywords.plant),
        allowance: findHeader(sr, headerKeywords.allowance),
        planRemark: findHeader(sr, headerKeywords.planRemark),
        latestSale: findHeader(sr, headerKeywords.latestSale),
        hasPo: findHeader(sr, headerKeywords.hasPo),
        snapshotDate: findHeader(sr, ['snapshot date', 'วันที่ดึงข้อมูล', 'วันที่', 'snapshot']),
        actionStatus: findHeader(sr, headerKeywords.actionStatus)
    };
    if (!map.overPo || !map.stock) return [];

    return rawData.map((row, i) => {
        const stockVal = parseNum(row[map.stock]);
        const poVal = parseNum(row[map.hasPo]);
        const overVal = parseNum(row[map.overPo]);
        if (stockVal <= 0 && overVal <= 0 && poVal <= 0) return null;

        const reasonRaw = map.reason && row[map.reason] ? String(row[map.reason]).trim() : '';
        const rawDate = map.latestProduce ? row[map.latestProduce] : null;
        const ageMonths = calculateAgeMonths(rawDate, row[map.age]);
        let finalReason = reasonRaw || 'รอข้อมูลวางแผน';
        if (finalReason === '-' || finalReason === '') finalReason = 'รอข้อมูลวางแผน';

        const snapshotVal = forceSnapshot || (map.snapshotDate ? String(row[map.snapshotDate]).trim() : 'Current');
        const rowId = `${String(row[map.item] || '').trim()}|${(map.plant && row[map.plant] ? String(row[map.plant]) : '-').trim()}|${snapshotVal}`;
        const sheetStatus = map.actionStatus && row[map.actionStatus] ? String(row[map.actionStatus]).trim() : '';

        return {
            _id: rowId, stock: stockVal, hasPo: poVal, overPo: overVal,
            reason: finalReason, age: ageMonths,
            item: String(row[map.item] || '-').trim(),
            desc: String(row[map.desc] || '-').trim(),
            saleman: String(row[map.saleman] || '-').trim(),
            customer: String(row[map.customer] || '-').trim(),
            plant: (map.plant && row[map.plant] ? String(row[map.plant]) : '-').trim(),
            allowance: map.allowance && row[map.allowance] ? String(row[map.allowance]).trim() : '-',
            planRemark: map.planRemark && row[map.planRemark] ? String(row[map.planRemark]).trim() : '-',
            latestSale: map.latestSale ? String(row[map.latestSale]).trim() : '-',
            status: sheetStatus, snapshotDate: snapshotVal,
            missingData: (!rawDate || !reasonRaw || reasonRaw === '-')
        };
    }).filter(r => r !== null);
}

export function processDualData(masterRaw, currentRaw) {
    showLoading(70, 'วิเคราะห์ข้อมูล (แยกตามหัวตาราง)...');
    setTimeout(async () => {
        try {
            const masterProcessed = mapDataset(masterRaw);
            const currentProcessed = mapDataset(currentRaw, 'Current');
            let all = [...masterProcessed];
            currentProcessed.forEach(c => {
                if (!all.find(m => m._id === c._id)) all.push(c);
            });

            const getSortDate = (s) => {
                let d = new Date(s);
                if (!isNaN(d)) return d;
                const parts = String(s).split(/[\/\-\.]/);
                if (parts.length === 3) {
                    let [a, b, c] = parts.map(Number);
                    if (c > 2500) c -= 543;
                    d = new Date(c, b - 1, a);
                }
                if (s && (String(s).toLowerCase().includes('current') || String(s).includes('ล่าสุด'))) return new Date(8640000000000000);
                return isNaN(d) ? new Date(0) : d;
            };

            const uniqueDates = [...new Set(all.map(d => d.snapshotDate))].filter(d => d && d !== '-');
            uniqueDates.sort((a, b) => getSortDate(a) - getSortDate(b));
            state.latestSnap = uniqueDates[uniqueDates.length - 1];
            dataStore.snapDates = uniqueDates;

            const historyStatusMap = {};
            [...all].sort((a, b) => getSortDate(a.snapshotDate) - getSortDate(b.snapshotDate)).forEach(row => {
                if (row.status && row.status !== 'รอตรวจสอบ' && row.status !== '-') {
                    historyStatusMap[`${row.item}|${row.plant}`] = row.status;
                }
            });

            all.forEach(row => {
                if (row.status && row.status !== 'รอตรวจสอบ' && row.status !== '-') {
                    dataStore.actionStates[row._id] = row.status;
                } else {
                    const historicalStatus = historyStatusMap[`${row.item}|${row.plant}`];
                    if (historicalStatus) dataStore.actionStates[row._id] = historicalStatus;
                }
            });

            dataStore.allFilteredData = all;
            dataStore.currentData = currentProcessed.length > 0 ? currentProcessed : all.filter(d => d.snapshotDate === state.latestSnap);

            console.log(`📊 Loaded: Total=${all.length}, Dashboard=${dataStore.currentData.length}`);

            const ageMaxInput = document.getElementById('filterAgeMax');
            if (ageMaxInput) {
                const maxAge = all.reduce((max, r) => Math.max(max, r.age), 0);
                const safeMaxAge = Math.min(240, maxAge || 120);
                ageMaxInput.max = safeMaxAge;
                document.getElementById('filterAgeMin').max = safeMaxAge;
                ageMaxInput.value = safeMaxAge;
                state.ageMax = safeMaxAge;
                document.getElementById('ageLabel').textContent = `${state.ageMin} - ${safeMaxAge} ด.`;
            }

            await localforage.setItem('inventoryData', dataStore.allFilteredData);
            showLoading(100, 'สร้างแดชบอร์ด...');
            window.dispatchEvent(new CustomEvent('data-ready'));
        } catch (err) {
            console.error(err);
            alert("Error: " + err.message);
        } finally {
            setTimeout(() => hideLoading(), 200);
        }
    }, 100);
}
