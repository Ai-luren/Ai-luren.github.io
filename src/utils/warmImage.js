// Decode an image before replacing a visible card. Keep a bounded set of decoded
// images while navigating, so iOS Safari does not have to rediscover each frame.
const cache = new Map();
const LIMIT = 18;

export const isImageReady = (src) => Boolean(cache.get(src)?.ready);

export function warmImage(src) {
  if (!src || typeof Image === 'undefined') return Promise.resolve(false);
  const cached = cache.get(src);
  if (cached) return cached.promise;
  const image = new Image();
  image.decoding = 'async';
  const entry = { image, ready: false, promise: null };
  entry.promise = new Promise(resolve => {
    let finished = false;
    const complete = async (ok) => {
      if (finished) return;
      finished = true;
      if (ok && typeof image.decode === 'function') {
        try { await image.decode(); } catch { ok = image.complete && image.naturalWidth > 0; }
      }
      entry.ready = Boolean(ok && image.naturalWidth);
      if (!entry.ready) cache.delete(src);
      resolve(entry.ready);
    };
    image.onload = () => complete(true);
    image.onerror = () => complete(false);
    image.src = src;
    if (image.complete) complete(image.naturalWidth > 0);
  });
  cache.set(src, entry);
  while (cache.size > LIMIT) cache.delete(cache.keys().next().value);
  return entry.promise;
}

export const warmImages = (sources) => Promise.all(sources.map(warmImage));

// Only start distant gallery assets when the user approaches that section;
// do not compete with the Hero video on the first network burst.
export function warmNear(element, sources, margin = '1100px') {
  if (!element) return () => {};
  if (typeof IntersectionObserver === 'undefined') {
    sources.forEach(warmImage);
    return () => {};
  }
  const observer = new IntersectionObserver(entries => {
    if (!entries[0]?.isIntersecting) return;
    observer.disconnect();
    sources.forEach(warmImage);
  }, { rootMargin: margin });
  observer.observe(element);
  return () => observer.disconnect();
}


/**
 * The archive uses a 3:4 cover while the viewer uses a separate 16:9 poster.
 * Decode the latter before opening the dialog, so its first visible frame
 * cannot expose the black video stage. A failed poster falls back to the
 * already displayed card cover, without triggering a second image swap.
 */
export async function prepareProjectPoster(project) {
  if (!project) return project;
  const src = project.playerPoster || project.cover;
  const ready = await warmImage(src);
  return ready ? project : { ...project, playerPoster: project.cover };
}
