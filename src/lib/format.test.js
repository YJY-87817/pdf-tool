import { expect, it } from 'vitest'
import { formatBytes } from './format.js'

it('formats sizes', () => {
  expect(formatBytes(0)).toBe('1 KB')
  expect(formatBytes(2048)).toBe('2 KB')
  expect(formatBytes(1.5 * 1024 * 1024)).toBe('1.5 MB')
})
