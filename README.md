# 頁序 PDF

在瀏覽器裡合併、拆分與整理 PDF 頁面。檔案只在本機處理，不會上傳。

## 功能

- 加入多份 PDF，點選頁面選取、拖曳排序
- 旋轉、刪除所選頁面
- 合併並匯出成一份 PDF
- 拆分：指定頁碼範圍（如 `1-3, 5`），輸出成一份 PDF 或逐頁打包成 ZIP；有勾選頁面時會自動帶入

## 開發

```bash
npm install
npm run dev
npm run build
```

推送到 `main` 會自動部署到 GitHub Pages（網站在 `/pdf-tool/` 子路徑，見 `vite.config.js`）。
