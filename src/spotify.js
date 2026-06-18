// src/spotify.js
// Fetches the user's liked songs library and aggregates by artist.
// Paginates through up to 500 tracks (10 pages of 50).

const MAX_PAGES = 200;

export async function fetchTopArtists(accessToken) {
  let artists = {};
  let url = 'https://api.spotify.com/v1/me/tracks?limit=50';
  let pages = 0;

  while (url && pages < MAX_PAGES) {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      console.error('Spotify API error:', res.status);
      break;
    }

    const data = await res.json();

    for (const item of data.items || []) {
      const track = item.track;
      if (!track) continue;

      for (const artist of track.artists || []) {
        if (!artists[artist.id]) {
          artists[artist.id] = {
            id:        artist.id,
            name:      artist.name,
            likedSongs: 0,
            image:     null,
            genres:    [],
          };
        }
        artists[artist.id].likedSongs++;
      }
    }

    url = data.next || null;
    pages++;
  }

  // Sort by liked song count, take top 20
  const sorted = Object.values(artists)
    .sort((a, b) => b.likedSongs - a.likedSongs)
    .slice(0, 100);

  // Fetch genres + images for top artists (batch by 50)
  await enrichArtists(sorted, accessToken);

  return sorted;
}

async function enrichArtists(artists, accessToken) {
  const ids = artists.map(a => a.id).join(',');
  const res = await fetch(`https://api.spotify.com/v1/artists?ids=${ids}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) return;

  const data = await res.json();

  for (const fullArtist of data.artists || []) {
    const match = artists.find(a => a.id === fullArtist.id);
    if (!match) continue;
    match.genres = fullArtist.genres?.slice(0, 2) || [];
    match.image  = fullArtist.images?.[1]?.url || fullArtist.images?.[0]?.url || null;
  }
}
