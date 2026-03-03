import { MASTER_SHEET_URL, CURRENT_SHEET_URL, APPS_SCRIPT_API_URL, headerKeywords, dataStore, state } from './state.js';
import { parseNum, calculateAgeMonths, findHeader, showLoading, hideLoading } from './utils.js';

export async function saveActionToSheet(rowId, status, item, plant, snapshotDate) {
    if (!APPS_SCRIPT_API_URL) return;
    try {
        const payload = { rowId, status, item, plant, snapshotDate, timestamp: new Date().toISOString() };
        await fetch(APPS_SCRIPT_API_URL, { method: 'POST', mode: 'no-cors', body: JSON.stringify(payload), headers: { 'Content-Type': 'application/json' } });
        console.log(`📡 ซิงค์ข้อมูล "${status}" ของ ${item} (${plant}) ไปยัง Sheet แล้ว`);
    } catch (e) { console.error("Sheet sync failed", e); }
}

// Parse CSV text into array of objects
function parseCsv(csvText) {
    return new Promise((resolve, reject) => {
        Papa.parse(csvText, {
            header: true, skipEmptyLines: true,
            complete: (r) => resolve(r.data),
            error: (e) => reject(e)
        });
    });
}

// Fetch a single sheet URL and return parsed rows
async function fetchSheet(url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseCsv(await response.text());
}

export async function fetchGoogleSheet() {
    showLoading(10, 'กำลังดึงข้อมูลจาก Google Sheets...');
    try {
        // Fetch Master_History and Current sheets in parallel
        const [masterRows, currentRows] = await Promise.all([
            fetchSheet(MASTER_SHEET_URL).catch(e => { console.warn('Master fetch failed:', e); return []; }),
            fetchSheet(CURRENT_SHEET_URL).catch(e => { console.warn('Current fetch failed:', e); return []; })
        ]);

        showLoading(50, 'ประมวลผลข้อมูล...');
        processData(masterRows, currentRows);
    } catch (err) {
        hideLoading();
        alert('Fetch error: ' + err.message);
    }
}

// Build column map from a sample row
function buildMap(sr) {
    const allKeys = Object.keys(sr);
    console.log("📋 Sheet headers:", allKeys);
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
    console.log("📍 Column map:", map);
    if (!map.actionStatus) {
        console.warn("⚠️ actionStatus NOT MATCHED. Potential candidates:");
        allKeys.forEach(k => {
            const kn = k.toLowerCase();
            if (kn.includes('สถานะ') || kn.includes('action') || kn.includes('status') || kn.includes('จัดการ')) {
                console.warn(`   → "${k}"`);
            }
        });
    }
    return map;
}

// Date helper — handles Thai Buddhist Era and "Current" labels
function getSortDate(s) {
    if (!s) return new Date(0);
    if (String(s).toLowerCase().includes('current') || String(s).includes('ล่าสุด')) return new Date(8640000000000000);
    let d = new Date(s);
    if (!isNaN(d)) return d;
    const parts = String(s).split(/[\/\-\.]/);
    if (parts.length === 3) {
        let [a, b, c] = parts.map(Number);
        if (c > 2500) c -= 543;
        d = new Date(c, b - 1, a);
    }
    return isNaN(d) ? new Date(0) : d;
}

// Parse a set of raw rows into processed item objects
function parseRows(rawData, map, defaultSnapshot = 'Current') {
    const rows = [];
    rawData.forEach(row => {
        const stockVal = parseNum(row[map.stock]);
        const poVal = parseNum(row[map.hasPo]);
        const overVal = parseNum(row[map.overPo]);
        if (stockVal <= 0 && overVal <= 0 && poVal <= 0) return;

        const reasonRaw = map.reason && row[map.reason] ? String(row[map.reason]).trim() : '';
        const rawDate = map.latestProduce ? row[map.latestProduce] : null;
        const ageMonths = calculateAgeMonths(rawDate, row[map.age]);
        let finalReason = reasonRaw || 'รอข้อมูลวางแผน';
        if (finalReason === '-') finalReason = 'รอข้อมูลวางแผน';

        const snapVal = (map.snapshotDate && row[map.snapshotDate])
            ? String(row[map.snapshotDate]).trim()
            : defaultSnapshot;
        const itemVal = String(row[map.item] || '-').trim();
        const plantVal = (map.plant && row[map.plant] ? String(row[map.plant]) : '-').trim();
        const rowId = `${itemVal}|${plantVal}|${snapVal}`;
        const sheetStatus = (map.actionStatus && row[map.actionStatus])
            ? String(row[map.actionStatus]).trim() : '';

        rows.push({
            _id: rowId,
            stock: stockVal, hasPo: poVal, overPo: overVal,
            reason: finalReason, age: ageMonths,
            item: itemVal, desc: String(row[map.desc] || '-').trim(),
            saleman: String(row[map.saleman] || '-').trim(),
            customer: String(row[map.customer] || '-').trim(),
            plant: plantVal,
            allowance: (map.allowance && row[map.allowance]) ? String(row[map.allowance]).trim() : '-',
            planRemark: (map.planRemark && row[map.planRemark]) ? String(row[map.planRemark]).trim() : '-',
            latestSale: map.latestSale ? String(row[map.latestSale]).trim() : '-',
            status: sheetStatus,
            snapshotDate: snapVal,
            missingData: (!rawDate || !reasonRaw || reasonRaw === '-')
        });
    });
    return rows;
}

export function processData(masterRawData, currentRawData = []) {
    const hasMaster = masterRawData && masterRawData.length > 0;
    const hasCurrent = currentRawData && currentRawData.length > 0;

    if (!hasMaster && !hasCurrent) {
        hideLoading();
        return alert('ไม่พบข้อมูลจากทั้งสองชีท กรุณาตรวจสอบการตั้งค่า URL');
    }

    showLoading(70, 'วิเคราะห์ข้อมูล...');
    setTimeout(async () => {
        try {
            // ── 1. MASTER HISTORY ──────────────────────────────────────────
            let masterProcessed = [];
            let maxAgeFound = 0;
            if (hasMaster) {
                const masterMap = buildMap(masterRawData[0]);
                masterProcessed = parseRows(masterRawData, masterMap);
                masterProcessed.forEach(r => {
                    if (r.age > maxAgeFound) maxAgeFound = r.age;
                    if (r.status) dataStore.actionStates[r._id] = r.status;
                });
            }
            dataStore.allFilteredData = masterProcessed;

            // Determine snapshot dates from Master
            const uniqueDates = [...new Set(masterProcessed.map(d => d.snapshotDate))].filter(d => d && d !== '-');
            uniqueDates.sort((a, b) => getSortDate(a) - getSortDate(b));
            state.latestSnap = uniqueDates[uniqueDates.length - 1] || null;
            dataStore.snapDates = uniqueDates;

            // Build Item+Plant → latest status map from Master history
            const historyStatusMap = {};
            [...masterProcessed]
                .sort((a, b) => getSortDate(a.snapshotDate) - getSortDate(b.snapshotDate))
                .forEach(row => {
                    if (row.status && row.status !== '-') {
                        historyStatusMap[`${row.item}|${row.plant}`] = row.status;
                    }
                });

            // ── 2. CURRENT SHEET ────────────────────────────────────────────
            let currentProcessed = [];
            if (hasCurrent) {
                const currentMap = buildMap(currentRawData[0]);
                currentProcessed = parseRows(currentRawData, currentMap, 'Current');
                currentProcessed.forEach(r => {
                    if (r.age > maxAgeFound) maxAgeFound = r.age;
                    const key = `${r.item}|${r.plant}`;
                    if (r.status) {
                        dataStore.actionStates[r._id] = r.status;
                    } else if (!dataStore.actionStates[r._id] && historyStatusMap[key]) {
                        // Inherit latest status from Master history
                        dataStore.actionStates[r._id] = historyStatusMap[key];
                    }
                });
            }

            // Fallback: if Current sheet empty, use latest Master snapshot
            if (currentProcessed.length === 0 && state.latestSnap) {
                currentProcessed = masterProcessed.filter(d => d.snapshotDate === state.latestSnap);
                currentProcessed.forEach(r => {
                    const key = `${r.item}|${r.plant}`;
                    if (!dataStore.actionStates[r._id] && historyStatusMap[key]) {
                        dataStore.actionStates[r._id] = historyStatusMap[key];
                    }
                });
            }
            dataStore.currentData = currentProcessed;

            console.log(`📊 Master=${dataStore.allFilteredData.length}, Current(Dashboard)=${dataStore.currentData.length}`);
            console.log(`🔍 History Status Persistence: ${Object.keys(historyStatusMap).length} unique items with status found in history`);

            // ── 3. PERSIST & FINISH ─────────────────────────────────────────
            try { await localforage.setItem('inventoryActions', dataStore.actionStates); } catch (e) { }
            try { await localforage.setItem('inventoryData', dataStore.allFilteredData); } catch (e) { }

            const ageMaxInput = document.getElementById('filterAgeMax');
            if (ageMaxInput) {
                const safeMaxAge = Math.min(240, maxAgeFound || 120);
                ageMaxInput.max = safeMaxAge;
                document.getElementById('filterAgeMin').max = safeMaxAge;
                ageMaxInput.value = safeMaxAge;
                state.ageMax = safeMaxAge;
                document.getElementById('ageLabel').textContent = `${state.ageMin} - ${safeMaxAge} ด.`;
            }

            showLoading(100, 'สร้างแดชบอร์ด...');
            window.dispatchEvent(new CustomEvent('data-ready'));
        } catch (err) {
            console.error("Processing error", err);
            alert("เกิดข้อผิดพลาดในการประมวลผลข้อมูล: " + err.message);
        } finally {
            setTimeout(() => hideLoading(), 200);
        }
    }, 100);
}
