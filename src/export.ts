/**
 * HTML export of the current Pi session.
 *
 * Two strategies, per the project plan:
 *
 *  - B1 (default): shell out to the public `pi --export <session> <out>` CLI.
 *    Zero coupling, survives internal refactors.
 *  - B3 (opt-in via PI_OPENGIST_USE_INPROCESS=1): deep-import Pi's internal
 *    `exportSessionToHtml` for in-process speed, at the cost of relying on an
 *    internal module path.
 *
 * Both return the HTML string. Callers never see the strategy.
 */

import { spawnSync } from "node:child_process"
import { readFileSync as fsReadFileSync } from "node:fs"
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent"

export type ReadFile = (path: string, encoding: "utf8") => string

/** Minimal subset of spawnSync result that export.ts consumes. */
export interface SpawnResult {
  status: number | null
  stdout: string
  stderr: string
}

export type SpawnFn = (command: string, args: string[]) => SpawnResult

export interface ExportOptions {
  /** Injectable spawn (for tests). Defaults to node's spawnSync. */
  spawnImpl?: SpawnFn
  /** Injectable file reader (for tests). Defaults to node's fs.readFileSync. */
  readImpl?: ReadFile
}

/** Raised when neither the session file nor the export could be produced. */
export class ExportError extends Error {
  code: string
  constructor(message: string, code: string) {
    super(message)
    this.name = "ExportError"
    this.code = code
  }
}

/**
 * Export the session attached to `ctx` to a self-contained HTML string.
 */
export async function exportSessionHtml(
  ctx: ExtensionCommandContext,
  opts: ExportOptions = {},
): Promise<string> {
  const sessionFile = ctx.sessionManager.getSessionFile()
  if (!sessionFile) {
    throw new ExportError("No active session to export (ephemeral session)", "nosession")
  }

  if (process.env.PI_OPENGIST_USE_INPROCESS === "1") {
    return await exportInProcess(ctx)
  }
  return exportViaCli(
    sessionFile,
    opts.readImpl ?? fsReadFileSync,
    opts.spawnImpl ?? adaptSpawn(spawnSync),
  )
}

/** B1: `pi --export <session> <output>` then read the file.
 *
 * We pass an explicit output path so we don't depend on Pi's `<session>.html`
 * naming convention; `pi --export` prints `Exported to: <path>` to stdout,
 * which we parse defensively as a fallback.
 */
function exportViaCli(sessionFile: string, readImpl: ReadFile, spawnImpl: SpawnFn): string {
  const outPath = `${sessionFile}.pi-share-og.html`
  const result = spawnImpl("pi", ["--export", sessionFile, outPath])

  if (result.status !== 0) {
    throw new ExportError(
      `pi --export failed: ${result.stderr || result.stdout || "unknown error"}`,
      "spawn",
    )
  }

  // Prefer the path Pi actually wrote. `pi --export` prints
  // `Exported to: <path>` to stdout; parse it (stripping the prefix and any
  // trailing blank line) and trust that over the path we requested.
  let target = outPath
  const printed = result.stdout
    ?.split("\n")
    .map((l) => l.replace(/^Exported to:\s*/, "").trim())
    .filter(Boolean)
    .pop()
  if (printed) target = printed

  try {
    return readImpl(target, "utf8")
  } catch (e) {
    throw new ExportError(
      `Could not read exported HTML at ${target}: ${(e as Error).message}`,
      "read",
    )
  }
}

/** Wrap node's spawnSync into the minimal SpawnFn shape, passing utf-8. */
function adaptSpawn(fn: typeof spawnSync): SpawnFn {
  return (command, args) => {
    const r = fn(command, args, { encoding: "utf-8" })
    return {
      status: r.status,
      stdout: typeof r.stdout === "string" ? r.stdout : "",
      stderr: typeof r.stderr === "string" ? r.stderr : "",
    }
  }
}

/**
 * B3: deep-import the internal exporter for an in-process fast path.
 *
 * Wrapped in dynamic import + try/catch so a missing/moved internal module
 * degrades gracefully to the CLI strategy instead of crashing the command.
 */
async function exportInProcess(ctx: ExtensionCommandContext): Promise<string> {
  try {
    // Resolve the installed pi package dir, then deep-import its internal
    // export-html module. Any failure (missing module, moved path, shape
    // change) is caught and surfaced as a clear, actionable error.
    const pkgUrl = import.meta.resolve("@earendil-works/pi-coding-agent/package.json")
    const base = pkgUrl.replace(/\/package\.json$/, "")
    const mod = await import(`${base}/dist/core/export-html/index.js`)
    const html = await mod.exportSessionToHtml(ctx.sessionManager)
    if (typeof html !== "string") {
      throw new Error("exportSessionToHtml did not return a string")
    }
    return html
  } catch (e) {
    throw new ExportError(
      `In-process export failed (${(e as Error).message}); unset PI_OPENGIST_USE_INPROCESS to use the CLI`,
      "inprocess",
    )
  }
}
