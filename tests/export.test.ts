/**
 * Unit tests for export.ts — CLI subprocess strategy (B1).
 *
 * The in-process (B3) path depends on internal Pi modules and is exercised
 * only against a real install; here we cover the deterministic CLI path
 * using injectable spawn + reader implementations.
 */

import { beforeEach, describe, expect, it, mock } from "bun:test"
import type { ExtensionCommandContext } from "@earendil-works/pi-coding-agent"
import { exportSessionHtml, type ReadFile } from "../src/export"

function mockCtx(sessionFile: string | null): ExtensionCommandContext {
  return {
    sessionManager: { getSessionFile: () => sessionFile },
  } as unknown as ExtensionCommandContext
}

/** Minimal stub matching the SpawnSyncReturns fields export.ts reads. */
type SpawnStub = { status: number | null; stdout: string; stderr: string }

describe("exportSessionHtml (CLI path)", () => {
  beforeEach(() => {
    delete process.env.PI_OPENGIST_USE_INPROCESS
  })

  it("throws when there is no active session", async () => {
    try {
      await exportSessionHtml(mockCtx(null))
      expect.unreachable("should throw")
    } catch (e) {
      expect((e as Error).message).toContain("No active session")
      expect((e as { code: string }).code).toBe("nosession")
    }
  })

  it("passes an explicit output path and reads the HTML it asked for", async () => {
    const calls: unknown[][] = []
    const spawnImpl = mock((_c: string, _a: string[]) => {
      calls.push([_c, _a])
      // Real Pi prints `Exported to: <path>` to stdout.
      return {
        status: 0,
        stdout: `Exported to: /s/s.jsonl.pi-share-og.html\n`,
        stderr: "",
      } satisfies SpawnStub
    }) as never
    const readImpl = mock(() => "<html>body</html>") as unknown as ReadFile & {
      mock: { calls: string[][] }
    }

    const html = await exportSessionHtml(mockCtx("/s/s.jsonl"), { spawnImpl, readImpl })

    expect(html).toBe("<html>body</html>")
    // An explicit output path is passed so we don't depend on Pi's naming.
    expect(calls[0]?.[0]).toBe("pi")
    expect(calls[0]?.[1]).toEqual(["--export", "/s/s.jsonl", "/s/s.jsonl.pi-share-og.html"])
    expect(readImpl.mock.calls[0]?.[0]).toBe("/s/s.jsonl.pi-share-og.html")
  })

  it("reads the explicit output path when stdout is empty", async () => {
    const spawnImpl = mock(() => ({ status: 0, stdout: "", stderr: "" }) as SpawnStub) as never
    let readPath = ""
    const readImpl = ((p: string) => {
      readPath = p
      return "<html/>"
    }) as ReadFile
    await exportSessionHtml(mockCtx("/s/s.jsonl"), { spawnImpl, readImpl })
    expect(readPath).toBe("/s/s.jsonl.pi-share-og.html")
  })

  it("strips the `Exported to: ` prefix when parsing the printed path", async () => {
    let readPath = ""
    const readImpl = ((p: string) => {
      readPath = p
      return "<html/>"
    }) as ReadFile
    const spawnImpl = mock(
      () =>
        ({
          status: 0,
          stdout: "Exported to: /elsewhere/out.html\n",
          stderr: "",
        }) as SpawnStub,
    ) as never
    await exportSessionHtml(mockCtx("/s/s.jsonl"), { spawnImpl, readImpl })
    expect(readPath).toBe("/elsewhere/out.html")
  })

  it("throws a spawn error on non-zero exit", async () => {
    const spawnImpl = mock(() => ({ status: 1, stdout: "", stderr: "boom" }) as SpawnStub) as never
    try {
      await exportSessionHtml(mockCtx("/s/s.jsonl"), { spawnImpl })
      expect.unreachable("should throw")
    } catch (e) {
      expect((e as Error).message).toContain("boom")
      expect((e as { code: string }).code).toBe("spawn")
    }
  })
})
