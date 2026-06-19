import { useState, useEffect, useMemo } from "react";
import { fetchTopArtists } from "./spotify.js";

const TM_API_KEY = "zJUvSRwFFL8C29KJDGqC76eO1HmP5Xbl";

async function fetchTicketmasterShows(artistName, userLat, userLon, radiusMiles) {
  try {
    // Step 1: Find the artist's Ticketmaster attraction ID
    const attractionRes = await fetch(
      `https://app.ticketmaster.com/discovery/v2/attractions.json?apikey=${TM_API_KEY}&keyword=${encodeURIComponent(artistName)}&size=1`
    );
    if (!attractionRes.ok) return [];
    const attractionData = await attractionRes.json();
    const attractions = attractionData._embedded?.attractions;
    if (!attractions?.length) return [];
    const attractionId = attractions[0].id;

    // Step 2: Find upcoming events for that artist near the user
    const eventsRes = await fetch(
      `https://app.ticketmaster.com/discovery/v2/events.json?apikey=${TM_API_KEY}&attractionId=${attractionId}&latlong=${userLat},${userLon}&radius=${radiusMiles}&unit=miles&sort=date,asc&size=5&classificationName=music`
    );
    if (!eventsRes.ok) return [];
    const eventsData = await eventsRes.json();
    const events = eventsData._embedded?.events;
    if (!events?.length) return [];

    return events.map(ev => {
      const venue = ev._embedded?.venues?.[0] || {};
      return {
        id: ev.id,
        name: ev.name,
        datetime: ev.dates?.start?.dateTime || ev.dates?.start?.localDate,
        venue: {
          name: venue.name || "",
          city: venue.city?.name || "",
          region: venue.state?.stateCode || "",
          latitude: venue.location?.latitude,
          longitude: venue.location?.longitude,
        },
        ticketUrl: ev.url,
        imageUrl: ev.images?.find(i => i.ratio === "16_9" && i.width > 500)?.url,
      };
    });
  } catch (e) {
    console.error("TM error for", artistName, e);
    return [];
  }
}

async function zipToCoords(zip) {
  try {
    const res = await fetch(`https://api.zippopotam.us/us/${zip}`);
    if (!res.ok) return null;
    const data = await res.json();
    const place = data.places?.[0];
    if (!place) return null;
    return {
      lat: parseFloat(place.latitude),
      lon: parseFloat(place.longitude),
      city: `${place["place name"]}, ${place["state abbreviation"]}`,
    };
  } catch { return null; }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos((lat1*Math.PI)/180)*Math.cos((lat2*Math.PI)/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

const genreColor = (genre = "") => {
  if (genre.includes("country"))  return "#c8a96e";
  if (genre.includes("rock"))     return "#e07060";
  if (genre.includes("hip") || genre.includes("rap")) return "#9b8ec4";
  if (genre.includes("pop"))      return "#5eb8a0";
  if (genre.includes("r&b") || genre.includes("soul")) return "#e88dc0";
  if (genre.includes("indie") || genre.includes("alt")) return "#60a8d0";
  if (genre.includes("folk") || genre.includes("acoustic")) return "#a0c878";
  if (genre.includes("metal"))    return "#cc6644";
  if (genre.includes("jazz") || genre.includes("blues")) return "#70b8c0";
  if (genre.includes("electronic") || genre.includes("edm")) return "#8080e0";
  if (genre.includes("reggae"))   return "#60c080";
  return "#8899aa";
};

const genreLabel = (genre = "") => {
  if (!genre) return "Music";
  if (genre.includes("country"))  return "Country";
  if (genre.includes("rock"))     return "Rock";
  if (genre.includes("hip") || genre.includes("rap")) return "Hip-Hop";
  if (genre.includes("pop"))      return "Pop";
  if (genre.includes("r&b") || genre.includes("soul")) return "R&B";
  if (genre.includes("indie"))    return "Indie";
  if (genre.includes("alt"))      return "Alternative";
  if (genre.includes("folk") || genre.includes("acoustic")) return "Folk";
  if (genre.includes("metal"))    return "Metal";
  if (genre.includes("jazz"))     return "Jazz";
  if (genre.includes("reggae"))   return "Reggae";
  if (genre.includes("electronic") || genre.includes("edm")) return "Electronic";
  return genre.split(" ")[0].charAt(0).toUpperCase() + genre.split(" ")[0].slice(1);
};

function ShowCard({ show, accentColor, userCoords }) {
  const dateStr = show.datetime
    ? new Date(show.datetime).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "Date TBD";

  const dist = userCoords && show.venue.latitude && show.venue.longitude
    ? Math.round(haversineDistance(userCoords.lat, userCoords.lon, parseFloat(show.venue.latitude), parseFloat(show.venue.longitude)))
    : null;

  return (
    <div style={{
      background: "#0c0c18", border: `1px solid ${accentColor}33`,
      borderRadius: 9, overflow: "hidden", marginBottom: 8,
    }}>
      {show.imageUrl && (
        <img src={show.imageUrl} alt={show.name} style={{ width: "100%", height: 120, objectFit: "cover", opacity: 0.7 }} />
      )}
      <div style={{ padding: "12px 14px" }}>
        <div style={{ color: "#fff", fontWeight: 700, fontSize: 13, marginBottom: 4, fontFamily: "'Inter', sans-serif" }}>
          {show.name}
        </div>
        <div style={{ color: accentColor, fontSize: 12, marginBottom: 4, fontFamily: "monospace" }}>
          {dateStr}
        </div>
        <div style={{ color: "#556677", fontSize: 12, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}>
          <span>{[show.venue.name, show.venue.city, show.venue.region].filter(Boolean).join(" · ")}</span>
          {dist !== null && (
            <span style={{ background: "#1a2a3a", color: "#4d90c0", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
              {dist} mi
            </span>
          )}
        </div>
        <a href={show.ticketUrl} target="_blank" rel="noopener noreferrer" style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          background: "#026cdf", color: "#fff",
          borderRadius: 6, padding: "7px 14px",
          fontSize: 12, fontWeight: 700, textDecoration: "none",
          fontFamily: "'Inter', sans-serif",
        }}>
          🎟 Buy Tickets on Ticketmaster
        </a>
      </div>
    </div>
  );
}

function ArtistCard({ artist, selected, onClick }) {
  const accent = genreColor(artist.genres?.[0] || "");
  return (
    <button onClick={onClick} style={{
      background: selected ? "#14142a" : "#0c0c18",
      border: `1.5px solid ${selected ? accent : "#1e1e30"}`,
      borderRadius: 10, padding: "11px 13px",
      cursor: "pointer", textAlign: "left",
      transition: "border-color 0.15s, background 0.15s",
      position: "relative", overflow: "hidden",
    }}>
      {selected && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {artist.image
          ? <img src={artist.image} alt={artist.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${accent}44` }} />
          : <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${accent}22`, border: `1px solid ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🎵</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: selected ? "#fff" : "#bbc", fontFamily: "'Inter', sans-serif", fontWeight: 600, fontSize: 13, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {artist.name}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 3 }}>
            {artist.genres?.[0] && (
              <span style={{ background: `${accent}22`, color: accent, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>
                {genreLabel(artist.genres[0])}
              </span>
            )}
            <span style={{ color: "#445566", fontSize: 10, fontFamily: "monospace" }}>{artist.likedSongs} ♥</span>
          </div>
        </div>
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: selected ? accent : "#222233", flexShrink: 0, boxShadow: selected ? `0 0 6px ${accent}88` : "none" }} />
      </div>
    </button>
  );
}

function GenreFilterBar({ genres, activeGenre, onChange }) {
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
      {["All", ...genres].map(g => {
        const active = g === activeGenre;
        const color = g === "All" ? "#8899aa" : genreColor(g.toLowerCase());
        return (
          <button key={g} onClick={() => onChange(g)} style={{
            background: active ? `${color}22` : "#0c0c18",
            border: `1px solid ${active ? color : "#1e1e30"}`,
            color: active ? color : "#5566aa",
            borderRadius: 20, padding: "5px 13px",
            fontSize: 11, fontWeight: active ? 700 : 400,
            cursor: "pointer", fontFamily: "'Inter', sans-serif",
          }}>{g}</button>
        );
      })}
    </div>
  );
}

export default function App() {
  const [phase, setPhase]               = useState("connect");
  const [spotifyUser, setSpotifyUser]   = useState(null);
  const [artists, setArtists]           = useState([]);
  const [spotifyError, setSpotifyError] = useState(null);
  const [selectedArtists, setSelectedArtists] = useState(new Set());
  const [activeGenre, setActiveGenre]   = useState("All");
  const [zip, setZip]                   = useState("");
  const [zipError, setZipError]         = useState("");
  const [loading, setLoading]           = useState(false);
  const [loadingMsg, setLoadingMsg]     = useState("");
  const [results, setResults]           = useState([]);
  const [userCoords, setUserCoords]     = useState(null);
  const [radiusMiles, setRadiusMiles]   = useState(100);
  const [sortBy, setSortBy]             = useState("date");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("access_token");
    const error  = params.get("error");
    if (error) { setSpotifyError("Spotify login failed. Please try again."); window.history.replaceState({}, "", "/"); return; }
    if (token) {
      window.history.replaceState({}, "", "/");
      setPhase("loading");
      Promise.all([
        fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json()),
        fetchTopArtists(token),
      ])
        .then(([user, topArtists]) => {
          setSpotifyUser(user);
          setArtists(topArtists);
          setSelectedArtists(new Set(topArtists.map(a => a.id)));
          setPhase("artists");
        })
        .catch(() => { setSpotifyError("Couldn't load your Spotify data. Please try again."); setPhase("connect"); });
    }
  }, []);

  const genreList = useMemo(() => {
    const labels = new Set(artists.flatMap(a => (a.genres || []).map(g => genreLabel(g))));
    return Array.from(labels).filter(g => g !== "Music");
  }, [artists]);

  const filteredArtists = activeGenre === "All"
    ? artists
    : artists.filter(a => (a.genres || []).some(g => genreLabel(g) === activeGenre));

  const toggleArtist = (id) => setSelectedArtists(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const handleFindShows = async () => {
    if (zip.length !== 5 || isNaN(zip)) { setZipError("Enter a valid 5-digit ZIP code."); return; }
    setZipError("");
    setLoading(true);
    setLoadingMsg("Looking up your location…");

    const coords = await zipToCoords(zip);
    if (!coords) { setZipError("Couldn't find that ZIP. Try another."); setLoading(false); return; }
    setUserCoords(coords);

    const selected = artists.filter(a => selectedArtists.has(a.id));
    const allResults = [];

    for (let i = 0; i < selected.length; i++) {
      const artist = selected[i];
      setLoadingMsg(`Checking ${artist.name}… (${i + 1}/${selected.length})`);
      const shows = await fetchTicketmasterShows(artist.name, coords.lat, coords.lon, radiusMiles);
      if (shows.length > 0) {
        allResults.push({ artist, shows });
      }
      // Ticketmaster rate limit: 5 req/sec, we do 2 per artist so wait 400ms
      await new Promise(r => setTimeout(r, 400));
    }

    setResults(allResults);
    setPhase("results");
    setLoading(false);
  };

  // Flatten + sort for date view
  const sortedResults = useMemo(() => {
    if (sortBy === "artist") return results;
    const flat = results.flatMap(({ artist, shows }) => shows.map(show => ({ artist, show })));
    if (sortBy === "date") flat.sort((a, b) => new Date(a.show.datetime) - new Date(b.show.datetime));
    if (sortBy === "distance" && userCoords) {
      flat.sort((a, b) => {
        const d = (s) => s.venue.latitude ? haversineDistance(userCoords.lat, userCoords.lon, parseFloat(s.venue.latitude), parseFloat(s.venue.longitude)) : 9999;
        return d(a.show) - d(b.show);
      });
    }
    return flat;
  }, [results, sortBy, userCoords]);

  const totalShows = results.reduce((sum, r) => sum + r.shows.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", fontFamily: "'Inter', sans-serif", color: "#ccd" }}>

      {/* Header */}
      <div style={{ borderBottom: "1px solid #141420", padding: "13px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#07070f", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg, #1db954, #116b32)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎸</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "-0.3px" }}>TourFinder</div>
            <div style={{ color: "#223344", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Spotify + Ticketmaster</div>
          </div>
        </div>
        {spotifyUser && (
          <div style={{ color: "#334455", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1db954" }} />
            {spotifyUser.display_name}
          </div>
        )}
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "26px 16px" }}>

        {/* CONNECT */}
        {phase === "connect" && (
          <div style={{ textAlign: "center", paddingTop: 36 }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #1db95420, #1db95440)", border: "1.5px solid #1db95450", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🎵</div>
            <h1 style={{ color: "#fff", fontSize: 23, fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 10px" }}>Your music. Live, near you.</h1>
            <p style={{ color: "#334455", fontSize: 13, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 26px" }}>
              Connect your Spotify to see which of your most-liked artists are performing near you — with direct Ticketmaster links to buy tickets.
            </p>
            {spotifyError && (
              <div style={{ background: "#200a0a", border: "1px solid #cc444433", borderRadius: 8, padding: "10px 14px", color: "#cc6666", fontSize: 12, maxWidth: 340, margin: "0 auto 16px" }}>
                {spotifyError}
              </div>
            )}
            <a href="/api/login" style={{ display: "inline-block", background: "#1db954", color: "#000", borderRadius: 50, padding: "12px 32px", fontSize: 14, fontWeight: 800, textDecoration: "none" }}>
              Connect Spotify
            </a>
          </div>
        )}

        {/* LOADING SPOTIFY */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 20 }}>🎵</div>
            <div style={{ color: "#dde", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Loading your library…</div>
            <div style={{ color: "#334455", fontSize: 12 }}>Reading liked songs and building your artist list</div>
          </div>
        )}

        {/* ARTISTS */}
        {phase === "artists" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0a180a", border: "1px solid #1db95430", borderRadius: 5, padding: "3px 9px", marginBottom: 12 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1db954" }} />
                <span style={{ color: "#1db954", fontSize: 10, fontWeight: 700 }}>Spotify Connected</span>
              </div>
              <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Your top artists</h2>
              <p style={{ color: "#334455", fontSize: 12, margin: 0 }}>Ranked by liked songs. Filter by genre or deselect before searching.</p>
            </div>

            <GenreFilterBar genres={genreList} activeGenre={activeGenre} onChange={setActiveGenre} />

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(195px, 1fr))", gap: 9, marginBottom: 22 }}>
              {filteredArtists.map(a => (
                <ArtistCard key={a.id} artist={a} selected={selectedArtists.has(a.id)} onClick={() => toggleArtist(a.id)} />
              ))}
              {filteredArtists.length === 0 && (
                <div style={{ gridColumn: "1/-1", color: "#2a3d50", fontSize: 13, padding: "20px 0", textAlign: "center" }}>No artists in this genre.</div>
              )}
            </div>

            <div style={{ background: "#0c0c18", border: "1px solid #1a1a2a", borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ color: "#445566", fontSize: 11, marginBottom: 12 }}>{selectedArtists.size} artist{selectedArtists.size !== 1 ? "s" : ""} selected</div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ color: "#334455", fontSize: 10, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>ZIP Code</label>
                  <input type="text" maxLength={5} value={zip}
                    onChange={e => { setZip(e.target.value.replace(/\D/g, "")); setZipError(""); }}
                    placeholder="e.g. 91601"
                    style={{ width: "100%", background: "#07070f", border: `1px solid ${zipError ? "#cc4444" : "#1e1e30"}`, borderRadius: 7, padding: "9px 11px", color: "#dde", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                  />
                  {zipError && <div style={{ color: "#cc5555", fontSize: 11, marginTop: 4 }}>{zipError}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ color: "#334455", fontSize: 10, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Radius: {radiusMiles} mi</label>
                  <input type="range" min={25} max={300} step={25} value={radiusMiles}
                    onChange={e => setRadiusMiles(Number(e.target.value))}
                    style={{ width: "100%", accentColor: "#1db954", marginTop: 10 }}
                  />
                </div>
              </div>
              <button onClick={handleFindShows} disabled={loading || selectedArtists.size === 0} style={{
                width: "100%", padding: "11px",
                background: selectedArtists.size === 0 ? "#141420" : "#1db954",
                color: selectedArtists.size === 0 ? "#223" : "#000",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800,
                cursor: selectedArtists.size === 0 ? "not-allowed" : "pointer",
              }}>{loading ? loadingMsg : "Find Shows Near Me →"}</button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {phase === "results" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => setPhase("artists")} style={{ background: "none", border: "1px solid #1e1e30", color: "#334455", borderRadius: 6, padding: "6px 11px", fontSize: 11, cursor: "pointer", marginTop: 2, flexShrink: 0 }}>← Back</button>
              <div>
                <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: "0 0 2px", letterSpacing: "-0.3px" }}>
                  {totalShows > 0
                    ? `${totalShows} show${totalShows !== 1 ? "s" : ""} from ${results.length} artist${results.length !== 1 ? "s" : ""} near ${userCoords?.city}`
                    : `No shows found near ${userCoords?.city}`}
                </h2>
                <div style={{ color: "#223344", fontSize: 11 }}>Within {radiusMiles} mi · Ticketmaster · Direct ticket links</div>
              </div>
            </div>

            {totalShows === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", background: "#0c0c18", border: "1px solid #1a1a2a", borderRadius: 12 }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>🎸</div>
                <div style={{ color: "#334455", fontSize: 13, marginBottom: 16 }}>No Ticketmaster shows found within {radiusMiles} miles. Try a wider radius.</div>
                <button onClick={() => setPhase("artists")} style={{ background: "#141420", border: "1px solid #1e1e30", color: "#5566aa", borderRadius: 7, padding: "9px 18px", fontSize: 12, cursor: "pointer" }}>
                  Adjust radius →
                </button>
              </div>
            ) : (
              <>
                {/* Sort bar */}
                <div style={{ display: "flex", gap: 1, background: "#0c0c18", border: "1px solid #1e1e30", borderRadius: 8, padding: 3, width: "fit-content", marginBottom: 16 }}>
                  {[["date","Date"],["distance","Distance"],["artist","Artist"]].map(([key, label]) => (
                    <button key={key} onClick={() => setSortBy(key)} style={{
                      background: sortBy === key ? "#1e1e38" : "none", border: "none",
                      color: sortBy === key ? "#fff" : "#445566",
                      borderRadius: 6, padding: "5px 12px",
                      fontSize: 11, fontWeight: sortBy === key ? 700 : 400,
                      cursor: "pointer", fontFamily: "'Inter', sans-serif",
                    }}>{label}</button>
                  ))}
                </div>

                {/* Flat date/distance view */}
                {(sortBy === "date" || sortBy === "distance") && (
                  <div>
                    {sortedResults.map(({ artist, show }, i) => {
                      const accent = genreColor(artist.genres?.[0] || "");
                      return (
                        <div key={i} style={{ marginBottom: 16 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                            {artist.image && <img src={artist.image} alt={artist.name} style={{ width: 22, height: 22, borderRadius: "50%", objectFit: "cover" }} />}
                            <span style={{ background: `${accent}18`, color: accent, borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{artist.name}</span>
                          </div>
                          <ShowCard show={show} accentColor={accent} userCoords={userCoords} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Grouped artist view */}
                {sortBy === "artist" && (
                  <div>
                    {results.map(({ artist, shows }) => {
                      const accent = genreColor(artist.genres?.[0] || "");
                      return (
                        <div key={artist.id} style={{ marginBottom: 28 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12, paddingBottom: 9, borderBottom: `1px solid ${accent}25` }}>
                            {artist.image
                              ? <img src={artist.image} alt={artist.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${accent}40` }} />
                              : <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎵</div>
                            }
                            <div>
                              <div style={{ color: "#fff", fontWeight: 800, fontSize: 15 }}>{artist.name}</div>
                              <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 2 }}>
                                {artist.genres?.[0] && <span style={{ background: `${accent}22`, color: accent, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{genreLabel(artist.genres[0])}</span>}
                                <span style={{ color: "#223344", fontSize: 10 }}>{shows.length} show{shows.length !== 1 ? "s" : ""} nearby</span>
                              </div>
                            </div>
                          </div>
                          {shows.map((show, i) => <ShowCard key={i} show={show} accentColor={accent} userCoords={userCoords} />)}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
