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
  assetsInclude: ['**/*.glb'],
  build: {
    // 工牌 3D 依赖会被延迟加载为单独 chunk；它是可预期的 WebGL 运行时包。
    chunkSizeWarningLimit: 4096
  }
}));
