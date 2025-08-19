# Repository Guidelines（專案貢獻指南）

## 專案結構與模組組織
- `manifest.json`：Chrome MV3 清單（權限、背景、操作）。
- `background.js`：Service worker；情境選單、分頁監聽、腳本注入。
- `content.js`：頁內 UI、擷取/填入邏輯、存取儲存。
- `popup.html` / `popup.js` / `popup.css`：擴充功能的網站、快照、設定視圖 UI。
- `images/`：圖示（`icon16/48/128.png`）。
- `README.md` / `GEMINI.md`：使用說明與相關文件。

## 建置、測試與開發指令
- 本機執行：在 Chrome 啟用開發人員模式 → `chrome://extensions` → 載入未封裝 → 選擇專案根目錄。
- 重新載入：修改檔案後在擴充功能列表點「重新載入」。
- 封裝（Zip 供上架/手動安裝）：`zip -r dist/form-input-saver.zip . -x ".git/*" "dist/*" "*.DS_Store"`
- 重置儲存（清空狀態）：在任何頁面 DevTools Console 執行 `chrome.storage.local.clear()`。

## 程式風格與命名規範
- JavaScript：2 空白縮排、必加分號、使用雙引號、避免結尾逗號。
- 命名：變數/函式使用 `camelCase`，類別用 `PascalCase`，檔名小寫或 kebab（如 `content.js`、`popup.html`）。
- DOM/ID/CSS class：小寫加連字號（如 `fill-btn`、`whitelisted-sites-list`）。
- 內容腳本 UI 隔離：類別名稱加前綴 `form-saver-` 以避免衝突。

## 測試指南
- 手動 QA 流程：
  - 表單送出出現提示；按「儲存」會寫入資料；提交可順利進行。
  - Popup 能列出網站與快照；填入/刪除正常；白名單切換與主機名同步。
  - 匯出產生 `form-input-saver-backup-YYYYMMDD_HHMMSS.json`；匯入會合併且避免重複。
  - 僅對白名單主機注入 `content.js`。
- 專案未包含單元測試框架；若新增邏輯，傾向抽出小型可測單元。

## Commit 與 Pull Request 準則
- Commit 風格：遵循 Conventional Commits（`feat`、`fix`、`refactor`、`docs`…）；主旨使用祈使句，scope 可選。
  - 範例：`feat(popup): add whitelist toggle` 或 `fix: remove underline from whitelist URLs`。
- PR：說明清楚、連結議題、UI 變更附截圖或短影片，並提供測試步驟。

## 安全與設定提示
- 權限範圍廣（`<all_urls>`）；避免記錄敏感表單資料；減少除錯日誌。
- 以主機白名單控制注入；驗證使用者輸入；妥善處理 `chrome.storage` 錯誤。
