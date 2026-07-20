import './GlareHover.css';

const GlareHover = ({
  width = '500px', height = '500px', background = '#000', borderRadius = '10px', borderColor = '#333', children,
  glareColor = '#ffffff', glareOpacity = 0.5, glareAngle = -45, glareSize = 250, transitionDuration = 650,
  playOnce = false, className = '', style = {},
}) => {
  const hex = glareColor.replace('#', '');
  let rgba = glareColor;
  if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
    rgba = `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${glareOpacity})`;
  } else if (/^[0-9A-Fa-f]{3}$/.test(hex)) {
    rgba = `rgba(${parseInt(hex[0] + hex[0], 16)}, ${parseInt(hex[1] + hex[1], 16)}, ${parseInt(hex[2] + hex[2], 16)}, ${glareOpacity})`;
  }
  const vars = {
    '--gh-width': width, '--gh-height': height, '--gh-bg': background, '--gh-br': borderRadius,
    '--gh-angle': `${glareAngle}deg`, '--gh-duration': `${transitionDuration}ms`, '--gh-size': `${glareSize}%`,
    '--gh-rgba': rgba, '--gh-border': borderColor,
  };
  return <div className={`glare-hover ${playOnce ? 'glare-hover--play-once' : ''} ${className}`.trim()} style={{ ...vars, ...style }}>{children}</div>;
};

export default GlareHover;
