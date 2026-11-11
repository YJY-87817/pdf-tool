import { describe, expect, it } from 'vitest'
import { reorderPages } from './reorder.js'

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
