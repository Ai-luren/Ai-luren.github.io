import { createPortal } from 'react-dom';
import MagneticProjectArchive from './components/MagneticProjectArchive.jsx';
import ImpactEvidence from './components/ImpactEvidence.jsx';
import VideoPostProcess from './components/VideoPostProcess.jsx';
import './styles/card-surfaces.css';

export default function App() {
  const projectArchiveRoot = document.getElementById('projects-react-root');
  const impactEvidenceRoot = document.getElementById('recognition-react-root');

  return (
    <>
      <VideoPostProcess />
      {projectArchiveRoot && createPortal(<MagneticProjectArchive />, projectArchiveRoot)}
      {impactEvidenceRoot && createPortal(<ImpactEvidence />, impactEvidenceRoot)}
    </>
  );
}
