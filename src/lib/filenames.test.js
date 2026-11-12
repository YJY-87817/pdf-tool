import { describe, expect, it } from 'vitest'
import { exportFileName, zipEntryName } from './filenames.js'

const now = new Date(2026, 10, 12, 9, 5)

describe('exportFileName', () => {
  it('keeps the source name when every page comes from one file', () => {
    expect(exportFileName(['報告.pdf', '報告.pdf'], '合併', 'pdf', now)).toBe('報告-合併-20261112-0905.pdf')
  })
  it('uses the product name for multiple sources', () => {
    expect(exportFileName(['a.pdf', 'b.PDF'], '逐頁拆分', 'zip', now)).toBe('頁序-逐頁拆分-20261112-0905.zip')
  })
})

describe('zipEntryName', () => {
  it('puts the workspace order first and the source page last', () => {
    expect(zipEntryName(0, 12, 'a.pdf', 4)).toBe('001-a-p5.pdf')
    expect(zipEntryName(1233, 1500, 'b.PDF', 0)).toBe('1234-b-p1.pdf')
  })
})
