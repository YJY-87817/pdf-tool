import './app.css'
import JSZip from 'jszip'
import { app, fileInput, pageGrid, splitDialog } from './dom.js'
import { PageRangeError, formatPageRange, parsePageRange } from './lib/page-range.js'
import { reorderPages, restorePages, shiftPages } from './lib/reorder.js'
import { createPdf, loadPdfRuntime } from './pdf-runtime.js'
import { renderAll, renderPages, renderStatus, setBusy, setLoadingText, setProgress, showToast } from './render.js'
import { createId, nextColorIndex, pruneEmptyDocuments, state } from './state.js'

async function addFiles(fileCollection) {
  const pdfFiles = [...fileCollection].filter((file) => file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'))
  if (pdfFiles.length === 0) {
    showToast('請選擇 PDF 檔案。', true)
    return
  }

  let addedCount = 0
  const failures = []
  for (const [fileIndex, file] of pdfFiles.entries()) {
    setLoadingText(`正在讀取 ${fileIndex + 1} / ${pdfFiles.length}：${file.name}`)
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
      const colorIndex = nextColorIndex()
      const sourceDoc = { id: documentId, colorIndex, name: file.name, size: bytes.byteLength, pageCount: pdfJs.numPages, pdfJs, loadingTask, pdfLib }
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

  setLoadingText('')

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

function removeDocument(documentId) {
  if (state.busy) return
  finalizeUndo()
  state.pages = state.pages.filter((page) => page.documentId !== documentId)
  state.selectedPages = new Set([...state.selectedPages].filter((pageId) => state.pages.some((page) => page.id === pageId)))
  pruneEmptyDocuments()
  renderAll()
}

// ---- 刪除與復原 ----
// 刪除後保留被刪頁面一段時間；期間來源文件不釋放，期限過後才真正清理。
const UNDO_WINDOW_MS = 8000
let undo = null

function finalizeUndo() {
  if (!undo) return
  clearTimeout(undo.timer)
  undo = null
  pruneEmptyDocuments()
}

function deleteSelectedPages() {
  if (state.selectedPages.size === 0) return
  finalizeUndo()
  const entries = []
  state.pages.forEach((page, index) => {
    if (state.selectedPages.has(page.id)) entries.push({ page, index })
  })
  state.pages = state.pages.filter((page) => !state.selectedPages.has(page.id))
  state.selectedPages.clear()
  renderAll()
  undo = { entries, timer: setTimeout(finalizeUndo, UNDO_WINDOW_MS) }
  showToast(`已刪除 ${entries.length} 頁。`, false, UNDO_WINDOW_MS, { label: '復原', onClick: undoDelete })
}

function undoDelete() {
  if (!undo || state.busy) return
  const { entries } = undo
  clearTimeout(undo.timer)
  undo = null
  state.pages = restorePages(state.pages, entries)
  state.selectedPages = new Set(entries.map(({ page }) => page.id))
  renderAll()
  showToast(`已復原 ${entries.length} 頁。`)
}

document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.shiftKey || event.key.toLowerCase() !== 'z') return
  if (event.target.closest('input, textarea, [contenteditable]') || splitDialog.open) return
  if (!undo) return
  event.preventDefault()
  undoDelete()
})

// 工具列的「前移／後移」：觸控與鍵盤都能用，重用 shiftPages。
function shiftSelected(direction) {
  const shifted = shiftPages(state.pages, state.selectedPages, direction)
  if (!shifted) return
  state.pages = shifted
  renderPages()
  renderStatus()
  const first = state.pages.find((page) => state.selectedPages.has(page.id))
  pageGrid.querySelector(`[data-page-id="${first.id}"]`)?.scrollIntoView({ block: 'nearest' })
}

function getDefaultSplitRange() {
  const selectedNumbers = state.pages
    .map((page, index) => (state.selectedPages.has(page.id) ? index + 1 : null))
    .filter((pageNumber) => pageNumber !== null)
  return selectedNumbers.length ? formatPageRange(selectedNumbers) : `1-${state.pages.length}`
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
    const pages = parsePageRange(document.querySelector('#page-range').value, state.pages.length).map((index) => state.pages[index])
    if (pages.length === 0) throw new PageRangeError('請至少指定一頁。')
    const mode = document.querySelector('input[name="split-mode"]:checked').value
    setBusy(true, '正在拆分 PDF…')

    if (mode === 'zip') {
      const zip = new JSZip()
      for (let index = 0; index < pages.length; index += 1) {
        setProgress(`正在拆分第 ${index + 1} / ${pages.length} 頁…`)
        await new Promise((resolve) => setTimeout(resolve, 0)) // 讓出執行權，進度文字才畫得出來
        const page = pages[index]
        const source = state.documents.find((sourceDoc) => sourceDoc.id === page.documentId)
        const sourceName = source?.name.replace(/\.pdf$/i, '') ?? 'page'
        const bytes = await createPdf([page])
        zip.file(`${sourceName}-${String(index + 1).padStart(3, '0')}.pdf`, bytes)
      }
      setProgress('正在壓縮 ZIP…')
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
  if (action === 'delete-selected') deleteSelectedPages()
  if (action === 'move-earlier') shiftSelected(-1)
  if (action === 'move-later') shiftSelected(1)
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

// 依游標在卡片左半或右半，決定插入點在目標之前或之後。
function dropSide(event, target) {
  const bounds = target.getBoundingClientRect()
  return event.clientX > bounds.left + bounds.width / 2 ? 'after' : 'before'
}

function clearDropIndicators() {
  pageGrid.querySelectorAll('.is-drop-before, .is-drop-after').forEach((card) => card.classList.remove('is-drop-before', 'is-drop-after'))
}

pageGrid.addEventListener('dragstart', (event) => {
  const card = event.target.closest('.page-card')
  if (!card) return
  state.draggedPageId = card.dataset.pageId
  card.classList.add('is-dragging')
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', state.draggedPageId)
  // 一次拖多頁時，拖影顯示頁數。
  if (state.selectedPages.has(state.draggedPageId) && state.selectedPages.size > 1) {
    const badge = document.createElement('div')
    badge.className = 'drag-badge'
    badge.textContent = `${state.selectedPages.size} 頁`
    document.body.append(badge)
    event.dataTransfer.setDragImage(badge, 20, 16)
    setTimeout(() => badge.remove(), 0)
  }
})

pageGrid.addEventListener('dragend', () => {
  state.draggedPageId = null
  pageGrid.querySelectorAll('.is-dragging').forEach((card) => card.classList.remove('is-dragging'))
  clearDropIndicators()
})

pageGrid.addEventListener('dragover', (event) => {
  const target = event.target.closest('.page-card')
  if (!target || !state.draggedPageId || target.dataset.pageId === state.draggedPageId) return
  event.preventDefault()
  const side = dropSide(event, target)
  if (target.classList.contains(`is-drop-${side}`)) return
  clearDropIndicators()
  target.classList.add(`is-drop-${side}`)
})

pageGrid.addEventListener('drop', (event) => {
  if (state.busy) return
  const target = event.target.closest('.page-card')
  if (!target || !state.draggedPageId || target.dataset.pageId === state.draggedPageId) return
  event.preventDefault()
  const placeAfter = dropSide(event, target) === 'after'
  clearDropIndicators()
  movePages(state.draggedPageId, target.dataset.pageId, placeAfter)
})

// 拖曳已選取的頁面時，會一併移動所有已選取的頁面。
function movePages(draggedId, targetId, placeAfter) {
  const reordered = reorderPages(state.pages, state.selectedPages, draggedId, targetId, placeAfter)
  if (!reordered) return
  state.pages = reordered
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
