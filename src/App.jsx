import { createPortal } from 'react-dom';
import { lazy, Suspense, useRef, useState } from 'react';
import { loadCinemaPlayer, warmCinemaPlayer } from './components/lazyCinemaPlayer.js';
import { FEATURED_PROJECTS, PROJECTS } from './data/projects.js';
import { prepareProjectPoster } from './utils/warmImage.js';
import MagneticProjectArchive from './components/MagneticProjectArchive.jsx';
import ImpactEvidence from './components/ImpactEvidence.jsx';
import FloatingDock from './components/FloatingDock.jsx';
import MobileMenuSocialLinks from './components/MobileMenuSocialLinks.jsx';
import SiteExternalLinkGuard from './components/SiteExternalLinkGuard.jsx';
import ExperimentFlip from './components/ExperimentFlip.jsx';
import HeroActions from './components/HeroActions.jsx';
import HeroTitle from './components/HeroTitle.jsx';
import AnimatedContent from './components/AnimatedContent.jsx';
import DesktopPrimaryNavigation from './components/DesktopPrimaryNavigation.jsx';
import './styles/card-surfaces.css';
import './styles/apple-system.css';
import './navigation/inputModality.js';
import './styles/navigation.css';

// Keep React.lazy identity stable across page renders and project switching.
const CinemaPlayer = lazy(loadCinemaPlayer);

export default function App() {
  const [selectedProject, setSelectedProject] = useState(null);
  const cinemaReturnFocusRef = useRef(null);
  const selectionTokenRef = useRef(0);
  const selectFeaturedProject = async (project, trigger) => {
    const token = ++selectionTokenRef.current;
    if (!trigger?.isConnected) return;
    cinemaReturnFocusRef.current = trigger;
    const [prepared] = await Promise.all([prepareProjectPoster(project), loadCinemaPlayer()]);
    // A second click or a swipe may have superseded this image request.
    if (token !== selectionTokenRef.current || !trigger.isConnected) return;
    setSelectedProject(prepared);
  };
  const projectArchiveRoot = document.getElementById('projects-react-root');
  const impactEvidenceRoot = document.getElementById('recognition-react-root');
  const footerDockRoot = document.getElementById('footer-dock-react-root');
  const mobileMenuSocialRoot = document.getElementById('mobile-menu-social-root');
  const experimentRoot = document.getElementById('experiments-react-root');
  const heroActionsRoot = document.getElementById('hero-actions-react-root');
  const heroTitleRoot = document.getElementById('hero-title-react-root');
  const desktopNavRoot = document.getElementById('desktop-primary-nav-root');

  return (
    <>
      <SiteExternalLinkGuard />
      <AnimatedContent page="home" />
      {projectArchiveRoot && createPortal(<MagneticProjectArchive onSelect={selectFeaturedProject} onViewerIntent={warmCinemaPlayer} />, projectArchiveRoot)}
      {selectedProject && <Suspense fallback={null}>
        <CinemaPlayer key="open" project={selectedProject} projects={FEATURED_PROJECTS} allProjects={PROJECTS} featuredProjects={FEATURED_PROJECTS} returnFocusRef={cinemaReturnFocusRef} onSelect={setSelectedProject} onClose={() => setSelectedProject(null)} />
      </Suspense>}
      {impactEvidenceRoot && createPortal(<ImpactEvidence />, impactEvidenceRoot)}
      {footerDockRoot && createPortal(<FloatingDock />, footerDockRoot)}
      {mobileMenuSocialRoot && createPortal(<MobileMenuSocialLinks />, mobileMenuSocialRoot)}
      {experimentRoot && createPortal(<ExperimentFlip />, experimentRoot)}
      {heroActionsRoot && createPortal(<HeroActions />, heroActionsRoot)}
      {heroTitleRoot && createPortal(<HeroTitle />, heroTitleRoot)}
      {desktopNavRoot && createPortal(<DesktopPrimaryNavigation />, desktopNavRoot)}
    </>
  );
}
