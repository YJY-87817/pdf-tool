import { describe, expect, it } from 'vitest'
import { PageRangeError, formatPageRange, parsePageRange } from './page-range.js'

describe('parsePageRange', () => {
  it('parses single pages and ranges into sorted unique 0-based indexes', () => {
    expect(parsePageRange('1-3, 5', 5)).toEqual([0, 1, 2, 4])
    expect(parsePageRange('5,1,1-2', 5)).toEqual([0, 1, 4])
  })
  it('ignores empty segments such as a trailing comma', () => {
    expect(parsePageRange('1-3,', 5)).toEqual([0, 1, 2])
    expect(parsePageRange(' , 2 ,, ', 5)).toEqual([1])
  })
  it('accepts full-width digits and punctuation', () => {
    expect(parsePageRange('１-２，４', 5)).toEqual([0, 1, 3])
    expect(parsePageRange('1、3', 5)).toEqual([0, 2])
    expect(parsePageRange('2～4', 5)).toEqual([1, 2, 3])
  })
  it('gives a dedicated message for reversed ranges', () => {
    expect(() => parsePageRange('3-1', 3)).toThrow(/顛倒/)
  })
  it('rejects out-of-bounds pages', () => {
    expect(() => parsePageRange('0', 3)).toThrow(/介於 1 到 3/)
    expect(() => parsePageRange('2-4', 3)).toThrow(/介於 1 到 3/)
  })
  it('rejects malformed input and empty input with PageRangeError', () => {
    expect(() => parsePageRange('a-b', 3)).toThrow(PageRangeError)
    expect(parsePageRange('', 3)).toEqual([])
  })
})

describe('formatPageRange', () => {
  it('collapses consecutive numbers', () => {
    expect(formatPageRange([1, 2, 3, 5, 7, 8])).toBe('1-3, 5, 7-8')
    expect(formatPageRange([])).toBe('')
  })
})
