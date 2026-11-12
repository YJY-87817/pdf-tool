import {
  ArrowLeft,
  ArrowRight,
  Check,
  Combine,
  FilePlus2,
  FileStack,
  Files,
  GripVertical,
  Plus,
  RotateCw,
  Scissors,
  ShieldCheck,
  Trash2,
  Upload,
  X,
  createIcons,
} from 'lucide'

export const app = document.querySelector('#app')

const iconSet = {
  ArrowLeft,
  ArrowRight,
  Check,
  Combine,
  FilePlus2,
  FileStack,
  Files,
  GripVertical,
  Plus,
  RotateCw,
  Scissors,
  ShieldCheck,
  Trash2,
  Upload,
  X,
}

app.innerHTML = `
  <header class="topbar">
    <a class="brand" href="${import.meta.env.BASE_URL}" aria-label="頁序 PDF 工作台首頁">
      <span class="brand-mark"><i data-lucide="file-stack"></i></span>
      <span class="brand-name">頁序</span>
      <span class="brand-tag">PDF</span>
    </a>
    <span class="privacy-badge"><i data-lucide="shield-check"></i><span>檔案只在此裝置處理，不會上傳</span></span>
    <div class="topbar-actions">
      <button class="button button-quiet" type="button" data-action="add-files" aria-label="加入 PDF">
        <i data-lucide="plus"></i><span>加入 PDF</span>
      </button>
      <button class="button button-primary" type="button" data-action="merge" disabled>
        <i data-lucide="combine"></i><span>合併並匯出</span>
      </button>
    </div>
  </header>

  <main class="workspace">
    <aside class="sidebar" aria-label="來源文件">
      <div class="sidebar-heading">
        <h1>來源文件</h1>
        <span class="count-badge" id="file-count">0</span>
      </div>
      <div id="file-list" class="file-list"></div>
      <button class="add-source" type="button" data-action="add-files">
        <i data-lucide="file-plus-2"></i><span>加入其他文件</span>
      </button>
    </aside>

    <section class="editor" aria-label="PDF 頁面編輯器">
      <div class="toolbar" role="toolbar" aria-label="頁面操作">
        <div class="tool-group">
          <button class="tool-button tool-select-all" type="button" data-action="select-all" disabled>
            <span class="select-box" aria-hidden="true"><i data-lucide="check"></i></span><span>全選</span>
          </button>
          <span class="selection-summary" id="selection-summary">尚未選取頁面</span>
        </div>
        <div class="tool-group">
          <button class="tool-button" type="button" data-action="move-earlier" title="將所選頁面往前移一格" aria-label="將所選頁面往前移" disabled>
            <i data-lucide="arrow-left"></i><span>前移</span>
          </button>
          <button class="tool-button" type="button" data-action="move-later" title="將所選頁面往後移一格" aria-label="將所選頁面往後移" disabled>
            <i data-lucide="arrow-right"></i><span>後移</span>
          </button>
          <button class="tool-button" type="button" data-action="rotate-selected" title="將所選頁面旋轉 90 度" aria-label="旋轉所選頁面" disabled>
            <i data-lucide="rotate-cw"></i><span>旋轉</span>
          </button>
          <button class="tool-button" type="button" data-action="open-split" title="拆分或擷取頁面" aria-label="拆分或擷取頁面" disabled>
            <i data-lucide="scissors"></i><span>拆分</span>
          </button>
          <button class="tool-button tool-danger" type="button" data-action="delete-selected" title="刪除所選頁面" aria-label="刪除所選頁面" disabled>
            <i data-lucide="trash-2"></i><span>刪除</span>
          </button>
        </div>
      </div>

      <div class="canvas-shell" id="canvas-shell">
        <div class="empty-state" id="empty-state">
          <div class="empty-art" aria-hidden="true">
            <span class="paper paper-back"></span><span class="paper paper-mid"></span>
            <span class="paper paper-front"><i data-lucide="file-stack"></i></span>
          </div>
          <h2>把 PDF 拖曳到這裡</h2>
          <p>合併多份文件、調整頁面順序、旋轉、刪除或拆分，全部在瀏覽器內完成。</p>
          <button class="button button-primary button-large" type="button" data-action="add-files">
            <i data-lucide="upload"></i><span>選擇 PDF 檔案</span>
          </button>
          <span class="file-hint">可一次選擇多個檔案</span>
        </div>
        <div class="page-grid" id="page-grid"></div>
        <div class="drop-overlay" id="drop-overlay"><i data-lucide="upload"></i><strong>放開即可加入 PDF</strong></div>
      </div>

      <footer class="editor-footer">
        <span id="document-stats">尚未加入文件</span>
        <span class="reorder-hint"><i data-lucide="grip-vertical"></i>點選頁面以選取，拖曳即可重新排序（鍵盤：Alt + ←/→）</span>
      </footer>
    </section>
  </main>

  <input id="file-input" type="file" accept="application/pdf,.pdf" multiple hidden>
  <dialog class="split-dialog" id="split-dialog" aria-labelledby="split-title">
    <div class="dialog-heading">
      <h2 id="split-title">拆分 PDF</h2>
      <button class="icon-button" type="button" data-action="close-split" aria-label="關閉"><i data-lucide="x"></i></button>
    </div>
    <label class="field-label" for="page-range">頁碼範圍</label>
    <input class="range-input" id="page-range" type="text" autocomplete="off" spellcheck="false">
    <p class="field-help" id="page-range-help">例如：1-3, 5。頁碼依目前工作區順序。</p>
    <fieldset class="split-options">
      <legend>輸出方式</legend>
      <label class="option-row"><input type="radio" name="split-mode" value="extract" checked><span><strong>擷取為一份 PDF</strong><small>將指定頁面合併成單一檔案</small></span></label>
      <label class="option-row"><input type="radio" name="split-mode" value="zip"><span><strong>每頁分開，打包成 ZIP</strong><small>每一頁產生一份 PDF</small></span></label>
    </fieldset>
    <div class="dialog-actions">
      <button class="button button-quiet" type="button" data-action="close-split">取消</button>
      <button class="button button-primary" type="button" data-action="confirm-split"><i data-lucide="scissors"></i><span>開始拆分</span></button>
    </div>
  </dialog>
  <div class="toast" id="toast" role="status" aria-live="polite"></div>
`

createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.8 } })


export function refreshIcons() {
  createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.8 } })
}

refreshIcons()

export const fileInput = document.querySelector('#file-input')
export const fileList = document.querySelector('#file-list')
export const pageGrid = document.querySelector('#page-grid')
export const emptyState = document.querySelector('#empty-state')
export const splitDialog = document.querySelector('#split-dialog')
export const toast = document.querySelector('#toast')
