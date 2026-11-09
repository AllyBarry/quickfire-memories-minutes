/** Plan ids the API accepts. */
export const PLAN_IDS = ["digital", "boxed", "double"] as const;
export type PlanId = (typeof PLAN_IDS)[number];

export interface Plan {
  id: PlanId;
  name: string;
  /** What the API charges, in rand. */
  priceZar: number;
  tagline: string;
  /** Most friends (tracks) a tape on this plan takes. */
  tracks: number;
  features: string[];
  featured?: boolean;
  /** Boxed plans are printed, so their deadlines follow the weekly print run. */
  printed: boolean;
  cta: string;
}

export const plans: Plan[] = [
  {
    id: "digital",
    name: "Digital",
    priceZar: 349,
    tagline: "The tape page, plus cards to print at home.",
    tracks: 40,
    printed: false,
    features: [
      "Up to 40 friends",
      "Tape page with every liner note",
      "Each song opens in any music app",
      "Print-at-home PDF of the cards",
      "Online for 5 years, download it all",
    ],
    cta: "Start a digital tape",
  },
  {
    id: "boxed",
    name: "Boxed",
    priceZar: 899,
    tagline: "Printed liner-note cards in a keepsake tape box.",
    tracks: 40,
    printed: true,
    featured: true,
    features: [
      "Everything in Digital",
      "One printed card per friend, with a QR code",
      "J-card tracklist insert",
      "Rigid tape box, delivered",
      "Every card checked before it prints",
    ],
    cta: "Start a boxed tape",
  },
  {
    id: "double",
    name: "Double album",
    priceZar: 1299,
    tagline: "For big families and bigger parties.",
    tracks: 80,
    printed: true,
    features: ["Everything in Boxed", "Up to 80 friends", "Two J-cards, four sides", "A deeper box for twice the cards"],
    cta: "Start a double album",
  },
];

export const planById = (id: string): Plan => plans.find((p) => p.id === id) ?? plans[1];
export const formatZar = (n: number) => "R" + n.toLocaleString("en-ZA");
export const isPrinted = (planId: string) => planById(planId).printed;
