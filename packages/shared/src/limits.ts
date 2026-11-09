/** Field limits. The API enforces them and the web app shows them as character counters. */
export const LIMITS = {
  name: 60,
  contributor: 40,
  tagline: 28,
  song: 60,
  artist: 60,
  link: 500,
  message: 320,
  honoree: 14,
  occasion: 40,
  note: 500,
  photoBytes: 600 * 1024, // the web app sends a ~420 px JPEG, usually under 80 KB
} as const;
