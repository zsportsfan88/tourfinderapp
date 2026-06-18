// api/login.js — Vercel serverless function
// Redirects the user to Spotify's OAuth authorization page

export default function handler(req, res) {
  const client_id = process.env.SPOTIFY_CLIENT_ID;
  const redirect_uri = process.env.SPOTIFY_REDIRECT_URI;

  const scope = 'user-library-read user-read-private';

  // Generate a random state string for CSRF protection
  const state = Math.random().toString(36).substring(2, 18);

  const params = new URLSearchParams({
    response_type: 'code',
    client_id,
    scope,
    redirect_uri,
    state,
  });

  res.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`);
}
