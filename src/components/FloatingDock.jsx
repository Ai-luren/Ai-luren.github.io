import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import './FloatingDock.css';

const iconPaths = {
  mail: 'assets/images/mail.svg',
  phone: 'assets/images/phone.svg',
  wechat: 'assets/images/wechat.svg',
  github: 'assets/images/github.svg',
  xiaohongshu: 'assets/images/xiaohongshu-solid.svg',
  douyin: 'assets/images/douyin.svg',
  feishu: 'assets/images/feishu.png'
};

function MaskIcon({ name }) {
  return <span className="floating-dock-mask-icon" style={{ WebkitMaskImage: `url('${iconPaths[name]}')`, maskImage: `url('${iconPaths[name]}')` }} aria-hidden="true" />;
}

function DockItem({ item, mouseX, distance, magnification, baseItemSize, spring }) {
  const ref = useRef(null);
  const isHovered = useMotionValue(0);
  const [hovered, setHovered] = useState(false);
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
        }
      }}
    >
      <span className="floating-dock-icon">{item.icon}</span>
      <AnimatePresence>
        {hovered && (
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
  const [isCompact, setIsCompact] = useState(() => typeof window !== 'undefined' && window.innerWidth <= 380);
  const [status, setStatus] = useState('');
  const spring = { mass: 0.1, stiffness: 150, damping: 12 };

  useEffect(() => {
    const updateCompactMode = () => setIsCompact(window.innerWidth <= 380);
    window.addEventListener('resize', updateCompactMode, { passive: true });
    return () => window.removeEventListener('resize', updateCompactMode);
  }, []);

  const copy = (value, label) => {
    navigator.clipboard?.writeText(value).then(() => {
      setStatus(`${label}已复制`);
      window.setTimeout(() => setStatus(''), 1600);
    }).catch(() => setStatus('复制失败，请手动联系'));
  };

  const items = [
    { label: '复制邮箱', onClick: () => copy('1746850550@qq.com', '邮箱'), icon: <MaskIcon name="mail" /> },
    { label: '复制电话', onClick: () => copy('15580714085', '电话'), icon: <MaskIcon name="phone" /> },
    { label: '复制微信号', onClick: () => copy('15580714085', '微信号'), icon: <MaskIcon name="wechat" /> },
    { label: 'GitHub 主页', href: 'https://github.com/Ai-luren', external: true, icon: <MaskIcon name="github" /> },
    { label: '小红书主页', href: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470', external: true, icon: <MaskIcon name="xiaohongshu" /> },
    { label: '抖音主页', href: 'https://v.douyin.com/idVkRoxL/', external: true, icon: <MaskIcon name="douyin" /> },
    { label: '飞书作品集', href: 'https://my.feishu.cn/wiki/ZmHdwRlU4iIGz5kDIvJcwo7Snkf', external: true, icon: <MaskIcon name="feishu" /> }
  ];

  return (
    <div className="floating-dock-shell">
      <div
        className="floating-dock-panel"
        role="toolbar"
        aria-label="联系方式与作品集链接"
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
