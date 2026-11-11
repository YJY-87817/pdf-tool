import pdfWorkerUrl from 'pdfjs-dist/legacy/build/pdf.worker.min.mjs?url'
import { state } from './state.js'

let pdfRuntimePromise

export function loadPdfRuntime() {
  pdfRuntimePromise ??= Promise.all([import('pdf-lib'), import('pdfjs-dist/legacy/build/pdf.mjs')]).then(([pdfLib, pdfjs]) => {
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    return { PDFDocument: pdfLib.PDFDocument, degrees: pdfLib.degrees, pdfjs }
  }).catch((error) => {
    pdfRuntimePromise = undefined
    throw error
  })
  return pdfRuntimePromise
}

export async function createPdf(pages) {
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
    const source = state.documents.find((sourceDoc) => sourceDoc.id === documentId)
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
