import { useState, useEffect, useMemo } from "react";
import { fetchTopArtists } from "./spotify.js";

async function fetchBandsintownProfile(artistName) {
  try {
    const encoded = encodeURIComponent(artistName);
    const res = await fetch(
      `https://rest.bandsintown.com/artists/${encoded}?app_id=tourfinderapp`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) throw new Error("not found");
    const data = await res.json();
    return data.url || `https://www.bandsintown.com/search?query=${encoded}`;
  } catch {
    return `https://www.bandsintown.com/search?query=${encodeURIComponent(artistName)}`;
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

function artistKey(artistName) {
  return `saved||${artistName}`;
}

async function shareArtist(artistName, url) {
  const text = `Check out ${artistName} on tour!\n${url}`;
  if (navigator.share) {
    try { await navigator.share({ title: `${artistName} live`, text }); return "shared"; }
    catch { return "cancelled"; }
  } else {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
}

function ArtistResultCard({ artist, bitUrl, starred, onStar }) {
  const [shareState, setShareState] = useState(null);
  const accent = genreColor(artist.genres?.[0] || "");

  const handleShare = async () => {
    const result = await shareArtist(artist.name, bitUrl);
    if (result !== "cancelled") { setShareState(result); setTimeout(() => setShareState(null), 2000); }
  };

  return (
    <div style={{
      background: starred ? "#0f0f1f" : "#0c0c18",
      border: `1px solid ${starred ? accent + "55" : "#1e1e30"}`,
      borderRadius: 12, overflow: "hidden",
      transition: "border-color 0.15s, background 0.15s",
      marginBottom: 16,
    }}>
      {/* Artist header */}
      <div style={{ padding: "14px 16px 10px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${accent}20` }}>
        {artist.image
          ? <img src={artist.image} alt={artist.name} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", border: `1px solid ${accent}44`, flexShrink: 0 }} />
          : <div style={{ width: 44, height: 44, borderRadius: "50%", background: `${accent}22`, border: `1px solid ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>🎵</div>
        }
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "'Inter', sans-serif", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{artist.name}</div>
          <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 3 }}>
            {artist.genres?.[0] && <span style={{ background: `${accent}22`, color: accent, borderRadius: 3, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>{genreLabel(artist.genres[0])}</span>}
            <span style={{ color: "#334455", fontSize: 11 }}>{artist.likedSongs} liked songs</span>
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button onClick={handleShare} title="Share" style={{
            background: shareState ? "#1a2a1a" : "#111120",
            border: `1px solid ${shareState ? "#1db95444" : "#2a2a40"}`,
            borderRadius: 6, width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 13, color: shareState ? "#1db954" : "#556",
          }}>{shareState ? "✓" : "⬆"}</button>
          <button onClick={onStar} title={starred ? "Unsave" : "Save"} style={{
            background: starred ? `${accent}18` : "#111120",
            border: `1px solid ${starred ? accent + "55" : "#2a2a40"}`,
            borderRadius: 6, width: 30, height: 30,
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", fontSize: 14,
          }}>{starred ? "★" : "☆"}</button>
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ padding: "12px 16px", display: "flex", gap: 8, flexWrap: "wrap" }}>
        <a href={bitUrl} target="_blank" rel="noopener noreferrer" style={{
          background: "#1db954", color: "#000",
          borderRadius: 6, padding: "8px 16px",
          fontSize: 12, fontWeight: 700, textDecoration: "none",
          fontFamily: "'Inter', sans-serif",
          display: "inline-flex", alignItems: "center", gap: 6,
        }}>🎟 See Shows on Bandsintown</a>
        <a href={`https://open.spotify.com/artist/${artist.id}`} target="_blank" rel="noopener noreferrer" style={{
          background: "#111120", border: "1px solid #2a2a40",
          color: "#7799bb", borderRadius: 6, padding: "7px 14px",
          fontSize: 11, fontWeight: 500, textDecoration: "none",
          fontFamily: "'Inter', sans-serif",
          display: "inline-flex", alignItems: "center", gap: 5,
        }}>♫ Spotify</a>
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

function SavedDrawer({ savedArtists, allResults, onUnsave, onClose }) {
  const saved = allResults.filter(({ artist }) => savedArtists.has(artistKey(artist.name)));
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: "14px 14px 0 0", width: "100%", maxWidth: 660, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>★</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>Saved Artists</span>
            <span style={{ background: "#1e1e38", color: "#8899aa", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{saved.length}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#445566", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "14px 18px 24px", flex: 1 }}>
          {saved.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "#334455", fontSize: 13 }}>Star any artist to save them here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saved.map(({ artist, bitUrl }) => {
                const accent = genreColor(artist.genres?.[0] || "");
                const key = artistKey(artist.name);
                return (
                  <div key={key} style={{ background: "#0c0c18", border: `1px solid ${accent}33`, borderRadius: 9, padding: "11px 13px", display: "flex", alignItems: "center", gap: 12 }}>
                    {artist.image
                      ? <img src={artist.image} alt={artist.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", border: `1px solid ${accent}44` }} />
                      : <div style={{ width: 36, height: 36, borderRadius: "50%", background: `${accent}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>🎵</div>
                    }
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#dde", fontWeight: 700, fontSize: 13, fontFamily: "'Inter', sans-serif" }}>{artist.name}</div>
                      {artist.genres?.[0] && <span style={{ background: `${accent}22`, color: accent, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{genreLabel(artist.genres[0])}</span>}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <a href={bitUrl} target="_blank" rel="noopener noreferrer" style={{ background: "#1db954", color: "#000", borderRadius: 5, padding: "4px 10px", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>🎟 Shows</a>
                      <button onClick={() => onUnsave(key)} style={{ background: `${accent}18`, border: `1px solid ${accent}44`, color: accent, borderRadius: 5, width: 26, height: 26, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 13 }}>★</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [phase, setPhase]               = useState("connect");
  const [accessToken, setAccessToken]   = useState(null);
  const [spotifyUser, setSpotifyUser]   = useState(null);
  const [artists, setArtists]           = useState([]);
  const [spotifyError, setSpotifyError] = useState(null);
  const [selectedArtists, setSelectedArtists] = useState(new Set());
  const [activeGenre, setActiveGenre]   = useState("All");
  const [zip, setZip]                   = useState("");
  const [zipError, setZipError]         = useState("");
  const [loading, setLoading]           = useState(false);
  const [rawResults, setRawResults]     = useState([]);
  const [userCoords, setUserCoords]     = useState(null);
  const [savedArtists, setSavedArtists] = useState(new Set());
  const [showSaved, setShowSaved]       = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("access_token");
    const error  = params.get("error");
    if (error) { setSpotifyError("Spotify login failed. Please try again."); window.history.replaceState({}, "", "/"); return; }
    if (token) {
      setAccessToken(token);
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

  const toggleStar = (key) => setSavedArtists(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const handleFindShows = async () => {
    if (zip.length !== 5 || isNaN(zip)) { setZipError("Enter a valid 5-digit ZIP code."); return; }
    setZipError("");
    setLoading(true);
    const coords = await zipToCoords(zip);
    if (!coords) { setZipError("Couldn't find that ZIP. Try another."); setLoading(false); return; }
    setUserCoords(coords);

    const selected = artists.filter(a => selectedArtists.has(a.id));

    // Fetch Bandsintown profile URLs for all selected artists
    const results = await Promise.all(
      selected.map(async artist => {
        const bitUrl = await fetchBandsintownProfile(artist.name);
        return { artist, bitUrl };
      })
    );

    setRawResults(results);
    setPhase("results");
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", fontFamily: "'Inter', sans-serif", color: "#ccd" }}>
      {showSaved && <SavedDrawer savedArtists={savedArtists} allResults={rawResults} onUnsave={toggleStar} onClose={() => setShowSaved(false)} />}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #141420", padding: "13px 22px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, background: "#07070f", zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "linear-gradient(135deg, #1db954, #116b32)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15 }}>🎸</div>
          <div>
            <div style={{ color: "#fff", fontWeight: 800, fontSize: 14, letterSpacing: "-0.3px" }}>TourFinder</div>
            <div style={{ color: "#223344", fontSize: 9, textTransform: "uppercase", letterSpacing: "0.1em" }}>Spotify + Bandsintown</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 7, alignItems: "center" }}>
          {phase === "results" && (
            <button onClick={() => setShowSaved(true)} style={{
              background: savedArtists.size > 0 ? "#1a1a10" : "#0c0c18",
              border: `1px solid ${savedArtists.size > 0 ? "#c8a96e55" : "#1e1e30"}`,
              color: savedArtists.size > 0 ? "#c8a96e" : "#445566",
              borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}>★ {savedArtists.size > 0 ? savedArtists.size : "Saved"}</button>
          )}
          {spotifyUser && (
            <div style={{ color: "#334455", fontSize: 11, display: "flex", alignItems: "center", gap: 5 }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#1db954" }} />
              {spotifyUser.display_name}
            </div>
          )}
        </div>
      </div>

      <div style={{ maxWidth: 660, margin: "0 auto", padding: "26px 16px" }}>

        {/* CONNECT */}
        {phase === "connect" && (
          <div style={{ textAlign: "center", paddingTop: 36 }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #1db95420, #1db95440)", border: "1.5px solid #1db95450", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🎵</div>
            <h1 style={{ color: "#fff", fontSize: 23, fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 10px" }}>Your music. Live, near you.</h1>
            <p style={{ color: "#334455", fontSize: 13, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 26px" }}>
              Connect your Spotify to see your most-liked artists and find their upcoming shows on Bandsintown.
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

        {/* LOADING */}
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
              <div style={{ marginBottom: 12 }}>
                <label style={{ color: "#334455", fontSize: 10, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>ZIP Code</label>
                <input type="text" maxLength={5} value={zip}
                  onChange={e => { setZip(e.target.value.replace(/\D/g, "")); setZipError(""); }}
                  placeholder="e.g. 91601"
                  style={{ width: "100%", background: "#07070f", border: `1px solid ${zipError ? "#cc4444" : "#1e1e30"}`, borderRadius: 7, padding: "9px 11px", color: "#dde", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                />
                {zipError && <div style={{ color: "#cc5555", fontSize: 11, marginTop: 4 }}>{zipError}</div>}
              </div>
              <button onClick={handleFindShows} disabled={loading || selectedArtists.size === 0} style={{
                width: "100%", padding: "11px",
                background: selectedArtists.size === 0 ? "#141420" : "#1db954",
                color: selectedArtists.size === 0 ? "#223" : "#000",
                border: "none", borderRadius: 8, fontSize: 13, fontWeight: 800,
                cursor: selectedArtists.size === 0 ? "not-allowed" : "pointer",
              }}>{loading ? "Looking up artists…" : "Find Shows Near Me →"}</button>
            </div>
          </div>
        )}

        {/* RESULTS */}
        {phase === "results" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
              <button onClick={() => setPhase("artists")} style={{ background: "none", border: "1px solid #1e1e30", color: "#334455", borderRadius: 6, padding: "6px 11px", fontSize: 11, cursor: "pointer", marginTop: 2, flexShrink: 0 }}>← Back</button>
              <div>
                <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: "0 0 2px", letterSpacing: "-0.3px" }}>
                  {rawResults.length} artist{rawResults.length !== 1 ? "s" : ""} from your library
                </h2>
                <div style={{ color: "#223344", fontSize: 11 }}>Click "See Shows on Bandsintown" to view upcoming concerts</div>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column" }}>
              {rawResults.map(({ artist, bitUrl }) => {
                const key = artistKey(artist.name);
                return (
                  <ArtistResultCard
                    key={artist.id}
                    artist={artist}
                    bitUrl={bitUrl}
                    starred={savedArtists.has(key)}
                    onStar={() => toggleStar(key)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
