export function parseNum(val) {
    if (val === undefined || val === null || val === '') return 0;
    // Remove all non-numeric chars except . and -
    const cleaned = String(val).replace(/[^0-9.\-]/g, '');
    return parseFloat(cleaned) || 0;
}

export function calculateAgeMonths(dateStr, ageFallback) {
    let fallbackMonths = Math.ceil((parseNum(ageFallback) || 0) / 30);
    if (!dateStr) return fallbackMonths || 1;
    let str = String(dateStr).trim();
    let parts = str.split(/[\/\-\s]/);
    let d;
    if (parts.length >= 3) {
        let y = parseInt(parts[0]), m = parseInt(parts[1]), day = parseInt(parts[2]);
        if (str.match(/^\d{4}/)) {
            d = new Date(y, m - 1, day);
        } else {
            y = parseInt(parts[2]);
            m = parseInt(parts[1]);
            day = parseInt(parts[0]);
            if (y > 2500) y -= 543;
            else if (y < 100) y += 2000;
            d = new Date(y, m - 1, day);
        }
    } else {
        d = new Date(str);
    }
    if (isNaN(d.getTime())) return fallbackMonths || 1;
    let months = Math.floor(((new Date() - d) / (1000 * 60 * 60 * 24)) / 30);
    return isNaN(months) || months < 1 ? 1 : months;
}

export function findActualHeader(row, keywords) {
    for (let key of Object.keys(row)) {
        if (Object.values(keywords).some(kwList => kwList.some(kw => String(key).toLowerCase().includes(kw)))) {
            // Check WHICH key it matched – actually helper keywords is nested. Better to pass specific list.
        }
    }
    return null;
}

export function findHeader(row, kwList) {
    const keys = Object.keys(row);
    const cleanKws = kwList.map(kw => kw.trim().toLowerCase().replace(/\s/g, ''));

    // 1. Strict Exact Match (Trimmed & Lowercase)
    for (let key of keys) {
        const k = String(key).trim().toLowerCase();
        if (kwList.some(kw => k === kw.trim().toLowerCase())) return key;
    }

    // 2. Strict Exact Match (No spaces)
    for (let key of keys) {
        const k = String(key).trim().toLowerCase().replace(/\s/g, '');
        if (cleanKws.some(ckw => k === ckw)) return key;
    }

    // 3. Partial Match (Prefer longer keywords first to avoid 'po' matching 'over po'?) 
    // Actually we iterate keys first.
    for (let key of keys) {
        const k = String(key).trim().toLowerCase().replace(/\s/g, '');
        // We only return if the keyword is a SIGNIFICANT part or the key contains the keyword uniquely
        for (let ckw of cleanKws) {
            if (k.length > 2 && k.includes(ckw)) return key;
        }
    }
    return null;
}

export function showLoading(percent, text) {
    const overlay = document.getElementById('loadingOverlay');
    const bar = document.getElementById('progressBar');
    const label = document.getElementById('loadingText');
    if (overlay) overlay.classList.remove('hidden');
    if (bar) bar.style.width = `${percent}%`;
    if (label) label.textContent = text;
}

export function hideLoading() {
    const overlay = document.getElementById('loadingOverlay');
    if (overlay) overlay.classList.add('hidden');
}

export function closeModal(modalId) {
    document.getElementById(modalId)?.classList.add('hidden');
}

export function openModalById(modalId) {
    document.getElementById(modalId)?.classList.remove('hidden');
}
