import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Puts everything into index.html, so the built site is one file that opens anywhere, even by double-clicking it. */
function oneFile(): Plugin {
  return {
    name: 'one-file',
    enforce: 'post',
    generateBundle(_, bundle) {
      const page = bundle['index.html']
      if (page?.type !== 'asset') return
      let html = String(page.source)
      for (const [name, out] of Object.entries(bundle)) {
        if (out.type === 'chunk') {
          const code = out.code.replaceAll('</script', '<\\/script')
          html = html.replace(new RegExp(`<script[^>]*src="[^"]*${name}"[^>]*></script>`), () => `<script type="module">${code}</script>`)
        } else if (name.endsWith('.css')) {
          html = html.replace(new RegExp(`<link[^>]*href="[^"]*${name}"[^>]*>`), () => `<style>${out.source}</style>`)
        } else continue
        delete bundle[name]
      }
      page.source = html
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), oneFile()],
  build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER, modulePreload: false },
})
