import { createPortal } from 'react-dom';
import { useRef, useState } from 'react';
import CinemaPlayer from './components/CinemaPlayer.jsx';
import { FEATURED_PROJECTS } from './data/projects.js';
import { prepareProjectPoster } from './utils/warmImage.js';
import MagneticProjectArchive from './components/MagneticProjectArchive.jsx';
import ImpactEvidence from './components/ImpactEvidence.jsx';
import VideoPostProcess from './components/VideoPostProcess.jsx';
import FloatingDock from './components/FloatingDock.jsx';
import ExperimentFlip from './components/ExperimentFlip.jsx';
import HeroActions from './components/HeroActions.jsx';
import HeroTitle from './components/HeroTitle.jsx';
import DesktopPrimaryNavigation from './components/DesktopPrimaryNavigation.jsx';
import './styles/card-surfaces.css';
import './styles/apple-system.css';
import './navigation/inputModality.js';
import './styles/navigation.css';

export default function App() {
  const [selectedProject, setSelectedProject] = useState(null);
  const cinemaReturnFocusRef = useRef(null);
  const selectionTokenRef = useRef(0);
  const selectFeaturedProject = async (project, trigger) => {
    const token = ++selectionTokenRef.current;
    if (!trigger?.isConnected) return;
    cinemaReturnFocusRef.current = trigger;
    const prepared = await prepareProjectPoster(project);
    // A second click or a swipe may have superseded this image request.
    if (token !== selectionTokenRef.current || !trigger.isConnected) return;
    setSelectedProject(prepared);
  };
  const projectArchiveRoot = document.getElementById('projects-react-root');
  const impactEvidenceRoot = document.getElementById('recognition-react-root');
  const footerDockRoot = document.getElementById('footer-dock-react-root');
  const experimentRoot = document.getElementById('experiments-react-root');
  const heroActionsRoot = document.getElementById('hero-actions-react-root');
  const heroTitleRoot = document.getElementById('hero-title-react-root');
  const desktopNavRoot = document.getElementById('desktop-primary-nav-root');

  return (
    <>
      <VideoPostProcess />
      {projectArchiveRoot && createPortal(<MagneticProjectArchive onSelect={selectFeaturedProject} />, projectArchiveRoot)}
      <CinemaPlayer key={selectedProject ? 'open' : 'closed'} project={selectedProject} projects={FEATURED_PROJECTS} returnFocusRef={cinemaReturnFocusRef} onSelect={setSelectedProject} onClose={() => setSelectedProject(null)} />
      {impactEvidenceRoot && createPortal(<ImpactEvidence />, impactEvidenceRoot)}
      {footerDockRoot && createPortal(<FloatingDock />, footerDockRoot)}
      {experimentRoot && createPortal(<ExperimentFlip />, experimentRoot)}
      {heroActionsRoot && createPortal(<HeroActions />, heroActionsRoot)}
      {heroTitleRoot && createPortal(<HeroTitle />, heroTitleRoot)}
      {desktopNavRoot && createPortal(<DesktopPrimaryNavigation />, desktopNavRoot)}
    </>
  );
}
