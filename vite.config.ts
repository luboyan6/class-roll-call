import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

export default defineConfig({
  plugins: [react()],
  // 相对路径产物：无论托管在根域名还是子目录（如 /roll-call/）都能正常加载，
  // 本地直接双击 dist/index.html 也能打开
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  // 部署到任何反向代理托管（Cloudflare Pages / 容器平台）时：
  // host 必须 0.0.0.0，allowedHosts 必须放开，否则 Vite 会返回
  // "Blocked request. This host is not allowed."
  server: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
  preview: {
    host: '0.0.0.0',
    allowedHosts: true,
  },
})
