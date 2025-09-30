import { searchTrack } from './spotify.js';
import { extractTracksFromSetlist } from './setlist.js';

// build candidate pool and score by audio-features similarity + popularity
export async function createPlaylistFromSeeds({ token, seeds, redis, spotifyFetch, setlistFetch }){
  // 1) user top tracks -> mean audio feature vector
  const top = await spotifyFetch(token, '/me/top/tracks?limit=20');
  const topIds = (top.items || []).map(t=>t.id);
  let features = { audio_features: [] };
  if (topIds.length) features = await spotifyFetch(token, `/audio-features?ids=${topIds.join(',')}`);
  const userVec = meanFeature(features.audio_features || []);

  // 2) candidates: Spotify recommendations + setlist mapped to tracks
  const recs = (await spotifyFetch(token, `/recommendations?limit=50&seed_artists=${seeds.artistId || ''}`)).tracks || [];
  let candidates = recs;

  if (seeds.setlistMbId){
    const sl = await setlistFetch(`/setlist/${seeds.setlistMbId}`);
    const slTracks = extractTracksFromSetlist(sl);
    for (const t of slTracks){
      const found = await searchTrack(token, t.name, seeds.artistName);
      if (found) candidates.push(found);
    }
  }

  // dedupe
  const seen = new Set();
  candidates = candidates.filter(c => { if (!c.id) return false; if (seen.has(c.id)) return false; seen.add(c.id); return true; });

  // audio-features batch fetch
  const ids = candidates.map(c=>c.id);
  const chunk = (arr, n) => arr.length ? [arr.slice(0,n), ...chunk(arr.slice(n), n)] : [];
  const groups = chunk(ids, 100);
  const featMap = {};
  for (const g of groups){
    const resp = await spotifyFetch(token, `/audio-features?ids=${g.join(',')}`);
    for (const f of resp.audio_features || []) if (f) featMap[f.id] = f;
  }

  // scoring
  const scored = candidates.map(t => ({ t, score: scoreByFeature(userVec, featMap[t.id]) }));
  scored.sort((a,b)=>b.score-a.score);
  const playlist = scored.slice(0,30).map(s=>({ id: s.t.id, name: s.t.name, artists: s.t.artists.map(a=>a.name).join(', '), uri: s.t.uri }));
  return playlist;
}

function meanFeature(arr){
  if (!arr.length) return null;
  const keys = ['danceability','energy','valence','tempo'];
  const out = {};
  for (const k of keys) out[k] = arr.reduce((s,v)=>s + (v[k]||0), 0)/arr.length;
  return out;
}

function scoreByFeature(user, feat){
  if (!user || !feat) return feat?.popularity || 50;
  const d = Math.abs((feat.danceability||0)-user.danceability) + Math.abs((feat.energy||0)-user.energy) + Math.abs((feat.valence||0)-user.valence);
  return (feat.popularity || 50) * 0.6 + (1 - Math.min(d,3)/3) * 40;
}
