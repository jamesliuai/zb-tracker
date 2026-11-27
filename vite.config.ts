import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { build, defineConfig, type Plugin } from 'vite'

/**
 * Puts everything into index.html, so the built site is one file that opens anywhere, even by
 * double-clicking it. Only the smart cube's Bluetooth code stays apart, in smartcube.js.
 */
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

/**
 * Builds the smart cube library on its own, with everything it needs inside, into smartcube.js
 * beside the page. The page fetches it only on the way to connecting a cube (src/smart/connect.ts),
 * so it costs nothing to anyone without one. It isn't a chunk of the page's own build, because a
 * chunk would share code with the page, and the page is inlined, so nothing can import from it.
 */
function smartCube(): Plugin {
  return {
    name: 'smart-cube',
    apply: 'build',
    async generateBundle() {
      const out = await build({
        configFile: false,
        logLevel: 'warn',
        publicDir: false,
        build: {
          write: false,
          rollupOptions: {
            input: fileURLToPath(import.meta.resolve('smartcube-web-bluetooth')),
            preserveEntrySignatures: 'strict',
            output: { entryFileNames: 'smartcube.js' },
          },
        },
      })
      const first = [out].flat()[0]
      if (!('output' in first) || first.output[0].type !== 'chunk') throw new Error('The smart cube library didn’t build')
      this.emitFile({ type: 'asset', fileName: 'smartcube.js', source: first.output[0].code })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), smartCube(), oneFile()],
  build: { assetsInlineLimit: Number.MAX_SAFE_INTEGER, modulePreload: false },
})
