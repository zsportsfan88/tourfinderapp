const MAX_TRACKS = 10000;
const BATCH_SIZE = 10;

export async function fetchTopArtists(accessToken) {
  const first = await fetch('https://api.spotify.com/v1/me/tracks?limit=1', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const firstData = await first.json();
  const total = Math.min(firstData.total || 0, MAX_TRACKS);

  const offsets = [];
  for (let i = 0; i < total; i += 50) offsets.push(i);

  let artists = {};
  for (let i = 0; i < offsets.length; i += BATCH_SIZE) {
    const batch = offsets.slice(i, i + BATCH_SIZE);
    const results = await Promise.all(batch.map(offset =>
      fetch(`https://api.spotify.com/v1/me/tracks?limit=50&offset=${offset}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      }).then(r => r.json())
    ));
    for (const data of results) {
      for (const item of data.items || []) {
        const track = item.track;
        if (!track) continue;
        for (const artist of track.artists || []) {
          if (!artists[artist.id]) {
            artists[artist.id] = { id: artist.id, name: artist.name, likedSongs: 0, image: null, genres: [] };
          }
          artists[artist.id].likedSongs++;
        }
      }
    }
  }

  const sorted = Object.values(artists)
    .sort((a, b) => b.likedSongs - a.likedSongs)
    .slice(0, 100);

  // Enrich in batches of 50 (Spotify API limit)
  await enrichArtists(sorted, accessToken);
  return sorted;
}

async function enrichArtists(artists, accessToken) {
  // Spotify only allows 50 IDs at a time
  for (let i = 0; i < artists.length; i += 50) {
    const batch = artists.slice(i, i + 50);
    const ids = batch.map(a => a.id).join(',');
    const res = await fetch(`https://api.spotify.com/v1/artists?ids=${ids}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) continue;
    const data = await res.json();
    for (const fullArtist of data.artists || []) {
      const match = batch.find(a => a.id === fullArtist.id);
      if (!match) continue;
      match.genres = fullArtist.genres?.slice(0, 2) || [];
      match.image = fullArtist.images?.[1]?.url || fullArtist.images?.[0]?.url || null;
    }
  }
}
