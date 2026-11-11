import js from '@eslint/js'
import globals from 'globals'

export default [
  { ignores: ['dist/', 'node_modules/'] },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: { globals: globals.browser },
    rules: { 'no-shadow': ['error', { builtinGlobals: true, allow: ['event'] }] },
  },
  {
    files: ['vite.config.js', 'eslint.config.js'],
    languageOptions: { globals: globals.node },
  },
]
