import { GOOGLE_SHEET_URL, APPS_SCRIPT_API_URL, headerKeywords, dataStore, state } from './state.js';
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
        latestSale: findHeader(sr, headerKeywords.latestSale),
        hasPo: findHeader(sr, headerKeywords.hasPo),
        snapshotDate: findHeader(sr, ['snapshot date', 'วันที่ดึงข้อมูล', 'วันที่', 'snapshot'])
    };
    map.actionStatus = findHeader(sr, headerKeywords.actionStatus);

    console.log("📍 Column Mapping Results:", map);

    if (!map.overPo || !map.stock) {
        hideLoading();
        const missing = [];
        if (!map.stock) missing.push('"สต็อก"');
        if (!map.overPo) missing.push('"เกินพีโอ"');
        return alert('ไม่พบคอลัมน์ที่จำเป็น: ' + missing.join(' และ ') + '\nกรุณาตรวจสอบชื่อหัวตารางในไฟล์ Excel');
    }

    showLoading(70, 'วิเคราะห์ข้อมูล...');
    setTimeout(async () => {
        try {
            let processed = [];
            let maxAgeFound = 0;
            rawData.forEach((row, i) => {
                const stockVal = parseNum(row[map.stock]);
                const poVal = parseNum(row[map.hasPo]);
                const overVal = parseNum(row[map.overPo]);

                if (stockVal > 0 || overVal > 0 || poVal > 0) {
                    const reasonRaw = map.reason && row[map.reason] ? String(row[map.reason]).trim() : '';
                    const rawDate = map.latestProduce ? row[map.latestProduce] : null;
                    const ageMonths = calculateAgeMonths(rawDate, row[map.age]);
                    if (ageMonths > maxAgeFound) maxAgeFound = ageMonths;

                    let finalReason = reasonRaw || 'รอข้อมูลวางแผน';
                    if (finalReason === '-' || finalReason === '') finalReason = 'รอข้อมูลวางแผน';

                    const rowId = `row_${i}_${row[map.item] || i}`;
                    const sheetStatus = map.actionStatus && row[map.actionStatus] ? String(row[map.actionStatus]).trim() : '';
                    if (sheetStatus) dataStore.actionStates[rowId] = sheetStatus;

                    processed.push({
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
                        status: sheetStatus,
                        snapshotDate: map.snapshotDate ? String(row[map.snapshotDate]).trim() : '-',
                        missingData: (!rawDate || !reasonRaw || reasonRaw === '-')
                    });
                }
            });

            const uniqueDates = [...new Set(processed.map(d => d.snapshotDate))].filter(d => d && d !== '-');
            if (uniqueDates.length > 0) {
                const parseDate = (s) => {
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
                uniqueDates.sort((a, b) => parseDate(a) - parseDate(b));
                state.latestSnap = uniqueDates[uniqueDates.length - 1];
                dataStore.snapDates = uniqueDates;
            }

            // Persistence and State
            try { await localforage.setItem('inventoryActions', dataStore.actionStates); } catch (e) { }
            dataStore.allFilteredData = processed;
            dataStore.currentData = processed.filter(d => String(d.snapshotDate).toLowerCase().includes('current') || String(d.snapshotDate).includes('ล่าสุด'));
            if (dataStore.currentData.length === 0 && state.latestSnap) {
                dataStore.currentData = processed.filter(d => d.snapshotDate === state.latestSnap);
            }

            const ageMaxInput = document.getElementById('filterAgeMax');
            if (ageMaxInput) {
                const safeMaxAge = Math.min(240, maxAgeFound || 120);
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
            console.error("Processing error", err);
            alert("เกิดข้อผิดพลาดในการประมวลผลข้อมูล: " + err.message);
        } finally {
            setTimeout(() => hideLoading(), 200);
        }
    }, 100);
}
