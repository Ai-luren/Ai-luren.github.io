import { createPortal } from 'react-dom';
import MagneticProjectArchive from './components/MagneticProjectArchive.jsx';
import ImpactEvidence from './components/ImpactEvidence.jsx';
import VideoPostProcess from './components/VideoPostProcess.jsx';
import FloatingDock from './components/FloatingDock.jsx';
import ExperimentFlip from './components/ExperimentFlip.jsx';
import HeroActions from './components/HeroActions.jsx';
import HeroTitle from './components/HeroTitle.jsx';
import ExperienceGlareLayers from './components/ExperienceGlareLayers.jsx';
import './styles/card-surfaces.css';

export default function App() {
  const projectArchiveRoot = document.getElementById('projects-react-root');
  const impactEvidenceRoot = document.getElementById('recognition-react-root');
  const footerDockRoot = document.getElementById('footer-dock-react-root');
  const experimentRoot = document.getElementById('experiments-react-root');
  const heroActionsRoot = document.getElementById('hero-actions-react-root');
  const heroTitleRoot = document.getElementById('hero-title-react-root');

  return (
    <>
      <VideoPostProcess />
      {projectArchiveRoot && createPortal(<MagneticProjectArchive />, projectArchiveRoot)}
      {impactEvidenceRoot && createPortal(<ImpactEvidence />, impactEvidenceRoot)}
      {footerDockRoot && createPortal(<FloatingDock />, footerDockRoot)}
      {experimentRoot && createPortal(<ExperimentFlip />, experimentRoot)}
      {heroActionsRoot && createPortal(<HeroActions />, heroActionsRoot)}
      {heroTitleRoot && createPortal(<HeroTitle />, heroTitleRoot)}
      <ExperienceGlareLayers />
    </>
  );
}
