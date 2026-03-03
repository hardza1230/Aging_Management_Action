export const state = {
    search: '',
    plant: 'all',
    saleman: 'all',
    customer: 'all',
    ageMin: 4,
    ageMax: 120,
    page: 1,
    limit: 30,
    sortBy: 'overPo',
    sortAsc: false,
    chartMode: 'qty', // 'cases' or 'qty'
    latestSnap: null,
    currentTab: 'exec'
};

export const headerKeywords = {
    overPo: ['เกินพีโอ', 'เกิน พีโอ', 'เกิน po', 'เกินpo', 'over po', 'excess'],
    stock: ['สต็อก', 'สต๊อก', 'สตอก', 'ส.ต.อ.ก.', 'stock', 'total stock', 'คงเหลือ'],
    reason: ['reason', 'สาเหตุ', 'ที่มา'],
    latestProduce: ['ผลิตล่าสุด', 'last produce', 'mfg'],
    age: ['อายุ', 'age'],
    item: ['item', 'รหัสสินค้า', 'sku'],
    desc: ['description', 'รายละเอียด'],
    saleman: ['saleman', 'พนักงานขาย'],
    customer: ['customer', 'ลูกค้า'],
    plant: ['plant', 'แพลนต์', 'สาขา'],
    allowance: ['ค่าเผื่อ', 'allowance'],
    planRemark: ['planning remarks', 'planning remark', 'remark', 'หมายเหตุวางแผน'],
    latestSale: ['ขายล่าสุด', 'last sale', 'latest sale'],
    hasPo: ['มีพีโอ', 'มี พีโอ', 'มี พี โอ', 'มี po', 'มีpo', 'has po'],
    actionStatus: ['action (วิธีการ)', 'วิธีการ', 'สถานะการจัดการ', 'action status', 'status', 'จัดการ']
};

export const DEFAULT_ACTIONS = ["รอตรวจสอบ", "รอเคลียร์ตัวเลข", "รอ Rework", "รอส่งคืน", "รอทำลาย", "รอขายลดราคา", "ดำเนินการแล้ว"];
export const CORE_ACTIONS = ["รอตรวจสอบ", "ดำเนินการแล้ว"];

export const actionColors = {
    "รอตรวจสอบ": "#94a3b8",
    "รอเคลียร์ตัวเลข": "#8b5cf6",
    "รอ Rework": "#f59e0b",
    "รอส่งคืน": "#f97316",
    "รอทำลาย": "#ef4444",
    "รอขายลดราคา": "#3b82f6",
    "ดำเนินการแล้ว": "#10b981"
};

export function getActionColor(actionStr) {
    return actionColors[actionStr] || "#475569";
}

export const dataStore = {
    allFilteredData: [],
    activeData: [],
    actionStates: {},
    actionOptions: [...DEFAULT_ACTIONS],
    charts: {}
};

export const GOOGLE_SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTfJvJCGJfmarGs9LqNQfjozHgcdUUTHryMsim9soay_UF6UOcyB4KpIhwHwNvxaUqC5W1OpbIHjsH9/pub?gid=0&single=true&output=csv";
export const APPS_SCRIPT_API_URL = "https://script.google.com/macros/s/AKfycbzvh06DciAs8HYw_N_i7_oaBgNjAp10gVZjGwNlt1TRzpd7OedEi3FgxJHCS41xdtVXMA/exec";
