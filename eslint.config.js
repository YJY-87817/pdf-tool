import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/', 'test-results/', 'playwright-report/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-shadow': ['error', { builtinGlobals: true, allow: ['event'] }] },
  },
  {
    files: ['vite.config.js', 'eslint.config.js', 'vitest.config.js', 'playwright.config.js'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['e2e/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
]
