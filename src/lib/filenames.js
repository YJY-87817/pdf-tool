function stripPdf(fileName) {
  return fileName.replace(/\.pdf$/i, '')
}

function timestamp(now) {
  const pad = (value) => String(value).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`
}

// 全部頁面來自同一份文件時沿用來源檔名；否則加上時間戳，避免連續匯出互相覆蓋。
export function exportFileName(sourceNames, label, extension, now = new Date()) {
  const unique = [...new Set(sourceNames)]
  const base = unique.length === 1 ? stripPdf(unique[0]) : '頁序'
  return `${base}-${label}-${timestamp(now)}.${extension}`
}

// ZIP 內的檔名：序號放最前面才會依工作區順序排列，並附上來源檔名與來源頁碼。
export function zipEntryName(index, total, sourceName, sourceIndex) {
  const width = Math.max(3, String(total).length)
  return `${String(index + 1).padStart(width, '0')}-${stripPdf(sourceName)}-p${sourceIndex + 1}.pdf`
}
