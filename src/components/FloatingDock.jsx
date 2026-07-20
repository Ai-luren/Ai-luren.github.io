import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from 'motion/react';
import { useEffect, useRef, useState } from 'react';

import './FloatingDock.css';

import mailIcon from '../../assets/images/mail.svg';
import phoneIcon from '../../assets/images/phone.svg';
import wechatIcon from '../../assets/images/wechat.svg';
import githubIcon from '../../assets/images/github.svg';
import xiaohongshuIcon from '../../assets/images/xiaohongshu-solid.svg';
import douyinIcon from '../../assets/images/douyin.svg';
import feishuIcon from '../../assets/images/feishu.png';

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
    { label: '复制邮箱', onClick: () => copy('1746850550@qq.com', '邮箱'), icon: <DockIcon name="mail" /> },
    { label: '复制电话', onClick: () => copy('15580714085', '电话'), icon: <DockIcon name="phone" /> },
    { label: '复制微信号', onClick: () => copy('15580714085', '微信号'), icon: <DockIcon name="wechat" /> },
    { label: 'GitHub 主页', href: 'https://github.com/Ai-luren', external: true, icon: <DockIcon name="github" /> },
    { label: '小红书主页', href: 'https://www.xiaohongshu.com/user/profile/5eff691a000000000101c470', external: true, icon: <DockIcon name="xiaohongshu" /> },
    { label: '抖音主页', href: 'https://v.douyin.com/idVkRoxL/', external: true, icon: <DockIcon name="douyin" /> },
    { label: '飞书作品集', href: 'https://my.feishu.cn/wiki/ZmHdwRlU4iIGz5kDIvJcwo7Snkf', external: true, icon: <DockIcon name="feishu" /> }
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
