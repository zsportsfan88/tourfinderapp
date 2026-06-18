// api/callback.js — Vercel serverless function
// Spotify redirects here after user grants permission.
// We exchange the auth code for an access token, then redirect to the frontend.

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error || !code) {
    return res.redirect('/?error=access_denied');
  }

  const client_id     = process.env.SPOTIFY_CLIENT_ID;
  const client_secret = process.env.SPOTIFY_CLIENT_SECRET;
  const redirect_uri  = process.env.SPOTIFY_REDIRECT_URI;

  const credentials = Buffer.from(`${client_id}:${client_secret}`).toString('base64');

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type':  'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type:   'authorization_code',
        code,
        redirect_uri,
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenData.access_token) {
      console.error('Token exchange failed:', tokenData);
      return res.redirect('/?error=token_failed');
    }

    // Pass the token to the frontend via URL fragment (never hits server logs)
    const params = new URLSearchParams({
      access_token:  tokenData.access_token,
      refresh_token: tokenData.refresh_token || '',
      expires_in:    tokenData.expires_in || 3600,
    });

    res.redirect(`/?${params.toString()}`);
  } catch (err) {
    console.error('Callback error:', err);
    res.redirect('/?error=server_error');
  }
}
