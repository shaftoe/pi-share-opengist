/**
 * Unit tests for opengist.ts — GitHub-compatible gist upload.
 */

import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test"
import { OpengistError, uploadGist } from "../src/opengist"

function okResponse(body: unknown): Response {
  return {
    ok: true,
    status: 201,
    text: () => Promise.resolve(JSON.stringify(body)),
    json: () => Promise.resolve(body),
  } as Response
}

function errResponse(status: number, body = ""): Response {
  return {
    ok: false,
    status,
    statusText: `HTTP ${status}`,
    text: () => Promise.resolve(body),
    json: () => Promise.resolve({}),
  } as Response
}

describe("uploadGist", () => {
  let mockFetch: any

  beforeEach(() => {
    mockFetch = mock(() => Promise.resolve(okResponse({})))
  })

  afterEach(() => {
    mockFetch.mockRestore()
  })

  it("posts to {host}/api/gists with bearer token and returns id+url", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(
        okResponse({
          html_url: "https://gist.l3x.in/alex/abc123",
          uuid: "abc123",
        }),
      ),
    )

    const result = await uploadGist("https://gist.l3x.in", "tok", "<html>", {
      fetchImpl: mockFetch,
    })

    expect(result.id).toBe("abc123")
    expect(result.url).toBe("https://gist.l3x.in/alex/abc123")

    const [url, init] = mockFetch.mock.calls[0]
    expect(url).toBe("https://gist.l3x.in/api/gists")
    expect(init.method).toBe("POST")
    const headers = init.headers as Record<string, string>
    expect(headers.Authorization).toBe("Bearer tok")
    expect(headers["Content-Type"]).toBe("application/json")
    const body = JSON.parse(init.body)
    expect(body.files["session.html"].content).toBe("<html>")
    expect(body.visibility).toBe("unlisted")
    expect(body.description).toBe("pi session")
  })

  it("defaults to unlisted visibility", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://h/u/i", uuid: "i" })),
    )
    await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.visibility).toBe("unlisted")
  })

  it("respects visibility=public", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://h/u/i", uuid: "i" })),
    )
    await uploadGist("https://h", "t", "x", { visibility: "public", fetchImpl: mockFetch })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.visibility).toBe("public")
  })

  it("respects visibility=private", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://h/u/i", uuid: "i" })),
    )
    await uploadGist("https://h", "t", "x", { visibility: "private", fetchImpl: mockFetch })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.visibility).toBe("private")
  })

  it("prefers slug_url over derived url when html_url is absent", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ slug_url: "https://h/u/slug", uuid: "i" })),
    )
    const result = await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
    expect(result.url).toBe("https://h/u/slug")
  })

  it("derives id from the url's last path segment when uuid/id absent", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://gist.l3x.in/alex/segid" })),
    )
    const result = await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
    expect(result.id).toBe("segid")
  })

  it("prefers id over url-derived segment", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://h/u/fromurl", id: "explicitid" })),
    )
    const result = await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
    expect(result.id).toBe("explicitid")
  })

  it("throws OpengistError with status code on 401", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(errResponse(401, "unauthorized")))
    try {
      await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
      expect.unreachable("should throw")
    } catch (e) {
      expect(e).toBeInstanceOf(OpengistError)
      expect((e as OpengistError).code).toBe("http401")
      expect((e as OpengistError).message).toContain("401")
      expect((e as OpengistError).message).toContain("unauthorized")
    }
  })

  it("throws OpengistError on 500 with empty body", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(errResponse(500, "")))
    try {
      await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
      expect.unreachable("should throw")
    } catch (e) {
      expect((e as OpengistError).code).toBe("http500")
    }
  })

  it("wraps fetch network errors as OpengistError", async () => {
    mockFetch.mockImplementationOnce(() => Promise.reject(new TypeError("fetch failed")))
    try {
      await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
      expect.unreachable("should throw")
    } catch (e) {
      expect(e).toBeInstanceOf(OpengistError)
      expect((e as OpengistError).code).toBe("network")
      expect((e as OpengistError).message).toContain("fetch failed")
    }
  })

  it("rethrows AbortError without wrapping", async () => {
    const ab = new Error("aborted")
    ab.name = "AbortError"
    mockFetch.mockImplementationOnce(() => Promise.reject(ab))
    try {
      await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
      expect.unreachable("should throw")
    } catch (e) {
      expect(e).toBe(ab)
      expect(e).not.toBeInstanceOf(OpengistError)
    }
  })

  it("throws when response is missing a gist URL", async () => {
    mockFetch.mockImplementationOnce(() => Promise.resolve(okResponse({ foo: "bar" })))
    try {
      await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
      expect.unreachable("should throw")
    } catch (e) {
      expect((e as OpengistError).code).toBe("badresponse")
    }
  })

  it("throws badjson when the success body is not valid JSON", async () => {
    mockFetch.mockImplementationOnce(() => {
      const r: any = okResponse({})
      r.json = () => Promise.reject(new SyntaxError("Unexpected token"))
      return Promise.resolve(r)
    })
    try {
      await uploadGist("https://h", "t", "x", { fetchImpl: mockFetch })
      expect.unreachable("should throw")
    } catch (e) {
      expect((e as OpengistError).code).toBe("badjson")
    }
  })

  it("honors custom description and filename", async () => {
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://h/u/i", uuid: "i" })),
    )
    await uploadGist("https://h", "t", "x", {
      fetchImpl: mockFetch,
      description: "pi: my session (claude)",
      filename: "pi-my-session-2026.html",
    })
    const body = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(body.description).toBe("pi: my session (claude)")
    expect(Object.keys(body.files)[0]).toBe("pi-my-session-2026.html")
    expect(body.files["pi-my-session-2026.html"].content).toBe("x")
  })

  it("passes the abort signal through to fetch", async () => {
    const ac = new AbortController()
    mockFetch.mockImplementationOnce(() =>
      Promise.resolve(okResponse({ html_url: "https://h/u/i", uuid: "i" })),
    )
    await uploadGist("https://h", "t", "x", {
      fetchImpl: mockFetch,
      signal: ac.signal,
    })
    expect(mockFetch.mock.calls[0][1].signal).toBe(ac.signal)
  })
})
