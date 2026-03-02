import { GOOGLE_SHEET_URL, APPS_SCRIPT_API_URL, headerKeywords, dataStore, state } from './state.js';
import { parseNum, calculateAgeMonths, findHeader, showLoading, hideLoading } from './utils.js';

export async function saveActionToSheet(rowId, status) {
    if (!APPS_SCRIPT_API_URL) return; // ถ้าไม่ได้ระบุ URL ก็ข้ามไป (ใช้แค่ Local)

    try {
        await fetch(APPS_SCRIPT_API_URL, {
            method: 'POST',
            mode: 'no-cors',
            body: JSON.stringify({ rowId, status }),
            headers: { 'Content-Type': 'application/json' }
        });
        console.log(`📡 ซิงค์ข้อมูล "${status}" ไปยัง Google Sheet แล้ว (${rowId})`);
    } catch (e) {
        console.error("Sheet sync failed", e);
    }
}


export async function fetchGoogleSheet() {
    showLoading(20, 'กำลังดึงข้อมูลจาก Google Sheets...');
    try {
        const response = await fetch(GOOGLE_SHEET_URL);
        if (!response.ok) throw new Error('ไม่สามารถเข้าถึง Google Sheets ได้');
        const csvText = await response.text();

        Papa.parse(csvText, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                showLoading(50, 'ประมวลผลข้อมูล...');
                processData(results.data);
            },
            error: (err) => {
                hideLoading();
                alert('PapaParse error: ' + err.message);
            }
        });
    } catch (err) {
        hideLoading();
        alert('Fetch error: ' + err.message);
    }
}

export function processData(rawData) {
    if (rawData.length === 0) {
        hideLoading();
        return alert('ไฟล์ว่างเปล่า');
    }
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
        actionStatus: findHeader(sr, headerKeywords.actionStatus)
    };

    if (!map.overPo) {
        hideLoading();
        return alert('ไม่พบคอลัมน์ "เกินพีโอ"');
    }

    showLoading(70, 'วิเคราะห์ข้อมูล...');
    setTimeout(async () => {
        let processed = [];
        let maxAgeFound = 0;
        rawData.forEach((row, i) => {
            const overVal = parseNum(row[map.overPo]);
            if (overVal > 0) {
                const reasonRaw = map.reason && row[map.reason] ? String(row[map.reason]).trim() : '';
                const rawDate = map.latestProduce ? row[map.latestProduce] : null;
                const ageMonths = calculateAgeMonths(rawDate, row[map.age]);
                if (ageMonths > maxAgeFound) maxAgeFound = ageMonths;

                let finalReason = reasonRaw;
                if (!finalReason || finalReason === '-' || finalReason === '') {
                    finalReason = 'รอข้อมูลวางแผน';
                }

                const rowId = `row_${i}_${row[map.item] || 'u'}`;
                const sheetStatus = map.actionStatus && row[map.actionStatus] ? String(row[map.actionStatus]).trim() : '';
                if (sheetStatus) dataStore.actionStates[rowId] = sheetStatus;

                processed.push({
                    _id: rowId,
                    overPo: overVal,
                    reason: finalReason,
                    age: ageMonths,
                    item: row[map.item] || '-',
                    desc: row[map.desc] || '-',
                    saleman: row[map.saleman] || '-',
                    customer: row[map.customer] || '-',
                    plant: map.plant && row[map.plant] ? row[map.plant] : '-',
                    allowance: map.allowance ? parseNum(row[map.allowance]) : 0,
                    planRemark: map.planRemark && row[map.planRemark] ? String(row[map.planRemark]).trim() : '-',
                    missingData: (!rawDate || !reasonRaw || reasonRaw === '-')
                });
            }
        });

        // Save synchronized actions to localForage
        try { await localforage.setItem('inventoryActions', dataStore.actionStates); } catch (e) { }

        dataStore.allFilteredData = processed;

        const ageMaxInput = document.getElementById('filterAgeMax');
        if (ageMaxInput) {
            const safeMaxAge = Math.min(240, maxAgeFound || 120);
            ageMaxInput.max = safeMaxAge;
            document.getElementById('filterAgeMin').max = safeMaxAge;
            ageMaxInput.value = safeMaxAge;
            state.ageMax = safeMaxAge;
            document.getElementById('ageLabel').textContent = `0 - ${safeMaxAge} ด.`;
        }

        try {
            await localforage.setItem('inventoryData', dataStore.allFilteredData);
        } catch (e) { }

        showLoading(100, 'สร้างแดชบอร์ด...');
        // Need to call updateUI from here or dispatch event. Let's use custom event.
        window.dispatchEvent(new CustomEvent('data-ready'));
        setTimeout(() => hideLoading(), 200);
    }, 100);
}
