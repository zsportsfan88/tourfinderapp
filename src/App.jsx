import { useState, useEffect, useMemo } from "react";
import { fetchTopArtists } from "./spotify.js";

// ─── BANDSINTOWN ──────────────────────────────────────────────────────────────
const BIT_APP_ID = "tourfinderapp";

async function fetchBandsintownEvents(artistName) {
  try {
    const encoded = encodeURIComponent(artistName);
    const res = await fetch(
      `https://rest.bandsintown.com/artists/${encoded}/events?app_id=${BIT_APP_ID}&date=upcoming`,
      { headers: { Accept: "application/json" } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 8) : [];
  } catch { return []; }
}

function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
    Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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

// ─── HELPERS ─────────────────────────────────────────────────────────────────
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
  if (genre.includes("electronic") || genre.includes("edm")) return "Electronic";
  // Capitalize first word as fallback
  return genre.split(" ")[0].charAt(0).toUpperCase() + genre.split(" ")[0].slice(1);
};

const offerMeta = (offerType = "", url = "") => {
  const u = url.toLowerCase();
  const t = offerType.toLowerCase();
  if (u.includes("ticketmaster") || u.includes("livenation")) return { label: "Ticketmaster", color: "#026cdf" };
  if (u.includes("axs"))     return { label: "AXS",        color: "#e63946" };
  if (u.includes("stubhub")) return { label: "StubHub",    color: "#4e9af1" };
  if (u.includes("etix"))    return { label: "Etix",       color: "#f4822a" };
  if (t === "streaming")     return { label: "Watch Live", color: "#6c63ff" };
  return { label: offerType || "Buy Tickets", color: "#1db954" };
};

function eventKey(artistName, ev) {
  return `${artistName}||${ev.datetime}||${ev.venue?.name}`;
}

async function shareShow(artistName, ev) {
  const venue = ev.venue || {};
  const dateStr = ev.datetime
    ? new Date(ev.datetime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    : "upcoming";
  const location = [venue.name, venue.city, venue.region].filter(Boolean).join(", ");
  const ticketUrl = ev.offers?.[0]?.url || ev.url || "";
  const text = `${artistName} — ${dateStr} @ ${location}${ticketUrl ? `\n${ticketUrl}` : ""}`;
  if (navigator.share) {
    try { await navigator.share({ title: `${artistName} live`, text }); return "shared"; }
    catch { return "cancelled"; }
  } else {
    await navigator.clipboard.writeText(text);
    return "copied";
  }
}

// ─── EVENT ROW ────────────────────────────────────────────────────────────────
function EventRow({ event, userCoords, accentColor, starred, onStar }) {
  const [expanded, setExpanded] = useState(false);
  const [shareState, setShareState] = useState(null);

  const venue = event.venue || {};
  const vLat  = parseFloat(venue.latitude);
  const vLon  = parseFloat(venue.longitude);
  const dist  = userCoords && !isNaN(vLat) && !isNaN(vLon)
    ? Math.round(haversineDistance(userCoords.lat, userCoords.lon, vLat, vLon)) : null;

  const dateStr = event.datetime
    ? new Date(event.datetime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "TBD";
  const [mon, dayRaw, yr] = dateStr.split(" ");
  const day = dayRaw?.replace(",", "");

  const offers       = Array.isArray(event.offers) ? event.offers : [];
  const primaryOffer = offers[0];
  const extraOffers  = offers.slice(1);
  const bitUrl       = event.url || `https://www.bandsintown.com/a/${encodeURIComponent(event.lineupName || "")}`;
  const spotifyUrl   = `https://open.spotify.com/search/${encodeURIComponent(event.lineupName || "")}`;

  const handleShare = async () => {
    const result = await shareShow(event.lineupName, event);
    if (result !== "cancelled") { setShareState(result); setTimeout(() => setShareState(null), 2000); }
  };

  return (
    <div style={{
      background: starred ? "#0f0f1f" : "#0c0c18",
      border: `1px solid ${starred ? accentColor + "55" : "#1e1e30"}`,
      borderRadius: 9, overflow: "hidden",
      transition: "border-color 0.15s, background 0.15s",
    }}>
      <div style={{ padding: "12px 14px", display: "flex", alignItems: "flex-start", gap: 14 }}>
        <div style={{
          minWidth: 46, textAlign: "center",
          background: "#151525", borderRadius: 6, padding: "6px 4px", flexShrink: 0,
        }}>
          <div style={{ color: accentColor, fontSize: 9, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: "0.05em" }}>{mon}</div>
          <div style={{ color: "#fff", fontWeight: 800, fontSize: 17, fontFamily: "monospace", lineHeight: 1.1 }}>{day}</div>
          <div style={{ color: "#445566", fontSize: 9, fontFamily: "monospace" }}>{yr}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                color: "#dde", fontWeight: 600, fontSize: 13,
                whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                fontFamily: "'Inter', sans-serif",
              }}>{venue.name || "Venue TBD"}</div>
              <div style={{ color: "#556677", fontSize: 12, marginTop: 2, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span>{[venue.city, venue.region].filter(Boolean).join(", ")}</span>
                {dist !== null && (
                  <span style={{ background: "#1a2a3a", color: "#4d90c0", borderRadius: 4, padding: "1px 6px", fontSize: 10, fontWeight: 600 }}>
                    {dist} mi
                  </span>
                )}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0, marginTop: 1 }}>
              <button onClick={handleShare} title="Share" style={{
                background: shareState ? "#1a2a1a" : "#111120",
                border: `1px solid ${shareState ? "#1db95444" : "#2a2a40"}`,
                borderRadius: 6, width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 13, transition: "all 0.15s",
                color: shareState ? "#1db954" : "#556",
              }}>{shareState ? "✓" : "⬆"}</button>
              <button onClick={onStar} title={starred ? "Unsave" : "Save"} style={{
                background: starred ? `${accentColor}18` : "#111120",
                border: `1px solid ${starred ? accentColor + "55" : "#2a2a40"}`,
                borderRadius: 6, width: 28, height: 28,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", fontSize: 14, transition: "all 0.15s",
              }}>{starred ? "★" : "☆"}</button>
            </div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 7, marginTop: 10, alignItems: "center" }}>
            {primaryOffer ? (
              <>
                <a href={primaryOffer.url} target="_blank" rel="noopener noreferrer" style={{
                  background: offerMeta(primaryOffer.type, primaryOffer.url).color,
                  color: "#fff", borderRadius: 5, padding: "5px 12px",
                  fontSize: 11, fontWeight: 700, textDecoration: "none",
                  fontFamily: "'Inter', sans-serif",
                  display: "inline-flex", alignItems: "center", gap: 4,
                }}>🎟 {offerMeta(primaryOffer.type, primaryOffer.url).label}</a>
                {extraOffers.length > 0 && (
                  <button onClick={() => setExpanded(e => !e)} style={{
                    background: "none", border: "1px solid #2a2a40",
                    color: "#7788aa", borderRadius: 5, padding: "4px 10px",
                    fontSize: 11, cursor: "pointer", fontFamily: "'Inter', sans-serif",
                  }}>{expanded ? "▲ Less" : `+${extraOffers.length} more`}</button>
                )}
              </>
            ) : (
              <a href={bitUrl} target="_blank" rel="noopener noreferrer" style={{
                background: "#1db954", color: "#000", borderRadius: 5, padding: "5px 12px",
                fontSize: 11, fontWeight: 700, textDecoration: "none",
                fontFamily: "'Inter', sans-serif",
                display: "inline-flex", alignItems: "center", gap: 4,
              }}>🎟 Get Tickets</a>
            )}
            <a href={spotifyUrl} target="_blank" rel="noopener noreferrer" style={{
              background: "#111120", border: "1px solid #2a2a40",
              color: "#7799bb", borderRadius: 5, padding: "4px 10px",
              fontSize: 11, fontWeight: 500, textDecoration: "none",
              fontFamily: "'Inter', sans-serif",
            }}>♫ Spotify</a>
          </div>
        </div>
      </div>
      {expanded && extraOffers.length > 0 && (
        <div style={{
          borderTop: "1px solid #1e1e2e", padding: "10px 14px",
          display: "flex", flexWrap: "wrap", gap: 7, background: "#0a0a15",
        }}>
          <div style={{ color: "#334455", fontSize: 10, width: "100%", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            More options
          </div>
          {extraOffers.map((offer, i) => {
            const meta = offerMeta(offer.type, offer.url);
            return (
              <a key={i} href={offer.url} target="_blank" rel="noopener noreferrer" style={{
                background: "#151525", border: `1px solid ${meta.color}55`,
                color: meta.color, borderRadius: 5, padding: "5px 12px",
                fontSize: 11, fontWeight: 600, textDecoration: "none",
                fontFamily: "'Inter', sans-serif",
              }}>{meta.label}</a>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── ARTIST CARD ─────────────────────────────────────────────────────────────
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
      {selected && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, ${accent}, transparent)` }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        {artist.image ? (
          <img src={artist.image} alt={artist.name} style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", flexShrink: 0, border: `1px solid ${accent}44` }} />
        ) : (
          <div style={{ width: 38, height: 38, borderRadius: "50%", background: `${accent}22`, border: `1px solid ${accent}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, flexShrink: 0 }}>🎵</div>
        )}
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
        <div style={{ width: 7, height: 7, borderRadius: "50%", background: selected ? accent : "#222233", flexShrink: 0, boxShadow: selected ? `0 0 6px ${accent}88` : "none", transition: "background 0.15s" }} />
      </div>
    </button>
  );
}

// ─── GENRE FILTER BAR ─────────────────────────────────────────────────────────
function GenreFilterBar({ genres, activeGenre, onChange }) {
  const all = ["All", ...genres];
  return (
    <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
      {all.map(g => {
        const active = g === activeGenre;
        const color  = g === "All" ? "#8899aa" : genreColor(g.toLowerCase());
        return (
          <button key={g} onClick={() => onChange(g)} style={{
            background: active ? `${color}22` : "#0c0c18",
            border: `1px solid ${active ? color : "#1e1e30"}`,
            color: active ? color : "#5566aa",
            borderRadius: 20, padding: "5px 13px",
            fontSize: 11, fontWeight: active ? 700 : 400,
            cursor: "pointer", fontFamily: "'Inter', sans-serif",
            transition: "all 0.15s",
          }}>{g}</button>
        );
      })}
    </div>
  );
}

// ─── SORT BAR ─────────────────────────────────────────────────────────────────
function SortBar({ sort, onSort }) {
  return (
    <div style={{ display: "flex", gap: 1, background: "#0c0c18", border: "1px solid #1e1e30", borderRadius: 8, padding: 3, width: "fit-content" }}>
      {[["date","Date"],["distance","Distance"],["artist","Artist"]].map(([key, label]) => (
        <button key={key} onClick={() => onSort(key)} style={{
          background: sort === key ? "#1e1e38" : "none", border: "none",
          color: sort === key ? "#fff" : "#445566",
          borderRadius: 6, padding: "5px 12px",
          fontSize: 11, fontWeight: sort === key ? 700 : 400,
          cursor: "pointer", fontFamily: "'Inter', sans-serif", transition: "all 0.15s",
        }}>{label}</button>
      ))}
    </div>
  );
}

// ─── SAVED DRAWER ─────────────────────────────────────────────────────────────
function SavedDrawer({ savedShows, allResults, userCoords, onUnsave, onClose }) {
  const saved = [];
  allResults.forEach(({ artist, events }) => {
    events.forEach(ev => {
      const key = eventKey(artist.name, ev);
      if (savedShows.has(key)) saved.push({ artist, event: { ...ev, lineupName: artist.name }, key });
    });
  });
  saved.sort((a, b) => new Date(a.event.datetime) - new Date(b.event.datetime));

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 100 }}>
      <div style={{ background: "#0d0d1a", border: "1px solid #2a2a40", borderRadius: "14px 14px 0 0", width: "100%", maxWidth: 660, maxHeight: "80vh", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "14px 20px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 16 }}>★</span>
            <span style={{ color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "'Inter', sans-serif" }}>Saved Shows</span>
            <span style={{ background: "#1e1e38", color: "#8899aa", borderRadius: 10, padding: "1px 7px", fontSize: 11 }}>{saved.length}</span>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#445566", fontSize: 20, cursor: "pointer" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "14px 18px 24px", flex: 1 }}>
          {saved.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 0", color: "#334455", fontSize: 13 }}>Star any show to save it here.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {saved.map(({ artist, event, key }) => {
                const accent  = genreColor(artist.genres?.[0] || "");
                const venue   = event.venue || {};
                const dateStr = event.datetime ? new Date(event.datetime).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "TBD";
                const ticketUrl = event.offers?.[0]?.url || event.url;
                const vLat = parseFloat(venue.latitude);
                const vLon = parseFloat(venue.longitude);
                const dist = userCoords && !isNaN(vLat) && !isNaN(vLon)
                  ? Math.round(haversineDistance(userCoords.lat, userCoords.lon, vLat, vLon)) : null;
                return (
                  <div key={key} style={{ background: "#0c0c18", border: `1px solid ${accent}33`, borderRadius: 9, padding: "11px 13px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ minWidth: 40, textAlign: "center", background: "#151525", borderRadius: 6, padding: "5px 3px", flexShrink: 0 }}>
                      <div style={{ color: accent, fontSize: 8, fontFamily: "monospace", textTransform: "uppercase" }}>{dateStr.split(" ")[0]}</div>
                      <div style={{ color: "#fff", fontWeight: 800, fontSize: 15, fontFamily: "monospace", lineHeight: 1 }}>{dateStr.split(" ")[1]?.replace(",","")}</div>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: "#dde", fontWeight: 700, fontSize: 12, fontFamily: "'Inter', sans-serif" }}>{artist.name}</div>
                      <div style={{ color: "#445566", fontSize: 11, marginTop: 1 }}>
                        {[venue.name, venue.city, venue.region].filter(Boolean).join(" · ")}
                        {dist !== null && <span style={{ color: "#4d90c0", marginLeft: 6 }}>{dist} mi</span>}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
                      {ticketUrl && (
                        <a href={ticketUrl} target="_blank" rel="noopener noreferrer" style={{ background: "#1db954", color: "#000", borderRadius: 5, padding: "4px 10px", fontSize: 10, fontWeight: 700, textDecoration: "none" }}>🎟</a>
                      )}
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

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [phase, setPhase]               = useState("connect");
  const [accessToken, setAccessToken]   = useState(null);
  const [spotifyUser, setSpotifyUser]   = useState(null);
  const [artists, setArtists]           = useState([]);
  const [loadingSpotify, setLoadingSpotify] = useState(false);
  const [spotifyError, setSpotifyError] = useState(null);

  const [selectedArtists, setSelectedArtists] = useState(new Set());
  const [activeGenre, setActiveGenre]   = useState("All");
  const [zip, setZip]                   = useState("");
  const [zipError, setZipError]         = useState("");
  const [loading, setLoading]           = useState(false);
  const [rawResults, setRawResults]     = useState([]);
  const [userCoords, setUserCoords]     = useState(null);
  const [sort, setSort]                 = useState("date");
  const [savedShows, setSavedShows]     = useState(new Set());
  const [showSaved, setShowSaved]       = useState(false);
  const [radiusMiles, setRadiusMiles]   = useState(100);

  // ── Parse token from URL on load ──────────────────────────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("access_token");
    const error  = params.get("error");

    if (error) {
      setSpotifyError("Spotify login failed. Please try again.");
      window.history.replaceState({}, "", "/");
      return;
    }

    if (token) {
      setAccessToken(token);
      window.history.replaceState({}, "", "/"); // clean URL
      setLoadingSpotify(true);
      setPhase("loading");

      // Fetch user profile + top artists in parallel
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
        .catch(err => {
          console.error(err);
          setSpotifyError("Couldn't load your Spotify data. Please try again.");
          setPhase("connect");
        })
        .finally(() => setLoadingSpotify(false));
    }
  }, []);

  // Derived genre list from actual artist data
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

  const toggleStar = (key) => setSavedShows(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const sortedResults = useMemo(() => {
    if (sort === "artist") return rawResults;
    const flat = rawResults.flatMap(({ artist, events }) => events.map(ev => ({ artist, event: ev })));
    if (sort === "date") flat.sort((a, b) => new Date(a.event.datetime) - new Date(b.event.datetime));
    if (sort === "distance" && userCoords) {
      flat.sort((a, b) => {
        const d = (ev) => {
          const lat = parseFloat(ev.venue?.latitude), lon = parseFloat(ev.venue?.longitude);
          return isNaN(lat) ? 9999 : haversineDistance(userCoords.lat, userCoords.lon, lat, lon);
        };
        return d(a.event) - d(b.event);
      });
    }
    return flat;
  }, [rawResults, sort, userCoords]);

  const handleFindShows = async () => {
    if (zip.length !== 5 || isNaN(zip)) { setZipError("Enter a valid 5-digit ZIP code."); return; }
    setZipError("");
    setLoading(true);
    const coords = await zipToCoords(zip);
    if (!coords) { setZipError("Couldn't find that ZIP. Try another."); setLoading(false); return; }
    setUserCoords(coords);

    const selected = artists.filter(a => selectedArtists.has(a.id));
    const fetched  = await Promise.all(
      selected.map(async a => ({ artist: a, events: await fetchBandsintownEvents(a.name) }))
    );
    const filtered = fetched
      .map(({ artist, events }) => ({
        artist,
        events: events.filter(ev => {
          const lat = parseFloat(ev.venue?.latitude), lon = parseFloat(ev.venue?.longitude);
          if (isNaN(lat) || isNaN(lon)) return true;
          return haversineDistance(coords.lat, coords.lon, lat, lon) <= radiusMiles;
        }),
      }))
      .filter(({ events }) => events.length > 0);

    setRawResults(filtered);
    setSort("date");
    setPhase("results");
    setLoading(false);
  };

  const totalShows = rawResults.reduce((sum, r) => sum + r.events.length, 0);

  return (
    <div style={{ minHeight: "100vh", background: "#07070f", fontFamily: "'Inter', sans-serif", color: "#ccd" }}>
      {showSaved && <SavedDrawer savedShows={savedShows} allResults={rawResults} userCoords={userCoords} onUnsave={toggleStar} onClose={() => setShowSaved(false)} />}

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
              background: savedShows.size > 0 ? "#1a1a10" : "#0c0c18",
              border: `1px solid ${savedShows.size > 0 ? "#c8a96e55" : "#1e1e30"}`,
              color: savedShows.size > 0 ? "#c8a96e" : "#445566",
              borderRadius: 6, padding: "5px 11px", fontSize: 11, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5,
            }}>★ {savedShows.size > 0 ? savedShows.size : "Saved"}</button>
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

        {/* ── CONNECT ── */}
        {phase === "connect" && (
          <div style={{ textAlign: "center", paddingTop: 36 }}>
            <div style={{ width: 68, height: 68, borderRadius: "50%", background: "linear-gradient(135deg, #1db95420, #1db95440)", border: "1.5px solid #1db95450", margin: "0 auto 20px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30 }}>🎵</div>
            <h1 style={{ color: "#fff", fontSize: 23, fontWeight: 800, letterSpacing: "-0.5px", margin: "0 0 10px" }}>Your music. Live, near you.</h1>
            <p style={{ color: "#334455", fontSize: 13, lineHeight: 1.7, maxWidth: 380, margin: "0 auto 26px" }}>
              Connect your Spotify to find which of your most-liked artists are playing near you — sort by date or distance, save shows, and buy direct.
            </p>
            {spotifyError && (
              <div style={{ background: "#200a0a", border: "1px solid #cc444433", borderRadius: 8, padding: "10px 14px", color: "#cc6666", fontSize: 12, maxWidth: 340, margin: "0 auto 16px" }}>
                {spotifyError}
              </div>
            )}
            <a href="/api/login" style={{
              display: "inline-block",
              background: "#1db954", color: "#000",
              borderRadius: 50, padding: "12px 32px",
              fontSize: 14, fontWeight: 800, textDecoration: "none", letterSpacing: "-0.2px",
            }}>Connect Spotify</a>
          </div>
        )}

        {/* ── LOADING ── */}
        {phase === "loading" && (
          <div style={{ textAlign: "center", paddingTop: 80 }}>
            <div style={{ fontSize: 36, marginBottom: 20 }}>🎵</div>
           <div style={{ color: "#dde", fontSize: 15, fontWeight: 600, marginBottom: 8 }}>Scanning your library…</div>
<div style={{ color: "#334455", fontSize: 12, marginBottom: 24 }}>{loadProgress.total > 0 ? `${loadProgress.scanned.toLocaleString()} of ${loadProgress.total.toLocaleString()} songs scanned` : "Reading liked songs…"}</div>
<div style={{ color: "#334455", fontSize: 12 }}>Reading liked songs and building your artist list</div>
          </div>
        )}

        {/* ── ARTISTS ── */}
        {phase === "artists" && (
          <div>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#0a180a", border: "1px solid #1db95430", borderRadius: 5, padding: "3px 9px", marginBottom: 12 }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#1db954" }} />
                <span style={{ color: "#1db954", fontSize: 10, fontWeight: 700 }}>Spotify Connected</span>
              </div>
              <h2 style={{ color: "#fff", fontSize: 18, fontWeight: 800, margin: "0 0 4px", letterSpacing: "-0.3px" }}>Your top artists</h2>
              <p style={{ color: "#334455", fontSize: 12, margin: 0 }}>Ranked by liked songs from your library. Filter by genre or deselect before searching.</p>
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
                    placeholder="e.g. 90069"
                    style={{ width: "100%", background: "#07070f", border: `1px solid ${zipError ? "#cc4444" : "#1e1e30"}`, borderRadius: 7, padding: "9px 11px", color: "#dde", fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "monospace" }}
                  />
                  {zipError && <div style={{ color: "#cc5555", fontSize: 11, marginTop: 4 }}>{zipError}</div>}
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ color: "#334455", fontSize: 10, display: "block", marginBottom: 5, textTransform: "uppercase", letterSpacing: "0.07em" }}>Radius: {radiusMiles} mi</label>
                  <input type="range" min={25} max={500} step={25} value={radiusMiles}
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
              }}>{loading ? "Searching Bandsintown…" : "Find Shows Near Me →"}</button>
            </div>
          </div>
        )}

        {/* ── RESULTS ── */}
        {phase === "results" && (
          <div>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
              <button onClick={() => setPhase("artists")} style={{ background: "none", border: "1px solid #1e1e30", color: "#334455", borderRadius: 6, padding: "6px 11px", fontSize: 11, cursor: "pointer", marginTop: 2, flexShrink: 0 }}>← Back</button>
              <div style={{ flex: 1 }}>
                <h2 style={{ color: "#fff", fontSize: 16, fontWeight: 800, margin: "0 0 2px", letterSpacing: "-0.3px" }}>
                  {rawResults.length > 0
                    ? `${totalShows} show${totalShows !== 1 ? "s" : ""} from ${rawResults.length} artist${rawResults.length !== 1 ? "s" : ""} near ${userCoords?.city}`
                    : `No shows found near ${userCoords?.city}`}
                </h2>
                <div style={{ color: "#223344", fontSize: 11 }}>Within {radiusMiles} mi · Bandsintown · Direct tickets where available</div>
              </div>
            </div>

            {rawResults.length === 0 ? (
              <div style={{ textAlign: "center", padding: "44px 20px", background: "#0c0c18", border: "1px solid #1a1a2a", borderRadius: 12 }}>
                <div style={{ fontSize: 36, marginBottom: 14 }}>🎸</div>
                <div style={{ color: "#334455", fontSize: 13, marginBottom: 16 }}>No shows within {radiusMiles} miles of {userCoords?.city}.</div>
                <button onClick={() => setPhase("artists")} style={{ background: "#141420", border: "1px solid #1e1e30", color: "#5566aa", borderRadius: 7, padding: "9px 18px", fontSize: 12, cursor: "pointer" }}>Adjust radius or artists →</button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
                  <SortBar sort={sort} onSort={setSort} />
                  <div style={{ color: "#223344", fontSize: 11 }}>
                    {sort === "date" ? "Earliest first" : sort === "distance" ? "Closest first" : "By artist"}
                  </div>
                </div>

                {(sort === "date" || sort === "distance") && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                    {sortedResults.map(({ artist, event }, i) => {
                      const accent = genreColor(artist.genres?.[0] || "");
                      const key    = eventKey(artist.name, event);
                      return (
                        <div key={i}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5 }}>
                            <span style={{ background: `${accent}18`, color: accent, borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700 }}>{artist.name}</span>
                          </div>
                          <EventRow event={{ ...event, lineupName: artist.name }} userCoords={userCoords} accentColor={accent} starred={savedShows.has(key)} onStar={() => toggleStar(key)} />
                        </div>
                      );
                    })}
                  </div>
                )}

                {sort === "artist" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                    {rawResults.map(({ artist, events }) => {
                      const accent = genreColor(artist.genres?.[0] || "");
                      return (
                        <div key={artist.id}>
                          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10, paddingBottom: 9, borderBottom: `1px solid ${accent}25` }}>
                            {artist.image
                              ? <img src={artist.image} alt={artist.name} style={{ width: 32, height: 32, borderRadius: "50%", objectFit: "cover", border: `1px solid ${accent}40` }} />
                              : <div style={{ width: 32, height: 32, borderRadius: "50%", background: `${accent}18`, border: `1px solid ${accent}40`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13 }}>🎵</div>
                            }
                            <div>
                              <div style={{ color: "#fff", fontWeight: 800, fontSize: 14 }}>{artist.name}</div>
                              <div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 2 }}>
                                {artist.genres?.[0] && <span style={{ background: `${accent}22`, color: accent, borderRadius: 3, padding: "1px 5px", fontSize: 10, fontWeight: 600 }}>{genreLabel(artist.genres[0])}</span>}
                                <span style={{ color: "#223344", fontSize: 10 }}>{artist.likedSongs} liked · {events.length} show{events.length !== 1 ? "s" : ""}</span>
                              </div>
                            </div>
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
                            {events.map((ev, i) => {
                              const key = eventKey(artist.name, ev);
                              return <EventRow key={i} event={{ ...ev, lineupName: artist.name }} userCoords={userCoords} accentColor={accent} starred={savedShows.has(key)} onStar={() => toggleStar(key)} />;
                            })}
                          </div>
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
