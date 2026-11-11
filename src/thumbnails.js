import { state } from './state.js'

const THUMB_CSS_WIDTH = 228
const THUMB_CONCURRENCY = 3
export const pendingThumbs = new Map() // pageId -> card，等待繪製
const visibleCards = new WeakSet()
let activeThumbJobs = 0

export const thumbObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    const card = entry.target
    if (entry.isIntersecting) {
      visibleCards.add(card)
      if (card.dataset.drawnKey !== card.dataset.wantedKey) {
        pendingThumbs.set(card.dataset.pageId, card)
      }
    } else {
      visibleCards.delete(card)
      pendingThumbs.delete(card.dataset.pageId)
      releaseThumbnail(card)
    }
  }
  pumpThumbnails()
}, { rootMargin: '800px 0px' })

export function thumbKey(page) {
  return `${page.id}:${page.rotation}`
}

function releaseThumbnail(card) {
  if (!card.dataset.drawnKey) return
  const canvas = card.querySelector('canvas')
  canvas.width = 0
  canvas.height = 0
  delete card.dataset.drawnKey
  card.querySelector('.preview-loading').hidden = false
}

function pumpThumbnails() {
  while (activeThumbJobs < THUMB_CONCURRENCY && pendingThumbs.size > 0) {
    const [pageId, card] = pendingThumbs.entries().next().value
    pendingThumbs.delete(pageId)
    activeThumbJobs += 1
    drawCardThumbnail(card).finally(() => {
      activeThumbJobs -= 1
      pumpThumbnails()
    })
  }
}

async function drawCardThumbnail(card) {
  const page = state.pages.find((candidate) => candidate.id === card.dataset.pageId)
  if (!page) return
  const key = thumbKey(page)
  const loading = card.querySelector('.preview-loading')
  try {
    const source = state.documents.find((sourceDoc) => sourceDoc.id === page.documentId)
    const pdfPage = await source.pdfJs.getPage(page.sourceIndex + 1)
    const baseViewport = pdfPage.getViewport({ scale: 1 })
    const cssScale = Math.min(1, THUMB_CSS_WIDTH / baseViewport.width)
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2)
    // getViewport 的 rotation 會取代頁面本身的 /Rotate，所以要疊加。
    const rotation = (pdfPage.rotate + page.rotation) % 360
    const cssViewport = pdfPage.getViewport({ scale: cssScale, rotation })
    const pageViewport = pdfPage.getViewport({ scale: cssScale * pixelRatio, rotation })
    const offscreen = document.createElement('canvas')
    offscreen.width = Math.ceil(pageViewport.width)
    offscreen.height = Math.ceil(pageViewport.height)
    await pdfPage.render({ canvasContext: offscreen.getContext('2d', { alpha: false }), viewport: pageViewport }).promise

    // 繪製期間卡片可能已被移除、捲出範圍或再次旋轉，此時丟棄結果。
    const current = state.pages.find((candidate) => candidate.id === page.id)
    if (!current || !card.isConnected || !visibleCards.has(card) || thumbKey(current) !== key) {
      offscreen.width = 0
      return
    }
    const canvas = card.querySelector('canvas')
    canvas.width = offscreen.width
    canvas.height = offscreen.height
    canvas.style.width = `${Math.round(cssViewport.width)}px`
    canvas.getContext('2d', { alpha: false }).drawImage(offscreen, 0, 0)
    offscreen.width = 0 // 立即釋放離屏 canvas，只留下卡片上的一份。
    card.dataset.drawnKey = key
    loading.hidden = true
  } catch (error) {
    console.error(error)
    loading.hidden = false
    loading.innerHTML = '<span class="preview-error">無法預覽</span>'
  }
}
