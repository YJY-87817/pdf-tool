# 頁序 PDF

在瀏覽器裡合併、拆分與整理 PDF 頁面的小工具。所有處理都在你的裝置上完成，檔案不會上傳到任何伺服器。

線上使用：<https://yjy-87817.github.io/pdf-tool/>

## 功能

- **加入多份 PDF**：點「加入 PDF」選擇檔案，或直接把檔案拖曳到頁面上。每份文件會有自己的顏色，方便分辨頁面來源。
- **整理頁面**：點選頁面即可選取，拖曳頁面可重新排序。
- **旋轉與刪除**：對已選取的頁面一次旋轉 90 度或刪除。
- **合併並匯出**：依照目前的頁面順序，把所有頁面輸出成一份 PDF。
- **拆分**：指定頁碼範圍（例如 `1-3, 5`），有兩種輸出方式：
  - 擷取為一份 PDF
  - 每頁分開，打包成 ZIP

  如果有勾選頁面，打開拆分視窗時會自動帶入勾選的頁碼範圍。
- **深色模式**：跟隨系統設定自動切換。
- **手機版**：支援小螢幕操作。

> 有密碼保護（加密）的 PDF 可能無法正確讀取或匯出。

## 隱私

PDF 的讀取、預覽與輸出都在瀏覽器內完成，不會傳送到任何伺服器。

## 本機開發

需要 Node.js 22 或以上版本。

```bash
npm install
npm run dev      # 啟動開發伺服器
npm run build    # 建置到 dist/
npm run preview  # 預覽建置結果
```

開發伺服器啟動後，開啟終端機顯示的網址（路徑為 `/pdf-tool/`）。

## 部署

推送到 `main` 分支後，GitHub Actions（`.github/workflows/jekyll-gh-pages.yml`）會自動建置並部署到 GitHub Pages。

網站部署在 `/pdf-tool/` 子路徑下，對應 `vite.config.js` 裡的 `base` 設定；如果更改 repository 名稱，記得一起修改。

## 技術

- [Vite](https://vite.dev/)，原生 JavaScript，不使用框架
- [pdf.js](https://mozilla.github.io/pdf.js/)（`pdfjs-dist`）：頁面縮圖預覽。使用 legacy 版本，以支援還沒有 `Map.prototype.getOrInsertComputed` 的瀏覽器。
- [pdf-lib](https://pdf-lib.js.org/)：合併、拆分與旋轉頁面
- [JSZip](https://stuk.github.io/jszip/)：逐頁拆分時打包成 ZIP
- [Lucide](https://lucide.dev/)：圖示

## 專案結構

```
index.html      頁面入口
src/main.js     介面與所有 PDF 處理邏輯
src/app.css     樣式（含深色模式與手機版）
vite.config.js  Vite 設定
```
