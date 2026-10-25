// Shared input-modality hint for the navigation capsule on touch devices.
// Viewers still focus Close on open so keyboard/focus traps work. Some mobile
// engines show :focus-visible for that programmatic focus after a tap.
// Suppress only the decorative ring after real touch; restore it as soon as
// a hardware keyboard is used (including on a phone/tablet).
const root = document.documentElement;

const touchInput = () => { root.dataset.navInput = 'touch'; };
const keyboardInput = (event) => {
  if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock'].includes(event.key)) return;
  delete root.dataset.navInput;
};

document.addEventListener('pointerdown', (event) => {
  if (event.pointerType === 'touch' || event.pointerType === 'pen') touchInput();
  else delete root.dataset.navInput;
}, true);
document.addEventListener('touchstart', touchInput, { capture: true, passive: true });
document.addEventListener('keydown', keyboardInput, true);
