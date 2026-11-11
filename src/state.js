export const state = {
  documents: [],
  pages: [],
  selectedPages: new Set(),
  draggedPageId: null,
  busy: false,
}

export const SOURCE_COLOR_COUNT = 6
let documentCounter = 0

export function nextColorIndex() {
  return documentCounter++ % SOURCE_COLOR_COUNT
}

export function createId() {
  return crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

// 釋放已無任何頁面的來源文件（pdf.js 物件與 pdf-lib 文件）。
export function pruneEmptyDocuments() {
  const used = new Set(state.pages.map((page) => page.documentId))
  for (const sourceDoc of state.documents) if (!used.has(sourceDoc.id)) sourceDoc.loadingTask.destroy()
  state.documents = state.documents.filter((sourceDoc) => used.has(sourceDoc.id))
}

