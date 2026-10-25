import CometCard from './CometCard.jsx';
import './CometCard.css';
import './ProjectCard.css';
import { PROJECT_CATEGORIES } from '../data/projects.js';
import { warmImage } from '../utils/warmImage.js';

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

export default function ProjectCard({ project, lang, onClick }) {
  const detail = project.award[lang] || PROJECT_CATEGORIES.find(item => item.id === project.category)?.label[lang];
  const status = project.videoUrl?.trim()
    ? (lang === 'en' ? 'Play' : '播放')
    : (lang === 'en' ? 'Pending upload' : '待上传');
  return (
    <CometCard className="comet-archive__item" enableTilt={false}
      onPointerEnter={() => warmImage(project.playerPoster || project.cover)}
      onPointerDownCapture={() => warmImage(project.playerPoster || project.cover)}
      onFocusCapture={() => warmImage(project.playerPoster || project.cover)}
      onClick={event => onClick(event, project)}>
      <button type="button" className="comet-archive__card" aria-haspopup="dialog"
        aria-label={[project.title[lang], detail, status].filter(Boolean).join(' · ')}
        style={{ '--comet-cover': `url(${project.cover})`, '--comet-cover-fit': project.featured ? 'cover' : 'contain' }}>
        <span className="comet-archive__image">
          <img className="comet-archive__cover" src={project.cover} alt="" width="600" height="800"
            loading={project.featured ? 'eager' : 'lazy'} decoding="async"
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
