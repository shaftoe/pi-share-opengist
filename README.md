# @alexanderfortin/pi-share-opengist

A [Pi](https://pi.dev) extension that exports the current session to the same self-contained HTML Pi already produces for `/export`, uploads it to a self-hosted [Opengist](https://opengist.io/) instance, and prints a shareable link — without relying on the GitHub CLI or GitHub gists.

Built-in `/share` stays untouched; this is an additive extension.

## Install

```bash
pi extension add @alexanderfortin/pi-share-opengist
```

Or, for local development:

```bash
git clone https://github.com/shaftoe/pi-share-opengist
cd pi-share-opengist
bun install
bun run build
pi extension add ./dist/index.js
```

## Configuration

All configuration is via environment variables (consistent with Pi's existing `PI_SHARE_VIEWER_URL` convention), so the extension stays stateless.

| Var | Required | Example | Purpose |
|---|---|---|---|
| `PI_OPENGIST_HOST` | yes | `https://gist.l3x.in` | Opengist base URL (no trailing slash) |
| `PI_OPENGIST_TOKEN` | yes | `og_…` | Bearer token for `POST /api/gists` |
| `PI_OPENGIST_VISIBILITY` | no | `unlisted` | `public` \| `unlisted` \| `private` (gist visibility) |
| `PI_OPENGIST_PUBLIC` | no | — | Legacy: `true` maps to `public` (overridden by `PI_OPENGIST_VISIBILITY`) |
| `PI_SHARE_VIEWER_URL` | no | `https://pi.dev/session/` | If set, build `<viewer>#<gistId>`; else return raw Opengist URL |
| `PI_OPENGIST_USE_INPROCESS` | no | `1` | Opt-in fast path: deep-import Pi's internal exporter instead of shelling out to `pi --export` |

Set them in your shell rc (`~/.zshrc`, etc.) or Pi's launch environment, then restart Pi.

## Usage

In a Pi session with some content, run:

```
/share-og
```

You'll get a notification with the share URL (copied to the clipboard when
available). If `PI_SHARE_VIEWER_URL` is unset, the URL points straight at the
Opengist HTML view of the gist.

## How it works

1. Reads host + token from env; bails with a clear error if missing.
2. Exports the active session to HTML. By default it shells out to the public
   `pi --export <session>` CLI (zero coupling to Pi internals). Set
   `PI_OPENGIST_USE_INPROCESS=1` to instead deep-import Pi's internal
   `exportSessionToHtml` for an in-process fast path (relies on an internal
   module path; can break on minor Pi versions).
3. `POST {host}/api/gists` with an Opengist body, `Authorization: Bearer
   <token>`, and `visibility: "unlisted"` by default (reachable by link, not
   listed publicly).
4. Parses the returned gist URL/UUID.
5. Builds the share URL (honoring `PI_SHARE_VIEWER_URL`), copies it to the
   clipboard, and notifies.
6. Respects `ctx.signal` so `Esc` cancels the upload.

## Troubleshooting

- **"Set PI_OPENGIST_HOST and PI_OPENGIST_TOKEN…"** — both env vars are required.
- **`Share failed: Opengist responded 401: …`** — the token is invalid/expired.
- **`pi --export failed`** — make sure `pi` is on your `PATH` in Pi's launch
  environment, or switch to the in-process path via `PI_OPENGIST_USE_INPROCESS=1`.
- **`In-process export failed …`** — the internal Pi module moved; unset
  `PI_OPENGIST_USE_INPROCESS` to fall back to the CLI.

## Development

```bash
bun install
bun run check      # typecheck + lint
bun test           # unit tests
bun run build      # typecheck + emit dist/
bun run release:dry-run
```

Pre-commit hooks run via [lefthook](https://github.com/evilmartians/lefthook):
format, lint, and tests.

## License

MIT © Alexander Fortin
