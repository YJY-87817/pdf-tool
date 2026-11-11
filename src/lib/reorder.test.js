import { describe, expect, it } from 'vitest'
import { reorderPages, restorePages, shiftPages } from './reorder.js'

const pages = ['a', 'b', 'c', 'd'].map((id) => ({ id }))
const ids = (list) => list.map((page) => page.id).join('')

describe('reorderPages', () => {
  it('moves a single page before or after the target', () => {
    expect(ids(reorderPages(pages, new Set(), 'a', 'c', false))).toBe('bac' + 'd')
    expect(ids(reorderPages(pages, new Set(), 'a', 'c', true))).toBe('bcad')
    expect(ids(reorderPages(pages, new Set(), 'd', 'a', false))).toBe('dabc')
  })
  it('moves all selected pages together when the dragged one is selected', () => {
    expect(ids(reorderPages(pages, new Set(['a', 'c']), 'a', 'd', true))).toBe('bdac')
  })
  it('drags only the dragged page when it is not selected', () => {
    expect(ids(reorderPages(pages, new Set(['b', 'c']), 'a', 'd', true))).toBe('bcda')
  })
  it('returns null when dropping onto a moving page or unknown target', () => {
    expect(reorderPages(pages, new Set(['a', 'b']), 'a', 'b', true)).toBeNull()
    expect(reorderPages(pages, new Set(), 'a', 'zzz', true)).toBeNull()
  })
  it('does not mutate the input', () => {
    reorderPages(pages, new Set(), 'a', 'd', true)
    expect(ids(pages)).toBe('abcd')
  })
})

describe('shiftPages', () => {
  it('moves a selected page one step', () => {
    expect(ids(shiftPages(pages, new Set(['c']), -1))).toBe('acbd')
    expect(ids(shiftPages(pages, new Set(['b']), 1))).toBe('acbd')
  })
  it('keeps a selected block together and stops at the edge', () => {
    expect(ids(shiftPages(pages, new Set(['b', 'c']), 1))).toBe('adbc')
    expect(shiftPages(pages, new Set(['a']), -1)).toBeNull()
    expect(shiftPages(pages, new Set(['c', 'd']), 1)).toBeNull()
  })
  it('lets non-edge pages move while an edge page stays', () => {
    expect(ids(shiftPages(pages, new Set(['a', 'c']), -1))).toBe('acbd')
  })
  it('returns null with no selection', () => {
    expect(shiftPages(pages, new Set(), 1)).toBeNull()
  })
})

describe('restorePages', () => {
  it('puts deleted pages back at their original positions', () => {
    const remaining = [pages[1], pages[3]]
    const entries = [{ page: pages[0], index: 0 }, { page: pages[2], index: 2 }]
    expect(ids(restorePages(remaining, entries))).toBe('abcd')
  })
  it('clamps indexes beyond the end', () => {
    expect(ids(restorePages([pages[0]], [{ page: pages[3], index: 9 }]))).toBe('ad')
  })
})
