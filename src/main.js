import './app.css'
import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
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
      <span class="brand-name">頁序</span>
      <span class="brand-tag">PDF</span>
    </a>
    <span class="privacy-badge"><i data-lucide="shield-check"></i><span>檔案只在此裝置處理，不會上傳</span></span>
    <div class="topbar-actions">
      <button class="button button-quiet" type="button" data-action="add-files">
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
          <button class="tool-button" type="button" data-action="rotate-selected" title="將所選頁面旋轉 90 度" disabled>
            <i data-lucide="rotate-cw"></i><span>旋轉</span>
          </button>
          <button class="tool-button" type="button" data-action="open-split" title="拆分或擷取頁面" disabled>
            <i data-lucide="scissors"></i><span>拆分</span>
          </button>
          <button class="tool-button tool-danger" type="button" data-action="delete-selected" title="刪除所選頁面" disabled>
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
        <div class="page-grid" id="page-grid" aria-live="polite"></div>
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

const fileInput = document.querySelector('#file-input')
const fileList = document.querySelector('#file-list')
const pageGrid = document.querySelector('#page-grid')
const emptyState = document.querySelector('#empty-state')
const splitDialog = document.querySelector('#split-dialog')
const toast = document.querySelector('#toast')
let toastTimer
let pdfRuntimePromise
let documentCounter = 0
const SOURCE_COLOR_COUNT = 6

function loadPdfRuntime() {
  pdfRuntimePromise ??= Promise.all([import('pdf-lib'), import('pdfjs-dist/legacy/build/pdf.mjs')]).then(([pdfLib, pdfjs]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    return { PDFDocument: pdfLib.PDFDocument, degrees: pdfLib.degrees, pdfjs }
  }).catch((error) => {
    pdfRuntimePromise = undefined
    throw error
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

function showToast(message, isError = false, duration = 3200) {
  toast.textContent = message
  toast.classList.toggle('toast-error', isError)
  toast.classList.add('toast-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('toast-visible'), 3200)
}

function setBusy(busy, message = '') {
  state.busy = busy
  renderStatus()
  document.querySelector('[data-action="confirm-split"]').disabled = busy
  document.querySelectorAll('.source-remove').forEach((button) => {
    button.disabled = busy
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
    <article class="source-file source-${document.colorIndex}">
      <span class="source-icon"><i data-lucide="files"></i></span>
      <div class="source-details">
        <strong title="${escapeHtml(document.name)}">${escapeHtml(document.name)}</strong>
        <span>${document.pageCount} 頁 · ${formatBytes(document.size)}</span>
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
      <article class="page-card source-${source.colorIndex}${isSelected ? ' is-selected' : ''}" draggable="true" data-page-id="${page.id}" aria-label="第 ${index + 1} 頁，來源：${escapeHtml(source.name)}">
        <div class="page-preview">
          <div class="preview-loading"><span></span></div>
          <canvas class="page-canvas" aria-label="第 ${index + 1} 頁預覽"></canvas>
          <button class="page-check" type="button" data-action="toggle-page" data-page-id="${page.id}" aria-label="${isSelected ? '取消選取' : '選取'}第 ${index + 1} 頁" aria-pressed="${isSelected}">
            <i data-lucide="check"></i>
          </button>
          <span class="page-number">${String(index + 1).padStart(2, '0')}</span>
          <span class="page-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
        </div>
        <div class="page-caption"><span class="source-dot" aria-hidden="true"></span><span title="${escapeHtml(source.name)}">${escapeHtml(source.name)}</span><span>p.${page.sourceIndex + 1}</span></div>
      </article>
    `
  }).join('')

  refreshIcons()
  pruneThumbnails()
  thumbObserver.disconnect()
  pageGrid.querySelectorAll('.page-card').forEach((card) => {
    const cached = thumbCache.get(thumbKey(state.pages.find((page) => page.id === card.dataset.pageId)))
    if (cached) drawThumbnail(card, cached)
    else thumbObserver.observe(card)
  })
}

const thumbCache = new Map()
const thumbJobs = new Map()
const thumbObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue
    thumbObserver.unobserve(entry.target)
    renderThumbnail(entry.target.dataset.pageId)
  }
}, { rootMargin: '600px 0px' })

function thumbKey(page) {
  return `${page.id}:${page.rotation}`
}

function getThumbnail(page) {
  const key = thumbKey(page)
  if (thumbCache.has(key)) return Promise.resolve(thumbCache.get(key))
  if (!thumbJobs.has(key)) {
    const source = state.documents.find((document) => document.id === page.documentId)
    const job = (async () => {
      const pdfPage = await source.pdfJs.getPage(page.sourceIndex + 1)
      const baseViewport = pdfPage.getViewport({ scale: 1 })
      const scale = Math.min(1, 228 / baseViewport.width)
      // getViewport 的 rotation 會取代頁面本身的 /Rotate，所以要疊加。
      const viewport = pdfPage.getViewport({ scale, rotation: (pdfPage.rotate + page.rotation) % 360 })
      const offscreen = document.createElement('canvas')
      offscreen.width = Math.ceil(viewport.width)
      offscreen.height = Math.ceil(viewport.height)
      await pdfPage.render({ canvasContext: offscreen.getContext('2d', { alpha: false }), viewport }).promise
      thumbCache.set(key, offscreen)
      return offscreen
    })().finally(() => thumbJobs.delete(key))
    thumbJobs.set(key, job)
  }
  return thumbJobs.get(key)
}

function drawThumbnail(card, thumbnail) {
  const canvas = card.querySelector('canvas')
  canvas.width = thumbnail.width
  canvas.height = thumbnail.height
  canvas.getContext('2d', { alpha: false }).drawImage(thumbnail, 0, 0)
  card.querySelector('.preview-loading').hidden = true
}

async function renderThumbnail(pageId) {
  const page = state.pages.find((candidate) => candidate.id === pageId)
  if (!page) return
  try {
    const thumbnail = await getThumbnail(page)
    const card = pageGrid.querySelector(`[data-page-id="${pageId}"]`)
    const current = state.pages.find((candidate) => candidate.id === pageId)
    if (card && current && thumbKey(current) === thumbKey(page)) drawThumbnail(card, thumbnail)
  } catch {
    const card = pageGrid.querySelector(`[data-page-id="${pageId}"]`)
    const loading = card?.querySelector('.preview-loading')
    if (loading) loading.innerHTML = '<span class="preview-error">無法預覽</span>'
  }
}

function pruneThumbnails() {
  const liveKeys = new Set(state.pages.map(thumbKey))
  for (const key of thumbCache.keys()) if (!liveKeys.has(key)) thumbCache.delete(key)
}

function renderStatus() {
  const selectedCount = state.selectedPages.size
  const allSelected = state.pages.length > 0 && selectedCount === state.pages.length
  document.querySelector('#document-stats').textContent = state.pages.length
    ? `共 ${state.pages.length} 頁，來自 ${state.documents.length} 份文件`
    : '尚未加入文件'
  document.querySelector('#selection-summary').textContent = selectedCount
    ? `已選取 ${selectedCount} / ${state.pages.length} 頁`
    : state.pages.length ? '點選頁面以選取' : '尚未加入頁面'
  document.querySelector('[data-action="rotate-selected"]').disabled = selectedCount === 0 || state.busy
  document.querySelector('[data-action="delete-selected"]').disabled = selectedCount === 0 || state.busy
  const selectAllButton = document.querySelector('[data-action="select-all"]')
  selectAllButton.disabled = state.pages.length === 0 || state.busy
  selectAllButton.classList.toggle('is-all', allSelected)
  selectAllButton.classList.toggle('is-partial', selectedCount > 0 && !allSelected)
  selectAllButton.querySelector('span:last-child').textContent = allSelected ? '取消全選' : '全選'
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

  let addedCount = 0
  const failures = []
  for (const file of pdfFiles) {
    try {
      const bytes = await file.arrayBuffer()
      const { PDFDocument, pdfjs } = await loadPdfRuntime()
      const assetBase = `${import.meta.env.BASE_URL}pdfjs/`
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(bytes.slice(0)),
        cMapUrl: `${assetBase}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${assetBase}standard_fonts/`,
        wasmUrl: `${assetBase}wasm/`,
      })
      let pdfJs
      let pdfLib
      try {
        // 不使用 ignoreEncryption：加密檔案必須被拒絕，否則匯出的頁面內容會損毀。
        ;[pdfJs, pdfLib] = await Promise.all([loadingTask.promise, PDFDocument.load(bytes)])
      } catch (loadError) {
        loadingTask.destroy()
        throw loadError
      }
      const documentId = createId()
      const colorIndex = documentCounter++ % SOURCE_COLOR_COUNT
      const sourceDoc = { id: documentId, colorIndex, name: file.name, size: bytes.byteLength, pageCount: pdfJs.numPages, pdfJs, pdfLib }
      state.documents.push(sourceDoc)
      for (let sourceIndex = 0; sourceIndex < sourceDoc.pageCount; sourceIndex += 1) {
        state.pages.push({ id: createId(), documentId, sourceIndex, rotation: 0 })
      }
      addedCount += 1
      renderAll()
    } catch (error) {
      const encrypted = error?.name === 'PasswordException' || error?.constructor?.name === 'EncryptedPDFError' || /encrypted/i.test(error?.message ?? '')
      failures.push(`「${file.name}」${encrypted ? '有密碼保護' : '檔案損毀或格式不符'}`)
      console.error(error)
    }
  }

  if (failures.length > 0) {
    const added = addedCount > 0 ? `已加入 ${addedCount} 個 PDF；` : ''
    showToast(`${added}${failures.length} 個無法讀取：${failures.join('、')}。`, true, 8000)
  } else if (addedCount > 0) {
    showToast(`已加入 ${addedCount} 個 PDF。`)
  }
}

function togglePage(pageId) {
  if (state.selectedPages.has(pageId)) state.selectedPages.delete(pageId)
  else state.selectedPages.add(pageId)
  const card = pageGrid.querySelector(`[data-page-id="${pageId}"]`)
  const check = card?.querySelector('.page-check')
  card?.classList.toggle('is-selected', state.selectedPages.has(pageId))
  check?.setAttribute('aria-pressed', String(state.selectedPages.has(pageId)))
  const pageNumber = state.pages.findIndex((page) => page.id === pageId) + 1
  check?.setAttribute('aria-label', `${state.selectedPages.has(pageId) ? '取消選取' : '選取'}第 ${pageNumber} 頁`)
  renderStatus()
}

// 釋放已無任何頁面的來源文件（pdf.js 物件與 pdf-lib 文件）。
function pruneEmptyDocuments() {
  const used = new Set(state.pages.map((page) => page.documentId))
  for (const sourceDoc of state.documents) if (!used.has(sourceDoc.id)) sourceDoc.pdfJs.destroy()
  state.documents = state.documents.filter((sourceDoc) => used.has(sourceDoc.id))
}

function removeDocument(documentId) {
  if (state.busy) return
  state.pages = state.pages.filter((page) => page.documentId !== documentId)
  state.selectedPages = new Set([...state.selectedPages].filter((pageId) => state.pages.some((page) => page.id === pageId)))
  pruneEmptyDocuments()
  renderAll()
}

class PageRangeError extends Error {}

function parsePageRange(value) {
  const indexes = new Set()
  for (const part of value.split(',')) {
    const trimmed = part.trim()
    const match = trimmed.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new PageRangeError('頁碼格式錯誤，請使用例如 1-3, 5 的格式。')
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (start < 1 || end < start || end > state.pages.length) {
      throw new PageRangeError(`頁碼範圍需介於 1 到 ${state.pages.length} 頁。`)
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
  // 每份來源文件只呼叫一次 copyPages，共用的字型、圖片才不會被每頁重複複製。
  const indexesByDocument = new Map()
  for (const page of pages) {
    if (!indexesByDocument.has(page.documentId)) indexesByDocument.set(page.documentId, new Set())
    indexesByDocument.get(page.documentId).add(page.sourceIndex)
  }
  const copiedPages = new Map()
  for (const [documentId, indexSet] of indexesByDocument) {
    const source = state.documents.find((document) => document.id === documentId)
    if (!source) throw new Error('來源文件已被移除。')
    const indexes = [...indexSet]
    const copied = await output.copyPages(source.pdfLib, indexes)
    indexes.forEach((sourceIndex, position) => copiedPages.set(`${documentId}:${sourceIndex}`, copied[position]))
  }
  for (const page of pages) {
    const copiedPage = copiedPages.get(`${page.documentId}:${page.sourceIndex}`)
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
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

async function exportMergedPdf() {
  if (state.pages.length === 0 || state.busy) return
  setBusy(true, '正在整理頁面並匯出…')
  try {
    const snapshot = [...state.pages]
    const bytes = await createPdf(snapshot)
    downloadFile(bytes, '頁序-合併.pdf', 'application/pdf')
    showToast(`已匯出 ${snapshot.length} 頁 PDF。`)
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
    if (pages.length === 0) throw new PageRangeError('請至少指定一頁。')
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
    if (error instanceof PageRangeError) {
      showToast(error.message, true)
    } else {
      showToast('拆分失敗，請確認 PDF 檔案未加密。', true)
      console.error(error)
    }
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
  if (state.busy && ['rotate-selected', 'delete-selected', 'select-all', 'open-split'].includes(action)) return
  if (action === 'rotate-selected') {
    state.pages.forEach((page) => {
      if (state.selectedPages.has(page.id)) page.rotation = (page.rotation + 90) % 360
    })
    renderPages()
  }
  if (action === 'delete-selected') {
    state.pages = state.pages.filter((page) => !state.selectedPages.has(page.id))
    state.selectedPages.clear()
    pruneEmptyDocuments()
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
    document.querySelector('#page-range-help').textContent = state.selectedPages.size
      ? `已帶入勾選的 ${state.selectedPages.size} 頁，可直接修改。頁碼依目前工作區順序。`
      : '例如：1-3, 5。頁碼依目前工作區順序。'
    splitDialog.showModal()
  }
  if (action === 'close-split') splitDialog.close()
  if (action === 'confirm-split') splitPdf()
})

document.querySelector('#page-range').addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && !state.busy) {
    event.preventDefault()
    splitPdf()
  }
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
  if (state.busy) return
  const target = event.target.closest('.page-card')
  if (!target || !state.draggedPageId || target.dataset.pageId === state.draggedPageId) return
  event.preventDefault()
  const bounds = target.getBoundingClientRect()
  movePages(state.draggedPageId, target.dataset.pageId, event.clientX > bounds.left + bounds.width / 2)
})

// 拖曳已選取的頁面時，會一併移動所有已選取的頁面。
function movePages(draggedId, targetId, placeAfter) {
  const movingIds = state.selectedPages.has(draggedId) ? new Set(state.selectedPages) : new Set([draggedId])
  if (movingIds.has(targetId)) return
  const moving = state.pages.filter((page) => movingIds.has(page.id))
  const rest = state.pages.filter((page) => !movingIds.has(page.id))
  rest.splice(rest.findIndex((page) => page.id === targetId) + (placeAfter ? 1 : 0), 0, ...moving)
  state.pages = rest
  renderPages()
  renderStatus()
}

// 鍵盤替代方案：在頁面的選取按鈕上按 Alt + 左右方向鍵，移動該頁。
pageGrid.addEventListener('keydown', (event) => {
  const check = event.target.closest('.page-check')
  if (!check || !event.altKey || state.busy || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  event.preventDefault()
  const pageId = check.dataset.pageId
  const index = state.pages.findIndex((page) => page.id === pageId)
  const neighbor = index + (event.key === 'ArrowRight' ? 1 : -1)
  if (neighbor < 0 || neighbor >= state.pages.length) return
  ;[state.pages[index], state.pages[neighbor]] = [state.pages[neighbor], state.pages[index]]
  renderPages()
  renderStatus()
  pageGrid.querySelector(`.page-check[data-page-id="${pageId}"]`)?.focus()
  showToast(`已移到第 ${neighbor + 1} 頁。`)
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
