# xmpro-markdown-viewer

> A polished, configurable markdown viewer for XMPro App Designer. Drop it on
> any page, point it at your content, and ship.

![version](https://img.shields.io/badge/version-1.0.0-blue)
![license](https://img.shields.io/badge/license-MIT-green)
![status](https://img.shields.io/badge/status-stable-success)

## Features

- **Five themes** — light, dark, auto, xmpro-light, xmpro-dark — plus a
  custom accent color.
- **Eleven backgrounds** — solid, gradient, xmpro, dots, grid, paper, glass,
  mesh, aurora, image, none.
- **GitHub-flavoured markdown** — tables, task lists, strikethrough, fenced
  code blocks, autolinks, callouts.
- **Syntax highlighting** — 200+ languages via Prism's autoloader.
- **Math** — KaTeX, lazy-loaded only when needed.
- **Diagrams** — Mermaid, lazy-loaded only when needed.
- **Table of contents** — auto-generated, scroll-spy highlighting, four
  positions including a floating FAB for narrow widths.
- **Reading progress bar** — fixed-top, configurable on or off.
- **In-document search** — Ctrl/Cmd-F overlay with next/previous navigation.
- **Image lightbox** — click to zoom, escape to close.
- **Live updates** — accepts streaming content via `onDataChanged` from any
  XMPro Data Source.
- **Inter-metablock messaging** — emits `markdown:loaded`,
  `markdown:link-clicked`, `markdown:heading-clicked`, `markdown:scroll-progress`;
  accepts `markdown:set-content`, `markdown:set-theme`, `markdown:set-background`,
  `markdown:update-config`, `markdown:scroll-to`.

## Install

1. Open your XMPro app in **App Designer**.
2. Drag a **Metablock** onto the page.
3. Open the Metablock's **Block Properties**.
4. Upload these three files:
   - `main.html` → Presentation File
   - `main.css` → Styling File
   - `main.js` → Script File
5. Configure **Value Mapping** with at minimum a `content` or `markdown_url` key.
6. Save and launch the page.

No App Files uploads required. All external libraries load from `jsdelivr`.

## Quick configuration

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `content` | string | — | Inline markdown |
| `markdown_url` | string | — | URL to fetch (http/https only) |
| `theme` | enum | `"auto"` | `light`, `dark`, `auto`, `xmpro-light`, `xmpro-dark` |
| `background` | enum | `"solid"` | See full list above |
| `accent_color` | string | — | Any CSS color |
| `font_family` | enum | `"system"` | `system`, `sans`, `serif`, `mono`, `dyslexic` |
| `enable_toc` | bool | `false` | Auto-generated TOC |
| `enable_math` | bool | `false` | Lazy-loads KaTeX when used |
| `enable_diagrams` | bool | `false` | Lazy-loads Mermaid when used |

See `docs/VALUE_MAPPING.md` for the complete reference.

## Inter-metablock messaging

```javascript
// Emit content from a sibling metablock to this viewer
window.parent.postMessage({
    source: 'xmpro-metablock',
    type: 'markdown:set-content',
    data: { content: '# Updated\n\nContent from sibling.' },
    metablockId: MY_ID
}, '*');
```

## Development

```bash
# Local preview with the showcase harness
cd harness
npm install
npm start
# open http://localhost:3000
```

## License

MIT
