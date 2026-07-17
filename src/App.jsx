import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import MagneticProjectArchive from './components/MagneticProjectArchive.jsx';
import ImpactEvidence from './components/ImpactEvidence.jsx';

const BadgeLanyardModal = lazy(() => import('./components/BadgeLanyardModal.jsx'));

export default function App() {
  const [badgeOpen, setBadgeOpen] = useState(false);
  const [badgeClosing, setBadgeClosing] = useState(false);
  const [badgePosition, setBadgePosition] = useState(null);
  const closeTimer = useRef(null);

  const closeBadge = () => {
    if (!badgeOpen || badgeClosing) return;
    setBadgeClosing(true);
    closeTimer.current = window.setTimeout(() => {
      setBadgeOpen(false);
      setBadgeClosing(false);
      setBadgePosition(null);
      closeTimer.current = null;
    }, 480);
  };

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  useEffect(() => {
    const trigger = document.querySelector('.nav-badge');
    if (!trigger) return undefined;
    const toggleBadge = () => {
      if (badgeOpen) closeBadge();
      else {
        setBadgeClosing(false);
        setBadgePosition(null);
        setBadgeOpen(true);
      }
    };
    trigger.addEventListener('click', toggleBadge);
    return () => trigger.removeEventListener('click', toggleBadge);
  }, [badgeOpen]);

  useEffect(() => {
    const trigger = document.querySelector('.nav-badge');
    if (!trigger) return;
    trigger.setAttribute('aria-expanded', String(badgeOpen));
    trigger.textContent = badgeOpen ? '收起工牌' : '我的工牌';
    trigger.setAttribute('aria-label', badgeOpen ? '收起工牌' : '打开我的工牌');
    document.body.classList.toggle('has-badge-open', badgeOpen);
    return () => document.body.classList.remove('has-badge-open');
  }, [badgeOpen]);

  useEffect(() => {
    if (!badgeOpen) return undefined;
    const updatePosition = () => {
      const trigger = document.querySelector('.nav-badge');
      if (!trigger) return;
      const rect = trigger.getBoundingClientRect();
      const sceneHeight = Math.min(810, window.innerHeight - 24);
      // 不再用 Three.js 世界坐标追踪按钮。画布本身以按钮中心定位，
      // 这样物理挂绳的固定点始终是画布正中，避免相机投影造成左右穿帮。
      const cameraZ = 20 * (window.innerHeight / sceneHeight);
      setBadgePosition({
        camera: [0, 0, cameraZ],
        anchor: [0, 4, 0],
        stage: {
          left: rect.left + rect.width / 2,
          // React Bits 模型从画布顶部到可见绳子约占 104px；让它刚好露在按钮下沿。
          top: rect.bottom - 104
        }
      });
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [badgeOpen]);

  const projectArchiveRoot = document.getElementById('projects-react-root');
  const impactEvidenceRoot = document.getElementById('recognition-react-root');

  return (
    <>
      {projectArchiveRoot && createPortal(<MagneticProjectArchive />, projectArchiveRoot)}
      {impactEvidenceRoot && createPortal(<ImpactEvidence />, impactEvidenceRoot)}
      <Suspense fallback={null}>
        {badgeOpen && badgePosition && (
          <BadgeLanyardModal open={badgeOpen} closing={badgeClosing} onClose={closeBadge} position={badgePosition} />
        )}
      </Suspense>
    </>
  );
}
