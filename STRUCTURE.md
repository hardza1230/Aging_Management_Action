# Inventory Over-PO Analyzer (v8)

Project structure and logic mapping to prevent AI "hallucination" and ensure consistency.

## 📁 Project Structure

- `index.html`: Main UI entry point (Clean HTML, no logic).
- `css/style.css`: All styling (Vanilla CSS + Tailwind utilities).
- `js/`: Application logic using **ES Modules**.
  - `state.js`: Global constants, constants for headers, and the central `dataStore`.
  - `utils.js`: Helper functions (parsing numbers, date calculations, modal management).
  - `api.js`: Data fetching (Google Sheets & Local Upload) and initial data processing.
  - `charts.js`: Chart.js configurations and update logic.
  - `ui.js`: DOM rendering for tables, dashboards, and tabs.
  - `app.js`: Main entry point, event listeners, and high-level orchestration.

## 🚀 Key Features

1. **Google Sheets Integration**: Automatically fetches data from a published CSV link on startup.
2. **ES Modules**: Code is modularized for better maintainability (no 1000+ line files).
3. **Local Persistence**: Uses `localforage` (IndexedDB) to save user actions and the last imported data.
4. **Interactive Dashboard**: KPI cards, Charts (Reason, Aging, Salesman), and Action Plan table.

## 🛠 Tech Stack

- **UI**: HTML5, TailwindCSS, Vanilla CSS.
- **Charts**: Chart.js 4.x + DataLabels plugin.
- **Data**: PapaParse (CSV Parsing), localforage (Storage).
- **Module System**: Native JS Modules (`type="module"`).

## 📝 Modification Rules (for AI)

- **Do NOT add logic to `index.html`**. Keep it as a template.
- **Update `state.js`** when adding new configuration or changing keys.
- **Use `dataStore`** in `state.js` for sharing data across modules.
- **Keep `ui.js`** focused on rendering. Move complex calculations to `utils.js` or `api.js`.
