import useSWR from 'swr';

export default function Home(){
  const fetcher = (url) => fetch(url).then(r=>r.json());
  const { data: authUrl } = useSWR('http://localhost:4000/auth/url', fetcher);

  const login = () => { if (authUrl?.url) window.location = authUrl.url; };

  const generate = async () => {
    const token = localStorage.getItem('spotify_access_token');
    const res = await fetch('http://localhost:4000/api/generate', { method: 'POST', headers: { 'Content-Type':'application/json', 'Authorization': 'Bearer '+token }, body: JSON.stringify({ seeds: { artistId: '3TVXtAsR1Inumwj472S9r4' } }) });
    const j = await res.json();
    console.log('playlist', j.playlist);
    alert('playlist generated — see devtools');
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Spotify + Setlist Starter</h1>
      <button onClick={login}>Login with Spotify</button>
      <button onClick={generate}>Generate Demo Playlist</button>
    </div>
  );
}
