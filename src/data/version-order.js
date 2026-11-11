// Display order is independent of the immutable main/variant identity. The
// first visible version is the initial playback choice, not a file migration.
export function orderVideoVersions(versions = [], ids = []) {
  if (!Array.isArray(ids) || !ids.length) return [...versions];
  const positions = new Map(ids.map((id, index) => [id, index]));
  return [...versions].sort((a, b) =>
    (positions.get(a.id) ?? Infinity) - (positions.get(b.id) ?? Infinity));
}

export function projectVideoVersions(project) {
  if (!project) return [];
  const main = project.mainVersionArchived ? [] : [{
    id: 'main', label: project.mainVersionLabel || {zh: '主版本', en: 'Main version'},
    videoUrl: project.videoUrl, playerPoster: project.playerPoster,
    videoWidth: project.videoWidth, videoHeight: project.videoHeight, videoDuration: project.videoDuration,
  }];
  return orderVideoVersions([...main, ...(project.variants || [])], project.versionOrder);
}

export function initialProjectPoster(project) {
  return projectVideoVersions(project)[0]?.playerPoster || project?.cover;
}
