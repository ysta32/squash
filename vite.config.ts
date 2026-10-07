import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { seoPlugin } from './vite-plugin-seo'
import { bridgeConfigPlugin } from './vite-plugin-bridge'

export default defineConfig({
  plugins: [react(), tailwindcss(), seoPlugin(), bridgeConfigPlugin()],
})
