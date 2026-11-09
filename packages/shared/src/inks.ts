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
  id: InkId;
  name: string;
  light: InkSet;
  dark: InkSet;
}

/** Ink ids the API accepts. The first is the default. */
export const INK_IDS = ["night-neon", "forest-tangerine", "oxblood-sky", "graphite-sunflower"] as const;
export type InkId = (typeof INK_IDS)[number];

/**
 * Two-ink pairs the buyer can choose. Each prints as a main ink plus one bright "pop" ink,
 * like a two-drum riso print. Dark values are for the site and tape page only.
 * Confirm against the printer's proof before going live.
 */
export const inks: Ink[] = [
  {
    id: "night-neon",
    name: "Night & neon",
    light: { ink: "#1d2a73", pop: "#ff3fa4", popText: "#c8107a", paper: "#e6e9ee", card: "#f4f6f9" },
    dark: { ink: "#dfe4ff", pop: "#ff68ba", popText: "#ff8fcb", paper: "#10132a", card: "#181c3a" },
  },
  {
    id: "forest-tangerine",
    name: "Forest & tangerine",
    light: { ink: "#17432f", pop: "#ff6a1f", popText: "#c2470a", paper: "#e7ebe6", card: "#f4f7f3" },
    dark: { ink: "#d9efe1", pop: "#ff8a4c", popText: "#ffa577", paper: "#0e1c15", card: "#15291f" },
  },
  {
    id: "oxblood-sky",
    name: "Oxblood & sky",
    light: { ink: "#5a1424", pop: "#3a9be0", popText: "#1c6ca8", paper: "#ebe7ea", card: "#f7f4f6" },
    dark: { ink: "#f6dde3", pop: "#6cb9f1", popText: "#8fcaf5", paper: "#1c0c11", card: "#29141b" },
  },
  {
    id: "graphite-sunflower",
    name: "Graphite & sunflower",
    light: { ink: "#22252b", pop: "#f0b800", popText: "#8a6900", paper: "#e7e7e4", card: "#f6f6f3" },
    dark: { ink: "#ecebe6", pop: "#ffd23f", popText: "#ffdc66", paper: "#131417", card: "#1e2024" },
  },
];

export const inkById = (id: string): Ink => inks.find((i) => i.id === id) ?? inks[0];
