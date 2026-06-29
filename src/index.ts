/**
 * pi-share-opengist — Pi extension
 *
 * Registers the `/share-og` command: exports the current session to the same
 * self-contained HTML Pi produces for `/export`, uploads it to a self-hosted
 * Opengist instance, and surfaces a shareable link.
 *
 * Built-in `/share` is left untouched; this is additive.
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { copyToClipboard } from "./clipboard"
import { exportSessionHtml } from "./export"
import { buildGistMeta } from "./meta"
import { uploadGist, type Visibility } from "./opengist"

/** Resolve gist visibility from env, defaulting to unlisted.
 *
 * Precedence: explicit `PI_OPENGIST_VISIBILITY` (public|unlisted|private)
 * wins; otherwise the legacy `PI_OPENGIST_PUBLIC=true` maps to `public`.
 * Anything else falls back to `unlisted` (link-only, not listed publicly).
 */
export function resolveVisibility(): Visibility {
  const explicit = process.env.PI_OPENGIST_VISIBILITY?.trim().toLowerCase()
  if (explicit === "public" || explicit === "unlisted" || explicit === "private") {
    return explicit
  }
  if (process.env.PI_OPENGIST_PUBLIC === "true") return "public"
  return "unlisted"
}

/** Read + validate the Opengist config from the environment. */
function readConfig(): { host: string; token: string; visibility: Visibility } | null {
  const host = process.env.PI_OPENGIST_HOST
  const token = process.env.PI_OPENGIST_TOKEN
  if (!host || !token) return null
  return {
    host: host.replace(/\/+$/, ""),
    token,
    visibility: resolveVisibility(),
  }
}

/** Build the final share URL honoring PI_SHARE_VIEWER_URL when set. */
export function buildShareUrl(gistId: string, gistUrl: string): string {
  const viewer = process.env.PI_SHARE_VIEWER_URL
  return viewer ? `${viewer}#${gistId}` : gistUrl
}

export default function piShareOpengist(pi: ExtensionAPI): void {
  pi.registerCommand("share-og", {
    description: "Share the current session as HTML to a self-hosted Opengist",
    handler: async (_args, ctx) => {
      const cfg = readConfig()
      if (!cfg) {
        ctx.ui.notify("Set PI_OPENGIST_HOST and PI_OPENGIST_TOKEN to use /share-og", "error")
        return
      }

      ctx.ui.setStatus("share-og", "Sharing…")
      try {
        const html = await exportSessionHtml(ctx)
        const meta = buildGistMeta({
          sessionName: ctx.sessionManager.getSessionName(),
          cwd: ctx.cwd,
          modelId: ctx.model?.id,
        })
        const gist = await uploadGist(cfg.host, cfg.token, html, {
          visibility: cfg.visibility,
          description: meta.description,
          filename: meta.filename,
          ...(ctx.signal ? { signal: ctx.signal } : {}),
        })

        const url = buildShareUrl(gist.id, gist.url)
        if (copyToClipboard(url)) {
          ctx.ui.notify(`Shared (copied): ${url}`, "info")
        } else {
          ctx.ui.notify(`Shared: ${url}`, "info")
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        ctx.ui.notify(`Share failed: ${msg}`, "error")
      } finally {
        ctx.ui.setStatus("share-og", undefined)
      }
    },
  })
}
