# Opengist Web Viewer

A minimal, **zero-build, fully client-side** viewer for HTML gists hosted on a
self-hosted [Opengist](https://opengist.io) instance. Modelled on
`https://pi.dev/share`.

Open the viewer bare and you get a single centered form — paste an Opengist
URL, hit **View**. Open a share link (`…/#<opengist-url>`) and the gist
**renders full-screen**, filling the entire viewport as if it's the only
content (that's the whole point). Styling is plain semantic HTML +
[Pico.css](https://picocss.com) from CDN (`cdn.jsdelivr.net`); the only custom
CSS is ~3 lines of layout to full-bleed the iframe (Pico doesn't do that).
There's no build step.

Give it an Opengist URL; it fetches the gist via the Opengist API and renders the
HTML in a sandboxed `<iframe>`. Nothing runs server-side — drop the single
`index.html` on any static host (GitHub Pages, Netlify, S3, `python -m http.server`,
or open it via `file://`; the Pico stylesheet loads from CDN, so you'll want
network access for first paint).

See [`SPECS.md`](./SPECS.md) for the full design and the Opengist API grounding.

## Usage

Open the viewer with the gist URL in the **fragment**:

```
https://your-host/#https://gist.l3x.in/alex/1234
```

…or just open the page and paste the URL into the form.

A **bare uuid** also works if you set `DEFAULT_HOST` at the top of `index.html`:

```
https://your-host/#8622b297bce54b408e36d546cef8019d
```

but the **full URL in the fragment** is recommended — it's host-agnostic and
needs no configuration.

### Run locally

```bash
cd webviewer
python3 -m http.server 8080
# open http://localhost:8080/#https://gist.l3x.in/alex/1234
```

(`file://` works too because the app is a single non-module inline script.)

## How it resolves a gist

| Input | Endpoint hit |
|---|---|
| `https://h/u/slug` | `GET https://h/u/slug.json` (resolves by **slug**) |
| bare uuid + host | `GET https://h/api/gists/<uuid>` (resolves by **uuid**) |
| `https://h/api/gists/<uuid>` | `GET https://h/api/gists/<uuid>` |

If the returned file is `truncated`, it falls back to the web raw route
`GET https://h/<owner>/<slug>/raw/HEAD/<file>`.

Cross-origin browser fetch works because Opengist enables Echo's CORS middleware
with a default `Access-Control-Allow-Origin: *` on GET routes (see `SPECS.md`).

## Security model

- Gist HTML is rendered in a **sandboxed `<iframe srcdoc>`**
  (`allow-scripts allow-same-origin allow-popups allow-forms allow-modals`), so a
  Pi session export keeps its interactivity without touching the viewer's DOM.
  `allow-scripts + allow-same-origin` is the standard tradeoff for trusted
  content you chose to open; don't use this to view gists from people you don't
  trust.
- Non-HTML gists are shown as escaped `<pre>` text.
- The viewer sends **no credentials**; only `public`/`unlisted` gists are
  reachable. `private` gists will 404.
- A `<meta>` CSP restricts `connect-src` to `https:`/`http:` so any self-hosted
  instance is reachable.

## Integrating with `pi-share-opengist`

The extension's `buildShareUrl()` currently emits `<viewer>#<uuid>`. Two options:

- **Recommended (host-agnostic):** have it emit the **full Opengist URL** in the
  fragment: `<viewer>#<gist.url>`. The viewer resolves host/user/slug from it
  with no configuration.
- **Keep `<viewer>#<uuid>`:** set `DEFAULT_HOST` at the top of `index.html`,
  and the viewer resolves via the `/api/gists/<uuid>` endpoint.

This viewer does not modify the extension; that wiring is a separate change.
