import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import { useLang } from '../i18n/index.js';
import './FloatingDock.css';

import mailIcon from '../../assets/images/icon/mail.svg';
import phoneIcon from '../../assets/images/icon/phone.svg';
import wechatIcon from '../../assets/images/icon/wechat.svg';
import githubIcon from '../../assets/images/icon/github.svg';
import xiaohongshuIcon from '../../assets/images/icon/xiaohongshu-solid.svg';
import douyinIcon from '../../assets/images/icon/douyin.svg';
import feishuIcon from '../../assets/images/icon/feishu.webp';
import wechatQrCode from '../../assets/images/social-profiles/微信二维码.webp';
import douyinQrCode from '../../assets/images/social-profiles/抖音二维码.webp';
import xiaohongshuQrCode from '../../assets/images/social-profiles/小红书二维码.webp';

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
  return <img src={iconPaths[name]} alt="" aria-hidden="true" />;
}

function DockItem({ item, mouseX, distance, magnification, baseItemSize, spring }) {
  const ref = useRef(null);
  const isHovered = useMotionValue(0);
  const [hovered, setHovered] = useState(false);
  const lastTapRef = useRef(0);
  const mouseDistance = useTransform(mouseX, (value) => {
    const rect = ref.current?.getBoundingClientRect() ?? { x: 0, width: baseItemSize };
    return value - rect.x - baseItemSize / 2;
  });
  const targetSize = useTransform(mouseDistance, [-distance, 0, distance], [baseItemSize, magnification, baseItemSize]);
  const size = useSpring(targetSize, spring);

  return (
    <motion.a
      ref={ref}
      href={item.href || '#'}
      target={item.external ? '_blank' : undefined}
      rel={item.external ? 'noopener noreferrer' : undefined}
      aria-label={item.label}
      className="floating-dock-item"
      style={{ width: size, height: size }}
      onMouseEnter={() => { isHovered.set(1); setHovered(true); }}
      onMouseLeave={() => { isHovered.set(0); setHovered(false); }}
      onFocus={() => { isHovered.set(1); setHovered(true); }}
      onBlur={() => { isHovered.set(0); setHovered(false); }}
      onClick={(event) => {
        if (item.onClick) {
          event.preventDefault();
          item.onClick();
          return;
        }
        if (item.qrCode && !item.href) {
          event.preventDefault();
          return;
        }
        // 移动端（触屏设备）有跳转链接的 items 需要双击才跳转
        if (item.href) {
          const isTouch = window.matchMedia('(pointer: coarse)').matches;
          if (isTouch) {
            const now = Date.now();
            if (now - lastTapRef.current < 350) {
              lastTapRef.current = 0;
              return; // 允许默认跳转
            }
            lastTapRef.current = now;
            event.preventDefault();
            return;
          }
        }
      }}
    >
      <span className="floating-dock-icon">{item.icon}</span>
      <AnimatePresence>
        {hovered && item.qrCode && (
          <motion.span
            className="floating-dock-qr-popup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
          >
            <img src={item.qrCode} alt={item.label} />
            <span>{item.qrLabel || item.label}</span>
          </motion.span>
        )}
        {hovered && !item.qrCode && (
          <motion.span
            className="floating-dock-label"
            initial={{ opacity: 0, y: 4, x: '-50%' }}
            animate={{ opacity: 1, y: 0, x: '-50%' }}
            exit={{ opacity: 0, y: 4, x: '-50%' }}
            transition={{ duration: 0.18 }}
            style={{ left: '50%' }}
            role="tooltip"
          >
            {item.label}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.a>
  );
}

export default function FloatingDock() {
  const mouseX = useMotionValue(Infinity);
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 430);
  const [status, setStatus] = useState('');
  const lang = useLang();
  const spring = { mass: 0.1, stiffness: 150, damping: 12 };

  useEffect(() => {
    const updateCompactMode = () => setIsCompact(window.innerWidth <= 430);
    window.addEventListener('resize', updateCompactMode, { passive: true });
    return () => window.removeEventListener('resize', updateCompactMode);
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
    { label: lang === 'en' ? 'Copy phone' : '复制电话', onClick: () => copy('15580714085', { zh: '电话', en: 'Phone' }), icon: <DockIcon name="phone" /> },
    { label: lang === 'en' ? 'WeChat' : '微信', onClick: () => copy('15580714085', { zh: '微信号', en: 'WeChat ID' }), qrCode: wechatQrCode, qrLabel: lang === 'en' ? 'Scan to add on WeChat' : '扫码添加微信', icon: <DockIcon name="wechat" /> },
    { label: lang === 'en' ? 'GitHub profile' : 'GitHub 主页', href: 'https://github.com/Ai-luren', external: true, icon: <DockIcon name="github" /> },
    { label: lang === 'en' ? 'Rednote profile' : '小红书主页', href: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470', external: true, qrCode: xiaohongshuQrCode, qrLabel: lang === 'en' ? 'Scan to visit Rednote' : '扫码访问小红书', icon: <DockIcon name="xiaohongshu" /> },
    { label: lang === 'en' ? 'TikTok profile' : '抖音主页', href: 'https://v.douyin.com/idVkRoxL/', external: true, qrCode: douyinQrCode, qrLabel: lang === 'en' ? 'Scan with the TikTok app' : '使用抖音扫码访问', icon: <DockIcon name="douyin" /> },
    { label: lang === 'en' ? 'Lark portfolio' : '飞书作品集', href: 'https://my.feishu.cn/wiki/ZmHdwRlU4iIGz5kDIvJcwo7Snkf', external: true, icon: <DockIcon name="feishu" /> }
  ];

  return (
    <div className="floating-dock-shell">
      <div
        className="floating-dock-panel"
        role="toolbar"
        aria-label={lang === 'en' ? 'Contact and portfolio links' : '联系方式与作品集链接'}
        onMouseMove={(event) => mouseX.set(event.clientX)}
        onMouseLeave={() => mouseX.set(Infinity)}
      >
        {items.map((item) => <DockItem
          key={item.label}
          item={item}
          mouseX={mouseX}
          distance={isCompact ? 120 : 155}
          magnification={isCompact ? 48 : 60}
          baseItemSize={isCompact ? 36 : 46}
          spring={spring}
        />)}
      </div>
      <div className="floating-dock-status" role="status" aria-live="polite">{status}</div>
    </div>
  );
}
