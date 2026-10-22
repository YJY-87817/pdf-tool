import './app.css'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import JSZip from 'jszip'
import {
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

const app = document.querySelector('#app')
const state = {
  documents: [],
  pages: [],
  selectedPages: new Set(),
  draggedPageId: null,
  busy: false,
}

const iconSet = {
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
    <a class="brand" href="#" aria-label="頁序 PDF 工作台首頁">
      <span class="brand-mark"><i data-lucide="file-stack"></i></span>
      <span class="brand-name">頁序<span>PDF</span></span>
    </a>
    <div class="topbar-right">
      <span class="privacy-badge"><i data-lucide="shield-check"></i>檔案只在此裝置處理</span>
      <button class="button button-primary" type="button" data-action="add-files">
        <i data-lucide="plus"></i><span>加入 PDF</span>
      </button>
    </div>
  </header>

  <main class="workspace">
    <aside class="sidebar" aria-label="來源文件">
      <div class="sidebar-heading">
        <div>
          <p class="eyebrow">WORKSPACE</p>
          <h1>文件來源</h1>
        </div>
        <span class="count-badge" id="file-count">0</span>
      </div>
      <button class="add-source" type="button" data-action="add-files">
        <i data-lucide="file-plus-2"></i><span>加入其他文件</span><kbd>PDF</kbd>
      </button>
      <div id="file-list" class="file-list"></div>
      <div class="sidebar-bottom">
        <div class="local-note-icon"><i data-lucide="shield-check"></i></div>
        <div><strong>你的檔案不會上傳</strong><p>所有編輯都在瀏覽器本機完成。</p></div>
      </div>
    </aside>

    <section class="editor" aria-label="PDF 頁面編輯器">
      <div class="editor-heading">
        <div>
          <p class="eyebrow">PAGE EDITOR</p>
          <h2>整理你的頁面</h2>
        </div>
        <div class="document-stats" id="document-stats">尚未加入文件</div>
      </div>

      <div class="toolbar" role="toolbar" aria-label="頁面操作">
        <div class="tool-group">
          <button class="tool-button" type="button" data-action="rotate-selected" title="將所選頁面旋轉 90 度" disabled>
            <i data-lucide="rotate-cw"></i><span>旋轉</span>
          </button>
          <button class="tool-button" type="button" data-action="delete-selected" title="刪除所選頁面" disabled>
            <i data-lucide="trash-2"></i><span>刪除</span>
          </button>
          <span class="toolbar-divider"></span>
          <button class="tool-button tool-select-all" type="button" data-action="select-all" disabled>
            <i data-lucide="check"></i><span>全選</span>
          </button>
        </div>
        <div class="tool-group tool-group-export">
          <button class="button button-quiet" type="button" data-action="open-split" disabled>
            <i data-lucide="scissors"></i><span>拆分</span>
          </button>
          <button class="button button-export" type="button" data-action="merge" disabled>
            <i data-lucide="combine"></i><span>合併並匯出</span>
          </button>
        </div>
      </div>

      <div class="canvas-shell" id="canvas-shell">
        <div class="empty-state" id="empty-state">
          <div class="empty-art" aria-hidden="true">
            <span class="paper paper-back"></span><span class="paper paper-mid"></span>
            <span class="paper paper-front"><i data-lucide="file-stack"></i></span>
            <span class="art-plus"><i data-lucide="plus"></i></span>
          </div>
          <h3>把 PDF 放進工作區</h3>
          <p>拖曳檔案到這裡，或從裝置挑選文件開始編輯。</p>
          <button class="button button-primary" type="button" data-action="add-files">
            <i data-lucide="upload"></i><span>選擇 PDF 檔案</span>
          </button>
          <span class="file-hint">支援多個 PDF 檔案</span>
        </div>
        <div class="page-grid" id="page-grid" aria-live="polite"></div>
        <div class="drop-overlay" id="drop-overlay"><i data-lucide="upload"></i><strong>放開即可加入 PDF</strong></div>
      </div>

      <footer class="editor-footer">
        <span id="selection-summary">尚未選取頁面</span>
        <span class="reorder-hint"><i data-lucide="grip-vertical"></i>拖曳頁面即可重新排序</span>
      </footer>
    </section>
  </main>

  <input id="file-input" type="file" accept="application/pdf,.pdf" multiple hidden>
  <dialog class="split-dialog" id="split-dialog" aria-labelledby="split-title">
    <div class="dialog-heading">
      <div class="dialog-icon"><i data-lucide="scissors"></i></div>
      <button class="icon-button" type="button" data-action="close-split" aria-label="關閉"><i data-lucide="x"></i></button>
    </div>
    <h2 id="split-title">拆分 PDF</h2>
    <p class="dialog-copy">指定要處理的頁碼，或將範圍內的每一頁各自拆成 PDF。</p>
    <label class="field-label" for="page-range">頁碼範圍</label>
    <input class="range-input" id="page-range" type="text" autocomplete="off" spellcheck="false">
    <p class="field-help">例如：1-3, 5。頁碼依目前工作區順序。</p>
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

const fileInput = document.querySelector('#file-input')
const fileList = document.querySelector('#file-list')
const pageGrid = document.querySelector('#page-grid')
const emptyState = document.querySelector('#empty-state')
const splitDialog = document.querySelector('#split-dialog')
const toast = document.querySelector('#toast')
let toastTimer
let pdfRuntimePromise

function loadPdfRuntime() {
  pdfRuntimePromise ??= Promise.all([import('pdf-lib'), import('pdfjs-dist')]).then(([pdfLib, pdfjs]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    return { PDFDocument: pdfLib.PDFDocument, degrees: pdfLib.degrees, pdfjs }
  })
  return pdfRuntimePromise
}

function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character])
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function refreshIcons() {
  createIcons({ icons: iconSet, attrs: { 'stroke-width': 1.8 } })
}

function showToast(message, isError = false) {
  toast.textContent = message
  toast.classList.toggle('toast-error', isError)
  toast.classList.add('toast-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('toast-visible'), 3200)
}

function setBusy(busy, message = '') {
  state.busy = busy
  document.querySelectorAll('[data-action="merge"], [data-action="open-split"], [data-action="confirm-split"]').forEach((button) => {
    button.disabled = busy || state.pages.length === 0
  })
  if (message) document.querySelector('#selection-summary').textContent = message
}

function renderFiles() {
  document.querySelector('#file-count').textContent = String(state.documents.length)
  if (state.documents.length === 0) {
    fileList.innerHTML = '<p class="file-list-empty">加入的文件會列在這裡</p>'
    return
  }

  fileList.innerHTML = state.documents.map((document) => `
    <article class="source-file">
      <span class="source-icon"><i data-lucide="files"></i></span>
      <div class="source-details">
        <strong title="${escapeHtml(document.name)}">${escapeHtml(document.name)}</strong>
        <span>${document.pageCount} 頁 <span class="source-dot">·</span> ${formatBytes(document.bytes.byteLength)}</span>
      </div>
      <button class="icon-button source-remove" type="button" data-action="remove-document" data-document-id="${document.id}" aria-label="移除 ${escapeHtml(document.name)}" title="移除文件">
        <i data-lucide="x"></i>
      </button>
    </article>
  `).join('')
  refreshIcons()
}

function renderPages() {
  const hasPages = state.pages.length > 0
  emptyState.hidden = hasPages
  pageGrid.hidden = !hasPages

  if (!hasPages) {
    pageGrid.innerHTML = ''
    return
  }

  pageGrid.innerHTML = state.pages.map((page, index) => {
    const source = state.documents.find((document) => document.id === page.documentId)
    const isSelected = state.selectedPages.has(page.id)
    return `
      <article class="page-card${isSelected ? ' is-selected' : ''}" draggable="true" data-page-id="${page.id}" aria-label="第 ${index + 1} 頁，來源：${escapeHtml(source.name)}">
        <div class="page-preview">
          <div class="preview-loading"><span></span></div>
          <canvas class="page-canvas" aria-label="第 ${index + 1} 頁預覽"></canvas>
          <button class="page-check" type="button" data-action="toggle-page" data-page-id="${page.id}" aria-label="${isSelected ? '取消選取' : '選取'}第 ${index + 1} 頁" aria-pressed="${isSelected}">
            <i data-lucide="check"></i>
          </button>
          <span class="page-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="page-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
        </div>
        <div class="page-caption"><span>第 ${index + 1} 頁</span><span title="${escapeHtml(source.name)}">${escapeHtml(source.name)}</span></div>
      </article>
    `
  }).join('')

  refreshIcons()
  state.pages.forEach((page) => renderThumbnail(page))
}

async function renderThumbnail(page) {
  const card = pageGrid.querySelector(`[data-page-id="${page.id}"]`)
  if (!card) return

  const canvas = card.querySelector('canvas')
  const loading = card.querySelector('.preview-loading')
  const source = state.documents.find((document) => document.id === page.documentId)

  try {
    const pdfPage = await source.pdfJs.getPage(page.sourceIndex + 1)
    const baseViewport = pdfPage.getViewport({ scale: 1 })
    const scale = Math.min(1, 228 / baseViewport.width)
    const viewport = pdfPage.getViewport({ scale, rotation: page.rotation })
    const context = canvas.getContext('2d', { alpha: false })
    canvas.width = Math.ceil(viewport.width)
    canvas.height = Math.ceil(viewport.height)
    await pdfPage.render({ canvasContext: context, viewport }).promise
    loading.hidden = true
  } catch {
    loading.innerHTML = '<span class="preview-error">無法預覽</span>'
  }
}

function renderStatus() {
  const selectedCount = state.selectedPages.size
  const allSelected = state.pages.length > 0 && selectedCount === state.pages.length
  document.querySelector('#document-stats').textContent = state.pages.length
    ? `${state.pages.length} 頁 · ${state.documents.length} 份文件`
    : '尚未加入文件'
  document.querySelector('#selection-summary').textContent = selectedCount
    ? `已選取 ${selectedCount} / ${state.pages.length} 頁`
    : state.pages.length ? `共 ${state.pages.length} 頁` : '尚未選取頁面'
  document.querySelector('[data-action="rotate-selected"]').disabled = selectedCount === 0 || state.busy
  document.querySelector('[data-action="delete-selected"]').disabled = selectedCount === 0 || state.busy
  const selectAllButton = document.querySelector('[data-action="select-all"]')
  selectAllButton.disabled = state.pages.length === 0 || state.busy
  selectAllButton.querySelector('span').textContent = allSelected ? '取消全選' : '全選'
  document.querySelector('[data-action="merge"]').disabled = state.pages.length === 0 || state.busy
  document.querySelector('[data-action="open-split"]').disabled = state.pages.length === 0 || state.busy
}

function renderAll() {
  renderFiles()
  renderPages()
  renderStatus()
}

async function addFiles(fileCollection) {
  const pdfFiles = [...fileCollection].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
  if (pdfFiles.length === 0) {
    showToast('請選擇 PDF 檔案。', true)
    return
  }

  for (const file of pdfFiles) {
    try {
      const bytes = await file.arrayBuffer()
      const { PDFDocument, pdfjs } = await loadPdfRuntime()
      const [pdfJs, pdfLib] = await Promise.all([
        pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise,
        PDFDocument.load(bytes, { ignoreEncryption: true }),
      ])
      const documentId = createId()
      const document = { id: documentId, name: file.name, bytes, pageCount: pdfJs.numPages, pdfJs, pdfLib }
      state.documents.push(document)
      for (let sourceIndex = 0; sourceIndex < document.pageCount; sourceIndex += 1) {
        state.pages.push({ id: createId(), documentId, sourceIndex, rotation: 0 })
      }
      renderAll()
    } catch (error) {
      showToast(`無法讀取「${file.name}」，請確認檔案未加密且格式正確。`, true)
      console.error(error)
    }
  }

  if (pdfFiles.length > 0 && state.pages.length > 0) showToast(`已加入 ${pdfFiles.length} 個 PDF。`)
}

function togglePage(pageId) {
  if (state.selectedPages.has(pageId)) state.selectedPages.delete(pageId)
  else state.selectedPages.add(pageId)
  const card = pageGrid.querySelector(`[data-page-id="${pageId}"]`)
  const check = card?.querySelector('.page-check')
  card?.classList.toggle('is-selected', state.selectedPages.has(pageId))
  check?.setAttribute('aria-pressed', String(state.selectedPages.has(pageId)))
  check?.setAttribute('aria-label', `${state.selectedPages.has(pageId) ? '取消選取' : '選取'}頁面`)
  renderStatus()
}

function removeDocument(documentId) {
  state.documents = state.documents.filter((document) => document.id !== documentId)
  state.pages = state.pages.filter((page) => page.documentId !== documentId)
  state.selectedPages = new Set([...state.selectedPages].filter((pageId) => state.pages.some((page) => page.id === pageId)))
  renderAll()
}

function parsePageRange(value) {
  const indexes = new Set()
  for (const part of value.split(',')) {
    const trimmed = part.trim()
    const match = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new Error('頁碼格式錯誤，請使用例如 1-3, 5 的格式。')
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > state.pages.length) {
      throw new Error(`頁碼範圍需介於 1 到 ${state.pages.length} 頁。`)
    }
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) indexes.add(pageNumber - 1)
  }
  return [...indexes].sort((left, right) => left - right).map((index) => state.pages[index])
}

function formatPageRange(pageNumbers) {
  const ranges = []
  for (const pageNumber of pageNumbers) {
    const last = ranges.at(-1)
    if (last && pageNumber === last[1] + 1) last[1] = pageNumber
    else ranges.push([pageNumber, pageNumber])
  }
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(', ')
}

function getDefaultSplitRange() {
  const selectedNumbers = state.pages
    .map((page, index) => (state.selectedPages.has(page.id) ? index + 1 : null))
    .filter((pageNumber) => pageNumber !== null)
  return selectedNumbers.length ? formatPageRange(selectedNumbers) : `1-${state.pages.length}`
}

async function createPdf(pages) {
  const { PDFDocument, degrees } = await loadPdfRuntime()
  const output = await PDFDocument.create()
  for (const page of pages) {
    const source = state.documents.find((document) => document.id === page.documentId)
    const [copiedPage] = await output.copyPages(source.pdfLib, [page.sourceIndex])
    const rotation = ((copiedPage.getRotation().angle + page.rotation) % 360 + 360) % 360
    copiedPage.setRotation(degrees(rotation))
    output.addPage(copiedPage)
  }
  return output.save()
}

function downloadFile(contents, filename, mimeType) {
  const url = URL.createObjectURL(new Blob([contents], { type: mimeType }))
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

async function exportMergedPdf() {
  if (state.pages.length === 0 || state.busy) return
  setBusy(true, '正在整理頁面並匯出…')
  try {
    const bytes = await createPdf(state.pages)
    downloadFile(bytes, '頁序-合併.pdf', 'application/pdf')
    showToast(`已匯出 ${state.pages.length} 頁 PDF。`)
  } catch (error) {
    showToast('匯出失敗，請確認 PDF 檔案未加密。', true)
    console.error(error)
  } finally {
    setBusy(false)
    renderStatus()
  }
}

async function splitPdf() {
  try {
    const pages = parsePageRange(document.querySelector('#page-range').value)
    if (pages.length === 0) throw new Error('請至少指定一頁。')
    const mode = document.querySelector('input[name="split-mode"]:checked').value
    setBusy(true, '正在拆分 PDF…')

    if (mode === 'zip') {
      const zip = new JSZip()
      for (let index = 0; index < pages.length; index += 1) {
        const page = pages[index]
        const source = state.documents.find((document) => document.id === page.documentId)
        const sourceName = source?.name.replace(/\.pdf$/i, '') ?? 'page'
        const bytes = await createPdf([page])
        zip.file(`${sourceName}-${String(index + 1).padStart(3, '0')}.pdf`, bytes)
      }
      const archive = await zip.generateAsync({ type: 'uint8array' })
      downloadFile(archive, '頁序-逐頁拆分.zip', 'application/zip')
    } else {
      const bytes = await createPdf(pages)
      downloadFile(bytes, '頁序-擷取頁面.pdf', 'application/pdf')
    }

    splitDialog.close()
    showToast(`已完成 ${pages.length} 頁拆分。`)
  } catch (error) {
    showToast(error.message || '拆分失敗，請確認 PDF 檔案未加密。', true)
    if (!(error instanceof Error && /頁碼|指定/.test(error.message))) console.error(error)
  } finally {
    setBusy(false)
    renderStatus()
  }
}

app.addEventListener('click', (event) => {
  const actionButton = event.target.closest('[data-action]')
  const card = event.target.closest('.page-card')

  if (card && !actionButton) {
    togglePage(card.dataset.pageId)
    return
  }
  if (!actionButton) return

  const { action, documentId, pageId } = actionButton.dataset
  if (action === 'add-files') fileInput.click()
  if (action === 'toggle-page') togglePage(pageId)
  if (action === 'remove-document') removeDocument(documentId)
  if (action === 'rotate-selected') {
    state.pages.forEach((page) => {
      if (state.selectedPages.has(page.id)) page.rotation = (page.rotation + 90) % 360
    })
    renderPages()
  }
  if (action === 'delete-selected') {
    state.pages = state.pages.filter((page) => !state.selectedPages.has(page.id))
    state.selectedPages.clear()
    renderAll()
  }
  if (action === 'select-all') {
    if (state.selectedPages.size === state.pages.length) state.selectedPages.clear()
    else state.selectedPages = new Set(state.pages.map((page) => page.id))
    renderPages()
    renderStatus()
  }
  if (action === 'merge') exportMergedPdf()
  if (action === 'open-split') {
    document.querySelector('#page-range').value = getDefaultSplitRange()
    splitDialog.showModal()
  }
  if (action === 'close-split') splitDialog.close()
  if (action === 'confirm-split') splitPdf()
})

fileInput.addEventListener('change', async () => {
  await addFiles(fileInput.files)
  fileInput.value = ''
})

pageGrid.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.page-card')
  if (!card) return
  state.draggedPageId = card.dataset.pageId
  card.classList.add('is-dragging')
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', state.draggedPageId)
})

pageGrid.addEventListener('dragend', () => {
  state.draggedPageId = null
  pageGrid.querySelectorAll('.page-card').forEach((card) => card.classList.remove('is-dragging', 'is-drop-target'))
})

pageGrid.addEventListener('dragover', (event) => {
  const target = event.target.closest('.page-card')
  if (!target || !state.draggedPageId || target.dataset.pageId === state.draggedPageId) return
  event.preventDefault()
  pageGrid.querySelectorAll('.is-drop-target').forEach((card) => card.classList.remove('is-drop-target'))
  target.classList.add('is-drop-target')
})

pageGrid.addEventListener('drop', (event) => {
  const target = event.target.closest('.page-card')
  if (!target || !state.draggedPageId || target.dataset.pageId === state.draggedPageId) return
  event.preventDefault()
  const fromIndex = state.pages.findIndex((page) => page.id === state.draggedPageId)
  let toIndex = state.pages.findIndex((page) => page.id === target.dataset.pageId)
  const bounds = target.getBoundingClientRect()
  if (event.clientX > bounds.left + bounds.width / 2) toIndex += 1
  if (fromIndex < toIndex) toIndex -= 1
  const [movedPage] = state.pages.splice(fromIndex, 1)
  state.pages.splice(toIndex, 0, movedPage)
  renderPages()
  renderStatus()
})

window.addEventListener('dragover', (event) => {
  if (event.dataTransfer?.types.includes('Files')) {
    event.preventDefault()
    app.classList.add('is-file-dragging')
  }
})

window.addEventListener('dragleave', (event) => {
  if (!event.relatedTarget) app.classList.remove('is-file-dragging')
})

window.addEventListener('drop', async (event) => {
  app.classList.remove('is-file-dragging')
  if (event.dataTransfer?.files.length) {
    event.preventDefault()
    await addFiles(event.dataTransfer.files)
  }
})

renderAll()
