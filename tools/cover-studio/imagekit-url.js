// ImageKit media library URLs and delivery URLs share the same file name.
// Workbench inputs show the stem; the saved URL always uses tr:orig-true and .mp4.
export const IMAGEKIT_URL_PREFIX = 'https://ik.imagekit.io/Ailuren/tr:orig-true/videos/';
const LIBRARY_PATH = '/Ailuren/videos/';
const DELIVERY_PATH = '/Ailuren/tr:orig-true/videos/';

export function imageKitVideoStem(value) {
  const input = String(value ?? '').trim();
  if (!input) return '';
  let name = input;
  if (/^(?:https?:|\/\/)/i.test(input)) {
    let url;
    try { url = new URL(input); } catch { return input; }
    if (url.protocol !== 'https:' || url.origin !== 'https://ik.imagekit.io' ||
        url.username || url.password || url.search || url.hash) return input;
    const base = [DELIVERY_PATH, LIBRARY_PATH].find(path => url.pathname.startsWith(path));
    if (!base) return input;
    try { name = decodeURIComponent(url.pathname.slice(base.length)); }
    catch { return input; }
  }
  return /\.mp4$/i.test(name) ? name.slice(0, -4) : name;
}

export function imageKitVideoError(value, { optional = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) return optional ? '' : '请填写视频文件名。';
  const stem = imageKitVideoStem(raw);
  if (/^(?:https?:|\/\/)/i.test(stem)) return '只接受当前 ImageKit 账户的视频链接或文件名。';
  if (!stem || stem.includes('..') || stem.includes('\\') || stem.startsWith('/') ||
      /[?#<>\x00-\x1f\x7f]/.test(stem)) return '文件名不能包含路径跳转、问号、井号或非法字符。';
  if (/\.(?:mov|mkv|avi|webm|m4v|mp3|jpg|jpeg|png|gif|html|pdf)$/i.test(stem))
    return '请使用 MP4 视频文件名（可省略 .mp4）。';
  try {
    const url = new URL(IMAGEKIT_URL_PREFIX + stem + '.mp4');
    if (url.origin !== 'https://ik.imagekit.io' || !url.pathname.startsWith(DELIVERY_PATH))
      return 'ImageKit 视频文件名格式不正确。';
  } catch { return 'ImageKit 视频文件名格式不正确。'; }
  return '';
}

export function imageKitVideoURL(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  // Invalid drafts stay distinguishable from the saved URL. Their save action
  // is disabled by imageKitVideoError, never sent to the server.
  if (imageKitVideoError(raw)) return raw;
  return new URL(IMAGEKIT_URL_PREFIX + imageKitVideoStem(raw) + '.mp4').href;
}
