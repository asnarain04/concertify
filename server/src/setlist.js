// normalize setlist tracks returned by setlist.fm
export function extractTracksFromSetlist(setlistJson){
  const sets = setlistJson.setlist?.sets?.set || [];
  const tracks = [];
  for (const s of sets){
    const songs = s.song || [];
    for (const sng of songs){
      if (typeof sng === 'string') tracks.push({ name: sng });
      else tracks.push({ name: sng.name });
    }
  }
  return tracks;
}
