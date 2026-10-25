/**
 * Warm only the HTML/CSS/JS shell of the other portfolio document.
 * Never preload video, screenshots, or artwork. Background prefetch starts
 * only when the user is near the featured archive or idle in the work library.
 * Same-document hash links are not page transitions.
 */
const requested = new Set();

function prefetchAsset(url, as) {
  if (requested.has(url)) return;
  requested.add(url);
  const link = document.createElement('link');
  link.rel = 'prefetch';
  link.href = url;
  link.as = as;
  link.fetchPriority = 'low';
  document.head.append(link);
}

async function prefetchDocument(href) {
  const absolute = new URL(href, document.baseURI);
  if (absolute.origin !== location.origin || requested.has(absolute.href)) return;
  requested.add(absolute.href);
  try {
    const response = await fetch(absolute.href, { priority: 'low', credentials: 'same-origin' });
    if (!response.ok) return;
    const html = new DOMParser().parseFromString(await response.text(), 'text/html');
    // Vite builds include a hashed script and its CSS/modulepreload dependencies;
    // development mode uses a source entry. No images or videos are discovered.
    const assets = [
      ...html.querySelectorAll('script[type="module"][src]'),
      ...html.querySelectorAll('link[rel="modulepreload"][href],link[rel="stylesheet"][href]'),
    ];
    for (const element of assets) {
      const path = element.getAttribute('src') || element.getAttribute('href');
      const src = new URL(path, absolute.href);
      if (src.origin !== location.origin) continue;
      prefetchAsset(src.href, element.tagName === 'SCRIPT' || element.rel === 'modulepreload' ? 'script' : 'style');
    }
  } catch {
    // Prefetch is opportunistic: normal links must always work offline or
    // on browsers that do not support low-priority fetching.
  }
}

export function warmNavigationTo(href, { observe, idle = false } = {}) {
  if (typeof window === 'undefined') return () => {};
  const url = new URL(href, document.baseURI);
  const intended = () => prefetchDocument(url.href);
  const canonicalPath = pathname => pathname
    .replace(/\/index(?:\.html)?$/, '/')
    .replace(/\.html$/, '')
    .replace(/\/$/, '') || '/';
  // Pointer/touch/focus intent also works if Netlify rewrites
  // /works.html to /works or if IntersectionObserver is absent.
  const handleIntent = event => {
    const link = event.target.closest('a[href]');
    if (!link) return;
    try {
      const target = new URL(link.href);
      if (target.origin === url.origin && canonicalPath(target.pathname) === canonicalPath(url.pathname)) intended();
    } catch {}
  };
  document.addEventListener('pointerover', handleIntent, { passive: true });
  document.addEventListener('pointerdown', handleIntent, { passive: true });
  document.addEventListener('focusin', handleIntent);
  let observer;
  let idleHandle;
  let timer;
  const eligible = !navigator.connection?.saveData && !/2g/.test(navigator.connection?.effectiveType || '');
  if (eligible && observe && 'IntersectionObserver' in window) {
    observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        if ('requestIdleCallback' in window) idleHandle = requestIdleCallback(intended, { timeout: 1600 });
        else timer = window.setTimeout(intended, 700);
      }
    // Wait until work cards approach the comfortable reading area. Merely
    // seeing the end of the Hero must not start competing requests.
    }, { rootMargin: '-10% 0px -25% 0px' });
    observer.observe(observe);
  } else if (eligible && idle) {
    timer = window.setTimeout(intended, 1800);
  }
  return () => {
    observer?.disconnect();
    if (idleHandle && 'cancelIdleCallback' in window) cancelIdleCallback(idleHandle);
    window.clearTimeout(timer);
    document.removeEventListener('pointerover', handleIntent);
    document.removeEventListener('pointerdown', handleIntent);
    document.removeEventListener('focusin', handleIntent);
  };
}
