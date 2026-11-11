// Canonical external destinations used by the homepage dock and both menus.
// Keep canonical links stable; the mobile dropdown has its own editorial order.
export const SOCIAL_PROFILES = Object.freeze([
  { id: 'github', zh: 'GitHub', en: 'GitHub', href: 'https://github.com/Ai-luren' },
  { id: 'rednote', zh: '小红书', en: 'REDnote', href: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470' },
  { id: 'douyin', zh: '抖音', en: 'Douyin', href: 'https://v.douyin.com/idVkRoxL/' },
  { id: 'feishu', zh: '飞书', en: 'Feishu', href: 'https://my.feishu.cn/wiki/ZmHdwRlU4iIGz5kDIvJcwo7Snkf' },
]);

// Dropdown-only order, displayed as a two-column grid (row-major).
export const MOBILE_MENU_SOCIAL_PROFILES = Object.freeze(
  ['douyin', 'rednote', 'feishu', 'github'].map(id => SOCIAL_PROFILES.find(profile => profile.id === id))
);
