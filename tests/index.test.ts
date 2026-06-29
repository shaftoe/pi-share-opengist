/**
 * Unit tests for index.ts — config parsing and share URL building.
 *
 * The command handler itself is integration-ish (needs a full Pi context),
 * so we test the pure helpers it delegates to.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { buildShareUrl, resolveVisibility } from "../src/index"

const ENV_KEYS = [
  "PI_OPENGIST_HOST",
  "PI_OPENGIST_TOKEN",
  "PI_OPENGIST_PUBLIC",
  "PI_OPENGIST_VISIBILITY",
  "PI_SHARE_VIEWER_URL",
]

function snapshotEnv(): Record<string, string | undefined> {
  const snap: Record<string, string | undefined> = {}
  for (const k of ENV_KEYS) snap[k] = process.env[k]
  return snap
}

function restoreEnv(snap: Record<string, string | undefined>) {
  for (const k of ENV_KEYS) {
    if (snap[k] === undefined) delete process.env[k]
    else process.env[k] = snap[k]
  }
}

describe("buildShareUrl", () => {
  let snap: Record<string, string | undefined>

  beforeEach(() => {
    snap = snapshotEnv()
    delete process.env.PI_SHARE_VIEWER_URL
  })
  afterEach(() => restoreEnv(snap))

  it("returns the raw gist URL when no viewer is configured", () => {
    expect(buildShareUrl("id1", "https://gist.l3x.in/u/slug")).toBe("https://gist.l3x.in/u/slug")
  })

  it("builds <viewer>#<id> when PI_SHARE_VIEWER_URL is set", () => {
    process.env.PI_SHARE_VIEWER_URL = "https://pi.dev/session/"
    expect(buildShareUrl("id1", "https://gist.l3x.in/u/slug")).toBe("https://pi.dev/session/#id1")
  })
})

describe("resolveVisibility", () => {
  let snap: Record<string, string | undefined>

  beforeEach(() => {
    snap = snapshotEnv()
    delete process.env.PI_OPENGIST_VISIBILITY
    delete process.env.PI_OPENGIST_PUBLIC
  })
  afterEach(() => restoreEnv(snap))

  it("defaults to unlisted when nothing is set", () => {
    expect(resolveVisibility()).toBe("unlisted")
  })

  it("honors explicit PI_OPENGIST_VISIBILITY", () => {
    for (const v of ["public", "unlisted", "private"] as const) {
      process.env.PI_OPENGIST_VISIBILITY = v
      expect(resolveVisibility()).toBe(v)
    }
  })

  it("is case-insensitive for PI_OPENGIST_VISIBILITY", () => {
    process.env.PI_OPENGIST_VISIBILITY = "PUBLIC"
    expect(resolveVisibility()).toBe("public")
  })

  it("ignores invalid PI_OPENGIST_VISIBILITY and falls back", () => {
    process.env.PI_OPENGIST_VISIBILITY = "secret"
    expect(resolveVisibility()).toBe("unlisted")
  })

  it("maps legacy PI_OPENGIST_PUBLIC=true to public", () => {
    process.env.PI_OPENGIST_PUBLIC = "true"
    expect(resolveVisibility()).toBe("public")
  })

  it("explicit PI_OPENGIST_VISIBILITY wins over legacy PI_OPENGIST_PUBLIC", () => {
    process.env.PI_OPENGIST_PUBLIC = "true"
    process.env.PI_OPENGIST_VISIBILITY = "private"
    expect(resolveVisibility()).toBe("private")
  })
})
