# Inventory Over-PO Analyzer (v8) - Collaborative Edition

Project structure and logic mapping to ensure consistency and prevent AI hallucination.

## 📁 Project Structure

- `STRUCTURE.md`: Project summary and rules.
- `PROBLEM.md`: Log of user problems and implementation history.
- `index.html`: Main UI entry point (Clean HTML, no logic).
- `css/style.css`: All styling (Vanilla CSS + Tailwind utilities).
- `js/`: Application logic using **ES Modules**.
  - `state.js`: Constants, keywords, and `dataStore`.
  - `utils.js`: Helper functions (parsing, dates, modals).
  - `api.js`: Data fetching (Sheets) and **Manual Action Sync**.
  - `charts.js`: Chart.js configurations.
  - `ui.js`: DOM rendering for tables and dashboards.
  - `app.js`: Event listeners and orchestration.

## 🚀 Key Features

1. **Google Sheets Central Source**: Fetches live data from a published Google Sheet CSV on startup.
2. **Collaborative Action Status (Manual Save)**: Team-wide status sync. Users must click "Save" or "Save All" to push data to Google Sheets via Apps Script.
3. **Enhanced Header Mapping**: Keyword matching for "Action (วิธีการ)" and "Snapshot Date".
4. **Data Accuracy**: Uses `rowId`, `Snapshot Date`, and `Item` for precise row matching on the server.
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

