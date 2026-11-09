/** Calls to the API on the same site (Pages Functions at /api/*). Errors come back as ApiError. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public field?: string,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const h = new Headers(headers);
  if (json !== undefined) h.set("Content-Type", "application/json");
  let res: Response;
  try {
    res = await fetch(path, { credentials: "same-origin", ...rest, headers: h, body: json !== undefined ? JSON.stringify(json) : rest.body });
  } catch {
    throw new ApiError(0, "network", "We couldn't reach the server. Check your connection and try again.");
  }
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: string; message?: string; field?: string };
    throw new ApiError(res.status, b.error ?? "error", b.message ?? `Something went wrong (${res.status}).`, b.field);
  }
  return body as T;
}

/** Turn a data URL (the resized photo) back into a Blob for upload. */
export async function dataUrlToBlob(dataUrl: string) {
  return (await fetch(dataUrl)).blob();
}

/** Shapes the API returns. Kept loose on purpose: the API is the source of truth. */
export interface ApiTape {
  id: string;
  slug: string;
  honoree: string;
  occasion: string;
  bornYear: number;
  partyDate: string;
  planId: string;
  inkId: string;
  invited: number;
  status: string;
  open: boolean;
  closeAt: string;
  closeIsCustom: boolean;
  suggestedCloseAt: string;
  latestCloseAt: string;
  printRun: string | null;
  createdAt: string;
}

export interface ApiTrack {
  id: string;
  position: number;
  contributor: string;
  tagline: string;
  since: string;
  song: string;
  artist: string;
  link: string | null;
  songPageUrl: string | null;
  message: string;
  photo: string | null;
  qr: string;
  status: "new" | "approved" | "hidden";
  createdAt: string;
  updatedAt: string;
}

export interface PublicTape {
  slug: string;
  honoree: string;
  occasion: string;
  bornYear: number;
  inkId: string;
  planId: string;
  state: "open" | "closed" | "live";
  closeAt: string;
  organiserName: string | null;
  tracks: ApiTrack[];
}
