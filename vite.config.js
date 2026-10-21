import { cpSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const copyVendorToDist = {
  name: 'copy-vendor-to-dist',
  writeBundle() {
    const source = resolve('vendor');
    const target = resolve('dist/vendor');
    if (existsSync(source)) cpSync(source, target, { recursive: true });
  }
};

export default defineConfig(({ command }) => ({
  // 开发服务使用站点根路径；构建产物保留相对路径，以便 GitHub Pages 根目录发布。
  base: command === 'build' ? './' : '/',
  plugins: [react(), copyVendorToDist],
  // Match documented local addresses; never silently jump to another port.
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 5181, strictPort: true },
  build: {
    // Preserve standards-based backdrop-filter declarations in production.
    // The default CSS minifier currently drops them in favor of a -webkit-
    // prefixed declaration that Edge does not apply. No extra dependency.
    cssMinify: false,
    // Real static HTML entries work on Netlify and GitHub Pages without SPA rewrites.
    rolldownOptions: {
      input: { index: resolve('index.html'), works: resolve('works.html') }
    },
    // ogl (WebGL) 用于视频后处理，打包体积较大，放宽 chunk 告警阈值。
    chunkSizeWarningLimit: 4096
  }
}));
