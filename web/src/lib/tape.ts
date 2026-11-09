import type { Track } from "../data/types";

/** Whole years since a YYYY-MM-DD date, as of today. */
export function yearsSince(iso: string, now = new Date()) {
  const d = new Date(`${iso}T00:00:00`);
  let y = now.getFullYear() - d.getFullYear();
  if (now < new Date(now.getFullYear(), d.getMonth(), d.getDate())) y--;
  return Math.max(0, y);
}

export const sinceYear = (iso: string) => Number(iso.slice(0, 4));

export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .map((p) => p[0] ?? "")
    .slice(0, 2)
    .join("")
    .toUpperCase();

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

/**
 * A plain search link, used in the demo when a friend didn't paste a link of their own.
 * The real app resolves every pick through the Odesli (song.link) API and prints that link instead.
 */
export const searchUrl = (t: Pick<Track, "artist" | "song">) => "https://music.youtube.com/search?q=" + encodeURIComponent(`${t.artist} ${t.song}`);
export const songUrl = (t: Track) => t.qr || t.link?.trim() || searchUrl(t);

export interface Side {
  letter: string;
  offset: number;
  tracks: Track[];
}

/** Split a running order into sides of a tape. Up to 40 tracks make A and B, a double album adds C and D. */
export function sidesOf(tracks: Track[]): Side[] {
  const sideCount = tracks.length > 40 ? 4 : 2;
  const per = Math.max(1, Math.ceil(tracks.length / sideCount));
  const out: Side[] = [];
  for (let s = 0; s < sideCount; s++) {
    const list = tracks.slice(s * per, s * per + per);
    if (list.length) out.push({ letter: "ABCD"[s], offset: s * per, tracks: list });
  }
  return out;
}

/** "A3" style code for the track at index i of n. */
export function trackCode(i: number, n: number) {
  const sides = sidesOf(Array.from({ length: n }, (_, k) => ({ id: String(k) }) as Track));
  const side = sides.find((s) => i >= s.offset && i < s.offset + s.tracks.length) ?? sides[0];
  return `${side?.letter ?? "A"}${i - (side?.offset ?? 0) + 1}`;
}

/** Sort by when each friend met the guest of honour, oldest first. */
export const byYearMet = <T extends Pick<Track, "since">>(list: T[]) => [...list].sort((a, b) => a.since.localeCompare(b.since));

export const isUrl = (s: string) => /^https?:\/\/\S+\.\S+/.test(s.trim());

/** Shrink an uploaded photo to a small JPEG data URL so the demo can keep it in localStorage. */
export function resizePhoto(file: File, max = 420): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That file isn't a photo we can read."));
    };
    img.src = url;
  });
}
