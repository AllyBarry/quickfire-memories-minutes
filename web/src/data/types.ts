/** One friend's track: the song they picked and the liner note they wrote. */
export interface Track {
  id: string;
  contributor: string;
  /** How they know the guest of honour, in a few words. Printed in handwriting. */
  tagline: string;
  /** When they met, YYYY-MM-DD. The tape runs in this order. */
  since: string;
  song: string;
  artist: string;
  /** A link from any music app. The real app turns it into a song.link page. */
  link?: string;
  message: string;
  /** A small JPEG data URL (demo, or before upload) or a URL the API serves. Cards print initials without one. */
  photo?: string;
  /** The QR destination printed on the card: minutes.qfm.co.za/go/<id> on a real tape. */
  qr?: string;
}

export interface Tape {
  honoree: string;
  occasion: string;
  bornYear: number;
  shortLink: string;
  tracks: Track[];
}

export interface Plan {
  id: string;
  name: string;
  priceZar: number;
  tagline: string;
  tracks: number;
  features: string[];
  featured?: boolean;
  printed: boolean;
  cta: string;
}

/** One theme's worth of a two-ink print. */
export interface InkSet {
  ink: string;
  pop: string;
  /** The pop ink darkened (or lightened) enough to read as small text. */
  popText: string;
  paper: string;
  card: string;
}

export interface Ink {
  id: string;
  name: string;
  light: InkSet;
  dark: InkSet;
}
