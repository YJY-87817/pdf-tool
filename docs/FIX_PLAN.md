# 頁序 PDF：問題盤點與修正規劃

- 檢查日期：2026-11-11
- 檢查基準：`main` @ `4a55821`
- 檢查範圍：`src/main.js`、`src/app.css`、`index.html`、`vite.config.js`、`package.json`、`.github/workflows/deploy.yml`、`README.md`
- 檢查方式：逐行閱讀全部原始碼；`npm ci`、`npm run build`、`npm audit`；以 Chromium 載入 production build，用自製測試 PDF 實際操作。

## 總結

建置與相依套件狀態正常（build 通過、`npm audit` 0 個弱點），核心的合併、拆分、旋轉、排序流程可用，先前修過的縮圖旋轉、加密檔拒絕、匯出去重都還有效。

這次找到 22 個問題，沒有會讓匯出檔案內容錯誤的問題。最需要先處理的是 **中文 PDF 縮圖空白**（A1）：這是面向中文使用者的工具，而未內嵌字型的中文 PDF 目前預覽是一張白紙。

| 優先度 | 數量 | 性質 |
| --- | --- | --- |
| P1 | 5 | 使用者會直接碰到的錯誤或誤導 |
| P2 | 8 | 體驗與無障礙 |
| P3 | 4 | 大檔案效能與記憶體 |
| P4 | 5 | 工程品質與文件 |

「狀態」欄：**已實測** 表示在瀏覽器重現；**程式碼判讀** 表示由程式碼推得、未另外重現。

---

## P1：功能錯誤與誤導

### A1. 中文（CJK）PDF 縮圖空白 — 已實測

- 位置：`src/main.js:372`（`pdfjs.getDocument({ data })`）
- 現象：使用未內嵌 CID 字型的 PDF（中日韓文件常見）縮圖完全空白，console 出現 `Ensure that the cMapUrl API parameter is provided.`。匯出的檔案本身正確，只有預覽壞掉，但使用者無法靠預覽辨認頁面。
- 原因：`getDocument` 沒有提供 `cMapUrl`、`standardFontDataUrl`、`wasmUrl`。後兩者缺少時，未內嵌標準 14 字型的文字、JPEG 2000 / JBIG2 影像（掃描檔常見）同樣會畫不出來。
- 修正：
  1. 建置時把 `node_modules/pdfjs-dist/` 下的 `cmaps/`（1.7 MB）、`standard_fonts/`（820 KB）、`wasm/`（1.6 MB）複製到 `dist/pdfjs/`（`vite-plugin-static-copy` 或一支 prebuild 腳本）。
  2. `getDocument` 加上 `cMapUrl`、`cMapPacked: true`、`standardFontDataUrl`、`wasmUrl`，路徑以 `import.meta.env.BASE_URL` 組成，才能在 `/pdf-tool/` 子路徑下運作。
- 驗收：用 reportlab `UnicodeCIDFont('MSung-Light')` 產生的 PDF 縮圖顯示文字；console 無 cMap 警告；這些資源只在需要時才被請求。

### A2. 拆分失敗時直接顯示內部英文錯誤訊息 — 程式碼判讀

- 位置：`src/main.js:533-534`
- 現象：`showToast(error.message || '拆分失敗…')`，只要錯誤物件有 message（pdf-lib、JSZip 的錯誤都有），使用者看到的就是原始英文訊息，中文備援訊息幾乎不會出現。另外用 `/頁碼|指定/` 比對訊息文字來判斷是不是使用者輸入錯誤，訊息一改字就會失效。
- 修正：新增 `class PageRangeError extends Error`，`parsePageRange` 與「請至少指定一頁」丟這個型別；`catch` 以 `instanceof PageRangeError` 分流：是則顯示其訊息，否則顯示固定中文訊息並 `console.error`。
- 驗收：輸入錯誤顯示對應中文提示；模擬 `createPdf` 丟錯時顯示「拆分失敗…」而非英文。

### A3. 頁面全部刪除後，來源文件仍留在清單並計入統計 — 已實測

- 位置：`src/main.js:562-566`（刪除）、`337-339`（統計）
- 現象：加入兩份文件後刪光其中一份的頁面，頁尾仍顯示「來自 2 份文件」，側欄也還列著該檔案與原始頁數；該文件的 pdf.js / pdf-lib 物件也持續佔用記憶體。
- 修正：刪除頁面後，移除已無任何頁面的來源文件（呼叫 `pdfJs.destroy()` 並自 `state.documents` 移除），可與 `removeDocument` 共用一個清理函式。若之後做 B5 的復原功能，則改為延後到復原期限過後才清理。
- 驗收：刪光某文件的頁面後，側欄與頁尾數字同步減少。

### A4. 加入檔案時沒有任何載入提示 — 程式碼判讀

- 位置：`src/main.js:360-400`
- 現象：第一次加入檔案要先下載約 900 KB 的 PDF 執行階段再解析，大檔案更久；這段期間畫面完全不變（空白狀態原樣停留），使用者無法分辨是否有反應，容易重複拖放。
- 修正：`addFiles` 開始時顯示進度狀態（例如頁尾或空白狀態顯示「正在讀取 2 / 5：檔名」），結束時還原。不要沿用 `state.busy`，因為它會鎖住旋轉、刪除等操作。
- 驗收：以節流網路加入大檔時，從放開到縮圖出現之間持續看得到進度文字。

### A5. 一次加入多個檔案時，個別失敗訊息被蓋掉 — 程式碼判讀

- 位置：`src/main.js:392`、`398`
- 現象：失敗檔案的提示會立刻被下一個提示覆蓋，最後只剩「已加入 1 個 PDF，1 個失敗」，不知道是哪一個、為什麼。
- 修正：迴圈中收集失敗清單，結束後一次顯示，列出檔名；並區分「有密碼保護」（pdf.js `PasswordException` / pdf-lib `EncryptedPDFError`）與「檔案損毀或格式不符」。含失敗項目時提示停留時間拉長。
- 驗收：同時加入一個正常檔、一個加密檔、一個損毀檔，提示能指出後兩者的檔名與原因。

---

## P2：體驗與無障礙

### B1. 每次操作都重建整個頁面格線，卡片進場動畫全部重播 — 已實測

- 位置：`src/main.js:230-267`（`renderPages`）、`src/app.css:201`
- 現象：旋轉、全選、拖曳排序、鍵盤移動都會 `innerHTML` 重建所有卡片，每張卡片重新播放 `arrive` 動畫，畫面整片閃一下；旋轉一頁也會讓其他頁閃動。
- 修正：
  - 全選／取消全選：只切換既有卡片的 class 與 `aria-pressed`（`togglePage` 已是這個做法）。
  - 旋轉：只重畫被旋轉卡片的 canvas。
  - 排序：搬動既有 DOM 節點並更新頁碼文字，不重建。
  - `arrive` 動畫只套用在新加入的卡片。
- 驗收：旋轉一頁時其他卡片節點不變（DOM 節點同一性）、無動畫重播。

### B2. `aria-live` 掛在整個頁面格線上 — 程式碼判讀

- 位置：`src/main.js:110`
- 現象：格線每次重建，螢幕報讀器會把全部頁面重念一次。
- 修正：移除 `#page-grid` 的 `aria-live`；狀態變化改由既有的 `#toast`（`role="status"`）或 `#selection-summary` 播報。

### B3. 行動版「加入 PDF」按鈕沒有無障礙名稱 — 已實測

- 位置：`src/main.js:55-57`、`src/app.css:267`
- 現象：寬度 760px 以下文字被 `display: none`，按鈕沒有 `aria-label` 也沒有 `title`，報讀器只會念「按鈕」。
- 修正：按鈕加上 `aria-label="加入 PDF"`。工具列的旋轉／拆分／刪除目前靠 `title` 提供名稱，一併補上 `aria-label` 較穩妥。

### B4. 高解析度螢幕上縮圖模糊 — 程式碼判讀

- 位置：`src/main.js:291`
- 現象：縮圖固定以最多 228 CSS px 寬繪製，沒有乘上 `devicePixelRatio`，在 Retina 與手機螢幕上明顯模糊。
- 修正：`scale` 乘上 `Math.min(devicePixelRatio, 2)`，顯示尺寸交給 CSS。需與 C1 一起做，否則記憶體用量變成 4 倍。

### B5. 刪除無法復原 — 程式碼判讀

- 位置：`src/main.js:562-566`
- 現象：刪除立即生效，沒有確認也沒有復原；誤刪只能重新加入整份檔案再重排。
- 修正：刪除後在提示中提供「復原」按鈕（保留被刪頁面與原位置數秒）；可順便支援 `Ctrl/Cmd+Z`。提示目前是 `pointer-events: none`，需要調整成可互動。

### B6. 觸控裝置上排序缺乏引導 — 程式碼判讀（未實機測試）

- 位置：`src/app.css:286-288`
- 現象：行動版把拖曳把手與排序提示都隱藏，唯一說明的替代方式是鍵盤 `Alt + ←/→`。HTML5 拖曳在觸控螢幕上需長按才會觸發，各瀏覽器行為不一。
- 修正：卡片選取後在工具列提供「往前移／往後移」按鈕（重用 `movePages`），觸控與鍵盤都能用；確認做法前先在實機 iOS Safari 與 Android Chrome 測試現況。

### B7. 頁碼範圍輸入容錯不足、錯誤訊息不精確 — 已實測

- 位置：`src/main.js:423-437`
- 現象：
  - `3-1` 回報「頁碼範圍需介於 1 到 3 頁」，但真正的問題是起訖顛倒。
  - `1-3,`（結尾逗號）被判為格式錯誤。
  - 全形輸入 `１-２`、`，`、`、`、`～` 被判為格式錯誤；中文輸入法下很容易打出全形。
- 修正：解析前先正規化（`normalize('NFKC')`，把 `，、；` 轉成 `,`、`～~–—` 轉成 `-`），忽略空白片段；顛倒範圍給專屬訊息。此函式抽成純函式（接收 `pageCount`），方便 D2 寫測試。

### B8. 拖曳放置位置不明確 — 程式碼判讀

- 位置：`src/main.js:611-626`、`src/app.css:206`
- 現象：目標卡片整張加虛線框，但實際是依滑鼠在卡片左半或右半決定插在前或後，畫面看不出來；一次拖多頁時也只看到一張卡片的拖影。
- 修正：`dragover` 時依左右半邊加上 `is-drop-before` / `is-drop-after`，以卡片側邊的直線標示插入點；多選拖曳時用 `setDragImage` 顯示頁數。

---

## P3：大檔案效能與記憶體

### C1. 縮圖記憶體沒有上限，且每頁存兩份 — 已實測（400 頁文件產生 404 個 DOM canvas）

- 位置：`src/main.js:269-312`
- 現象：每頁在 `thumbCache` 存一張離屏 canvas，再複製一份到卡片上的 canvas。每張約 270 KB，兩份合計每頁約 0.5 MB；上千頁文件會到數百 MB，行動裝置可能直接當掉分頁。
- 修正：快取改存 `ImageBitmap` 或直接重用同一個 canvas 節點（配合 B1 不再重建 DOM 後，快取可以大幅簡化）；離開可視範圍較遠的卡片釋放 canvas，回到範圍內再重畫。

### C2. 縮圖繪製沒有並行上限也無法取消 — 程式碼判讀

- 位置：`src/main.js:271-304`
- 現象：快速捲動時所有進入範圍的頁面同時開始繪製，已捲離的頁面仍會畫完。
- 修正：加一個小型佇列（並行 2 至 4），卡片離開可視範圍時從佇列移除或呼叫 `renderTask.cancel()`。

### C3. 匯出期間介面凍結 — 程式碼判讀

- 位置：`src/main.js:456-480`、`515-523`
- 現象：pdf-lib 在主執行緒執行，大檔合併時頁面無法互動，「正在整理頁面並匯出…」之外沒有進度。ZIP 模式逐頁呼叫 `createPdf`，但只有文字提示。
- 修正：短期在 ZIP 迴圈顯示「第 n / N 頁」；長期評估把 pdf-lib 移到 Web Worker。

### C4. 其他小項 — 程式碼判讀

- `src/main.js:3`：JSZip 是靜態匯入（進入主 bundle），只有 ZIP 拆分才用得到，應比照 pdf-lib 改為動態匯入。
- `src/main.js:263`：`renderPages` 中對每張卡片做 `state.pages.find`，是 O(n²)；B1 完成後自然消失。
- `src/main.js:488`：`URL.revokeObjectURL` 固定 1 秒後執行，大檔在較慢的裝置上可能下載尚未開始；改為 60 秒或更久。
- `src/main.js:495`：`createPdf(state.pages)` 直接傳入可變陣列，匯出期間仍可加入檔案。實測未重現問題（複製階段不會讓出執行權），建議改傳 `[...state.pages]` 作為防禦，並讓成功訊息的頁數取自這份快照。

---

## P4：工程品質與文件

### D1. 外部字型請求與「不會上傳」的訴求不一致 — 已實測

- 位置：`src/app.css:1`
- 現象：頁面載入時向 `fonts.googleapis.com`、`fonts.gstatic.com` 發出十多個請求。檔案確實沒有上傳，但對主打本機處理的工具，第三方請求會削弱可信度；離線時也會拖慢首次繪製。
- 修正：二擇一：改用系統字型堆疊（`system-ui, 'PingFang TC', 'Microsoft JhengHei', sans-serif`），或以 `@fontsource` 自行託管。建議前者，Noto Sans TC 自行託管體積很大。
- 驗收：載入頁面時沒有任何非同源請求。

### D2. 沒有測試、沒有 lint、PR 沒有 CI — 程式碼判讀

- 位置：`package.json`、`.github/workflows/deploy.yml`
- 現象：唯一的 workflow 只在推到 `main` 時部署；PR 不會跑 build，壞掉的變更要合併後才會發現。
- 修正：
  1. 把 `parsePageRange`、`formatPageRange`、`movePages` 的排序邏輯、`formatBytes` 抽到 `src/lib/` 成為純函式，用 Vitest 寫單元測試。
  2. 加 ESLint。
  3. 新增 `ci.yml`：`pull_request` 時跑 lint、test、build。
  4. 一支 Playwright smoke test：加入檔案、旋轉、匯出，再用 pdf-lib 驗證輸出頁數與旋轉角度。

### D3. `src/main.js` 單檔 675 行，且區域變數遮蔽全域 `document` — 程式碼判讀

- 位置：`src/main.js:215`、`241`、`287`、`384` 等
- 現象：多處以 `document` 當作來源文件的變數名稱，`addFiles` 內甚至是區塊層級的 `const document`。目前沒有出錯，但之後在同一區塊加一行 DOM 操作就會踩到。
- 修正：改名為 `doc` / `sourceDoc`；配合 D2 拆成 `state`、`render`、`thumbnails`、`export`、`events` 幾個模組。ESLint `no-shadow`（含 `builtinGlobals`）可防止再犯。

### D4. 匯出的已知限制沒有寫在 README — 已實測（書籤）／程式碼判讀（表單）

- 現象：匯出後書籤（outline）消失：測試檔有 3 個書籤，匯出後為 0。這是 pdf-lib `copyPages` 的行為；同理，可填寫表單欄位、文件內部連結、文件屬性（標題、作者）也不會保留。
- 修正：README 新增「已知限制」一節列出上述項目，以及「不支援加密／有密碼的 PDF」。是否要自行重建書籤屬於新功能，另案評估。

### D5. 零星項目

| 位置 | 問題 | 修正 |
| --- | --- | --- |
| `index.html:6` | `theme-color` 固定為 `#ffffff`，深色模式下瀏覽器介面仍是白色 | 用兩個帶 `media="(prefers-color-scheme: …)"` 的 meta |
| `src/main.js:48` | 品牌連結 `href="#"` 沒有作用，點了只會在網址加上 `#` | 改為非連結元素，或指向 `import.meta.env.BASE_URL` |
| `src/main.js:521` | ZIP 內檔名的序號是「擷取順序」，不是工作區頁碼也不是來源頁碼，例如 `a-001.pdf`、`b-002.pdf` | 改為 `{序號}-{來源檔名}-p{來源頁碼}.pdf`，序號放前面才會依序排列 |
| `src/main.js:496`、`524`、`527` | 下載檔名固定，連續匯出會互相覆蓋或變成 `(1)`、`(2)` | 單一來源時沿用來源檔名，或附上時間戳 |
| `src/app.css:75`、`86` | 行動瀏覽器上 `100vh` 會超出可視高度 | 加上 `100dvh` |
| `package.json` | 套件名 `pdf-studio`、版本 `0.0.0`，與 repo 名、產品名不一致；沒有 LICENSE | 統一命名，補授權檔 |
| 相依套件 | `pdfjs-dist` 6.4.299 → 6.5.438、`lucide` 1.52 → 1.71、`vite` 8.3.3 → 8.3.7 可更新 | 與 A1 一起升級並重測縮圖 |

---

## 建議的執行順序

每個階段各自一個 PR，都可以獨立上線。

| 階段 | 內容 | 項目 | 規模 |
| --- | --- | --- | --- |
| 1 | 縮圖正確性與錯誤訊息 | A1、A2、A3、A5、C4（快照與 revoke） | 小 |
| 2 | 測試基礎 | D2、D3（先抽純函式與改名）、B7 | 中 |
| 3 | 渲染方式改為局部更新 | B1、B2、B3、C1、C2、B4 | 大 |
| 4 | 操作體驗 | A4、B5、B6、B8、C3（ZIP 進度） | 中 |
| 5 | 收尾 | D1、D4、D5、C4（JSZip 動態匯入） | 小 |

排序理由：

- 階段 1 都是小改動，能立刻修掉最明顯的問題（A1）。
- 階段 2 先於階段 3：階段 3 會大幅改寫 `renderPages` 與排序邏輯，需要測試保護。
- B4（高解析度縮圖）必須在 C1（記憶體）之後，所以放在同一階段的最後。
- B5（復原）會影響 A3 的清理時機，實作 B5 時要回頭調整 A3。

## 不在這次範圍

- 支援加密 PDF（輸入密碼後解鎖）：pdf-lib 1.17.1 不支援，且該套件自 2021 年後沒有新版本；需要時再評估替代方案。
- 保留或重建書籤、表單欄位。
- PWA／離線安裝。
- 逆時針旋轉、Shift 連選、`Delete` / `Ctrl+A` 快捷鍵等新功能。
