import express from 'express';
import fetch from 'node-fetch';
import Redis from 'ioredis';
import qs from 'qs';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { randomUUID } from 'crypto';
import { createPlaylistFromSeeds } from './playlistGenerator.js';

const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
const SPOTIFY_CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const SPOTIFY_CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;
const SPOTIFY_REDIRECT_URI = process.env.SPOTIFY_REDIRECT_URI || 'http://localhost:3000/callback';
const SETLISTFM_KEY = process.env.SETLISTFM_API_KEY;

function b64(s){ return Buffer.from(s).toString('base64'); }

// 1) Provide Spotify auth URL
app.get('/auth/url', (req, res) => {
  const state = randomUUID();
  const scope = [
    'user-top-read',
    'user-read-recently-played',
    'playlist-modify-private',
    'playlist-modify-public'
  ].join(' ');
  const q = qs.stringify({
    client_id: SPOTIFY_CLIENT_ID,
    response_type: 'code',
    redirect_uri: SPOTIFY_REDIRECT_URI,
    scope,
    state
  });
  res.json({ url: `https://accounts.spotify.com/authorize?${q}` });
});

// 2) Exchange code -> tokens
app.get('/auth/callback', async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).json({ error: 'No code' });

  const body = qs.stringify({ grant_type: 'authorization_code', code, redirect_uri: SPOTIFY_REDIRECT_URI });
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Authorization': `Basic ${b64(SPOTIFY_CLIENT_ID + ':' + SPOTIFY_CLIENT_SECRET)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });
  const data = await r.json();
  // PRODUCTION: store refresh_token server-side in a secure DB and set a secure httpOnly cookie/session.
  res.json(data);
});

// helper to call Spotify
async function spotifyFetch(accessToken, path, opts = {}){
  const url = path.startsWith('http') ? path : `https://api.spotify.com/v1${path}`;
  const r = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}`, ...(opts.headers||{}) }, ...opts });
  return r.json();
}

// helper to call Setlist.fm
async function setlistFetch(path){
  const url = path.startsWith('http') ? path : `https://api.setlist.fm/rest/1.0${path}`;
  const r = await fetch(url, { headers: { 'x-api-key': SETLISTFM_KEY, 'Accept': 'application/json', 'User-Agent': 'spotify-setlist-starter/1.0' } });
  return r.json();
}

// cached top tracks
app.get('/api/top-tracks', async (req, res) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'missing token' });
  const cacheKey = `top:${token.slice(0,8)}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));
  const data = await spotifyFetch(token, '/me/top/tracks?limit=50');
  await redis.set(cacheKey, JSON.stringify(data), 'EX', 60*10);
  res.json(data);
});

// setlist endpoint (artist by MusicBrainz id)
app.get('/api/setlists/artist/:mbid', async (req, res) => {
  const mbid = req.params.mbid;
  const cacheKey = `setlist:${mbid}`;
  const cached = await redis.get(cacheKey);
  if (cached) return res.json(JSON.parse(cached));
  const data = await setlistFetch(`/artist/${mbid}/setlists`);
  await redis.set(cacheKey, JSON.stringify(data), 'EX', 60*60*24);
  res.json(data);
});

// playlist generation
app.post('/api/generate', async (req, res) => {
  const { seeds } = req.body; // { artistId, setlistMbId, artistName }
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'missing token' });

  try {
    const playlist = await createPlaylistFromSeeds({ token, seeds, redis, spotifyFetch, setlistFetch });
    res.json({ playlist });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Server listening on ${PORT}`));
