// helpers: map song titles -> spotify track ids, simple wrappers
import fetch from 'node-fetch';

export async function searchTrack(token, title, artist){
  const q = encodeURIComponent(`${title} ${artist || ''}`);
  const r = await fetch(`https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`, { headers: { Authorization: `Bearer ${token}` } });
  const j = await r.json();
  return j.tracks?.items?.[0] || null;
}
