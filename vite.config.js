import { cpSync, existsSync, readFileSync } from 'node:fs';
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

// Warm the directly opened All Work category's first row from HTML, before
// React runs. Read Studio-managed metadata so reordered or replaced covers
// cannot leave stale hard-coded preloads.
const preloadLibraryFirstRow = {
  name: 'preload-library-first-row',
  transformIndexHtml: {
    order: 'pre',
    handler(html, ctx) {
      if (!ctx.path.endsWith('/works.html')) return html;
      const json = file => JSON.parse(readFileSync(resolve('src/data', file), 'utf8'));
      const order = json('project-order.json').all;
      const coverOverrides = json('project-cover-overrides.json');
      const auto = json('auto-projects.json');
      const archived = json('archive-state.json');
      const categories = ['commercial', 'short-film', 'social', 'visual'];
      const files = order
        .filter(id => !archived.works?.[id])
        .map(id => coverOverrides[id] || auto.find(project => project.id === id)?.coverFile)
        .filter(file => file && existsSync(resolve('assets/images/project-covers', file)));
      const links = categories.flatMap(category =>
        files.filter(file => file.startsWith(category + '/')).slice(0, 4)
          .map((file, index) => ({
            tag: 'link',
            attrs: {
              rel: 'preload', as: 'image',
              href: './assets/images/project-covers/' + file,
              fetchpriority: 'high',
              media: 'not all',
              'data-library-cover-category': category,
              'data-library-cover-media': index < 2 ? 'all'
                : index === 2 ? '(min-width: 900px)' : '(min-width: 1280px)',
            },
            injectTo: 'head',
          }))
      );
      // Inert preloads become active while the HTML head is being parsed.
      // Only the directly visited category/viewport gets early requests.
      const activate = `(() => {
        const categories = ${JSON.stringify(categories)};
        const requested = new URLSearchParams(location.search).get('category');
        const category = categories.includes(requested) ? requested : 'commercial';
        document.querySelectorAll('link[data-library-cover-category]').forEach(link => {
          if (link.dataset.libraryCoverCategory === category) {
            link.media = link.dataset.libraryCoverMedia;
          }
        });
      })();`;
      return {
        html,
        tags: [...links, { tag: 'script', children: activate, injectTo: 'head' }],
      };
    },
  },
};

export default defineConfig(({ command }) => ({
  // 开发服务使用站点根路径；构建产物保留相对路径，以便 GitHub Pages 根目录发布。
  base: command === 'build' ? './' : '/',
  plugins: [react(), preloadLibraryFirstRow, copyVendorToDist],
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
