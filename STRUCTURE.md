# Inventory Over-PO Analyzer (v8) - Collaborative Edition

Project structure and logic mapping to ensure consistency and prevent AI hallucination.

## 📁 Project Structure

- `index.html`: Main UI entry point (Clean HTML, no logic).
- `css/style.css`: All styling (Vanilla CSS + Tailwind utilities).
- `js/`: Application logic using **ES Modules**.
  - `state.js`: Global constants, header keywords, and central `dataStore`. (Includes Google Apps Script API URLs).
  - `utils.js`: Helper functions (parsing numbers, date calculations, modal management).
  - `api.js`: Data fetching (Google Sheets Fetch) and **Action Sync (POST to Apps Script)**.
  - `charts.js`: Chart.js configurations and update logic.
  - `ui.js`: DOM rendering for tables, dashboards, and tabs.
  - `app.js`: Main entry point, event listeners, and high-level orchestration.

## 🚀 Key Features

1. **Google Sheets Central Source**: Fetches live data from a published Google Sheet CSV on startup.
2. **Collaborative Action Status**: Team-wide status synchronization. Selecting a status in the UI triggers a POST request to a Google Apps Script Web App, which updates the master Google Sheet.
3. **Automated Header Mapping**: Uses keyword matching in `state.js` to find correct columns (supports "สถานะการจัดการ").
4. **Historical Analysis Prepared**: Web App logic is ready to handle "Snapshot Date" columns for future trend analysis.
5. **ES Modules & Clean UI**: Modularized logic for maintenance; TailwindCSS for premium aesthetic.

## 🛠 Tech Stack

- **UI**: HTML5, TailwindCSS, Vanilla CSS.
- **Charts**: Chart.js 4.x + DataLabels plugin.
- **Data Persistence**: 
  - **Local**: `localforage` (IndexedDB) for local fallback.
  - **Global**: Google Apps Script (Webhook) for live write-backs.
- **Parsing**: PapaParse (CSV Parsing).
- **Module System**: Native JS Modules (`type="module"`).

## 📝 Modification Rules (for AI)

- **Do NOT add logic to `index.html`**. Keep it as a template.
- **NEVER use manual CSV uploads**. Logic has been removed to enforce the Google Sheets single source of truth.
- **Action Management**: All UI changes to action status must call `saveActionToSheet()` in `api.js`.
- **Global State**: Use `dataStore` in `state.js` for sharing data across modules.
- **UI Renders**: Keep `ui.js` focused on rendering. Complex data processing belongs in `api.js`.

