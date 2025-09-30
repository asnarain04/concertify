import { useEffect } from 'react';
import { useRouter } from 'next/router';

export default function Callback(){
  const router = useRouter();
  useEffect(()=>{
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (!code) return;
    fetch(`http://localhost:4000/auth/callback?code=${encodeURIComponent(code)}`)
      .then(r=>r.json())
      .then(j=>{
        // Demo-only: store access token locally. PRODUCTION: store refresh_token server-side and set httpOnly session cookie.
        localStorage.setItem('spotify_access_token', j.access_token);
        router.push('/');
      });
  },[]);
  return <div>Authenticating...</div>;
}
