# Value Mapping — full reference

Every key the XMPro Markdown Viewer metablock recognizes. All keys are
optional; defaults are shown.

## Content

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `content` | string | `""` | Inline markdown. Overridden by Data Source. |
| `markdown_url` | string | `""` | URL to fetch. Only `http://` and `https://` accepted. Encrypted credentials require XMPro proxy. |
| `frontmatter_display` | bool | `false` | If true, YAML frontmatter renders as a metadata table at the top. |

**Content priority** (highest first):
1. Data Source field `markdown` / `content` / `text` / `body`
2. `content`
3. `markdown_url` (fetched)
4. Empty-state placeholder

## Appearance

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `theme` | enum | `"auto"` | `auto`, `light`, `dark`, `xmpro-light`, `xmpro-dark` |
| `background` | enum | `"solid"` | See [BACKGROUNDS.md](./BACKGROUNDS.md) |
| `background_image_url` | string | `""` | Required when `background="image"` |
| `background_overlay` | 0–1 | `0.55` | Theme color overlay opacity on image background |
| `accent_color` | CSS color | (theme) | Drives links, headings, focus rings — any valid CSS color |

## Typography

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `font_family` | enum | `"system"` | `system`, `sans` (Inter), `serif` (Source Serif), `mono` (JetBrains Mono), `dyslexic` (OpenDyslexic) |
| `font_size` | 0.8–1.5 | `1.0` | Multiplier on 16px base |
| `line_height` | enum | `"normal"` | `tight` (1.35), `normal` (1.65), `relaxed` (1.85) |
| `content_width` | enum | `"medium"` | `narrow` (60ch), `medium` (75ch), `wide` (90ch), `full` (100%) |
| `heading_style` | enum | `"classic"` | `classic`, `modern` (accent bar), `underlined`, `numbered` (auto numbering) |

## Code blocks

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `code_copy_button` | bool | `true` | Renders a copy button + language label header |
| `code_line_numbers` | bool | `false` | Adds line number gutter |
| `code_wrap` | bool | `false` | When false, long lines scroll horizontally |

## Feature toggles

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `enable_toc` | bool | `false` | Auto-generated table of contents |
| `toc_position` | enum | `"right"` | `left`, `right`, `top`, `floating` |
| `enable_math` | bool | `false` | Lazy-loads KaTeX when `$...$` or `$$...$$` appears |
| `enable_diagrams` | bool | `false` | Lazy-loads Mermaid when ```` ```mermaid ```` appears |
| `enable_anchors` | bool | `true` | Hover anchor links on headings |
| `enable_progress_bar` | bool | `false` | Fixed reading progress at top |
| `enable_image_zoom` | bool | `true` | Click image to open lightbox |
| `enable_search` | bool | `true` | Ctrl/Cmd-F in-document search overlay |

## Behaviour

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `animation_level` | enum | `"subtle"` | `none`, `subtle`, `lively`. `prefers-reduced-motion` always wins. |
| `links_target` | enum | `"_blank"` | `_blank`, `_self`, `_top` for external links |
| `auto_scroll_to_anchor` | bool | `true` | On load, scroll to URL hash if present |

## Debug & identity

| Key | Type | Default | Notes |
|-----|------|---------|-------|
| `debug` | bool | `false` | Enable verbose console logging |
| `log_level` | enum | `"warn"` | `trace`, `debug`, `info`, `warn`, `error`, `none` |
| `metablock_id` | string | random | Used in postMessage envelope; set explicitly for inter-metablock coordination |

## postMessage protocol

The metablock exchanges JSON messages with the parent window:

### Emitted (metablock → parent)

| Type | Data shape |
|------|------------|
| `markdown:ready` | `{ metablockId }` — fires once after init |
| `markdown:loaded` | `{ source, wordCount, headings[], hasMath, hasDiagrams }` |
| `markdown:link-clicked` | `{ href, text, internal }` |
| `markdown:heading-clicked` | `{ id, text, level }` |
| `markdown:scroll-progress` | `{ percent }` (throttled to 200ms when `enable_progress_bar`) |

### Accepted (parent → metablock)

| Type | Data shape |
|------|------------|
| `markdown:set-content` | `{ content: string }` |
| `markdown:set-theme` | `{ theme: string }` |
| `markdown:set-background` | `{ background, background_image_url?, background_overlay? }` |
| `markdown:update-config` | `{ ...any subset of config keys }` |
| `markdown:scroll-to` | `{ anchor }` or `{ percent }` |

All messages use the envelope:

```javascript
{
    source: 'xmpro-metablock' | 'xmpro-harness',
    type: '...',
    data: { ... },
    timestamp: '2026-05-22T10:30:00.000Z',
    metablockId: '...'
}
```

Messages whose `metablockId` matches the viewer's own ID are ignored to prevent echo loops.
