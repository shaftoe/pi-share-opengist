/**
 * Opengist API client — create endpoint.
 *
 * Posts a single HTML file as a new gist to a self-hosted Opengist instance
 * and returns a stable id plus the canonical HTML URL. Uses Opengist's native
 * `visibility` field (public | unlisted | private) rather than GitHub's
 * boolean `public`, defaulting to **unlisted** so links work for anyone who
 * has them without being listed publicly.
 */

/** Opengist gist visibility levels. */
export type Visibility = "public" | "unlisted" | "private"

/** Shape of the JSON body we send to `POST {host}/api/gists`. */
export interface CreateGistBody {
  description: string
  visibility: Visibility
  files: Record<string, { content: string }>
}

/** Subset of the Opengist gist response we care about. */
export interface GistResponse {
  html_url?: string
  slug_url?: string
  url?: string
  uuid?: string
  id?: string
}

export interface GistResult {
  /** Stable gist identifier (uuid if present, else last URL path segment). */
  id: string
  /** Canonical gist URL returned by the server. */
  url: string
}

export interface UploadGistOptions {
  /** Gist visibility. Defaults to "unlisted" (reachable by link, not listed). */
  visibility?: Visibility
  /** Optional abort signal so the upload can be cancelled (Esc). */
  signal?: AbortSignal
  /** Injectable fetch (defaults to global). Enables unit testing. */
  fetchImpl?: typeof fetch
  /** Gist description. Defaults to "pi session". */
  description?: string
  /** Filename for the single HTML file. Defaults to "session.html". */
  filename?: string
}

/**
 * Create a gist on a self-hosted Opengist instance.
 *
 * @param host   Opengist base URL, no trailing slash (e.g. https://gist.l3x.in)
 * @param token  Bearer token (Opengist personal access token)
 * @param html   HTML body of the single-file gist
 * @param opts   visibility + abort signal + description/filename
 * @throws {OpengistError} on any non-2xx response or network failure
 */
export async function uploadGist(
  host: string,
  token: string,
  html: string,
  opts: UploadGistOptions = {},
): Promise<GistResult> {
  const doFetch = opts.fetchImpl ?? fetch

  const body: CreateGistBody = {
    description: opts.description ?? "pi session",
    visibility: opts.visibility ?? "unlisted",
    files: { [opts.filename ?? "session.html"]: { content: html } },
  }

  let res: Response
  try {
    const init: RequestInit = {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    }
    if (opts.signal) init.signal = opts.signal
    res = await doFetch(`${host}/api/gists`, init)
  } catch (e) {
    if ((e as Error)?.name === "AbortError") throw e
    throw new OpengistError(`Network error contacting Opengist: ${(e as Error).message}`, "network")
  }

  if (!res.ok) {
    const text = await safeText(res)
    throw new OpengistError(
      `Opengist responded ${res.status}: ${text || res.statusText}`,
      `http${res.status}`,
    )
  }

  const data = (await safeJson(res)) as GistResponse
  const url = data.html_url ?? data.slug_url ?? data.url ?? ""
  if (!url) {
    throw new OpengistError("Opengist response missing gist URL", "badresponse")
  }
  const id = data.uuid ?? data.id ?? url.split("/").pop() ?? ""
  if (!id) {
    throw new OpengistError("Could not derive gist id from response", "badresponse")
  }

  return { id, url }
}

/** Error class carrying a short machine code for diagnostics. */
export class OpengistError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "OpengistError"
    this.code = code
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text()
  } catch {
    return ""
  }
}

async function safeJson(res: Response): Promise<unknown> {
  try {
    return await res.json()
  } catch (e) {
    throw new OpengistError(`Opengist returned invalid JSON: ${(e as Error).message}`, "badjson")
  }
}
