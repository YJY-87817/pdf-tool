import { emptyState, fileList, pageGrid, refreshIcons, toast } from './dom.js'
import { escapeHtml } from './lib/html.js'
import { formatBytes } from './lib/format.js'
import { state } from './state.js'
import { thumbKey, thumbObserver, pendingThumbs } from './thumbnails.js'

let toastTimer

export function showToast(message, isError = false, duration = 3200) {
  toast.textContent = message
  toast.classList.toggle('toast-error', isError)
  toast.classList.add('toast-visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('toast-visible'), duration)
}

export function setBusy(busy, message = '') {
  state.busy = busy
  renderStatus()
  document.querySelector('[data-action="confirm-split"]').disabled = busy
  document.querySelectorAll('.source-remove').forEach((button) => {
    button.disabled = busy
  })
  if (message) document.querySelector('#selection-summary').textContent = message
}

export function renderFiles() {
  document.querySelector('#file-count').textContent = String(state.documents.length)
  if (state.documents.length === 0) {
    fileList.innerHTML = '<p class="file-list-empty">加入的文件會列在這裡</p>'
    return
  }

  fileList.innerHTML = state.documents.map((sourceDoc) => `
    <article class="source-file source-${sourceDoc.colorIndex}">
      <span class="source-icon"><i data-lucide="files"></i></span>
      <div class="source-details">
        <strong title="${escapeHtml(sourceDoc.name)}">${escapeHtml(sourceDoc.name)}</strong>
        <span>${sourceDoc.pageCount} 頁 · ${formatBytes(sourceDoc.size)}</span>
      </div>
      <button class="icon-button source-remove" type="button" data-action="remove-document" data-document-id="${sourceDoc.id}" aria-label="移除 ${escapeHtml(sourceDoc.name)}" title="移除文件">
        <i data-lucide="x"></i>
      </button>
    </article>
  `).join('')
  refreshIcons()
}

// ---- 頁面格線：以 page.id 為 key 的局部更新 ----
// 卡片節點在整個生命週期內保持不變，只更新會變的部分（頁碼、選取狀態、旋轉後的縮圖），
// 所以旋轉、排序、全選都不會重建 DOM，也不會重播進場動畫。
const cards = new Map()

export function createCard(page) {
  const source = state.documents.find((sourceDoc) => sourceDoc.id === page.documentId)
  const card = document.createElement('article')
  card.className = `page-card is-new source-${source.colorIndex}`
  card.draggable = true
  card.dataset.pageId = page.id
  card.innerHTML = `
    <div class="page-preview">
      <div class="preview-loading"><span></span></div>
      <canvas class="page-canvas" role="img"></canvas>
      <button class="page-check" type="button" data-action="toggle-page" data-page-id="${page.id}" aria-pressed="false">
        <i data-lucide="check"></i>
      </button>
      <span class="page-number"></span>
      <span class="page-grip" aria-hidden="true"><i data-lucide="grip-vertical"></i></span>
    </div>
    <div class="page-caption"><span class="source-dot" aria-hidden="true"></span><span title="${escapeHtml(source.name)}">${escapeHtml(source.name)}</span><span>p.${page.sourceIndex + 1}</span></div>
  `
  card.addEventListener('animationend', () => card.classList.remove('is-new'), { once: true })
  const canvas = card.querySelector('canvas')
  canvas.width = 0 // 預設 300×150 的畫布；未繪製前不佔用像素
  canvas.height = 0
  return card
}

export function updateCard(card, page, index) {
  const source = state.documents.find((sourceDoc) => sourceDoc.id === page.documentId)
  const isSelected = state.selectedPages.has(page.id)
  const number = index + 1
  const label = `第 ${number} 頁，來源：${source.name}`
  if (card.getAttribute('aria-label') !== label) card.setAttribute('aria-label', label)
  card.classList.toggle('is-selected', isSelected)
  const check = card.querySelector('.page-check')
  check.setAttribute('aria-pressed', String(isSelected))
  check.setAttribute('aria-label', `${isSelected ? '取消選取' : '選取'}第 ${number} 頁`)
  const numberText = String(number).padStart(2, '0')
  const numberEl = card.querySelector('.page-number')
  if (numberEl.textContent !== numberText) numberEl.textContent = numberText
  card.querySelector('canvas').setAttribute('aria-label', `第 ${number} 頁預覽`)
  // 旋轉角度改變：舊縮圖保留到新縮圖畫好為止；重新觀察以觸發重畫。
  if (card.dataset.wantedKey !== thumbKey(page)) {
    card.dataset.wantedKey = thumbKey(page)
    thumbObserver.unobserve(card)
    thumbObserver.observe(card)
  }
}

export function renderPages() {
  const hasPages = state.pages.length > 0
  emptyState.hidden = hasPages
  pageGrid.hidden = !hasPages

  const live = new Set(state.pages.map((page) => page.id))
  for (const [pageId, card] of cards) {
    if (live.has(pageId)) continue
    thumbObserver.unobserve(card)
    pendingThumbs.delete(pageId)
    card.remove()
    cards.delete(pageId)
  }

  let createdAny = false
  state.pages.forEach((page, index) => {
    let card = cards.get(page.id)
    if (!card) {
      card = createCard(page)
      cards.set(page.id, card)
      createdAny = true
    }
    // 只在位置不對時才搬動節點。
    if (pageGrid.children[index] !== card) pageGrid.insertBefore(card, pageGrid.children[index] ?? null)
    updateCard(card, page, index)
  })
  if (createdAny) refreshIcons()
}

export function renderStatus() {
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

export function renderAll() {
  renderFiles()
  renderPages()
  renderStatus()
}
