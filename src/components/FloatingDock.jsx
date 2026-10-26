import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { useLang } from '../i18n/index.js';
import './FloatingDock.css';
import ExternalLinkSheet, { useTouchExternalLink } from './ExternalLinkSheet.jsx';

import mailIcon from '../../assets/images/icon/mail.svg';
import phoneIcon from '../../assets/images/icon/phone.svg';
import wechatIcon from '../../assets/images/icon/wechat.svg';
import githubIcon from '../../assets/images/icon/github.svg';
import xiaohongshuIcon from '../../assets/images/icon/xiaohongshu-solid.svg';
import douyinIcon from '../../assets/images/icon/douyin.svg';
import feishuIcon from '../../assets/images/icon/feishu.webp';
import wechatQrCode from '../../assets/images/social-profiles/微信二维码.webp';

const iconPaths = {
  mail: mailIcon,
  phone: phoneIcon,
  wechat: wechatIcon,
  github: githubIcon,
  xiaohongshu: xiaohongshuIcon,
  douyin: douyinIcon,
  feishu: feishuIcon
};

function DockIcon({ name }) {
  return <img src={iconPaths[name]} alt="" width="23" height="23" aria-hidden="true" />;
}

function DockItem({ item, mouseX, distance, magnification, baseItemSize, spring, reducedMotion, hasFinePointer, onExternalClick }) {
  const ref = useRef(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const mouseDistance = useTransform(mouseX, (value) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize };
    return value - rect.x - baseItemSize / 2;
  });
  const targetScale = useTransform(mouseDistance, [-distance, 0, distance], [1, reducedMotion ? 1 : magnification / baseItemSize, 1]);
  const scale = useSpring(targetScale, spring);
  // Coarse-pointer screens use the explicit bottom sheet, not a floating Hover label.
  const showLabel = hasFinePointer && (hovered || focused);

  return (
    <motion.a
      ref={ref}
      href={item.href || '#'}
      download={item.download}
      target={item.external ? '_blank' : undefined}
      rel={item.external ? 'noopener noreferrer' : undefined}
      aria-label={item.label}
      className="floating-dock-item"
      style={{ width: baseItemSize, height: baseItemSize }}
      onMouseEnter={() => { if (hasFinePointer) setHovered(true); }}
      onMouseLeave={() => { if (hasFinePointer) setHovered(false); }}
      onFocus={() => { setFocused(true); setHovered(true); }}
      onBlur={() => { setFocused(false); setHovered(false); }}
      onClick={(event) => {
        if (item.onClick) {
          event.preventDefault();
          item.onClick();
          return;
        }
        if (item.external) onExternalClick(event, item);
      }}
    >
      <motion.span className="floating-dock-icon" style={{ scale: focused ? (reducedMotion ? 1 : 1.18) : scale }}>{item.icon}</motion.span>
      <AnimatePresence>
        {showLabel && (
          <motion.span
            className="floating-dock-label"
            initial={reducedMotion ? false : { opacity: 0, y: 4, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={reducedMotion ? { opacity: 1, y: 0, x: '-50%' } : { opacity: 0, y: 4, x: '-50%' }}
            transition={{ duration: reducedMotion ? 0 : 0.18 }}
            style={{ left: '50%' }}
            role="tooltip"
          >
            {item.hoverLabel || item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.a>
  );
}

export default function FloatingDock() {
  const mouseX = useMotionValue(Infinity);
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 430);
  const [hasFinePointer, setHasFinePointer] = useState(() => (
    typeof window !== 'undefined'
      && (!window.matchMedia || window.matchMedia('(hover: hover) and (pointer: fine)').matches)
  ));
  const [reducedMotion, setReducedMotion] = useState(() => (
    typeof window !== 'undefined'
      && Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  ));
  const [status, setStatus] = useState('');
  const lang = useLang();
  const { pendingLink, closeLink, intercept } = useTouchExternalLink();
  const spring = { mass: 0.18, stiffness: 180, damping: 22 };

  useEffect(() => {
    const updateCompactMode = () => setIsCompact(window.innerWidth <= 430);
    window.addEventListener('resize', updateCompactMode, { passive: true });
    return () => window.removeEventListener('resize', updateCompactMode);
  }, []);

  useEffect(() => {
    const media = window.matchMedia?.('(hover: hover) and (pointer: fine)');
    if (!media) return undefined;
    const updatePointerMode = () => {
      setHasFinePointer(media.matches);
      if (!media.matches) mouseX.set(Infinity);
    };
    updatePointerMode();
    media.addEventListener?.('change', updatePointerMode);
    return () => media.removeEventListener?.('change', updatePointerMode);
  }, [mouseX]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!media) return undefined;
    const updateMotionPreference = () => setReducedMotion(media.matches);
    updateMotionPreference();
    media.addEventListener?.('change', updateMotionPreference);
    return () => media.removeEventListener?.('change', updateMotionPreference);
  }, []);

  const copy = (value, label) => {
    const copied = lang === 'en' ? `${label.en} copied` : `${label.zh}已复制`;
    navigator.clipboard?.writeText(value).then(() => {
      setStatus(copied);
      window.setTimeout(() => setStatus(''), 1600);
    }).catch(() => setStatus(lang === 'en' ? 'Copy failed, please reach out manually' : '复制失败，请手动联系'));
  };

  const items = [
    { label: lang === 'en' ? 'Copy email' : '复制邮箱', onClick: () => copy('1746850550@qq.com', { zh: '邮箱', en: 'Email' }), icon: <DockIcon name="mail" /> },
    { label: lang === 'en' ? 'Save WeChat QR code' : '保存微信二维码', hoverLabel: lang === 'en' ? 'Save WeChat QR' : '保存微信二维码', href: wechatQrCode, download: 'wechat-qr-code.webp', icon: <DockIcon name="wechat" /> },
    { label: lang === 'en' ? 'GitHub profile' : 'GitHub 主页', hoverLabel: lang === 'en' ? 'Open GitHub profile' : '打开 GitHub 主页', href: 'https://github.com/Ai-luren', external: true, zh: 'GitHub 主页', en: 'GitHub profile', icon: <DockIcon name="github" /> },
    { label: lang === 'en' ? 'REDnote profile' : '小红书主页', hoverLabel: lang === 'en' ? 'Open REDnote profile' : '打开小红书主页', href: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470', external: true, zh: '小红书主页', en: 'REDnote profile', icon: <DockIcon name="xiaohongshu" /> },
    { label: lang === 'en' ? 'Douyin profile' : '抖音主页', hoverLabel: lang === 'en' ? 'Open Douyin profile' : '打开抖音主页', href: 'https://v.douyin.com/idVkRoxL/', external: true, zh: '抖音主页', en: 'Douyin profile', icon: <DockIcon name="douyin" /> },
    { label: lang === 'en' ? 'Feishu portfolio' : '飞书作品集', hoverLabel: lang === 'en' ? 'Open Feishu portfolio' : '打开飞书作品集', href: 'https://my.feishu.cn/wiki/ZmHdwRlU4iIGz5kDIvJcwo7Snkf', external: true, zh: '飞书作品集', en: 'Feishu portfolio', icon: <DockIcon name="feishu" /> }
  ];

  return (
    <div className="floating-dock-shell">
      <div
        className="floating-dock-panel"
        role="toolbar"
        aria-label={lang === 'en' ? 'Contact and portfolio links' : '联系方式与作品集链接'}
        onMouseMove={(event) => { if (hasFinePointer) mouseX.set(event.clientX); }}
        onMouseLeave={() => mouseX.set(Infinity)}
      >
        {items.map((item) => <DockItem
          key={item.label}
          item={item}
          mouseX={mouseX}
          distance={isCompact ? 120 : 155}
          magnification={hasFinePointer ? (isCompact ? 46 : 60) : (isCompact ? 44 : 60)}
          baseItemSize={isCompact ? 44 : 46}
          spring={reducedMotion ? { duration: 0 } : spring}
          reducedMotion={reducedMotion}
          hasFinePointer={hasFinePointer}
          onExternalClick={intercept}
        />)}
      </div>
      <div className="floating-dock-status" role="status" aria-live="polite">{status}</div>
      <ExternalLinkSheet link={pendingLink} onClose={closeLink} lang={lang} />
    </div>
  );
}
