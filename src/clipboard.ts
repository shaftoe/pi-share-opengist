/**
 * Minimal, dependency-free clipboard helper.
 *
 * Pi's own clipboard util (`dist/utils/clipboard.js`) is not part of the
 * public API, so we ship a tiny standalone version that tries the common
 * platform tools and falls back to OSC 52 for remote/tmux sessions.
 * Failures are swallowed — clipboard is a nice-to-have, never blocking.
 */

import { execFileSync } from "node:child_process"
import { platform } from "node:os"

const MAX_OSC52 = 100_000

/** Copy text to the system clipboard. Returns true on best-effort success. */
export function copyToClipboard(text: string): boolean {
  if (process.env.SSH_CONNECTION || process.env.SSH_CLIENT || process.env.MOSH_CONNECTION) {
    return emitOsc52(text)
  }

  const p = platform()
  try {
    if (p === "darwin") {
      execFileSync("pbcopy", { input: text, stdio: ["pipe", "ignore", "ignore"] })
      return true
    }
    if (p === "linux") {
      execFileSync("wl-copy", { input: text, stdio: ["pipe", "ignore", "ignore"] })
      return true
    }
  } catch {
    // fall through to OSC 52
  }
  return emitOsc52(text)
}

/** Emit an OSC 52 escape sequence; works in most modern terminals + tmux. */
function emitOsc52(text: string): boolean {
  const encoded = Buffer.from(text).toString("base64")
  if (encoded.length > MAX_OSC52) return false
  process.stdout.write(`\x1b]52;c;${encoded}\x07`)
  return true
}
