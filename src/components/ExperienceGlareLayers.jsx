import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import GlareHover from './GlareHover.jsx';

export default function ExperienceGlareLayers() {
  const [panels, setPanels] = useState([]);
  useEffect(() => setPanels(Array.from(document.querySelectorAll('[data-experience-panel]'))), []);
  return panels.map((panel) => createPortal(
    <GlareHover
      className="experience-glare-layer"
      width="100%"
      height="100%"
      background="transparent"
      borderRadius="inherit"
      borderColor="transparent"
      glareColor="#ffffff"
      glareOpacity={0.16}
      glareAngle={-32}
      glareSize={220}
      transitionDuration={720}
      style={{ pointerEvents: 'none' }}
    />,
    panel,
    `experience-glare-${panel.dataset.experiencePanel}`,
  ));
}
