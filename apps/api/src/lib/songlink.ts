/**
 * Turn whatever link a friend pasted (Spotify, Apple Music, YouTube, Deezer...) into one song.link page
 * that offers the song in every app. Best effort: a slow or failed lookup never blocks a song pick,
 * and /go/<id> falls back to the original link or a search.
 */
export async function resolveSongPage(link: string | null, timeoutMs = 4000): Promise<string | null> {
  if (!link) return null;
  try {
    const res = await fetch(`https://api.song.link/v1-alpha.1/links?userCountry=ZA&url=${encodeURIComponent(link)}`, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { pageUrl?: string };
    return typeof body.pageUrl === "string" && body.pageUrl.startsWith("https://") ? body.pageUrl : null;
  } catch {
    return null;
  }
}

/** Where a QR code sends a guest: the resolved page, the friend's own link, or a search by title and artist. */
export function songDestination(t: { song_page_url: string | null; link: string | null; song: string; artist: string }) {
  return t.song_page_url ?? t.link ?? `https://music.youtube.com/search?q=${encodeURIComponent(`${t.artist} ${t.song}`)}`;
}
