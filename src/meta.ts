/**
 * Gist metadata builder.
 *
 * Turns the current Pi session context into a human-readable gist description
 * and a sensible filename, instead of the flat "pi session" default.
 *
 * Pure + injectable (context + clock) so it's fully unit-testable.
 */

import { basename } from "node:path"

/** Minimal slice of ExtensionCommandContext we read for metadata. */
export interface MetaContext {
  /** Session display name, if the user named the session. */
  sessionName?: string | undefined
  /** Current working directory. */
  cwd: string
  /** Active model id (e.g. "claude-sonnet-4-5"), if any. */
  modelId?: string | undefined
}

export interface GistMeta {
  /** One-line gist description. */
  description: string
  /** Filename for the single HTML file inside the gist. */
  filename: string
}

export interface BuildMetaOptions {
  /**
   * Injectable clock returning an ISO date string. Defaults to a frozen
   * snapshot captured at call time so behavior is deterministic in tests.
   */
  now?: () => Date
}

const MAX_DESCRIPTION = 250 // GitHub Gist API cap; Opengist is permissive but keep it safe.

/** Sanitize an arbitrary string into a safe gist filename stem. */
function slugify(s: string): string {
  return (
    s
      .trim()
      .toLowerCase()
      // collapse whitespace
      .replace(/\s+/g, "-")
      // drop anything that's not [a-z0-9._-]
      .replace(/[^a-z0-9._-]/g, "")
      // collapse repeated separators
      .replace(/[-_.]+/g, "-")
      .replace(/^-+|-+$/g, "") || "session"
  )
}

/** Format a Date as a compact, filename-safe UTC stamp: YYYY-MM-DDTHH-MM-SSZ. */
function stamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0")
  return (
    `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())}` +
    `T${p(d.getUTCHours())}-${p(d.getUTCMinutes())}-${p(d.getUTCSeconds())}Z`
  )
}

/**
 * Build gist metadata from the session context.
 *
 * Description shape: `pi: <title> (<model>) <cwd>`
 * - title = session name, else cwd basename, else "session"
 * - model omitted when unknown
 * - cwd shown relative to home when possible, for brevity
 *
 * Filename shape: `pi-<title>-<stamp>.html`
 */
export function buildGistMeta(ctx: MetaContext, opts: BuildMetaOptions = {}): GistMeta {
  const now = (opts.now ?? (() => new Date()))()
  const title = slugify(ctx.sessionName || basename(ctx.cwd || "") || "session")
  const filename = `pi-${title}-${stamp(now)}.html`

  const parts: string[] = ["pi:"]
  const displayTitle = ctx.sessionName?.trim() || basename(ctx.cwd || "") || "session"
  parts.push(displayTitle)
  if (ctx.modelId) parts.push(`(${ctx.modelId})`)
  const cwd = abbreviateHome(ctx.cwd)
  if (cwd) parts.push(cwd)

  let description = parts.join(" ")
  if (description.length > MAX_DESCRIPTION) {
    description = `${description.slice(0, MAX_DESCRIPTION - 1)}…`
  }

  return { description, filename }
}

/** Replace the home dir prefix with `~` for a shorter description. */
function abbreviateHome(cwd: string): string {
  if (!cwd) return ""
  const home = process.env.HOME
  if (home && (cwd === home || cwd.startsWith(`${home}/`))) {
    return `~${cwd.slice(home.length)}`
  }
  return cwd
}
