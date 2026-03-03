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

### 6. Stock Doubling & Latest Snapshot Filter
- **Problem**: When loading multiple snapshots for history, the Dashboard KPIs (Total Stock, Over PO) were doubling or tripling because they summed all snapshots.
- **Solution Implementation**: Added `latestSnap` detection in `api.js` using robust date parsing (supporting Thai years). The main dashboard and Action Management now filter data to show only the most recent snapshot by default.

### 7. Missing "Notable Decreases" (Items cleared)
- **Requirement**: Users want to see which items have been cleared or reduced significantly between snapshots.
- **Solution Implementation**: 
    - Implemented "Notable Decreases" calculation by comparing the last two snapshots.
    - Added ✅ visual indicator for items that reached 0 stock in the latest snapshot.
    - Updated `renderProgressTab` to use full historical data (ignoring filters) for trend accuracy.

### 8. Action Management Table Column Layout
- **Requirement**: High-density table focusing on key information in fewer columns.
- **Solution Implementation**: 
    - Merged `Item`, `Description`, `Reason`, `Remarks`, and `Latest Sale` into a single "Item Info" column.
    - Fixed formatting for `Allowance` to support text strings like "+10/-10".
    - Added "💾 Save" button inside each row for individual confirmation.
    - Defaulted age range filter to 4+ months to focus on critical cases.

## 📅 Log History

| 2026-03-03 | ปรับปรุง KPI Cards และ Dashboard | ✅ Updated | เปลี่ยนชุด KPI, เพิ่ม Data Label, Legend %, และปุ่มสลับหน่วย |
| 2026-03-03 | แสดงคอลัมน์ "ขายล่าสุด" | ✅ Added | แมพข้อมูลขายล่าสุดลงตาราง Action Management |
| 2026-03-03 | เอาปุ่มบันทึกทั้งหมดออก | ✅ Removed | นำปุ่ม Save All ออกตามคำขอ |
| 2026-03-03 | ข้อมูลหน้า Dashobard หาย | ✅ Fixed | ปรับปรุง findHeader ให้รองรับสระและวรรณยุกต์ไทย |
| 2026-03-03 | Stock เบิ้ล & Progress ไม่ขึ้น | ✅ Fixed | เพิ่ม Latest Snapshot filter และระบบเปรียบเทียบประวัติข้ามชุดข้อมูล |
| 2026-03-03 | ปรับ Layout ตาราง Action | ✅ Redesigned | รวมคอลัมน์ข้อมูลเป็น Item Info ชุดเดียว และแก้บั๊กคอลัมน์ค่าเผื่อ |

