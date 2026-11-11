import { useEffect, useRef, useState } from 'react';
import CometCard from './CometCard.jsx';
import './CometCard.css';
import './ProjectCard.css';
import { PROJECT_CATEGORIES } from '../data/projects.js';
import {initialProjectPoster,projectVideoVersions} from '../data/version-order.js';
import { warmImage } from '../utils/warmImage.js';
import {useLocalArtworkRevision,revisionedArtworkUrl} from '../utils/localPreviewArtwork.js';

const renderTitle = (raw) => {
  if (raw === 'WAN AI Short Film') return <span className="comet-archive__title-content">{raw}</span>;
  const idx = raw.indexOf(' AI ');
  if (idx === -1) return <span className="comet-archive__title-content">{raw}</span>;
  return (
    <span className="comet-archive__title-content">
      <span className="comet-archive__title-line">{raw.slice(0, idx)}</span>
      {' '}
      <span className="comet-archive__title-line">{raw.slice(idx + 1)}</span>
    </span>
  );
};

export default function ProjectCard({ project, lang, onClick, coverPriority = 'auto', deferUntilNear = false }) {
  const cardRef = useRef(null);
  const [coverNear, setCoverNear] = useState(!deferUntilNear);
  useEffect(() => {
    if (!deferUntilNear) {
      setCoverNear(true);
      return undefined;
    }
    if (!cardRef.current || !('IntersectionObserver' in window)) {
      setCoverNear(true);
      return undefined;
    }
    // The homepage starts with a video Hero. Avoid pulling offscreen featured
    // artwork into its initial network burst, without waiting until it is visible.
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setCoverNear(true);
        observer.disconnect();
      }
    }, { rootMargin: '350px 0px' });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, [deferUntilNear]);
  const previewRevision=useLocalArtworkRevision('cover',project.id);
  const cover=revisionedArtworkUrl(project.cover,previewRevision);
  const detail = project.award[lang] || PROJECT_CATEGORIES.find(item => item.id === project.category)?.label[lang];
  const status = projectVideoVersions(project)[0]?.videoUrl?.trim()
    ? (lang === 'en' ? 'Play' : '播放')
    : (lang === 'en' ? 'Pending upload' : '待上传');
  return (
    <CometCard className="comet-archive__item" enableTilt={false}
      onPointerEnter={() => warmImage(initialProjectPoster(project) || cover)}
      onPointerDownCapture={() => warmImage(initialProjectPoster(project) || cover)}
      onFocusCapture={() => warmImage(initialProjectPoster(project) || cover)}
      onClick={event => onClick(event, project)}>
      <button ref={cardRef} type="button" className="comet-archive__card" data-project-id={project.id} aria-haspopup="dialog"
        aria-label={[project.title[lang], detail, status].filter(Boolean).join(' · ')}
        style={{ '--comet-cover': `url(${cover})`, '--comet-cover-fit': project.featured ? 'cover' : 'contain' }}>
        <span className="comet-archive__image">
          <img className="comet-archive__cover" src={coverNear ? cover : undefined} alt="" width="600" height="800"
            loading={coverPriority === 'high' || coverPriority === 'normal' || (coverPriority === 'auto' && project.featured) ? 'eager' : 'lazy'}
            fetchPriority={coverPriority === 'normal' ? 'auto' : coverPriority} decoding="async"
            style={{ objectFit: project.featured ? 'cover' : 'contain' }} />
          <span className="comet-archive__play-badge" aria-hidden="true">{status}</span>
        </span>
        <strong className="comet-archive__title">{renderTitle(project.title[lang])}</strong>
        <span className="comet-archive__copy">
          <span className="comet-archive__details"><strong>{detail}</strong></span>
        </span>
      </button>
    </CometCard>
  );
}
