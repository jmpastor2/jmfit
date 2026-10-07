/* oxlint-disable no-console -- a command line step */
import { copyFileSync, existsSync } from 'node:fs'

// GitHub Pages has no SPA fallback: serve index.html for unknown paths via 404.html.
const src = new URL('../dist/index.html', import.meta.url)
const dst = new URL('../dist/404.html', import.meta.url)
if (existsSync(src)) {
  copyFileSync(src, dst)
  console.log('postbuild: 404.html created for SPA fallback')
}
