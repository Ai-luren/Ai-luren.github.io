// The film viewer is the heaviest optional interaction on either portfolio page.
// Load on user intent (pointer, touch, focus), never during the initial Hero
// or gallery paint. React.lazy uses this same cached promise on first open.
let promise;
export function loadCinemaPlayer() {
  if (!promise) {
    promise = import('./CinemaPlayer.jsx').catch(error => {
      promise = null; // allow a later attempt if an intermittent network fails
      throw error;
    });
  }
  return promise;
}
export function warmCinemaPlayer() {
  // Intent prefetch must never create an unhandled rejection.
  void loadCinemaPlayer().catch(() => {});
}
