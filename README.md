# XMPro Markdown Viewer

A polished, configurable markdown viewer for XMPro App Designer. Drop it on
any page, point it at your content, and ship.

```
metablock/    Three files. Upload to XMPro App Designer as-is.
harness/      Self-contained local preview with 8 example documents.
docs/         Configuration & background reference.
```

## What's in the metablock

Three files — that's the entire deliverable:

| File | Purpose |
|------|---------|
| [`metablock/main.html`](metablock/main.html) | Structural shell + CDN script tags |
| [`metablock/main.css`](metablock/main.css) | Themes, backgrounds, typography, layout, feature styles |
| [`metablock/main.js`](metablock/main.js) | Renderer (marked + DOMPurify + Prism), config, postMessage bus |

External libraries load from jsdelivr. No App Files uploads required.

## Features

- **5 themes** — auto, light, dark, xmpro-light, xmpro-dark — plus a custom
  accent color (any CSS color).
- **11 backgrounds** — solid, gradient, xmpro, dots, grid, paper, glass,
  mesh, aurora, image, none. See [`docs/BACKGROUNDS.md`](docs/BACKGROUNDS.md).
- **Container-query responsive** — adapts to its own iframe size, not the
  user's browser size. Works from 320px to 4K.
- **GitHub-flavoured markdown** — tables, task lists, strikethrough, fenced
  code blocks, autolinks, GitHub-style callouts (`> [!NOTE]`).
- **Syntax highlighting** — 200+ languages via Prism autoloader, theme-aware.
- **Math** — KaTeX, lazy-loaded only when math is enabled AND used.
- **Diagrams** — Mermaid, lazy-loaded only when diagrams are enabled AND used.
- **Auto TOC** — four positions including a floating FAB for narrow widths,
  with scroll-spy active-section highlighting.
- **Reading progress bar**, **in-document search** (Ctrl/Cmd-F),
  **image lightbox**, **code copy buttons**, **heading anchors**.
- **Live updates** — accepts streaming content via `onDataChanged`.
- **postMessage protocol** — for inter-metablock coordination (siblings can
  drive the viewer).

## Quick start

### Deploy to XMPro

1. Drop a **Metablock** onto a page in App Designer.
2. Open **Block Properties** and upload:
   - `metablock/main.html` → Presentation File
   - `metablock/main.css`  → Styling File
   - `metablock/main.js`   → Script File
3. Configure **Value Mapping** (see [`docs/VALUE_MAPPING.md`](docs/VALUE_MAPPING.md))
   — at minimum, set `content` or `markdown_url`, or connect a Data Source.
4. Save and launch the page.

### Preview locally

```bash
cd harness
npm start
```

Then open <http://localhost:3000>.

The harness has live controls for every customization option, a postMessage
log, and 8 curated example documents. See [`harness/README.md`](harness/README.md).

## Minimum viable Value Mapping

The smallest useful configuration:

```json
{
    "content": "# Hello\nThis is **markdown**."
}
```

Or fetch from a URL:

```json
{
    "markdown_url": "https://raw.githubusercontent.com/your/repo/main/README.md"
}
```

Or hook up a Data Source with a `markdown` field — the viewer pulls
content from the first record automatically.

## Live updating content

The viewer accepts streaming updates without any special configuration. As
long as the host calls `onDataChanged(data, changes)` with an array
containing a `markdown` / `content` / `text` field, the viewer re-renders.

The viewer hashes content to avoid re-rendering identical input, so duplicate
calls are cheap.

## Inter-metablock messaging

Sibling metablocks can drive the viewer:

```javascript
// From a sibling metablock — replace the viewer's content
window.parent.postMessage({
    source: 'xmpro-metablock',
    type: 'markdown:set-content',
    data: { content: '# New content' },
    metablockId: 'sibling-id'
}, '*');

// Or flip the theme
window.parent.postMessage({
    source: 'xmpro-metablock',
    type: 'markdown:set-theme',
    data: { theme: 'dark' },
    metablockId: 'sibling-id'
}, '*');
```

Full protocol in [`docs/VALUE_MAPPING.md`](docs/VALUE_MAPPING.md#postmessage-protocol).

## Architecture notes

- **marked** for parsing (~30 KB gzipped)
- **DOMPurify** for sanitization (~22 KB) — every render passes through it
- **Prism** for syntax highlighting (~18 KB core + per-language autoload)
- **KaTeX** (~280 KB) only loaded when math is enabled AND content has math
- **Mermaid** (~600 KB) only loaded when diagrams are enabled AND content has diagrams
- All external resources served from `jsdelivr` — no AppFiles dependency
- CSS uses **container queries** (not viewport queries) for true iframe-aware
  responsive behavior

## License

Internal XMPro tooling.
