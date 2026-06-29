/**
 * Unit tests for meta.ts — gist description + filename building.
 */

import { afterEach, beforeEach, describe, expect, it } from "bun:test"
import { buildGistMeta } from "../src/meta"

const FIXED = new Date("2026-06-29T14:37:24Z")
const fixedNow = () => FIXED

describe("buildGistMeta", () => {
  let originalHome: string | undefined

  beforeEach(() => {
    originalHome = process.env.HOME
    process.env.HOME = "/Users/alex"
  })
  afterEach(() => {
    process.env.HOME = originalHome
  })

  it("uses the session name for title and description when present", () => {
    const meta = buildGistMeta(
      { sessionName: "Refactor export", cwd: "/Users/alex/git/repo", modelId: "claude-sonnet-4-5" },
      { now: fixedNow },
    )
    expect(meta.description).toBe("pi: Refactor export (claude-sonnet-4-5) ~/git/repo")
    expect(meta.filename).toBe("pi-refactor-export-2026-06-29T14-37-24Z.html")
  })

  it("falls back to cwd basename when no session name", () => {
    const meta = buildGistMeta(
      { cwd: "/Users/alex/git/pi-opengist", modelId: "gpt-4o" },
      { now: fixedNow },
    )
    expect(meta.description).toBe("pi: pi-opengist (gpt-4o) ~/git/pi-opengist")
    expect(meta.filename).toBe("pi-pi-opengist-2026-06-29T14-37-24Z.html")
  })

  it("omits the model clause when modelId is absent", () => {
    const meta = buildGistMeta({ cwd: "/Users/alex/x" }, { now: fixedNow })
    expect(meta.description).toBe("pi: x ~/x")
  })

  it("falls back to 'session' when both name and cwd are empty", () => {
    const meta = buildGistMeta({ cwd: "" }, { now: fixedNow })
    expect(meta.description).toBe("pi: session")
    expect(meta.filename).toBe("pi-session-2026-06-29T14-37-24Z.html")
  })

  it("abbreviates cwd with ~ only when under HOME", () => {
    const meta = buildGistMeta({ cwd: "/opt/srv/app" }, { now: fixedNow })
    expect(meta.description).toBe("pi: app /opt/srv/app")
  })

  it("slugifies special characters in the session name for the filename", () => {
    const meta = buildGistMeta(
      { sessionName: "Fix bug #42 / API!!", cwd: "/Users/alex/r" },
      { now: fixedNow },
    )
    expect(meta.filename).toBe("pi-fix-bug-42-api-2026-06-29T14-37-24Z.html")
  })

  it("truncates the description when it exceeds the cap", () => {
    const longName = "x".repeat(300)
    const meta = buildGistMeta({ sessionName: longName, cwd: "/Users/alex/r" }, { now: fixedNow })
    expect(meta.description.length).toBe(250)
    expect(meta.description.endsWith("…")).toBe(true)
  })
})
