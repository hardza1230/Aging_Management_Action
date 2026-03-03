# User Problem Log & Task Requirements

This document tracks specific problems reported by users and the solutions implemented to address them.

## 📝 Recent Problems & Requirements

### 1. Row Mapping Discrepancy
- **Problem**: When users update an action, the data sometimes lands on the wrong row in Google Sheets.
- **Hypothesis**: Likely due to incorrect column identification or row shifting when multiple users edit simultaneously.
- **Solution Implementation**:
    - Enhanced `headerKeywords` in `state.js` to prioritize "Action (วิธีการ)" and "สถานะการจัดการ".
    - Included `Snapshot Date` in the sync payload for better row identification on the server-side (Apps Script).
    - Switched from automatic sync (on change) to manual sync (on button click) to prevent race conditions.

### 2. Lack of Confirmation for Actions
- **Requirement**: Users want a "Save" button to confirm their action status selected in the dropdown.
- **Solution Implementation**:
    - Added a `Save` button in every row of the `Action Management` table.
    - Added a `💾 บันทึกที่เลือกทั้งหมด` (Save All) button in the header for bulk updates.
    - Removed the unnecessary `Export Excel` button to clean up the UI.
    - Added visual feedback (⏳, ✅, ❌) on buttons to indicate sync status.

### 4. Database Mapping - "ขายล่าสุด"
- **Requirement**: Mapping and displaying the "Latest Sale" (ขายล่าสุด) column in the table.
- **Solution Implementation**: Added `latestSale` keywords to `state.js` and included the column in the `Action Management` table.

### 5. Executive Dashboard Redesign
- **Requirement**: Overhaul KPI cards and add advanced chart features (Legend %, Connector lines, Data labels).
- **Solution Implementation**: 
    - Replaced old KPI cards with: SKU Count, Total Stock (Excess), With PO, and Over PO.
    - Updated Donut Chart to show percentages in legends.
    - Enabled DataLabels for Bar and Donut charts.
    - Added a Toggle Button to switch Reason chart between "Cases" and "Item Quantity".
    - Removed "Save All Visible Actions" button as requested.
    - Improved Reason chart spacing and Indigo color scheme.

## 📅 Log History

| Date | User Request | Status | Resolution |
| :--- | :--- | :--- | :--- |
| 2026-03-03 | ปรับปรุง KPI Cards และ Dashboard | ✅ Updated | เปลี่ยนชุด KPI, เพิ่ม Data Label, Legend %, และปุ่มสลับหน่วย |
| 2026-03-03 | แสดงคอลัมน์ "ขายล่าสุด" | ✅ Added | แมพข้อมูลขายล่าสุดลงตาราง Action Management |
| 2026-03-03 | เอาปุ่มบันทึกทั้งหมดออก | ✅ Removed | นำปุ่ม Save All ออกตามคำขอ |
