import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { defineConfig } from 'vite'

const BASE = '/pdf-tool/'
const PDFJS_ASSET_DIRS = ['cmaps', 'standard_fonts', 'wasm']

// 把 pdf.js 的 CJK cMap、標準字型與 wasm 解碼器放到 /pdfjs/，開發與建置都提供。
function pdfjsAssets() {
  const require = createRequire(import.meta.url)
  const root = dirname(require.resolve('pdfjs-dist/package.json'))
  const prefix = `${BASE}pdfjs/`
  const files = []
  for (const dir of PDFJS_ASSET_DIRS) {
    for (const name of readdirSync(join(root, dir))) files.push(`${dir}/${name}`)
  }
  return {
    name: 'pdfjs-assets',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const path = decodeURIComponent((req.url ?? '').split('?')[0])
        if (!path.startsWith(prefix)) return next()
        const relative = path.slice(prefix.length)
        if (!files.includes(relative) || !existsSync(join(root, relative))) return next()
        res.end(readFileSync(join(root, relative)))
      })
    },
    generateBundle() {
      for (const relative of files) {
        this.emitFile({ type: 'asset', fileName: `pdfjs/${relative}`, source: readFileSync(join(root, relative)) })
      }
    },
  }
}

export default defineConfig({
  base: BASE,
  plugins: [pdfjsAssets()],
})
