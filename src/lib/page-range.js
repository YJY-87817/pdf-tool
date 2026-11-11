export class PageRangeError extends Error {}

// 把全形與常見的中文標點正規化，讓中文輸入法下打的範圍也能使用。
function normalizeRangeText(value) {
  return value
    .normalize('NFKC')
    .replace(/[，、；;]/g, ',')
    .replace(/[~～–—－﹣]/g, '-')
}

// 回傳 0 起算、遞增排序、不重複的頁面索引。
export function parsePageRange(value, pageCount) {
  const indexes = new Set()
  const parts = normalizeRangeText(value).split(',').map((part) => part.trim()).filter(Boolean)
  for (const part of parts) {
    const match = part.match(/^(\d+)(?:\s*-\s*(\d+))?$/)
    if (!match) throw new PageRangeError('頁碼格式錯誤，請使用例如 1-3, 5 的格式。')
    const start = Number(match[1])
    const end = Number(match[2] ?? match[1])
    if (end < start) throw new PageRangeError(`「${part}」的起訖頁顛倒了，請改為 ${end}-${start}。`)
    if (start < 1 || end > pageCount) throw new PageRangeError(`頁碼範圍需介於 1 到 ${pageCount} 頁。`)
    for (let pageNumber = start; pageNumber <= end; pageNumber += 1) indexes.add(pageNumber - 1)
  }
  return [...indexes].sort((left, right) => left - right)
}

export function formatPageRange(pageNumbers) {
  const ranges = []
  for (const pageNumber of pageNumbers) {
    const last = ranges.at(-1)
    if (last && pageNumber === last[1] + 1) last[1] = pageNumber
    else ranges.push([pageNumber, pageNumber])
  }
  return ranges.map(([start, end]) => (start === end ? `${start}` : `${start}-${end}`)).join(', ')
}
